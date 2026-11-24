// Run with Playwright available on NODE_PATH; no dependency is needed by Lumo itself.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const servers = [];
async function server(port) {
  const child = spawn(process.env.LUMO_PYTHON || 'python', [path.join(root, 'editor-v2/dev/start_editor.py'), '--no-browser', '--port', String(port)], { cwd: process.env.TEMP || root });
  servers.push(child);
  child.stderr.resume();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server readiness timeout')), 10000);
    child.once('error', reject);
    child.stdout.on('data', data => {
      const match = data.toString().match(/ready: (http:\/\/[^/]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.once('exit', code => { if (code) reject(Error(`Server exited ${code}`)); });
  });
}
async function check(name, body) { await body(); passed++; console.log(`PASS ${name}`); }
async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.LUMO_CHROME ? { executablePath: process.env.LUMO_CHROME } : {}) });
  try {
    const { mockLevelDocument } = await import(pathToFileURL(path.join(root, 'editor-v2/src/data/mockLevelDocument.js')));
    const context = await browser.newContext();
    await context.addInitScript(() => {

      let current;
      Object.defineProperty(window, '__LumoRechargedBoot', {
        configurable: true, get() { return current; }, set(value) {
          if (!window.__initialBoot && value?.booted) window.__initialBoot = { worldId: value.worldId, x: value.playerX, y: value.playerY };
          current = value;
        },
      });
    });
    // Capture the real store for data comparisons; all import/launch actions use the real UI.
    await context.route('**/editor-v2/src/main.js', async route => {
      const response = await route.fetch();
      const source = (await response.text()).replace('const store = createStore(createEditorState());', 'const store = createStore(createEditorState()); window.__testStore = store;');
      await route.fulfill({ response, body: source });
    });
    for (const port of [4173, 3000, 8080]) {
      const origin = await server(port);
      assert.equal(new URL(origin).port, String(port), 'required test port must be available');
      for (const host of ['127.0.0.1', 'localhost']) {
        const base = origin.replace('127.0.0.1', host);
        const editor = await context.newPage();
        await editor.goto(`${base}/editor-v2/`);
        await editor.waitForFunction(() => !!window.__testStore);
        await check(`real editor/runtime ${host}:${port}`, async () => {
          const popupPromise = editor.waitForEvent('popup');
          await editor.locator('[data-topbar-action="play-from-here"]').click();
          const runtime = await popupPromise;
          await runtime.waitForFunction(() => window.__LumoRechargedBoot?.booted === true);
          assert.equal(new URL(runtime.url()).origin, base);
          await editor.waitForFunction(() => document.getElementById('topBarStatus').textContent.includes('Runtime ready'));
          await runtime.close();
        });
        if (port !== 4173 || host !== '127.0.0.1') { await editor.close(); continue; }
        const importDoc = async doc => {
          const chooser = editor.waitForEvent('filechooser');
          await editor.locator('[data-topbar-action="import"]').click();
          await (await chooser).setFiles({ name: `${doc.meta.id}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
          await editor.waitForFunction(id => window.__testStore.getState().document.active.meta.id === id, doc.meta.id);
        };
        const play = async () => {
          const before = await editor.evaluate(() => JSON.stringify(window.__testStore.getState().document.active));
          const popup = editor.waitForEvent('popup');
          await editor.locator('[data-topbar-action="play-from-here"]').click();
          const runtime = await popup;
          await runtime.waitForFunction(() => window.__LumoRechargedBoot?.booted === true);
          await editor.waitForFunction(() => document.getElementById('topBarStatus').textContent.includes('Runtime ready'));
          const data = await runtime.evaluate(async () => ({
            raw: await (await fetch(new URLSearchParams(location.search).get('level'))).json(),
            boot: window.__initialBoot,
            world: window.__LumoRechargedBoot.adapter.getWorldSnapshot(),
            payload: window.__LumoRechargedBoot.adapter.getBootPayload(),
          }));
          assert.equal(await editor.evaluate(() => JSON.stringify(window.__testStore.getState().document.active)), before);
          return { runtime, data };
        };
        let A = structuredClone(mockLevelDocument);
        A.meta.id = 'browser-A'; A.meta.name = 'Very different A'; A.world = { spawn: { x: 2, y: 3 } };
        await check('import A and verify actual runtime identity and authored player spawn', async () => {
          await importDoc(A);
          const {runtime,data} = await play();
          assert.equal(data.boot.worldId, 'browser-A');
          assert.deepEqual([data.boot.x,data.boot.y],[48,72]);
          await runtime.close();
        });
        let B = structuredClone(A); B.meta.id = 'browser-B'; B.meta.name = 'Entirely different B';
        B.dimensions.width = 55; B.tiles.base = Array(55 * B.dimensions.height).fill(0);
        B.tiles.base[110] = 12;
        await check('import B without closing editor; stale valid session cannot win', async () => {
          await editor.evaluate(A => sessionStorage.setItem('lumo.editorPlay.level.v1',JSON.stringify(A)), A);
          await importDoc(B);
          const {runtime,data} = await play();
          assert.equal(data.boot.worldId, 'browser-B');
          assert.equal(data.world.width, 55);
          await runtime.close();
        });
        await check('unsaved UI edit reaches snapshot and runtime; original document remains intact', async () => {
          await editor.locator('[data-topbar-menu-toggle="export"]').click();
          await editor.locator('input[data-export-meta-field="name"]').fill('Unsaved browser B');
          await editor.locator('input[data-export-meta-field="name"]').dispatchEvent('change');
          await editor.locator('[data-topbar-menu-toggle="export"]').click();
          const {runtime,data} = await play();
          assert.equal(data.raw.meta.name,'Unsaved browser B');
          await runtime.close();
        });
        await check('selected cell reaches actual boot player position', async () => {
          await editor.evaluate(() => window.__testStore.setState(s => {s.interaction.selectedCell={x:9,y:4};}));
          const {runtime,data} = await play();
          assert.deepEqual([data.boot.x,data.boot.y],[216,96]);
          await runtime.close();
        });
        await check('invalid selected cell falls back to authored spawn', async () => {
          for(const cell of [{x:-1,y:4},{x:55,y:4},{x:1.5,y:4},{x:null,y:4}]) {
            await editor.evaluate(cell => window.__testStore.setState(s => {s.interaction.selectedCell=cell;}),cell);
            const {runtime,data} = await play();
            assert.deepEqual([data.boot.x,data.boot.y],[48,72],JSON.stringify(cell));
            await runtime.close();
          }
        });
        await check('boundary cells use their exact grid-to-pixel spawn',async()=>{
          for(const cell of [{x:0,y:0},{x:54,y:21}]) {
            await editor.evaluate(cell=>window.__testStore.setState(s=>{s.interaction.selectedCell=cell;}),cell);
            const {runtime,data}=await play();
            assert.deepEqual([data.boot.x,data.boot.y],[cell.x*24,cell.y*24]);
            await runtime.close();
          }
        });
        await check('spawn next to collision preserves authored collision and existing physics',async()=>{
          const nearby=structuredClone(B);nearby.meta.id='near-collision';
          for(let x=0;x<55;x++)nearby.tiles.base[10*55+x]=12;
          await importDoc(nearby);
          await editor.evaluate(()=>window.__testStore.setState(s=>{s.interaction.selectedCell={x:4,y:9};}));
          const {runtime,data}=await play();
          assert.deepEqual([data.boot.x,data.boot.y],[96,216]);
          assert.equal(data.raw.tiles.base[10*55+4],12);
          assert.ok(data.world.supportTiles.some(t=>t.tileId===12));
          await runtime.close();await importDoc(B);
        });
        await check('popup blocked preserves editor location and unsaved document', async () => {
          const before=await editor.evaluate(()=>JSON.stringify(window.__testStore.getState().document.active));
          await editor.evaluate(()=>{window.__realOpen=window.open;window.open=()=>null;});
          await editor.locator('[data-topbar-action="play-from-here"]').click();
          assert.match(await editor.locator('#topBarStatus').innerText(),/popup blocked/i);
          assert.equal(await editor.evaluate(()=>JSON.stringify(window.__testStore.getState().document.active)),before);
          assert.equal(editor.url(),`${base}/editor-v2/`);
          await editor.evaluate(()=>{window.open=window.__realOpen;});
        });
        await check('large document bypasses storage quota without truncation', async () => {
          const large=structuredClone(B); large.meta.id='large-document'; large.extra=[{payload:'x'.repeat(7*1024*1024)}];
          large.dimensions={width:1024,height:64,tileSize:24};large.tiles.base=Array(1024*64).fill(0);large.tiles.base[65535]=12;
          await importDoc(large);
          await editor.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
          const {runtime,data}=await play();
          assert.equal(data.raw.extra[0].payload.length,7*1024*1024);
          assert.equal(data.raw.tiles.base.length,65536);assert.equal(data.raw.tiles.base[65535],12);
          assert.equal(data.world.width,1024);assert.equal(data.world.height,64);
          assert.equal(data.boot.worldId,'large-document');
          await runtime.close();
        });
        await check('every supported layer and area survives the same full snapshot', async () => {
          const full=JSON.parse(fs.readFileSync(path.join(root,'editor-v2/src/data/level-all.json'),'utf8'));
          full.meta.id='all-layers-browser'; full.world={spawn:{x:2,y:2}};
          for(const key of ['mirrorSurfaceAreas','stoneAreas','dustAreas','glowAreas','smokeAreas','waterDropAreas']) full[key]=[{id:`browser-${key}`,x:48,y:120,width:96,height:48,enabled:true,visible:true}];
          await importDoc(full);
          const expected=await editor.evaluate(()=>JSON.parse(JSON.stringify(window.__testStore.getState().document.active)));
          const {runtime,data}=await play();
          const {editorPlay,...snapshot}=data.raw;
          assert.deepEqual(snapshot,expected,'all authored fields, params and reactive patches survive unchanged');
          assert.equal(data.boot.worldId,'all-layers-browser');
          for(const key of ['mirrorSurfaceAreas','stoneAreas','dustAreas','glowAreas','smokeAreas','waterDropAreas']) assert.equal(data.world[key][0]?.id,`browser-${key}`,key);
          assert.ok(data.world.supportTiles.length>0);
          assert.ok(data.world.decorItems.length>0);
          assert.ok(data.world.audioItems.length>0);
          for(const type of ['checkpoint','flare_pickup_01','dark_creature_01','fog_volume','water_volume','lava_volume','lantern_01']) assert.ok(data.raw.entities.some(e=>e.type===type),type);
          for(const key of ['reactiveGrassPatches','reactiveBloomPatches','reactiveCrystalPatches']) assert.ok(data.raw[key].length>0,key);
          const live=await runtime.evaluate(()=>window.__LumoRechargedBoot.adapter.getPlayerSnapshot().entities);
          assert.ok(live.some(e=>e.type==='dark_creature_01'));
          assert.deepEqual(live.find(e=>e.type==='dark_creature_01').params,expected.entities.find(e=>e.type==='dark_creature_01').params);
          await runtime.close();
        });
        await check('two overlapping launches retain separate identities and latest editor status', async()=>{
          await importDoc(A);
          const old=await play();
          await importDoc(B);
          const current=await play();
          assert.notEqual(new URL(old.runtime.url()).searchParams.get('editorPlay'),new URL(current.runtime.url()).searchParams.get('editorPlay'));
          await old.runtime.evaluate(()=>window.opener.postMessage({type:'lumo.editorPlay.status.v1',launchId:new URLSearchParams(location.search).get('editorPlay'),status:'failed',details:{error:'Old window'}},location.origin));
          await editor.waitForTimeout(50);
          assert.match(await editor.locator('#topBarStatus').innerText(),/Runtime ready/);
          assert.equal(current.data.boot.worldId,'browser-B');
          await old.runtime.close();await current.runtime.close();
        });
        for(const [name,query] of [['missing snapshot','editorPlay=missing'],['unavailable snapshot','editorPlay=bad&level=/missing-snapshot.json'],['invalid protocol','editorPlay=bad&level=javascript:alert(1)'],['empty launch ID','editorPlay=&level=/missing-snapshot.json']]) {
          await check(`${name} displays error and never loads legacy or debug level`,async()=>{
            const runtime=await context.newPage();
            await runtime.goto(`${base}/Lumo.html?recharged=1&${query}`);
            await runtime.locator('[role="alert"]').waitFor();
            assert.equal(await runtime.evaluate(()=>window.__LumoRechargedBoot.booted),false);
            assert.equal(await runtime.locator('script[src="src/app.js"]').count(),0);
            await runtime.close();
          });
        }
        await check('corrupt snapshot and mismatched launch fail without fallback',async()=>{
          for(const contents of ['{bad JSON',JSON.stringify({...A,editorPlay:{launchId:'different'}})]) {
            const url=await editor.evaluate(text=>URL.createObjectURL(new Blob([text],{type:'application/json'})),contents);
            const runtime=await context.newPage();
            await runtime.goto(`${base}/Lumo.html?recharged=1&editorPlay=current&level=${encodeURIComponent(url)}`);
            await runtime.locator('[role="alert"]').waitFor();
            assert.equal(await runtime.locator('script[src="src/app.js"]').count(),0);
            await runtime.close();await editor.evaluate(url=>URL.revokeObjectURL(url),url);
          }
        });
        await check('ordinary legacy game startup remains available',async()=>{
          const runtime=await context.newPage();await runtime.goto(`${base}/Lumo.html`);
          await runtime.waitForFunction(()=>!!document.querySelector('script[src="src/app.js"]'));
          assert.equal(await runtime.evaluate(()=>window.__LumoRechargedBoot.enabled),false);
          await runtime.close();
        });
        await check('explicit ordinary level URL and actual next-level loader ignore stale storage',async()=>{
          const runtime=await context.newPage();
          await runtime.addInitScript(()=>sessionStorage.setItem('lumo.editorPlay.level.v1',JSON.stringify({stale:true})));
          await runtime.goto(`${base}/Lumo.html?recharged=1&level=editor-v2/src/data/testLevelDocument.v1.json`);
          await runtime.waitForFunction(()=>window.__LumoRechargedBoot?.booted);
          assert.equal(await runtime.evaluate(()=>window.__LumoRechargedBoot.levelSourceType),'url');
          const next=await runtime.evaluate(async()=>{
            const {loadNextRechargedLevelFromIntermission}=await import('./editor-v2/src/runtime/rechargedIntermissionNextLevelFlow.js');
            const {bootLumoRechargedFromQuery}=await import('./editor-v2/src/runtime/bootLumoRechargedFromQuery.js');
            return loadNextRechargedLevelFromIntermission({currentLevelPath:'editor-v2/src/data/testLevelDocument.v1.json',bootFromQuery:bootLumoRechargedFromQuery});
          });
          assert.equal(next.ok,true);assert.equal(next.bootResult.levelSourceType,'url');
          await runtime.close();
        });
        await editor.close();
      }
    }
    await context.close();
  } finally { await browser.close(); for (const child of servers) child.kill(); }
  console.log(`Browser tests: ${passed} passed, 0 failed`);
}
main().catch(error => {console.error(error); console.error(`Browser tests: ${passed} passed, 1 failed`); for(const child of servers) child.kill(); process.exitCode=1;});
