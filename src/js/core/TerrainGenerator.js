var RealmKit = RealmKit || {};

RealmKit.TerrainGenerator = class TerrainGenerator {
    constructor(config) {
        this.config = config || {};
        
        this.width = this.config.width || 100;
        this.height = this.config.height || 100;
        this.seed = this.config.seed || Math.random() * 100000;
        
        this.elevationScale = this.config.elevationScale || 0.008;
        this.moistureScale = this.config.moistureScale || 0.006;
        this.temperatureScale = this.config.temperatureScale || 0.005;
        this.erosionPasses = this.config.erosionPasses || 3;   // smoother terrain
        // flat: true → skip all biome logic; generate uniform dirt+grass terrain
        this.flat = this.config.flat || false;

        // Continental thresholds — waterLevel at 0.22 gives ~22% of the lowest
        // tiles as lakes/inland water without the forced ocean border.
        // Raised hill/mountain levels reduce over-abundance of rocky tiles.
        this.waterLevel = this.config.waterLevel || 0.22;
        this.mountainLevel = this.config.mountainLevel || 0.88;
        this.hillLevel = this.config.hillLevel || 0.78;
        
        // ── Tile IDs match tpl_ts_grassland in 001_initial_schema.sql ──────────
        // Layout: 8 cols × 16 rows = 128 frames.
        // Frame index = row * 8 + col.
        //
        // Row 0 [ 0– 7]: Primary ground (grass variants)
        // Row 1 [ 8–15]: Secondary ground (dirt / gravel / mud / sand)
        // Row 2 [16–23]: Rock / stone / cliff / peak
        // Row 3 [24–31]: Water edges + static water + waterfall
        // Row 4 [32–39]: Paths (dirt H/V, stone H/V, road H/V/corner, bridge)
        // Row 5 [40–47]: Flora
        // Row 6 [48–55]: Objects / decor
        // Row 7 [56–63]: Structures
        // Rows 8–15 [64–127]: Animated strips (2 × 4 frames per row)
        this.tileTypes = {
            // ── Primary Ground (row 0) ──────────────────────────────────────
            GRASS:         0,   // grass_base
            GRASS_LUSH:    1,   // grass_lush
            GRASS_PALE:    2,   // grass_pale
            GRASS_WILD:    3,   // grass_wild / tall
            GRASS_FLOWER:  4,   // grass with flowers (meadow areas)
            GRASS_SPARSE:  5,   // sparse grass (transitional)
            GRASS_HIGHLAND:6,   // highland / hill grass
            GRASS_DRY:     7,   // dry / late-summer grass
            GRASS2:        3,   // compat alias → GRASS_WILD
            // ── Secondary Ground (row 1) ────────────────────────────────────
            DIRT:          8,   // dirt_packed
            DIRT_LOOSE:    9,   // dirt_loose
            DIRT_CRACKED:  10,  // dirt_cracked
            GRAVEL:        11,  // gravel_fine
            GRAVEL_COARSE: 12,  // gravel_coarse
            MUD:           13,  // mud
            SAND:          14,  // sand (fallback for desert in grassland tileset)
            FROZEN_PATCH:  15,  // frozen_patch (tundra transition tile)
            // ── Rock / Stone (row 2) ────────────────────────────────────────
            STONE:         16,  // stone_smooth
            STONE_ROUGH:   17,  // stone_rough
            STONE_MOSSY:   18,  // stone_mossy (ancient / ruin zones)
            ROCK_SMALL:    19,  // rock_small
            ROCK:          19,  // compat alias
            ROCK_LARGE:    20,  // rock_large
            CLIFF:         21,  // cliff_face
            BOULDER:       22,  // boulder
            MOUNTAIN:      23,  // mountain_peak / snow-cap
            SNOW:          23,  // compat alias → mountain_peak
            // ── Water + Edges (row 3) ────────────────────────────────────────
            BEACH:         24,  // shore_sand
            BEACH_WET:     25,  // shore_wet
            WATER_EDGE:    26,  // land→water transition
            BEACH_2:       27,  // beach (deeper sand)
            DEEP_WATER:    28,  // deep_water_static
            SHALLOW_WATER: 29,  // shallow_water_static
            WATERFALL:     30,  // waterfall_static
            // ── Paths + Bridge (row 4) ────────────────────────────────────────
            PATH:          32,  // path_dirt_h
            PATH_V:        33,  // path_dirt_v
            PATH_STONE:    34,  // path_stone_h
            PATH_STONE_V:  35,  // path_stone_v
            ROAD_H:        36,  // road_h
            ROAD_V:        37,  // road_v
            ROAD_CORNER:   38,  // road_corner
            BRIDGE_H:      39,  // bridge (compat alias)
            BRIDGE_V:      39,  // bridge (same frame)
            // ── Flora (row 5) ──────────────────────────────────────────────
            FLOWER:        40,  // flower_red
            FLOWER_YELLOW: 41,  // flower_yellow
            TALL_GRASS:    42,  // tall_grass
            REEDS:         43,  // reeds
            LILYPAD:       44,  // lilypad
            SHRUB:         45,  // shrub_small
            SHRUB_LARGE:   46,  // shrub_large
            FERN:          47,  // fern
            // ── Objects (row 6) ────────────────────────────────────────────
            ROCK_OBJ:      48,  // rock object
            STUMP:         49,  // tree stump
            LOG:           50,  // fallen log
            HAY_BALE:      51,  // hay bale
            FENCE_H:       52,  // fence_h
            FENCE_V:       53,  // fence_v
            SIGNPOST:      54,  // signpost
            CRATE:         55,  // crate
            // ── Structures (row 7) ─────────────────────────────────────────
            TREE:          56,  // tree_small
            TREE_LARGE:    57,  // tree_large / canopy
            BUSH:          58,  // bush
            RUIN_FLOOR:    59,  // ruin_floor
            RUIN_WALL:     60,  // ruin_wall
            DOOR:          61,  // door
            BUILDING_WALL: 62,  // building_wall
            BUILDING_FLOOR:59,  // alias → ruin_floor slot
            CHEST:         63,  // chest
            // ── Animated first-frames (rows 8–15) ─────────────────────────
            DEEP_WATER_ANIM:    64,
            SHALLOW_WATER_ANIM: 68,
            WATERFALL_ANIM:     72,
            STREAM_ANIM:        76,
            WIND_GRASS_ANIM:    80,
            TORCH_ANIM:         88,
            MAGIC_ANIM:         92,
            // ── Legacy biome-marker aliases (now map to nearest equivalent) ─
            FOREST:  57,   // tree_large (dense canopy tile)
            SWAMP:   13,   // mud
            DESERT:  14,   // sand (fallback in grassland tileset)
            TUNDRA:  15,   // frozen_patch
            WETLAND: 13,   // mud (shallow marsh)
            MEADOW:   4,   // grass_flower
            ANCIENT: 59,   // ruin_floor
        };
        
        this.elevationMap = null;
        this.moistureMap = null;
        this.temperatureMap = null;
        this.riverMap = null;
        this.roadMap = null;
        
        console.log('[TerrainGenerator] Initialized with seed:', this.seed);
    }
    
    generate() {
        RealmKit.PerlinNoise.seed(this.seed);

        console.log('[TerrainGenerator] Generating terrain' + (this.flat ? ' (flat mode)' : '') + '...');
        var start = performance.now();

        var layers;
        if (this.flat) {
            layers = this.buildFlatLayers();
        } else {
            this.elevationMap = this.generateElevation();
            this.moistureMap  = this.generateMoisture();
            this.temperatureMap = this.generateTemperature();
            this.applyErosion();
            this.generateRivers();
            this.generateLakes();
            this.generateRoads();
            layers = this.buildLayers();
        }

        var elapsed = performance.now() - start;
        console.log('[TerrainGenerator] Generated in', elapsed.toFixed(1), 'ms');
        return layers;
    }

    // ── Flat terrain ────────────────────────────────────────────────────────
    // All ground = DIRT (8); grass overlay on every tile using detail noise for
    // variant selection (0-7); no collision, no objects, no water.
    buildFlatLayers() {
        var ground       = new Uint16Array(this.width * this.height);
        var grassOverlay = new Int16Array(this.width * this.height).fill(-1);
        var collision    = new Uint8Array(this.width * this.height);
        var objects      = new Uint16Array(this.width * this.height);

        this.riverMap = new Uint8Array(this.width * this.height);
        this.roadMap  = new Uint8Array(this.width * this.height);
        this.elevationMap   = new Float32Array(this.width * this.height);
        this.moistureMap    = new Float32Array(this.width * this.height);
        this.temperatureMap = new Float32Array(this.width * this.height);

        var detailScale = this.elevationScale * 9.0;

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = y * this.width + x;
                ground[idx] = this.tileTypes.DIRT;

                // Detail noise picks one of the 8 grass variants per tile.
                var dn = RealmKit.PerlinNoise.octave(
                    x * detailScale + 47.3,
                    y * detailScale + 83.1,
                    2, 0.5, 2.0);
                var variant = dn > 0.30 ? 0
                            : dn > 0.05 ? 1
                            : dn > -0.10 ? 2
                            : dn > -0.25 ? 3
                            : dn > -0.40 ? 4
                            : dn > -0.55 ? 5
                            : dn > -0.65 ? 6 : 7;
                grassOverlay[idx] = variant;
            }
        }

        var spawns = this.findSpawnPoints(ground, collision);
        return {
            ground:       ground,
            grassOverlay: grassOverlay,
            collision:    collision,
            objects:      objects,
            roadMap:      this.roadMap,
            riverMap:     this.riverMap,
            elevationMap: this.elevationMap,
            moistureMap:  this.moistureMap,
            temperatureMap: this.temperatureMap,
            width:        this.width,
            height:       this.height,
            spawns:       spawns,
            settlements:  []
        };
    }
    
    generateElevation() {
        var map = new Float32Array(this.width * this.height);

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = y * this.width + x;

                // Broad low-frequency layer — creates large continental regions
                // (highlands, basins, mountain ranges spanning many tiles).
                var broad = RealmKit.PerlinNoise.octave(
                    x * this.elevationScale * 0.35,
                    y * this.elevationScale * 0.35,
                    3, 0.5, 2.0
                );

                // Fine detail layer — local ridges, valleys, and texture.
                var fine = RealmKit.PerlinNoise.octave(
                    x * this.elevationScale,
                    y * this.elevationScale,
                    5, 0.55, 2.0
                );

                // No island/edge shaping — pure continental noise.
                map[idx] = broad * 0.5 + fine * 0.5;
            }
        }

        this.normalize(map);
        return map;
    }
    
    generateMoisture() {
        var map = new Float32Array(this.width * this.height);
        var moistureOffset = 500;

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = y * this.width + x;
                // More octaves for believable moisture variation across the world
                var base = RealmKit.PerlinNoise.octave(
                    x * this.moistureScale + moistureOffset,
                    y * this.moistureScale + moistureOffset,
                    4, 0.5, 2.0
                );
                map[idx] = base;
            }
        }

        this.normalize(map);
        return map;
    }

    generateTemperature() {
        var map = new Float32Array(this.width * this.height);
        var tempOffset = 1500;

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = y * this.width + x;

                // Base temperature from Perlin (fantasy world - no strict lat gradient)
                var base = RealmKit.PerlinNoise.octave(
                    x * this.temperatureScale + tempOffset,
                    y * this.temperatureScale + tempOffset,
                    3, 0.5, 2.0
                );

                // High elevation = cold; steepen the cooling curve above hillLevel
                var elev = this.elevationMap[idx];
                var cooling = 0;
                if (elev > this.hillLevel) {
                    cooling = (elev - this.hillLevel) / (1 - this.hillLevel) * 0.7;
                }

                map[idx] = Math.max(0, Math.min(1, base * 0.5 + 0.5 - cooling));
            }
        }

        this.normalize(map);
        return map;
    }
    
    applyErosion() {
        // Pre-allocate arrays for reuse to reduce GC pressure
        var tempMap = new Float32Array(this.width * this.height);
        
        for (var pass = 0; pass < this.erosionPasses; pass++) {
            // Copy current elevation to temp
            tempMap.set(this.elevationMap);
            
            for (var y = 1; y < this.height - 1; y++) {
                for (var x = 1; x < this.width - 1; x++) {
                    var idx = y * this.width + x;
                    var h = this.elevationMap[idx];
                    
                    var neighbors = [
                        this.elevationMap[(y - 1) * this.width + x],
                        this.elevationMap[(y + 1) * this.width + x],
                        this.elevationMap[y * this.width + (x - 1)],
                        this.elevationMap[y * this.width + (x + 1)]
                    ];
                    
                    var avg = (neighbors[0] + neighbors[1] + neighbors[2] + neighbors[3]) / 4;
                    tempMap[idx] = h * 0.75 + avg * 0.25;
                }
            }
            
            // Swap references instead of creating new arrays
            var swap = this.elevationMap;
            this.elevationMap = tempMap;
            tempMap = swap;
        }
        
        this.normalize(this.elevationMap);
    }
    
    generateRivers() {
        this.riverMap = new Uint8Array(this.width * this.height);
        
        var riverCount = 3 + Math.floor(Math.random() * 3); // 3–5 rivers

        for (var r = 0; r < riverCount; r++) {
            var startIdx = this.findHighElevationPoint();
            if (startIdx === -1) break;

            var rx = startIdx % this.width;
            var ry = Math.floor(startIdx / this.width);

            this.traceRiver(rx, ry, 80 + Math.random() * 80);
        }
    }
    
    findHighElevationPoint() {
        var attempts = 200;
        var threshold = this.hillLevel * 0.80;
        
        for (var i = 0; i < attempts; i++) {
            var x = 5 + Math.floor(Math.random() * (this.width - 10));
            var y = 5 + Math.floor(Math.random() * (this.height - 10));
            var idx = y * this.width + x;
            
            if (this.elevationMap[idx] > threshold && this.riverMap[idx] === 0) {
                return idx;
            }
        }
        
        return -1;
    }
    
    traceRiver(startX, startY, maxSteps) {
        var x = startX;
        var y = startY;
        var steps = 0;
        var riverWidth = 1;
        
        while (steps < maxSteps && x > 1 && x < this.width - 2 && y > 1 && y < this.height - 2) {
            var idx = y * this.width + x;
            
            var elevation = this.elevationMap[idx];
            if (elevation < this.waterLevel) break;
            
            this.riverMap[idx] = 1;
            
            if (riverWidth > 1) {
                var leftIdx = y * this.width + (x - 1);
                var rightIdx = y * this.width + (x + 1);
                if (leftIdx >= 0 && leftIdx < this.riverMap.length) this.riverMap[leftIdx] = 1;
                if (rightIdx >= 0 && rightIdx < this.riverMap.length) this.riverMap[rightIdx] = 1;
            }
            
            var neighbors = [
                { x: x, y: y - 1, h: this.elevationMap[(y - 1) * this.width + x] },
                { x: x, y: y + 1, h: this.elevationMap[(y + 1) * this.width + x] },
                { x: x - 1, y: y, h: this.elevationMap[y * this.width + (x - 1)] },
                { x: x + 1, y: y, h: this.elevationMap[y * this.width + (x + 1)] }
            ];
            
            var lowest = neighbors[0];
            for (var i = 1; i < 4; i++) {
                if (neighbors[i].h < lowest.h) {
                    lowest = neighbors[i];
                }
            }
            
            x = lowest.x;
            y = lowest.y;
            steps++;
            
            if (steps > 15) {
                riverWidth = 2;
            }
        }
    }
    
    generateLakes() {
        var lakeCount = 2 + Math.floor(Math.random() * 3); // 2–4 lakes
        
        for (var l = 0; l < lakeCount; l++) {
            var lakeX = 10 + Math.floor(Math.random() * (this.width - 20));
            var lakeY = 10 + Math.floor(Math.random() * (this.height - 20));
            var lakeIdx = lakeY * this.width + lakeX;
            
            var minDistFromEdge = 8;
            if (lakeX < minDistFromEdge || lakeX > this.width - minDistFromEdge ||
                lakeY < minDistFromEdge || lakeY > this.height - minDistFromEdge) {
                continue;
            }
            
            if (this.elevationMap[lakeIdx] < this.hillLevel && this.elevationMap[lakeIdx] > this.waterLevel - 0.15) {
                var size = 3 + Math.floor(Math.random() * 3);
                
                for (var dy = -size; dy <= size; dy++) {
                    for (var dx = -size; dx <= size; dx++) {
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist <= size) {
                            var idx = (lakeY + dy) * this.width + (lakeX + dx);
                            if (idx >= 0 && idx < this.elevationMap.length) {
                                this.elevationMap[idx] = Math.min(this.elevationMap[idx], this.waterLevel - 0.1);
                                this.riverMap[idx] = 2;
                            }
                        }
                    }
                }
            }
        }
    }
    
    generateRoads() {
        // roadMap stores the road TILE TYPE (ROAD_H=10, ROAD_V=11, ROAD_CORNER=12)
        // or 0 for no road. NPC/bridge code must test > 0, not === 1.
        this.roadMap = new Uint8Array(this.width * this.height);

        var settlementCount = 3 + Math.floor(Math.random() * 2);
        var settlements = [];

        for (var s = 0; s < settlementCount; s++) {
            var sx, sy, attempts = 50;
            do {
                sx = 15 + Math.floor(Math.random() * (this.width - 30));
                sy = 15 + Math.floor(Math.random() * (this.height - 30));
                attempts--;
            } while (attempts > 0 && this.elevationMap[sy * this.width + sx] > this.hillLevel);

            settlements.push({ x: sx, y: sy });
            this.placeSettlement(sx, sy);
        }

        // Connect settlements in a ring chain (0→1→2→…→0) instead of all O(n²)
        // pairs. This avoids the crossing-diagonal "triangle web" look.
        for (var i = 0; i < settlements.length; i++) {
            var next = (i + 1) % settlements.length;
            this.buildRoad(settlements[i], settlements[next]);
        }

        this.settlements = settlements;
    }

    buildRoad(from, to) {
        // Split each road into two segments via a low-elevation midpoint so the
        // path naturally bends toward valleys rather than cutting straight through hills.
        var mid = this.findLowElevMidpoint(from.x, from.y, to.x, to.y);
        this.traceRoadSegment(from.x, from.y, mid.x, mid.y);
        this.traceRoadSegment(mid.x, mid.y, to.x, to.y);
    }

    findLowElevMidpoint(x1, y1, x2, y2) {
        var midX = Math.floor((x1 + x2) / 2);
        var midY = Math.floor((y1 + y2) / 2);
        var searchR = Math.max(6, Math.floor(Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1)) / 4));

        var best = { x: midX, y: midY };
        var bestElev = this.elevationMap[midY * this.width + midX] || 1;

        for (var i = 0; i < 30; i++) {
            var rx = midX + Math.floor((Math.random() - 0.5) * searchR * 2);
            var ry = midY + Math.floor((Math.random() - 0.5) * searchR * 2);
            rx = Math.max(2, Math.min(this.width - 3, rx));
            ry = Math.max(2, Math.min(this.height - 3, ry));
            var idx = ry * this.width + rx;
            var elev = this.elevationMap[idx];
            if (elev < bestElev && elev > this.waterLevel && elev < this.hillLevel) {
                bestElev = elev;
                best = { x: rx, y: ry };
            }
        }
        return best;
    }

    traceRoadSegment(x1, y1, x2, y2) {
        var adx = Math.abs(x2 - x1);
        var ady = Math.abs(y2 - y1);
        var sx = x1 < x2 ? 1 : -1;
        var sy = y1 < y2 ? 1 : -1;
        var err = adx - ady;

        var x = x1, y = y1;
        var prevX = x, prevY = y;

        while (true) {
            // Choose tile type from actual movement direction
            var mx = x - prevX, my = y - prevY;
            var tileType;
            if (mx !== 0 && my !== 0) {
                tileType = this.tileTypes.ROAD_CORNER;
            } else if (my !== 0) {
                tileType = this.tileTypes.ROAD_V;
            } else {
                tileType = this.tileTypes.ROAD_H;
            }

            this.setRoadTile(x, y, tileType);

            if (x === x2 && y === y2) break;

            prevX = x;
            prevY = y;

            var e2 = 2 * err;
            if (e2 > -ady) { err -= ady; x += sx; }
            if (e2 < adx)  { err += adx; y += sy; }
        }
    }

    setRoadTile(cx, cy, tileType) {
        tileType = tileType || this.tileTypes.ROAD_H;
        // 3-tile-wide road (±1) instead of the old 5-wide (±2)
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                var x = cx + dx;
                var y = cy + dy;

                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

                var idx = y * this.width + x;
                var elevation = this.elevationMap[idx];
                if (elevation < this.waterLevel || elevation > this.hillLevel + 0.15) continue;

                // Centre tile gets the directional type; shoulders always use ROAD_H
                // (prevents corner tiles appearing on straight stretches)
                var t = (dx === 0 && dy === 0) ? tileType : this.tileTypes.ROAD_H;
                // Don't overwrite a more specific type already placed
                if (this.roadMap[idx] === 0) {
                    this.roadMap[idx] = t;
                }
            }
        }
    }

    placeSettlement(cx, cy) {
        var size = 4 + Math.floor(Math.random() * 3);

        for (var dy = -size; dy <= size; dy++) {
            for (var dx = -size; dx <= size; dx++) {
                var x = cx + dx;
                var y = cy + dy;

                if (x < 2 || x >= this.width - 2 || y < 2 || y >= this.height - 2) continue;

                var idx = y * this.width + x;
                var elevation = this.elevationMap[idx];

                if (elevation > this.waterLevel && elevation < this.hillLevel) {
                    this.elevationMap[idx] = Math.min(elevation, this.hillLevel * 0.55);
                    if (this.roadMap[idx] === 0) {
                        this.roadMap[idx] = this.tileTypes.ROAD_H;
                    }
                }
            }
        }
    }
    
    buildLayers() {
        var ground       = new Uint16Array(this.width * this.height);
        var grassOverlay = new Int16Array(this.width * this.height).fill(-1); // -1 = empty
        var collision    = new Uint8Array(this.width * this.height);
        var objects      = new Uint16Array(this.width * this.height);

        // Two noise scales for grass patch generation:
        //  patchNoise  — low-freq: defines broad patch shapes (fields, clearings)
        //  detailNoise — high-freq: variety selector within each patch
        var patchScale  = this.elevationScale * 3.0;
        var detailScale = this.elevationScale * 9.0;

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = y * this.width + x;

                var elevation   = this.elevationMap[idx];
                var moisture    = this.moistureMap[idx];
                var temperature = this.temperatureMap[idx];
                var isRiver     = this.riverMap[idx] > 0;
                var isRoad      = this.roadMap[idx] > 0;

                var tile   = this.getTerrainTile(elevation, moisture, temperature, isRiver, isRoad, x, y, idx);
                var tileId = tile.tile;

                // ── Two-layer grass handling ──────────────────────────────────
                // Row-0 tiles (IDs 0–7) are grass overlays drawn over a DIRT base.
                // Detail noise selects which of the 8 grass variants to use.
                // Every grass tile gets an overlay (no coverage threshold) so the
                // grass layer is always visible above the dirt.
                if (tileId >= 0 && tileId <= 7) {
                    ground[idx] = this.tileTypes.DIRT;  // base soil under all grass

                    if (!isRoad) {
                        var dn = RealmKit.PerlinNoise.octave(
                            x * detailScale + 47.3, y * detailScale + 83.1,
                            2, 0.5, 2.0);
                        var variant;
                        if (dn > 0.30)       variant = tileId;
                        else if (dn > 0.05)  variant = (tileId + 1) % 8;
                        else if (dn > -0.10) variant = (tileId + 2) % 8;
                        else if (dn > -0.30) variant = (tileId + 3) % 8;
                        else if (dn > -0.50) variant = (tileId + 4) % 8;
                        else                 variant = (tileId + 5) % 8;
                        grassOverlay[idx] = variant;
                    }
                } else {
                    ground[idx] = tileId;
                }
                // ─────────────────────────────────────────────────────────────

                collision[idx] = tile.collision ? 1 : 0;
                objects[idx]   = tile.object || 0;
            }
        }

        return {
            ground:       ground,
            grassOverlay: grassOverlay,
            collision:    collision,
            objects:      objects,
            roadMap:      this.roadMap,
            riverMap:     this.riverMap,
            elevationMap: this.elevationMap,
            moistureMap:  this.moistureMap,
            temperatureMap: this.temperatureMap,
            width:        this.width,
            height:       this.height,
            spawns:       this.findSpawnPoints(ground, collision),
            settlements:  this.settlements || []
        };
    }
    
    getTerrainTile(elevation, moisture, temperature, isRiver, isRoad, x, y, idx) {
        var result = { tile: 3, collision: false, object: 0 };

        var left = x > 0 ? this.elevationMap[idx - 1] : elevation;
        var right = x < this.width - 1 ? this.elevationMap[idx + 1] : elevation;
        var up = y > 0 ? this.elevationMap[idx - this.width] : elevation;
        var down = y < this.height - 1 ? this.elevationMap[idx + this.width] : elevation;

        var cliffThreshold = 0.22;
        var isCliff = Math.abs(left - elevation) > cliffThreshold ||
                      Math.abs(right - elevation) > cliffThreshold ||
                      Math.abs(up - elevation) > cliffThreshold ||
                      Math.abs(down - elevation) > cliffThreshold;

        // Deterministic per-tile hash for variant + biome selection
        // (computed early so water/beach can also use variant selection)
        var tileHash = (((x * 73856093) ^ (y * 19349663)) >>> 0) & 0xFFFF;

        // --- Water ---
        // Deep water = bottom ~35% of the water zone; shallow = top 65%.
        // Use animated tile IDs (64 = deep water anim, 68 = shallow water anim).
        var deepWaterThresh = this.waterLevel - this.waterLevel * 0.35;
        if (elevation < deepWaterThresh) {
            result.tile = this.tileTypes.DEEP_WATER_ANIM;
            result.collision = true;
            return result;
        }
        if (elevation < this.waterLevel) {
            result.tile = this.tileTypes.SHALLOW_WATER_ANIM;
            result.collision = true;
            return result;
        }
        // Beach: a narrow band just above waterLevel (two variants)
        if (elevation < this.waterLevel + 0.025) {
            result.tile = (tileHash & 0x01) ? this.tileTypes.BEACH_WET : this.tileTypes.BEACH;
            return result;
        }

        // --- Rivers and lakes ---
        if (isRiver && this.riverMap[idx] === 2) {
            result.tile = this.tileTypes.SHALLOW_WATER_ANIM;
            result.collision = true;
            return result;
        }
        if (isRiver && this.riverMap[idx] === 1) {
            result.tile = isRoad ? this.tileTypes.BRIDGE_H : this.tileTypes.SHALLOW_WATER_ANIM;
            result.collision = !isRoad;
            return result;
        }

        // --- Roads --- (roadMap stores the actual tile type directly)
        if (isRoad) {
            result.tile = this.roadMap[idx];
            return result;
        }

        // --- High terrain ---
        if (elevation > this.mountainLevel) {
            // Snow caps: upper ~40% of the mountain band
            var snowThresh = this.mountainLevel + (1.0 - this.mountainLevel) * 0.60;
            if (elevation > snowThresh) {
                result.tile = this.tileTypes.MOUNTAIN; // mountain_peak (snow-capped)
            } else {
                // Mid-mountain: cliff or boulder variant
                result.tile = (tileHash & 0x01) ? this.tileTypes.CLIFF : this.tileTypes.BOULDER;
            }
            result.collision = true;
            return result;
        }
        if (elevation > this.hillLevel) {
            if (isCliff) {
                result.tile = this.tileTypes.CLIFF;
            } else {
                // Pick from stone variants based on hash
                var stoneVariant = tileHash & 0x03; // 0-3
                result.tile = stoneVariant === 0 ? this.tileTypes.STONE_ROUGH
                            : stoneVariant === 1 ? this.tileTypes.STONE
                            : stoneVariant === 2 ? this.tileTypes.ROCK_SMALL
                            :                      this.tileTypes.ROCK_LARGE;
            }
            result.collision = true;
            return result;
        }

        // --- Biome classification: mid-elevation land ---
        var lowElev = this.waterLevel + (this.hillLevel - this.waterLevel) * 0.35;

        // Tundra: cold regions → frozen_patch / snow variants
        if (temperature < 0.22) {
            result.tile = (tileHash & 0x01) ? this.tileTypes.FROZEN_PATCH : this.tileTypes.GRASS_HIGHLAND;
            return result;
        }

        // Desert: hot and dry → sand / cracked earth
        if (temperature > 0.70 && moisture < 0.30) {
            result.tile = (tileHash & 0x01) ? this.tileTypes.SAND : this.tileTypes.DIRT_CRACKED;
            return result;
        }

        // Swamp: warm + very wet + low elevation → mud
        if (moisture > 0.70 && temperature > 0.35 && elevation < lowElev) {
            result.tile = (tileHash & 0x01) ? this.tileTypes.MUD : this.tileTypes.REEDS;
            return result;
        }

        // Wetland: wet + low elevation → mud / sparse grass
        if (moisture > 0.60 && elevation < lowElev) {
            result.tile = (tileHash & 0x03) === 0 ? this.tileTypes.MUD
                        : (tileHash & 0x03) === 1 ? this.tileTypes.GRASS_SPARSE
                        : (tileHash & 0x03) === 2 ? this.tileTypes.REEDS
                        :                            this.tileTypes.TALL_GRASS;
            return result;
        }

        // Dense forest: moderate-to-high moisture, moderate temperature
        if (moisture > 0.50 && temperature > 0.28 && temperature < 0.78) {
            // Mix of tree canopy and wild grass/fern on forest floor
            if ((tileHash & 0x07) === 0) {
                result.tile = this.tileTypes.TREE_LARGE;
                result.collision = true;
            } else if ((tileHash & 0x03) === 0) {
                result.tile = this.tileTypes.FERN;
            } else {
                result.tile = this.tileTypes.GRASS_WILD;
            }
            return result;
        }

        // Ancient ruins: rare deterministic scatter in habitable zones
        if (tileHash < 180 && moisture > 0.22 && temperature > 0.28 && temperature < 0.76) {
            result.tile = (tileHash & 0x01) ? this.tileTypes.RUIN_FLOOR : this.tileTypes.STONE_MOSSY;
            return result;
        }

        // Meadow: moderate moisture and comfortable temperature → flower variants
        if (moisture > 0.30 && moisture < 0.65 && temperature > 0.30 && temperature < 0.72) {
            var meadowVariant = tileHash & 0x07;
            result.tile = meadowVariant === 0 ? this.tileTypes.GRASS_FLOWER
                        : meadowVariant === 1 ? this.tileTypes.FLOWER
                        : meadowVariant === 2 ? this.tileTypes.FLOWER_YELLOW
                        : meadowVariant === 3 ? this.tileTypes.GRASS_WILD
                        :                       this.tileTypes.GRASS_LUSH;
            return result;
        }

        // Dry dirt / scrubland → dirt variants and gravel
        if (moisture < 0.18) {
            var dirtVariant = tileHash & 0x03;
            result.tile = dirtVariant === 0 ? this.tileTypes.DIRT
                        : dirtVariant === 1 ? this.tileTypes.DIRT_LOOSE
                        : dirtVariant === 2 ? this.tileTypes.GRAVEL
                        :                     this.tileTypes.DIRT_CRACKED;
            return result;
        }

        // Default: grass with 8 variants spread by hash
        var grassVariant = tileHash & 0x07;
        result.tile = grassVariant <= 2 ? this.tileTypes.GRASS          // 3/8 → grass_base
                    : grassVariant === 3 ? this.tileTypes.GRASS_LUSH     // 1/8 → lush
                    : grassVariant === 4 ? this.tileTypes.GRASS_PALE     // 1/8 → pale
                    : grassVariant === 5 ? this.tileTypes.GRASS_WILD     // 1/8 → wild
                    : grassVariant === 6 ? this.tileTypes.GRASS_SPARSE   // 1/8 → sparse
                    :                      this.tileTypes.GRASS;          // fallback
        return result;
    }
    
    findSpawnPoints(ground, collision) {
        var spawns = [];
        var centerX = Math.floor(this.width / 2);
        var centerY = Math.floor(this.height / 2);
        // tileSize stored in config for correct world-space coordinates
        var ts = this.config.tileSize || 32;
        var half = ts / 2;

        var playerSpawn = this.find3x3Area(centerX, centerY, collision);
        if (playerSpawn) {
            spawns.push({
                id: 'player_start',
                x: playerSpawn.x * ts + half,
                y: playerSpawn.y * ts + half,
                type: 'player'
            });
            console.log('[TerrainGenerator] Player spawn at', playerSpawn.x, playerSpawn.y);
        } else {
            spawns.push({
                id: 'player_start',
                x: centerX * ts + half,
                y: centerY * ts + half,
                type: 'player'
            });
            console.log('[TerrainGenerator] No valid player spawn, using center');
        }

        var enemyCount = 8 + Math.floor(Math.random() * 4);
        var placedEnemies = 0;
        var attempts = 0;
        var maxAttempts = enemyCount * 20;

        while (placedEnemies < enemyCount && attempts < maxAttempts) {
            attempts++;
            var ex = 5 + Math.floor(Math.random() * (this.width - 10));
            var ey = 5 + Math.floor(Math.random() * (this.height - 10));
            var spawn = this.find3x3Area(ex, ey, collision);
            if (spawn) {
                var distFromPlayer = Math.sqrt(
                    Math.pow(spawn.x - (playerSpawn ? playerSpawn.x : centerX), 2) +
                    Math.pow(spawn.y - (playerSpawn ? playerSpawn.y : centerY), 2)
                );
                // In flat mode elevationMap is zeroed — skip elevation check
                var elevation = this.elevationMap[spawn.y * this.width + spawn.x];
                var elevOk = this.flat ||
                    (elevation > this.waterLevel && elevation < this.hillLevel);
                if (elevOk && distFromPlayer > 5) {
                    spawns.push({
                        id: 'enemy_' + placedEnemies,
                        x: spawn.x * ts + half,
                        y: spawn.y * ts + half,
                        type: 'enemy',
                        properties: { elevation: elevation }
                    });
                    placedEnemies++;
                }
            }
        }

        var merchantSpawn = this.find3x3Area(
            playerSpawn ? playerSpawn.x : centerX,
            playerSpawn ? playerSpawn.y + 5 : centerY + 5,
            collision
        );
        if (merchantSpawn) {
            spawns.push({
                id: 'npc_merchant',
                x: merchantSpawn.x * ts + half,
                y: merchantSpawn.y * ts + half,
                type: 'merchant'
            });
        }

        console.log('[TerrainGenerator] Generated', spawns.length, 'spawn points');
        return spawns;
    }
    
    find3x3Area(cx, cy, collision) {
        for (var radius = 0; radius < 30; radius++) {
            for (var dy = -radius; dy <= radius; dy++) {
                for (var dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    
                    var x = cx + dx;
                    var y = cy + dy;
                    
                    if (x < 2 || x >= this.width - 2 || y < 2 || y >= this.height - 2) continue;
                    
                    if (this.check3x3Area(x, y, collision)) {
                        return { x: x, y: y };
                    }
                }
            }
        }
        return null;
    }
    
    check3x3Area(cx, cy, collision) {
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                var idx = (cy + dy) * this.width + (cx + dx);
                if (collision[idx] === 1) return false;
                // Skip elevation check in flat mode (elevation map is all zeros)
                if (!this.flat) {
                    var elevation = this.elevationMap[idx];
                    if (elevation < this.waterLevel) return false;
                    if (elevation > this.hillLevel) return false;
                }
            }
        }
        return true;
    }
    
    normalize(map) {
        var min = Infinity;
        var max = -Infinity;
        
        for (var i = 0; i < map.length; i++) {
            if (map[i] < min) min = map[i];
            if (map[i] > max) max = map[i];
        }
        
        var range = max - min || 1;
        for (var i = 0; i < map.length; i++) {
            map[i] = (map[i] - min) / range;
        }
    }
    
    static generateMap(config) {
        config = config || {};
        var generator = new RealmKit.TerrainGenerator(config);
        return generator.generate();
    }
};

console.log('[TerrainGenerator] Class loaded');