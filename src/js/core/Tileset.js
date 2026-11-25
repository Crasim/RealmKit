var RealmKit = RealmKit || {};

RealmKit.Tileset = class Tileset {
    constructor(config) {
        this.config = config || {};
        
        this.name = this.config.name || 'untitled';
        this.image = null;
        this.tileWidth = this.config.tileWidth || 16;
        this.tileHeight = this.config.tileHeight || 16;
        this.tilesX = this.config.tilesX || 1;
        this.tilesY = this.config.tilesY || 1;
        this.tileCount = this.tilesX * this.tilesY;
        
        // Overlap for transparent PNGs (pixels to bleed from adjacent tiles)
        this.overlapTop = this.config.overlapTop || 0;
        this.overlapLeft = this.config.overlapLeft || 0;
        
        this.tiles = {};
        this.loaded = false;
        
        console.log('[Tileset] Created:', this.name, {
            tileSize: this.tileWidth + 'x' + this.tileHeight,
            tileCount: this.tileCount,
            overlap: this.overlapTop + 'x' + this.overlapLeft
        });
    }
    
    setImage(image) {
        this.image = image;
        this.tilesX = Math.floor(image.width / this.tileWidth);
        this.tilesY = Math.floor(image.height / this.tileHeight);
        this.tileCount = this.tilesX * this.tilesY;
        this.loaded = true;
    }
    
    defineTile(id, x, y, properties) {
        this.tiles[id] = {
            x: x,
            y: y,
            properties: properties || {}
        };
    }
    
    getTile(id) {
        if (this.tiles[id]) {
            return this.tiles[id];
        }
        
        var tileX = id % this.tilesX;
        var tileY = Math.floor(id / this.tilesX);
        return { x: tileX, y: tileY, properties: {} };
    }
    
    drawTile(ctx, tileId, screenX, screenY, scale) {
        if (!this.image) return false;
        // Canvas elements (procedural tileset) are always ready; only block on IMG
        if (this.image.tagName === 'IMG' && !this.image.complete) return false;
        
        scale = scale || 1;
        var tile = this.getTile(tileId);
        
        var srcX = tile.x * this.tileWidth;
        var srcY = tile.y * this.tileHeight;
        
        // Adjust for overlap - skip the overlap pixels when reading from source
        if (this.overlapTop > 0 || this.overlapLeft > 0) {
            srcX += this.overlapLeft;
            srcY += this.overlapTop;
        }
        
        ctx.drawImage(
            this.image,
            srcX, srcY,
            this.tileWidth, this.tileHeight,
            screenX, screenY,
            this.tileWidth * scale, this.tileHeight * scale
        );
        
        return true;
    }
    
    static loadFromImage(config, callback) {
        var tileSize = config.tileSize || 32;
        var overlapTop = config.overlapTop || 0;
        var overlapLeft = config.overlapLeft || 0;
        
        // If overlap is set, the effective tile size includes the overlap
        // In the PNG: each tile is (tileSize + overlapTop + overlapLeft) pixels
        // But we only draw the non-overlap portion
        
        var effectiveTileWidth = tileSize + overlapLeft;
        var effectiveTileHeight = tileSize + overlapTop;
        
        var tileset = new RealmKit.Tileset({
            name: config.name || 'loaded_tileset',
            tileWidth: tileSize,
            tileHeight: tileSize,
            overlapTop: overlapTop,
            overlapLeft: overlapLeft,
            tilesX: config.tilesX || 8,
            tilesY: config.tilesY || 16
        });
        
        var img = new Image();
        img.onload = function() {
            tileset.setImage(img);
            console.log('[Tileset] Loaded image:', img.width + 'x' + img.height, 
                'tiles:', tileset.tilesX + 'x' + tileset.tilesY,
                'tileSize:', tileSize, 'overlap:', overlapTop + '/' + overlapLeft);
            if (callback) callback(null, tileset);
        };
        img.onerror = function(err) {
            console.error('[Tileset] Failed to load image:', config.url, err);
            if (callback) callback(err, null);
        };
        img.src = config.url;
        
        return tileset;
    }
    
    static async loadFromDB(assetId, storyDatabase, callback) {
        try {
            var asset = await storyDatabase.getAsset(assetId);
            if (!asset) {
                console.error('[Tileset] Asset not found:', assetId);
                if (callback) callback(new Error('Asset not found'), null);
                return null;
            }
            
            if (asset.source_type === 'procedural') {
                var tileset = RealmKit.Tileset.createProcedural(
                    asset.proc_tile_size || 32,
                    asset.proc_cols || 8,
                    asset.proc_rows || 16
                );
                if (callback) callback(null, tileset);
                return tileset;
            }
            
            if (asset.source_type === 'url' && asset.source_url) {
                return RealmKit.Tileset.loadFromImage({
                    name: asset.asset_key,
                    url: asset.source_url,
                    tileSize: asset.proc_tile_size || 32,
                    overlapTop: asset.overlap_top || 0,
                    overlapLeft: asset.overlap_left || 0
                }, callback);
            }
            
            if (callback) callback(new Error('Unknown asset source_type'), null);
            return null;
        } catch (err) {
            console.error('[Tileset] Failed to load asset:', assetId, err);
            if (callback) callback(err, null);
            return null;
        }
    }
    
    static createProcedural(tileSize, tilesX, tilesY, callback) {
        tileSize = tileSize || 32;
        tilesX   = tilesX  || 8;
        tilesY   = tilesY  || 16;   // 16 rows: 0-7 static, 8-15 animated

        var canvas = document.createElement('canvas');
        canvas.width  = tileSize * tilesX;
        canvas.height = tileSize * tilesY;
        var ctx = canvas.getContext('2d');

        var seed = Date.now();
        var rng = function() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 1000) / 1000;
        };

        // ── Semantic tile layout (GRASSLAND biome default) ──────────────────
        // Matches tpl_ts_grassland in migrations/001_initial_schema.sql.
        // Frame index = row * 8 + col.
        //
        // Row 0 [ 0– 7]  PRIMARY GROUND   — grass variants
        // Row 1 [ 8–15]  SECONDARY GROUND — dirt / gravel
        // Row 2 [16–23]  ROCK / STONE     — stone / cliff / peak
        // Row 3 [24–31]  WATER + EDGES    — shores, static water, waterfall
        // Row 4 [32–39]  PATHS + BRIDGE   — dirt path (H/V), stone path (H/V), road H/V/corner, bridge
        // Row 5 [40–47]  FLORA            — flowers×2, tall grass, reeds, lilypad, shrubs, fern
        // Row 6 [48–55]  OBJECTS          — rock obj, stump, log, hay, fence H/V, sign, crate
        // Row 7 [56–63]  STRUCTURES       — tree sm/lg, bush, ruin floor/wall, door, bldg wall, chest
        // Rows 8–15      ANIMATED STRIPS  — 2 anims × 4 frames per row (procedural: blue wash)
        var tileTypes = [
            // ── Row 0: Primary Ground (grass variants) ──────────────────────
            { type: 'grass_base',     colors: ['#27ae60','#2ecc71','#58d68d'], pattern: 'grass'    },
            { type: 'grass_lush',     colors: ['#1e8449','#239b56','#27ae60'], pattern: 'grass'    },
            { type: 'grass_pale',     colors: ['#a9dfbf','#7dbb8a','#82c98e'], pattern: 'grass'    },
            { type: 'grass_wild',     colors: ['#196f3d','#1a8a47','#229954'], pattern: 'grass'    },
            { type: 'grass_flower',   colors: ['#27ae60','#2ecc71','#f9e79f'], pattern: 'meadow'   },
            { type: 'grass_sparse',   colors: ['#7dbb4a','#a9c97a','#8fbb6a'], pattern: 'grass'    },
            { type: 'grass_highland', colors: ['#5d8a5e','#6b9e6d','#7ab07d'], pattern: 'grass'    },
            { type: 'grass_dry',      colors: ['#b7950b','#c8a227','#d4ac0d'], pattern: 'grass'    },
            // ── Row 1: Secondary Ground (dirt / gravel) ──────────────────────
            { type: 'dirt_packed',    colors: ['#8b7355','#9b8365','#a9927a'], pattern: 'dirt'     },
            { type: 'dirt_loose',     colors: ['#a07040','#b07a45','#c08850'], pattern: 'dirt'     },
            { type: 'dirt_cracked',   colors: ['#7a6545','#8a7050','#956040'], pattern: 'cracked'  },
            { type: 'gravel_fine',    colors: ['#8d9ea0','#9daeB0','#adbec0'], pattern: 'stone'    },
            { type: 'gravel_coarse',  colors: ['#7f8c8d','#8d9a9b','#95a5a6'], pattern: 'stone'    },
            { type: 'mud',            colors: ['#5d4037','#6d4c41','#795548'], pattern: 'dirt'     },
            { type: 'sand',           colors: ['#f4d03f','#f7dc6f','#f9e79f'], pattern: 'sand'     },
            { type: 'frozen_patch',   colors: ['#aed6f1','#d6eaf8','#ebf5fb'], pattern: 'snow'     },
            // ── Row 2: Rock / Stone ───────────────────────────────────────────
            { type: 'stone_smooth',   colors: ['#7f8c8d','#95a5a6','#bdc3c7'], pattern: 'stone'    },
            { type: 'stone_rough',    colors: ['#6b7a7b','#7f8c8d','#8d9a9b'], pattern: 'stone'    },
            { type: 'stone_mossy',    colors: ['#616a6b','#3d6b47','#517a55'], pattern: 'ruin'     },
            { type: 'rock_small',     colors: ['#515a5a','#767676','#616a6a'], pattern: 'rock'     },
            { type: 'rock_large',     colors: ['#424949','#515a5a','#5d6d7e'], pattern: 'rock'     },
            { type: 'cliff_face',     colors: ['#5d6d7e','#707b7c','#839192'], pattern: 'cliff'    },
            { type: 'boulder',        colors: ['#4a5568','#5a6778','#6b7c8d'], pattern: 'mountain' },
            { type: 'mountain_peak',  colors: ['#d5d8dc','#e8eaed','#f2f3f4'], pattern: 'snow'     },
            // ── Row 3: Water + Edges ──────────────────────────────────────────
            { type: 'shore_sand',     colors: ['#f0d080','#e8c870','#fae090'], pattern: 'sand'     },
            { type: 'shore_wet',      colors: ['#d4a855','#c8a040','#e0b060'], pattern: 'sand'     },
            { type: 'water_edge',     colors: ['#2471a3','#2980b9','#3498db'], pattern: 'water'    },
            { type: 'beach',          colors: ['#f4d03f','#f7dc6f','#3498db'], pattern: 'sand'     },
            { type: 'deep_static',    colors: ['#1a5276','#1e6091','#154360'], pattern: 'water'    },
            { type: 'shallow_static', colors: ['#2980b9','#3498db','#5dade2'], pattern: 'water'    },
            { type: 'waterfall_st',   colors: ['#3498db','#5dade2','#85c1e9'], pattern: 'waterfall'},
            { type: 'water_spare',    colors: ['#1f618d','#2471a3','#2980b9'], pattern: 'water'    },
            // ── Row 4: Paths + Bridge ─────────────────────────────────────────
            { type: 'path_dirt_h',    colors: ['#a07040','#b07a45','#8b6030'], pattern: 'road'     },
            { type: 'path_dirt_v',    colors: ['#a07040','#b07a45','#8b6030'], pattern: 'road'     },
            { type: 'path_stone_h',   colors: ['#8d9a9b','#9daaab','#7f8c8d'], pattern: 'road'     },
            { type: 'path_stone_v',   colors: ['#8d9a9b','#9daaab','#7f8c8d'], pattern: 'road'     },
            { type: 'road_h',         colors: ['#a0522d','#8b4513','#cd853f'], pattern: 'road'     },
            { type: 'road_v',         colors: ['#a0522d','#8b4513','#cd853f'], pattern: 'road'     },
            { type: 'road_corner',    colors: ['#a0522d','#8b4513','#cd853f'], pattern: 'road'     },
            { type: 'bridge',         colors: ['#8b4513','#a0522d','#6b4423'], pattern: 'bridge'   },
            // ── Row 5: Flora ──────────────────────────────────────────────────
            { type: 'flower_red',     colors: ['#27ae60','#e74c3c','#c0392b'], pattern: 'meadow'   },
            { type: 'flower_yellow',  colors: ['#27ae60','#f1c40f','#d4ac0d'], pattern: 'meadow'   },
            { type: 'tall_grass',     colors: ['#196f3d','#1a8a47','#1e8449'], pattern: 'grass'    },
            { type: 'reeds',          colors: ['#7d9a3c','#8aaa40','#5d6b20'], pattern: 'wetland'  },
            { type: 'lilypad',        colors: ['#27ae60','#1a9650','#2d8a50'], pattern: 'bush'     },
            { type: 'shrub_small',    colors: ['#239b56','#27ae60','#1e8449'], pattern: 'bush'     },
            { type: 'shrub_large',    colors: ['#1e8449','#196f3d','#145a32'], pattern: 'bush'     },
            { type: 'fern',           colors: ['#1a8a47','#145a32','#27ae60'], pattern: 'wetland'  },
            // ── Row 6: Objects / Decor ────────────────────────────────────────
            { type: 'rock_obj',       colors: ['#7f8c8d','#616a6a','#95a5a6'], pattern: 'rock'     },
            { type: 'stump',          colors: ['#7b4f2a','#8b5e35','#6b3f1f'], pattern: 'stump'    },
            { type: 'log',            colors: ['#8b5e35','#9b6e45','#7a4f25'], pattern: 'bridge'   },
            { type: 'hay_bale',       colors: ['#d4ac0d','#c8a000','#e0bc20'], pattern: 'chest'    },
            { type: 'fence_h',        colors: ['#8b6914','#9b7924','#7b5904'], pattern: 'road'     },
            { type: 'fence_v',        colors: ['#8b6914','#9b7924','#7b5904'], pattern: 'road'     },
            { type: 'signpost',       colors: ['#8b6914','#f4d03f','#7b5904'], pattern: 'door'     },
            { type: 'crate',          colors: ['#b7770d','#c8880e','#d4900f'], pattern: 'chest'    },
            // ── Row 7: Structures ─────────────────────────────────────────────
            { type: 'tree_small',     colors: ['#145a32','#196f3d','#1e8449'], pattern: 'tree'     },
            { type: 'tree_large',     colors: ['#0b5345','#0e6251','#117a65'], pattern: 'forest'   },
            { type: 'bush',           colors: ['#27ae60','#2ecc71','#58d68d'], pattern: 'bush'     },
            { type: 'ruin_floor',     colors: ['#7f8c8d','#95a5a6','#757575'], pattern: 'ruin'     },
            { type: 'ruin_wall',      colors: ['#5d6d7e','#707b7c','#455056'], pattern: 'ruin'     },
            { type: 'door',           colors: ['#6e2c00','#873600','#a04000'], pattern: 'door'     },
            { type: 'building_wall',  colors: ['#7d6608','#9a7d0a','#7d6608'], pattern: 'wall'     },
            { type: 'chest',          colors: ['#9a7d0a','#b7950b','#d4ac0d'], pattern: 'chest'    },
            // ── Rows 8-15: Animated placeholder tiles (2 anims×4 frames per row)
            // These will be replaced by real animated art; procedurally they show
            // colour-coded placeholders so the numbered frame grid stays readable.
            // water_deep anim ×4
            { type: 'wda0', colors: ['#0d47a1','#1565c0','#0d47a1'], pattern: 'water' },
            { type: 'wda1', colors: ['#1565c0','#1976d2','#1565c0'], pattern: 'water' },
            { type: 'wda2', colors: ['#1976d2','#1e88e5','#1976d2'], pattern: 'water' },
            { type: 'wda3', colors: ['#1e88e5','#2196f3','#1e88e5'], pattern: 'water' },
            // water_shallow anim ×4
            { type: 'wsa0', colors: ['#0288d1','#039be5','#0288d1'], pattern: 'water' },
            { type: 'wsa1', colors: ['#039be5','#03a9f4','#039be5'], pattern: 'water' },
            { type: 'wsa2', colors: ['#03a9f4','#29b6f6','#03a9f4'], pattern: 'water' },
            { type: 'wsa3', colors: ['#29b6f6','#4fc3f7','#29b6f6'], pattern: 'water' },
            // waterfall anim ×4
            { type: 'wfa0', colors: ['#1a237e','#283593','#1a237e'], pattern: 'waterfall' },
            { type: 'wfa1', colors: ['#283593','#303f9f','#283593'], pattern: 'waterfall' },
            { type: 'wfa2', colors: ['#303f9f','#3949ab','#303f9f'], pattern: 'waterfall' },
            { type: 'wfa3', colors: ['#3949ab','#3f51b5','#3949ab'], pattern: 'waterfall' },
            // stream anim ×4
            { type: 'stra0', colors: ['#006064','#00838f','#006064'], pattern: 'water' },
            { type: 'stra1', colors: ['#00838f','#0097a7','#00838f'], pattern: 'water' },
            { type: 'stra2', colors: ['#0097a7','#00acc1','#0097a7'], pattern: 'water' },
            { type: 'stra3', colors: ['#00acc1','#00bcd4','#00acc1'], pattern: 'water' },
            // wind_grass anim ×4
            { type: 'wga0', colors: ['#1b5e20','#2e7d32','#1b5e20'], pattern: 'grass' },
            { type: 'wga1', colors: ['#2e7d32','#388e3c','#2e7d32'], pattern: 'grass' },
            { type: 'wga2', colors: ['#388e3c','#43a047','#388e3c'], pattern: 'grass' },
            { type: 'wga3', colors: ['#43a047','#4caf50','#43a047'], pattern: 'grass' },
            // dust_path anim ×4
            { type: 'dpa0', colors: ['#795548','#8d6e63','#795548'], pattern: 'sand' },
            { type: 'dpa1', colors: ['#8d6e63','#a1887f','#8d6e63'], pattern: 'sand' },
            { type: 'dpa2', colors: ['#a1887f','#bcaaa4','#a1887f'], pattern: 'sand' },
            { type: 'dpa3', colors: ['#bcaaa4','#d7ccc8','#bcaaa4'], pattern: 'sand' },
            // torch anim ×4
            { type: 'tra0', colors: ['#bf360c','#d84315','#bf360c'], pattern: 'door' },
            { type: 'tra1', colors: ['#d84315','#e64a19','#d84315'], pattern: 'door' },
            { type: 'tra2', colors: ['#e64a19','#f4511e','#e64a19'], pattern: 'door' },
            { type: 'tra3', colors: ['#f4511e','#ff7043','#f4511e'], pattern: 'door' },
            // magic anim ×4
            { type: 'mga0', colors: ['#4a148c','#6a1b9a','#4a148c'], pattern: 'ancient' },
            { type: 'mga1', colors: ['#6a1b9a','#7b1fa2','#6a1b9a'], pattern: 'ancient' },
            { type: 'mga2', colors: ['#7b1fa2','#8e24aa','#7b1fa2'], pattern: 'ancient' },
            { type: 'mga3', colors: ['#8e24aa','#9c27b0','#8e24aa'], pattern: 'ancient' },
            // spare anims 8-15 (rows 12-15 = 32 frames) — dark placeholder tiles
            // Row 12 [96-103]
            { type: 'sp00', colors: ['#212121','#1a1a1a','#212121'], pattern: 'ruin' },
            { type: 'sp01', colors: ['#263238','#1c2327','#263238'], pattern: 'ruin' },
            { type: 'sp02', colors: ['#212121','#1a1a1a','#212121'], pattern: 'ruin' },
            { type: 'sp03', colors: ['#263238','#1c2327','#263238'], pattern: 'ruin' },
            { type: 'sp04', colors: ['#212121','#1a1a1a','#212121'], pattern: 'ruin' },
            { type: 'sp05', colors: ['#263238','#1c2327','#263238'], pattern: 'ruin' },
            { type: 'sp06', colors: ['#212121','#1a1a1a','#212121'], pattern: 'ruin' },
            { type: 'sp07', colors: ['#263238','#1c2327','#263238'], pattern: 'ruin' },
            // Row 13 [104-111]
            { type: 'sp10', colors: ['#1a237e','#0d1b5e','#1a237e'], pattern: 'ruin' },
            { type: 'sp11', colors: ['#0d1b5e','#1a237e','#0d1b5e'], pattern: 'ruin' },
            { type: 'sp12', colors: ['#1a237e','#0d1b5e','#1a237e'], pattern: 'ruin' },
            { type: 'sp13', colors: ['#0d1b5e','#1a237e','#0d1b5e'], pattern: 'ruin' },
            { type: 'sp14', colors: ['#1a237e','#0d1b5e','#1a237e'], pattern: 'ruin' },
            { type: 'sp15', colors: ['#0d1b5e','#1a237e','#0d1b5e'], pattern: 'ruin' },
            { type: 'sp16', colors: ['#1a237e','#0d1b5e','#1a237e'], pattern: 'ruin' },
            { type: 'sp17', colors: ['#0d1b5e','#1a237e','#0d1b5e'], pattern: 'ruin' },
            // Row 14 [112-119]
            { type: 'sp20', colors: ['#1b5e20','#0a3b0f','#1b5e20'], pattern: 'ruin' },
            { type: 'sp21', colors: ['#0a3b0f','#1b5e20','#0a3b0f'], pattern: 'ruin' },
            { type: 'sp22', colors: ['#1b5e20','#0a3b0f','#1b5e20'], pattern: 'ruin' },
            { type: 'sp23', colors: ['#0a3b0f','#1b5e20','#0a3b0f'], pattern: 'ruin' },
            { type: 'sp24', colors: ['#1b5e20','#0a3b0f','#1b5e20'], pattern: 'ruin' },
            { type: 'sp25', colors: ['#0a3b0f','#1b5e20','#0a3b0f'], pattern: 'ruin' },
            { type: 'sp26', colors: ['#1b5e20','#0a3b0f','#1b5e20'], pattern: 'ruin' },
            { type: 'sp27', colors: ['#0a3b0f','#1b5e20','#0a3b0f'], pattern: 'ruin' },
            // Row 15 [120-127]
            { type: 'sp30', colors: ['#4a148c','#2d0057','#4a148c'], pattern: 'ruin' },
            { type: 'sp31', colors: ['#2d0057','#4a148c','#2d0057'], pattern: 'ruin' },
            { type: 'sp32', colors: ['#4a148c','#2d0057','#4a148c'], pattern: 'ruin' },
            { type: 'sp33', colors: ['#2d0057','#4a148c','#2d0057'], pattern: 'ruin' },
            { type: 'sp34', colors: ['#4a148c','#2d0057','#4a148c'], pattern: 'ruin' },
            { type: 'sp35', colors: ['#2d0057','#4a148c','#2d0057'], pattern: 'ruin' },
            { type: 'sp36', colors: ['#4a148c','#2d0057','#4a148c'], pattern: 'ruin' },
            { type: 'sp37', colors: ['#2d0057','#4a148c','#2d0057'], pattern: 'ruin' },
        ];
        
        for (var ty = 0; ty < tilesY; ty++) {
            for (var tx = 0; tx < tilesX; tx++) {
                var tileIndex = ty * tilesX + tx;
                var tileType = tileTypes[tileIndex % tileTypes.length];
                var colorIndex = Math.floor(rng() * tileType.colors.length);
                
                var x = tx * tileSize;
                var y = ty * tileSize;
                
                ctx.fillStyle = tileType.colors[colorIndex];
                ctx.fillRect(x, y, tileSize, tileSize);
                
                drawPattern(ctx, x, y, tileSize, tileType.pattern, tileType.colors[0], rng);
                
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
                
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = 'bold 9px Courier New';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tileIndex.toString(), x + tileSize/2, y + tileSize/2);
            }
        }
        
        function drawPattern(ctx, x, y, size, pattern, baseColor, rng) {
            ctx.save();
            
            switch(pattern) {
                case 'water':
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(x + 4, y + 8 + i * 10);
                        ctx.quadraticCurveTo(x + size/2, y + 4 + i * 10, x + size - 4, y + 8 + i * 10);
                        ctx.stroke();
                    }
                    break;
                    
                case 'sand':
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    for (var i = 0; i < 8; i++) {
                        ctx.fillRect(x + Math.floor(rng() * (size-2)) + 1, y + Math.floor(rng() * (size-2)) + 1, 2, 2);
                    }
                    break;
                    
                case 'grass':
                    ctx.fillStyle = 'rgba(0,100,0,0.3)';
                    for (var i = 0; i < 6; i++) {
                        ctx.fillRect(x + Math.floor(rng() * (size-4)) + 2, y + Math.floor(rng() * (size-4)) + 2, 1, 3);
                    }
                    break;
                    
                case 'dirt':
                    ctx.fillStyle = 'rgba(139,69,19,0.2)';
                    for (var i = 0; i < 5; i++) {
                        ctx.beginPath();
                        ctx.arc(x + Math.floor(rng() * (size-4)) + 2, y + Math.floor(rng() * (size-4)) + 2, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                    
                case 'stone':
                case 'ruin':
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 2; i++) {
                        ctx.strokeRect(
                            x + 4 + Math.floor(rng() * (size-12)),
                            y + 4 + Math.floor(rng() * (size-12)),
                            6 + Math.floor(rng() * 4),
                            4 + Math.floor(rng() * 4)
                        );
                    }
                    break;
                    
                case 'cliff':
                case 'mountain':
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.beginPath();
                    ctx.moveTo(x + size/2, y + 4);
                    ctx.lineTo(x + size - 4, y + size - 4);
                    ctx.lineTo(x + 4, y + size - 4);
                    ctx.closePath();
                    ctx.fill();
                    break;
                    
                case 'snow':
                    ctx.fillStyle = 'rgba(100,100,255,0.2)';
                    for (var i = 0; i < 4; i++) {
                        ctx.fillRect(x + Math.floor(rng() * (size-4)) + 2, y + Math.floor(rng() * (size-4)) + 2, 3, 3);
                    }
                    break;
                    
                case 'road':
                case 'bridge':
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y + size/2);
                    ctx.lineTo(x + size, y + size/2);
                    ctx.stroke();
                    break;
                    
                case 'waterfall':
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    for (var i = 0; i < 5; i++) {
                        ctx.fillRect(x + size/2 - 2, y + i * (size/5), 2, size/6);
                    }
                    break;
                    
                case 'tree':
                    ctx.fillStyle = baseColor;
                    ctx.beginPath();
                    ctx.arc(x + size/2, y + size/3, size/4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#4a3728';
                    ctx.fillRect(x + size/2 - 2, y + size/2, 4, size/2);
                    break;
                    
                case 'bush':
                    ctx.fillStyle = 'rgba(0,100,0,0.5)';
                    ctx.beginPath();
                    ctx.arc(x + size/3, y + size/2, size/5, 0, Math.PI * 2);
                    ctx.arc(x + size*2/3, y + size/2, size/5, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                    
                case 'rock':
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.beginPath();
                    ctx.ellipse(x + size/2, y + size/2, size/3, size/4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                    
                case 'chest':
                    ctx.fillStyle = '#8b6914';
                    ctx.fillRect(x + 4, y + 8, size - 8, size - 12);
                    ctx.fillStyle = '#ffd700';
                    ctx.fillRect(x + size/2 - 2, y + size/2 - 2, 4, 4);
                    break;

                case 'forest':
                    // Dense canopy: 3-4 overlapping dark tree circles
                    ctx.fillStyle = 'rgba(5,50,20,0.7)';
                    for (var i = 0; i < 4; i++) {
                        var fx = x + 4 + Math.floor(rng() * (size - 8));
                        var fy = y + 4 + Math.floor(rng() * (size - 8));
                        ctx.beginPath();
                        ctx.arc(fx, fy, size / 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Trunk hints
                    ctx.fillStyle = 'rgba(60,30,10,0.5)';
                    ctx.fillRect(x + size/2 - 2, y + size*2/3, 3, size/3);
                    break;

                case 'swamp':
                    // Dark muddy patches + murky water glints
                    ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    for (var i = 0; i < 4; i++) {
                        ctx.beginPath();
                        ctx.ellipse(
                            x + 4 + Math.floor(rng() * (size - 8)),
                            y + 4 + Math.floor(rng() * (size - 8)),
                            size/6, size/8, rng() * Math.PI, 0, Math.PI * 2
                        );
                        ctx.fill();
                    }
                    // Murky sheen
                    ctx.strokeStyle = 'rgba(80,120,30,0.4)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 3, y + size/2);
                    ctx.quadraticCurveTo(x + size/2, y + size/3, x + size - 3, y + size/2);
                    ctx.stroke();
                    break;

                case 'desert':
                    // Sand ripple lines
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 4; i++) {
                        var dy2 = y + 4 + i * (size / 4);
                        ctx.beginPath();
                        ctx.moveTo(x + 2, dy2);
                        ctx.quadraticCurveTo(x + size / 2, dy2 - 3, x + size - 2, dy2);
                        ctx.stroke();
                    }
                    // Sparse pebbles
                    ctx.fillStyle = 'rgba(180,140,40,0.4)';
                    for (var i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.arc(x + 4 + Math.floor(rng() * (size - 8)), y + 4 + Math.floor(rng() * (size - 8)), 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;

                case 'tundra':
                    // Frost crystal lines radiating from center
                    ctx.strokeStyle = 'rgba(180,220,255,0.6)';
                    ctx.lineWidth = 1;
                    var cx2 = x + size / 2, cy2 = y + size / 2;
                    for (var i = 0; i < 6; i++) {
                        var angle = (i / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(cx2, cy2);
                        ctx.lineTo(cx2 + Math.cos(angle) * size * 0.35, cy2 + Math.sin(angle) * size * 0.35);
                        ctx.stroke();
                    }
                    // Icy sheen dots
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    for (var i = 0; i < 3; i++) {
                        ctx.fillRect(x + 3 + Math.floor(rng() * (size - 6)), y + 3 + Math.floor(rng() * (size - 6)), 2, 2);
                    }
                    break;

                case 'wetland':
                    // Reed stalks
                    ctx.strokeStyle = 'rgba(10,80,40,0.7)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 5; i++) {
                        var rx2 = x + 3 + Math.floor(rng() * (size - 6));
                        ctx.beginPath();
                        ctx.moveTo(rx2, y + size - 2);
                        ctx.lineTo(rx2, y + 4 + Math.floor(rng() * (size / 3)));
                        ctx.stroke();
                    }
                    // Shallow water glint
                    ctx.strokeStyle = 'rgba(100,200,180,0.35)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 2, y + size * 0.65);
                    ctx.quadraticCurveTo(x + size / 2, y + size * 0.58, x + size - 2, y + size * 0.65);
                    ctx.stroke();
                    break;

                case 'meadow':
                    // Small flower dots in varied colors
                    var flowerColors = ['#e74c3c', '#f1c40f', '#e67e22', '#9b59b6', '#ffffff'];
                    for (var i = 0; i < 6; i++) {
                        ctx.fillStyle = flowerColors[i % flowerColors.length];
                        ctx.beginPath();
                        ctx.arc(x + 3 + Math.floor(rng() * (size - 6)), y + 3 + Math.floor(rng() * (size - 6)), 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Soft grass blades
                    ctx.strokeStyle = 'rgba(50,140,50,0.5)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 4; i++) {
                        var gx = x + 3 + Math.floor(rng() * (size - 6));
                        ctx.beginPath();
                        ctx.moveTo(gx, y + size - 2);
                        ctx.lineTo(gx + 2, y + size - 6);
                        ctx.stroke();
                    }
                    break;

                case 'ancient':
                    // Crumbling stone blocks
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    for (var i = 0; i < 2; i++) {
                        ctx.strokeRect(
                            x + 2 + Math.floor(rng() * (size / 2)),
                            y + 2 + Math.floor(rng() * (size / 2)),
                            size / 3 + Math.floor(rng() * (size / 4)),
                            size / 4 + Math.floor(rng() * (size / 5))
                        );
                    }
                    // Overgrowth vines
                    ctx.strokeStyle = 'rgba(30,120,30,0.4)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + 2, y + size - 2);
                    ctx.quadraticCurveTo(x + size / 3, y + size / 2, x + size * 0.7, y + 3);
                    ctx.stroke();
                    break;

                case 'cracked':
                    // Cracked-earth pattern — polygon cracks
                    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                    ctx.lineWidth = 1;
                    var cx3 = x + size / 2, cy3 = y + size / 2;
                    for (var i = 0; i < 5; i++) {
                        var ang = rng() * Math.PI * 2;
                        var len = size * 0.25 + rng() * size * 0.2;
                        ctx.beginPath();
                        ctx.moveTo(cx3, cy3);
                        ctx.lineTo(cx3 + Math.cos(ang) * len, cy3 + Math.sin(ang) * len);
                        ctx.stroke();
                    }
                    break;

                case 'stump':
                    // Tree stump — ring + cross-grain lines
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    var sr = size * 0.32;
                    ctx.beginPath();
                    ctx.arc(x + size / 2, y + size / 2, sr, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x + size / 2, y + size / 2, sr * 0.6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    for (var i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(x + size / 2 - sr, y + size / 2 + (i - 1) * 3);
                        ctx.lineTo(x + size / 2 + sr, y + size / 2 + (i - 1) * 3);
                        ctx.stroke();
                    }
                    break;
            }
            
            ctx.restore();
        }
        
        // Store the canvas directly — HTMLCanvasElement is a valid drawImage source
        // and is *immediately* ready (no async onload), which avoids the one-frame
        // black-screen gap that occurs when converting to a dataURL Image.
        var tileset = new RealmKit.Tileset({
            name: 'procedural_tiles',
            tileWidth: tileSize,
            tileHeight: tileSize,
            tilesX: tilesX,
            tilesY: tilesY
        });
        tileset.image = canvas;
        tileset.loaded = true;
        if (callback) callback();
        
        console.log('[Tileset] Created:', tileset.name, 'tiles:', tilesX + 'x' + tilesY, 'size:', tileSize, 'loaded:', tileset.loaded);
        
        return tileset;
    }
};

console.log('[Tileset] Class loaded');