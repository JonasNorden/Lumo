import assert from 'node:assert/strict';
import test from 'node:test';
import { launchEditorPlayRuntime } from '../src/runtime/editorPlaySessionBridge.js';
import { bootLumoRechargedFromQuery } from '../src/runtime/bootLumoRechargedFromQuery.js';
import { EDITOR_PLAY_MESSAGE } from '../src/runtime/editorPlaySessionBridge.js';

const doc = () => ({meta:{id:'fresh-B',name:'Unsaved B',themeId:'test',version:'2.0.0'},dimensions:{width:20,height:12,tileSize:24},tiles:{base:Array(240).fill(0)},entities:[],world:{spawn:{x:2,y:3}},custom:{keep:['all',42]}});
test('HTTPS editor retains protocol, hostname, port and installation prefix',()=>{
  const launch=launchEditorPlayRuntime({levelDocument:doc(),editorUrl:'https://localhost:8443/installed/Lumo/editor-v2/',openFn:()=>({closed:false})});
  try {const url=new URL(launch.url);assert.equal(url.origin,'https://localhost:8443');assert.equal(url.pathname,'/installed/Lumo/Lumo.html');}
  finally {launch.dispose();}
});
for (const hostname of ['localhost','127.0.0.1']) {
  for (const port of [3000,4173,8080]) {
    test(`runtime retains ${hostname}:${port} and installation subfolder`, () => {
      let opened;
      const launch = launchEditorPlayRuntime({levelDocument:doc(),runtimeLevel:{},editorUrl:`http://${hostname}:${port}/games/Lumo/editor-v2/index.html`,openFn:url=>(opened=url,{closed:false}),sessionStorageRef:{setItem(){throw Error('quota');}}});
      const url = new URL(opened);
      assert.equal(url.origin,`http://${hostname}:${port}`);
      assert.equal(url.pathname,'/games/Lumo/Lumo.html');
      assert.ok(url.searchParams.get('editorPlay'));
      launch.dispose();
    });
  }
}
test('snapshot preserves unsaved fields and overrides spawn without mutating original',async()=>{
  const original=doc(), before=structuredClone(original);
  const launch=launchEditorPlayRuntime({levelDocument:original,runtimeLevel:{},spawnOverride:{x:7,y:8},editorUrl:'http://localhost:4173/editor-v2/',openFn:()=>({closed:false}),sessionStorageRef:{setItem(){}}});
  const snapshot=await (await fetch(new URL(launch.url).searchParams.get('level'))).json();
  assert.deepEqual(snapshot.custom,{keep:['all',42]});
  assert.deepEqual(snapshot.world.spawn,{x:7,y:8});
  assert.equal(snapshot.editorPlay.launchId,launch.launchId);
  assert.deepEqual(original,before);
  launch.dispose();
});
test('blocked popup fails without navigating away',()=>{
  assert.throws(()=>launchEditorPlayRuntime({levelDocument:doc(),runtimeLevel:{},editorUrl:'http://localhost:4173/editor-v2/',openFn:()=>null,sessionStorageRef:{setItem(){}}}),/popup/i);
});
test('explicit level URL beats stale session storage',async()=>{
  let source;
  const result=await bootLumoRechargedFromQuery({search:'?recharged=1&level=http://localhost/B.json',sessionStorageRef:{getItem(){return JSON.stringify({identity:{id:'stale',name:'Stale A',themeId:'test',formatVersion:'1.0.0'},world:{width:20,height:12,tileSize:24,spawn:{x:24,y:24}},layers:{tiles:[],background:[],decor:[],entities:[]}});}},loadLevelDocument:async descriptor=>{source=descriptor.url;return {levelDocument:{}};},createAdapter:options=>({async prepare(){await options.loadLevelDocument(options.sourceDescriptor);return {ok:true};},async boot(){return {ok:true,booted:true};},getBootPayload(){return {};}})});
  assert.equal(source,'http://localhost/B.json');
  assert.equal(result.levelSourceType,'url');
});
test('missing explicit editor snapshot fails closed',async()=>{
  const result=await bootLumoRechargedFromQuery({search:'?recharged=1&editorPlay=missing'});
  assert.equal(result.ok,false);
  assert.equal(result.booted,false);
  assert.match(result.errors.join(' '),/snapshot/i);
});
test('invalid editor URL diagnostics never promise a fallback',async()=>{
  const result=await bootLumoRechargedFromQuery({search:'?editorPlay=broken&level=javascript:alert(1)'});
  assert.equal(result.ok,false);
  assert.equal(result.levelSourceType,'editor-snapshot');
  assert.doesNotMatch(result.warnings.join(' '),/fallback/i);
});
test('a snapshot from a different launch fails with the actual identity error',async()=>{
  const blob=URL.createObjectURL(new Blob([JSON.stringify({...doc(),editorPlay:{launchId:'old'}})]));
  try {
    const result=await bootLumoRechargedFromQuery({search:`?recharged=1&editorPlay=new&level=${encodeURIComponent(blob)}`});
    assert.equal(result.ok,false);
    assert.match(result.errors.join(' '),/identity mismatch/i);
  } finally { URL.revokeObjectURL(blob); }
});
for (const spawn of [null,{x:-1,y:2},{x:20,y:2},{x:1.5,y:2},{x:null,y:2},{x:NaN,y:2}]) {
  test(`invalid spawn ${JSON.stringify(spawn)} retains authored spawn`,async()=>{
    const launch=launchEditorPlayRuntime({levelDocument:doc(),spawnOverride:spawn,editorUrl:'http://localhost:4173/editor-v2/',openFn:()=>({closed:false})});
    try { const raw=await (await fetch(new URL(launch.url).searchParams.get('level'))).json(); assert.deepEqual(raw.world.spawn,{x:2,y:3}); }
    finally {launch.dispose();}
  });
}
test('status messages require source, origin and launch identity; failures include runtime error',()=>{
  const events=new EventTarget(), win={closed:false}, statuses=[];
  const launch=launchEditorPlayRuntime({levelDocument:doc(),editorUrl:'http://localhost:4173/editor-v2/',openFn:()=>win,eventTarget:events,onStatus:e=>statuses.push(e)});
  const send=(override={})=>{
    const event=new Event('message');
    Object.assign(event,{origin:'http://localhost:4173',source:win,data:{type:EDITOR_PLAY_MESSAGE,launchId:launch.launchId,status:'opened'},...override});
    events.dispatchEvent(event);
  };
  send({origin:'http://evil.test'});send({source:{}});send({data:{type:EDITOR_PLAY_MESSAGE,launchId:'old',status:'ready'}});
  assert.deepEqual(statuses.map(e=>e.status),['launching']);
  send();send({data:{type:EDITOR_PLAY_MESSAGE,launchId:launch.launchId,status:'loaded'}});
  send({data:{type:EDITOR_PLAY_MESSAGE,launchId:launch.launchId,status:'failed',details:{error:'Corrupt snapshot'}}});
  assert.deepEqual(statuses.map(e=>e.status),['launching','opened','loaded','failed']);
  assert.equal(statuses.at(-1).error,'Corrupt snapshot');
});
test('launch timeout reports failure and revokes snapshot',async()=>{
  const statuses=[];
  const launch=launchEditorPlayRuntime({levelDocument:doc(),editorUrl:'http://localhost:4173/editor-v2/',openFn:()=>({closed:false}),onStatus:e=>statuses.push(e),timeoutMs:10});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(statuses.at(-1).status,'failed');
  await assert.rejects(fetch(new URL(launch.url).searchParams.get('level')));
});
