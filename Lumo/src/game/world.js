(() => {
  window.Lumo = window.Lumo || {};

  class World {
    constructor(){
      this.tileSize = 24;

      this.w = 0;   // tiles
      this.h = 0;   // tiles
      this.pxW = 0; // pixels
      this.pxH = 0; // pixels

      this.layers = { main: [] };
      this.tileVisualOverrides = {};

      // Background layer (grid of ids)
      this.bg = [];
      this._bgDefMap = null;
      this._bgImg = new Map();
      this._pfhBackgroundDiag = {
        loadLogged: false,
        drawLogged: false,
      };

      // --- Tile visuals (catalog-driven PNG rendering) ---
      this._tileDefById = null;      // tileId -> catalog def
      this._tileImg = new Map();     // tileId -> Image
      this._tileDefByCatalogId = null;
      this._behaviorProfileById = null; // behaviorProfileId -> profile def

      // Tile defs (id -> properties)
      const fallback = {
        0: { solid:false, oneWay:false, hazard:false, color:null },
        1: { solid:true,  oneWay:false, hazard:false, color:"#2b3646" },
        2: { solid:true,  oneWay:true,  hazard:false, color:"#44586f" },
        3: { solid:true,  oneWay:false, hazard:true,  color:"#8b1d1d" },
        4: { solid:true,  oneWay:false, hazard:false, color:"#274a66", groundAccelMul:0.85, groundFrictionMul:0.12, maxSpeedMul:1.25 },
        5: { solid:true,  oneWay:false, hazard:false, color:"#4a372c", groundAccelMul:1.00, groundFrictionMul:3.00, maxSpeedMul:0.80 },
      };

      this.tileDefs = (window.Lumo && Lumo.Tileset) ? Lumo.Tileset : fallback;
    }

    _tryLoadImage(src){
      try{
        const img = new Image();
        img.src = src;
        img._ok = false;
        img.onload = () => {
          img._ok = true;
          this._visualAssetEpoch = (this._visualAssetEpoch|0) + 1;
        };
        img.onerror = () => { img._ok = false; };
        return img;
      }catch(_){
        return null;
      }
    }

    _ensureTileCatalog(){
      if (this._tileDefById) return;

      this._tileDefById = new Map();
      this._tileDefByCatalogId = new Map();

      const cat = window.LUMO_CATALOG_TILES;
      if (!Array.isArray(cat) || !cat.length) return;

      for (const d of cat){
        if (!d) continue;
        const tid = (d.tileId|0);
        if (!tid) continue;
        this._tileDefById.set(tid, d);
        if (d.id != null) this._tileDefByCatalogId.set(String(d.id), d);

        if (d.img && !this._tileImg.has(tid)){
          const img = this._tryLoadImage(d.img);
          if (img){
            this._tileImg.set(tid, img);
            this._tileImg.set(d.img, img);
          }
        }
      }
    }

    _ensureBehaviorProfiles(){
      if (this._behaviorProfileById) return;

      this._behaviorProfileById = new Map();
      const profiles = window.LUMO_TILE_BEHAVIOR_PROFILES;
      if (!Array.isArray(profiles) || !profiles.length) return;

      for (const p of profiles){
        if (!p || !p.id) continue;
        this._behaviorProfileById.set(p.id, p);
      }
    }

    _getLegacyTileBehavior(id){
      const defs = (window.Lumo && Lumo.Tileset) ? Lumo.Tileset : this.tileDefs;
      return defs[id] || defs[1] || this.tileDefs[1];
    }

    resolveTileBehaviorById(id){
      const tileId = id | 0;
      const legacy = this._getLegacyTileBehavior(tileId);

      // Migration-safe bridge: honor additive behaviorProfileId metadata when present,
      // while keeping tileId/Tileset behavior as the compatibility fallback.
      this._ensureTileCatalog();
      this._ensureBehaviorProfiles();

      const tileMeta = this._tileDefById ? this._tileDefById.get(tileId) : null;
      const behaviorProfileId = tileMeta && tileMeta.behaviorProfileId;
      if (!behaviorProfileId || !this._behaviorProfileById) return legacy;

      const profile = this._behaviorProfileById.get(behaviorProfileId);
      if (!profile) return legacy;

      let profileBase = null;
      if (profile.collisionType === "solid"){
        profileBase = (profile.special === "ice")
          ? this._getLegacyTileBehavior(4)
          : this._getLegacyTileBehavior(1);
      } else if (profile.collisionType === "oneWay"){
        profileBase = this._getLegacyTileBehavior(2);
      } else if (profile.collisionType === "hazard"){
        profileBase = this._getLegacyTileBehavior(3);
      }

      if (!profileBase) return legacy;
      return Object.assign({}, legacy, profileBase);
    }

    getTileBehavior(tx, ty){
      const id = this.getTile(tx, ty) | 0;
      if (!id) return null;
      return this.resolveTileBehaviorById(id);
    }

    loadLevel(levelObj){
      const meta = levelObj && levelObj.meta ? levelObj.meta : {};
      const levelLabel = ((meta.id || "(no-id)") + (meta.name ? `:${meta.name}` : ""));
      this.tileSize = meta.tileSize || 24;

      const layers = levelObj && levelObj.layers ? levelObj.layers : {};
      const mainLayer = layers.main;

      let data = null;
      if (Array.isArray(mainLayer)) data = mainLayer;
      else if (mainLayer && Array.isArray(mainLayer.data)) data = mainLayer.data;
      else if (mainLayer && Array.isArray(mainLayer.tiles)) data = mainLayer.tiles;

      const w = (meta.w || (mainLayer && mainLayer.w) || 0) | 0;
      const h = (meta.h || (mainLayer && mainLayer.h) || 0) | 0;

      let W = w, H = h;
      let guessedDims = false;
      let usedSqrtFallback = false;
      if ((!W || !H) && Array.isArray(data) && data.length){
        guessedDims = true;
        W = meta.width ? (meta.width|0) : 500;
        H = Math.max(1, Math.floor(data.length / W));
        if (H * W !== data.length){
          const s = Math.floor(Math.sqrt(data.length));
          W = Math.max(1, s);
          H = Math.max(1, Math.floor(data.length / W));
          usedSqrtFallback = true;
        }
      }

      // First-pass runtime contract diagnostics only: keep legacy fallbacks, add load-time visibility.
      if (guessedDims){
        console.warn(`[Lumo][contract] Level ${levelLabel}: missing/invalid width/height, guessed ${W}x${H}.`);
      }
      if (usedSqrtFallback){
        console.warn(`[Lumo][contract] Level ${levelLabel}: tile data length ${data.length} does not fit guessed dimensions cleanly.`);
      }

      this.w = W || 0;
      this.h = H || 0;
      this.pxW = this.w * this.tileSize;
      this.pxH = this.h * this.tileSize;

      if (!Array.isArray(data)){
        data = new Array(this.w * this.h).fill(0);
      } else {
        const need = this.w * this.h;
        if (data.length < need){
          console.warn(`[Lumo][contract] Level ${levelLabel}: main layer shorter than ${need} (${data.length}); padding with 0.`);
          data = data.concat(new Array(need - data.length).fill(0));
        }
        else if (data.length > need){
          console.warn(`[Lumo][contract] Level ${levelLabel}: main layer longer than ${need} (${data.length}); truncating extras.`);
          data = data.slice(0, need);
        }
        else data = data.slice(0);
      }
      this.layers.main = data;
      this.tileVisualOverrides = (layers && layers.tileVisualOverrides && typeof layers.tileVisualOverrides === "object")
        ? Object.assign({}, layers.tileVisualOverrides)
        : {};

      // --- BG layer: exported from LumoEditor -> levelObj.editor.bg ---
      const needBG = this.w * this.h;
      let bg = null;
      if (layers && Array.isArray(layers.bg)) bg = layers.bg; // optional alt format
      else if (levelObj && levelObj.editor && Array.isArray(levelObj.editor.bg)) bg = levelObj.editor.bg;

      if (!Array.isArray(bg)) bg = new Array(needBG).fill(null);
      if (bg.length < needBG) bg = bg.concat(new Array(needBG - bg.length).fill(null));
      if (bg.length > needBG) bg = bg.slice(0, needBG);

      this.bg = bg;
      this._bgDefMap = null;
      this._pfhBackgroundDiag = {
        loadLogged: false,
        drawLogged: false,
      };
      const backgroundUniqueIds = new Set();
      let paintedCells = 0;
      for (const cell of bg){
        if (!cell) continue;
        paintedCells += 1;
        backgroundUniqueIds.add(String(cell));
      }
      console.info("[PFH background] runtime load received background layer", {
        levelId: meta.id || "(no-id)",
        levelName: meta.name || "(untitled)",
        expectedCells: needBG,
        receivedCells: bg.length,
        paintedCells,
        uniqueIds: Array.from(backgroundUniqueIds).slice(0, 20),
      });

      // Reset tile catalog mapping between levels
      this._tileDefById = null;
      this._tileDefByCatalogId = null;
      this._ensureTileCatalog();
    }

    _getTileVisualOverrideAt(tx, ty){
      if (!this.tileVisualOverrides || typeof this.tileVisualOverrides !== "object") return null;
      return this.tileVisualOverrides[`${tx|0},${ty|0}`] || null;
    }

    _getTileFootprintAt(tx, ty, id){
      const override = this._getTileVisualOverrideAt(tx, ty);
      const overrideW = override && Number.isFinite(Number(override.footprintW)) ? (Number(override.footprintW) | 0) : null;
      const overrideH = override && Number.isFinite(Number(override.footprintH)) ? (Number(override.footprintH) | 0) : null;

      if (overrideW && overrideH && overrideW > 0 && overrideH > 0){
        return { w: overrideW, h: overrideH };
      }

      this._ensureTileCatalog();
      const d = this._tileDefById ? this._tileDefById.get(id|0) : null;
      const fp = d && d.footprint ? d.footprint : null;
      const w = fp && fp.w ? (fp.w|0) : 1;
      const h = fp && fp.h ? (fp.h|0) : 1;
      return {
        w: Math.max(1, w),
        h: Math.max(1, h),
      };
    }

    // Runtime collision must follow authored placement size truth.
    // Collision intentionally defaults to 1x1 unless an authored override says otherwise.
    // (Visuals may still use catalog footprint metadata as a compatibility fallback.)
    _getCollisionFootprintAt(tx, ty, id){
      const override = this._getTileVisualOverrideAt(tx, ty);
      const overrideW = override && Number.isFinite(Number(override.footprintW)) ? (Number(override.footprintW) | 0) : null;
      const overrideH = override && Number.isFinite(Number(override.footprintH)) ? (Number(override.footprintH) | 0) : null;

      if (overrideW && overrideH && overrideW > 0 && overrideH > 0){
        return { w: overrideW, h: overrideH };
      }

      return { w: 1, h: 1 };
    }

    getTile(tx, ty){
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 0;
      return this.layers.main[ty * this.w + tx] | 0;
    }

    // For "big tiles" (e.g., 48×48 drawn from a single 24×24 anchor cell),
    // find a tile that COVERS the requested cell. This lets collision work even when the
    // anchor is adjacent (right/top cells inside the footprint).
    _getCoveringTile(tx, ty){
      // Fast path: direct cell
      const directId = this.getTile(tx, ty) | 0;
      if (directId){
        return { id: directId, ax: tx, ay: ty };
      }

      // Search a small neighborhood for anchors that might cover (tx,ty).
      // Typical footprints are 2×2; this window keeps things cheap and robust.
      this._ensureTileCatalog();

      const maxLook = 3; // covers up to 4×4 footprints safely
      for (let ay = ty; ay <= ty + maxLook; ay++){
        for (let ax = tx - maxLook; ax <= tx; ax++){
          const id = this.getTile(ax, ay) | 0;
          if (!id) continue;

          const footprint = this._getCollisionFootprintAt(ax, ay, id);
          const fw = footprint.w|0;
          const fh = footprint.h|0;

          if (fw <= 1 && fh <= 1) continue;

          // Anchor for tiles is BL in this project’s tile catalog.
          // Coverage in tile coords:
          //   x: [ax .. ax+fw-1]
          //   y: [ay-fh+1 .. ay]
          const x0 = ax;
          const x1 = ax + fw - 1;
          const y0 = ay - fh + 1;
          const y1 = ay;

          if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1){
            return { id, ax, ay };
          }
        }
      }
      return null;
    }

    queryTiles(px, py, pw, ph){
      const ts = this.tileSize;

      const x0 = Math.floor(px / ts);
      const y0 = Math.floor(py / ts);
      const x1 = Math.floor((px + pw - 1) / ts);
      const y1 = Math.floor((py + ph - 1) / ts);

      const out = [];
      const seen = new Set();

      // Collect unique colliders (dedupe by anchor)
      for (let ty = y0; ty <= y1; ty++){
        for (let tx = x0; tx <= x1; tx++){
          const hit = this._getCoveringTile(tx, ty);
          if (!hit) continue;

          const key = `${hit.id}:${hit.ax},${hit.ay}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const id = hit.id | 0;

          const def = this.resolveTileBehaviorById(id);

          // Default collider is 1×1 tile (24×24)
          let w = ts, h = ts, x = hit.ax * ts, y = hit.ay * ts;

          // If the tile is a "big tile", expand collider to its footprint (BL anchored)
          const footprint = this._getCollisionFootprintAt(hit.ax, hit.ay, id);
          const fw = footprint.w|0;
          const fh = footprint.h|0;

          if (fw > 1 || fh > 1){
            w = fw * ts;
            h = fh * ts;
            // BL anchor: top-left is one footprint-height above the anchor row
            x = hit.ax * ts;
            y = (hit.ay - fh + 1) * ts;
          }

          out.push({ id, def, x, y, w, h, tx: hit.ax, ty: hit.ay });
        }
      }
      return out;
    }

    collideRect(px, py, pw, ph){
      const tiles = this.queryTiles(px, py, pw, ph);
      let best = { hit:false, nx:0, ny:0, depth:0 };

      for (const t of tiles){
        if (!t || !t.def || !t.def.solid) continue;

        const ax0 = px, ay0 = py, ax1 = px + pw, ay1 = py + ph;
        const bx0 = t.x, by0 = t.y, bx1 = t.x + t.w, by1 = t.y + t.h;

        const ox = Math.min(ax1, bx1) - Math.max(ax0, bx0);
        const oy = Math.min(ay1, by1) - Math.max(ay0, by0);
        if (ox <= 0 || oy <= 0) continue;

        if (!best.hit || Math.min(ox, oy) < best.depth){
          best.hit = true;

          if (ox < oy){
            const aCenter = (ax0 + ax1) * 0.5;
            const bCenter = (bx0 + bx1) * 0.5;
            best.nx = (aCenter < bCenter) ? -1 : 1;
            best.ny = 0;
            best.depth = ox;
          } else {
            const aCenter = (ay0 + ay1) * 0.5;
            const bCenter = (by0 + by1) * 0.5;
            best.nx = 0;
            best.ny = (aCenter < bCenter) ? -1 : 1;
            best.depth = oy;
          }
        }
      }

      return best;
    }

    // ✅ RESTORED BG behavior: uses catalog_bg.js schema (w/h/anchor)
    _drawBG(ctx, cam, x0, y0, x1, y1){
      if (!this.bg || !this.bg.length) return;
      const cat = window.LUMO_CATALOG_BG;
      if (!Array.isArray(cat) || !cat.length){
        if (!this._pfhBackgroundDiag?.drawLogged){
          console.warn("[PFH background] draw skipped: runtime catalog_bg is unavailable/empty.");
          this._pfhBackgroundDiag.drawLogged = true;
        }
        return;
      }

      if (!this._bgDefMap){
        this._bgDefMap = new Map();
        for (const d of cat){
          if (!d) continue;
          const key = d.id || d.key || d.name;
          if (key){
            this._bgDefMap.set(String(key), d);
            this._bgDefMap.set(String(key).toLowerCase(), d);
          }
        }
      }

      const ts = this.tileSize;
      if (!this._pfhBackgroundDiag?.drawLogged){
        let paintedCells = 0;
        let missingDefCells = 0;
        for (const bid of this.bg){
          if (!bid) continue;
          paintedCells += 1;
          const def = this._bgDefMap.get(bid) || this._bgDefMap.get(String(bid).toLowerCase());
          if (!def || !def.img) missingDefCells += 1;
        }
        console.info("[PFH background] draw pass diagnostics", {
          paintedCells,
          missingDefinitionCells: missingDefCells,
          drawableCells: Math.max(0, paintedCells - missingDefCells),
        });
        this._pfhBackgroundDiag.drawLogged = true;
      }

      for (let ty = y0; ty <= y1; ty++){
        for (let tx = x0; tx <= x1; tx++){
          const i = ty * this.w + tx;
          const bid = this.bg[i];
          if (!bid) continue;

          const def = this._bgDefMap.get(bid) || this._bgDefMap.get(String(bid).toLowerCase());
          if (!def || !def.img) continue;

          let img = this._bgImg.get(def.img);
          if (!img){
            img = this._tryLoadImage(def.img);
            if (!img) continue;
            this._bgImg.set(def.img, img);
          }

          const w = (typeof def.w === "number") ? def.w : ts;
          const h = (typeof def.h === "number") ? def.h : ts;
          const anchor = def.anchor || "TL";

          const wx = tx * ts;
          const wy = ty * ts;
          const dx = wx - cam.x;
          const dy = (anchor === "BL") ? ((ty + 1) * ts - h - cam.y) : (wy - cam.y);

          if (img._ok){
            ctx.drawImage(img, dx, dy, w, h);
          }
        }
      }
    }

    _drawTilePNG(ctx, cam, tx, ty, id){
      this._ensureTileCatalog();
      if (!this._tileDefById) return false;

      const override = this._getTileVisualOverrideAt(tx, ty);
      let def = null;
      if (override && override.catalogTileId && this._tileDefByCatalogId){
        def = this._tileDefByCatalogId.get(String(override.catalogTileId)) || null;
      }
      if (!def) def = this._tileDefById.get(id);
      if (!def && override && override.img){
        def = { img: override.img };
      }
      if (!def || !def.img) return false;

      const imageKey = def.img;

      let img = this._tileImg.get(imageKey);
      if (!img){
        img = this._tryLoadImage(def.img);
        if (img) this._tileImg.set(imageKey, img);
      }
      if (!img || !img._ok) return false;

      const ts = this.tileSize;

      const w = (override && Number.isFinite(Number(override.drawW))) ? (Number(override.drawW)|0) : ((def.drawW|0) || ts);
      const h = (override && Number.isFinite(Number(override.drawH))) ? (Number(override.drawH)|0) : ((def.drawH|0) || ts);
      const offX = (override && Number.isFinite(Number(override.drawOffX))) ? (Number(override.drawOffX)|0) : ((def.drawOffX|0) || 0);
      const offY = (override && Number.isFinite(Number(override.drawOffY))) ? (Number(override.drawOffY)|0) : ((def.drawOffY|0) || 0);
      const anchor = (override && override.drawAnchor) ? String(override.drawAnchor) : (def.drawAnchor || "TL");

      const wx = tx * ts;
      const wy = ty * ts;

      const dx = Math.round(wx - cam.x + offX);
      const dy = Math.round((anchor === "BL")
        ? ((ty + 1) * ts - h - cam.y + offY)
        : (wy - cam.y + offY));

      ctx.drawImage(img, dx, dy, w, h);
      return true;
    }

    _isLikelyVisualAnchor(tx, ty, id, fp){
      const fw = Math.max(1, (fp && fp.w) ? (fp.w|0) : 1);
      const fh = Math.max(1, (fp && fp.h) ? (fp.h|0) : 1);
      if (fw <= 1 && fh <= 1) return true;

      // Stabilization rule: draw larger visuals from a single deterministic
      // anchor cell (bottom-left edge in BL tile convention).
      if ((this.getTile(tx, ty + 1)|0) === (id|0)) return false;
      if ((this.getTile(tx - 1, ty)|0) === (id|0)) return false;
      return true;
    }

    draw(ctx, cam){
      const ts = this.tileSize;

      const x0 = Math.max(0, Math.floor(cam.x / ts) - 2);
      const y0 = Math.max(0, Math.floor(cam.y / ts) - 2);
      const x1 = Math.min(this.w - 1, Math.floor((cam.x + cam.w) / ts) + 2);
      const y1 = Math.min(this.h - 1, Math.floor((cam.y + cam.h) / ts) + 2);

      // BG behind tiles
      this._drawBG(ctx, cam, x0, y0, x1, y1);

      for (let ty = y0; ty <= y1; ty++){
        for (let tx = x0; tx <= x1; tx++){
          const id = this.getTile(tx, ty);
          if (!id) continue;

          const override = this._getTileVisualOverrideAt(tx, ty);
          const tileDef = this._tileDefById ? this._tileDefById.get(id) : null;
          const fp = tileDef && tileDef.footprint ? tileDef.footprint : null;
          if (!override && !this._isLikelyVisualAnchor(tx, ty, id, fp)) continue;

          // 1) Tile PNG
          const drew = this._drawTilePNG(ctx, cam, tx, ty, id);
          if (drew) continue;

          // 2) Placeholder fallback
          const defs = (window.Lumo && Lumo.Tileset) ? Lumo.Tileset : this.tileDefs;
          const tdef = defs[id] || defs[1] || this.tileDefs[1];
          const sx = Math.round(tx * ts - cam.x);
          const sy = Math.round(ty * ts - cam.y);

          ctx.fillStyle = tdef.color || "#2b3646";
          ctx.fillRect(sx, sy, ts, ts);

          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.fillRect(sx, sy, ts, 1);

          if (tdef.hazard){
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fillRect(sx+2, sy+2, ts-4, 2);
          }
        }
      }
    }
  }

  Lumo.World = World;
})();
