var RealmKit = RealmKit || {};

/**
 * SpriteManifests - Central registry for sprite template definitions
 * Derived from sprite_templates and sprite_template_regions DB tables.
 */
RealmKit.SpriteManifests = {
    // Humanoid Standard (tpl_humanoid_std)
    humanoid_std: {
        id: 'tpl_humanoid_std',
        colsPerRow: 16,
        frameWidth: 32,
        frameHeight: 48,
        directionMirrors: {
            "right": "left",
            "diag_nw": "diag_ne",
            "diag_se": "diag_sw"
        },
        animations: {
            // Idle (Rows 0-4)
            'idle_down':    { start: 0,   count: 4, fps: 2.0, loop: true },
            'idle_up':      { start: 16,  count: 4, fps: 2.0, loop: true },
            'idle_left':    { start: 32,  count: 4, fps: 2.0, loop: true },
            'idle_diag_ne': { start: 48,  count: 4, fps: 2.0, loop: true, fallback: 'idle_down' },
            'idle_diag_sw': { start: 64,  count: 4, fps: 2.0, loop: true, fallback: 'idle_down' },
            
            // Walk (Rows 5-9)
            'walk_down':    { start: 80,  count: 8, fps: 8.0, loop: true },
            'walk_up':      { start: 96,  count: 8, fps: 8.0, loop: true },
            'walk_left':    { start: 112, count: 8, fps: 8.0, loop: true },
            'walk_diag_ne': { start: 128, count: 8, fps: 8.0, loop: true, fallback: 'walk_down' },
            'walk_diag_sw': { start: 144, count: 8, fps: 8.0, loop: true, fallback: 'walk_down' },
            
            // Run (Rows 10-14)
            'run_down':     { start: 160, count: 8, fps: 12.0, loop: true, fallback: 'walk_down' },
            'run_up':       { start: 176, count: 8, fps: 12.0, loop: true, fallback: 'walk_up' },
            'run_left':     { start: 192, count: 8, fps: 12.0, loop: true, fallback: 'walk_left' },
            'run_diag_ne':  { start: 208, count: 8, fps: 12.0, loop: true, fallback: 'walk_diag_ne' },
            'run_diag_sw':  { start: 224, count: 8, fps: 12.0, loop: true, fallback: 'walk_diag_sw' },
            
            // Shared States
            'death':        { start: 560, count: 8, fps: 8.0, loop: false },
            'hurt':         { start: 576, count: 4, fps: 12.0, loop: false, nextAnim: 'idle_down' },
            'victory':      { start: 592, count: 6, fps: 8.0, loop: false, nextAnim: 'idle_down' },
            'sleep':        { start: 608, count: 4, fps: 2.0, loop: true, fallback: 'idle_down' }
        }
    },

    // Humanoid Base (tpl_humanoid_base)
    humanoid_base: {
        id: 'tpl_humanoid_base',
        colsPerRow: 16,
        frameWidth: 32,
        frameHeight: 48,
        directionMirrors: {
            "right": "left",
            "diag_nw": "diag_ne",
            "diag_se": "diag_sw"
        },
        animations: {
            // Idle (Rows 0-7)
            'idle_down':    { start: 0,   count: 4, fps: 2.0, loop: true },
            'idle_up':      { start: 16,  count: 4, fps: 2.0, loop: true },
            'idle_left':    { start: 32,  count: 4, fps: 2.0, loop: true },
            'idle_right':   { start: 48,  count: 4, fps: 2.0, loop: true, fallback: 'idle_left' },
            'idle_diag_ne': { start: 64,  count: 4, fps: 2.0, loop: true, fallback: 'idle_down' },
            'idle_diag_nw': { start: 80,  count: 4, fps: 2.0, loop: true, fallback: 'idle_diag_ne' },
            'idle_diag_sw': { start: 96,  count: 4, fps: 2.0, loop: true, fallback: 'idle_down' },
            'idle_diag_se': { start: 112, count: 4, fps: 2.0, loop: true, fallback: 'idle_diag_sw' },
            
            // Walk (Rows 8-15)
            'walk_down':    { start: 128, count: 8, fps: 8.0, loop: true },
            'walk_up':      { start: 144, count: 8, fps: 8.0, loop: true },
            'walk_left':    { start: 160, count: 8, fps: 8.0, loop: true },
            'walk_right':   { start: 176, count: 8, fps: 8.0, loop: true, fallback: 'walk_left' },
            'walk_diag_ne': { start: 192, count: 8, fps: 8.0, loop: true, fallback: 'walk_down' },
            'walk_diag_nw': { start: 208, count: 8, fps: 8.0, loop: true, fallback: 'walk_diag_ne' },
            'walk_diag_sw': { start: 224, count: 8, fps: 8.0, loop: true, fallback: 'walk_down' },
            'walk_diag_se': { start: 240, count: 8, fps: 8.0, loop: true, fallback: 'walk_diag_sw' },
            
            // Run (Rows 16-23)
            'run_down':     { start: 256, count: 8, fps: 12.0, loop: true, fallback: 'walk_down' },
            'run_up':       { start: 272, count: 8, fps: 12.0, loop: true, fallback: 'walk_up' },
            'run_left':     { start: 288, count: 8, fps: 12.0, loop: true, fallback: 'walk_left' },
            'run_right':    { start: 304, count: 8, fps: 12.0, loop: true, fallback: 'run_left' },
            'run_diag_ne':  { start: 320, count: 8, fps: 12.0, loop: true, fallback: 'walk_diag_ne' },
            'run_diag_nw':  { start: 336, count: 8, fps: 12.0, loop: true, fallback: 'run_diag_ne' },
            'run_diag_sw':  { start: 352, count: 8, fps: 12.0, loop: true, fallback: 'walk_diag_sw' },
            'run_diag_se':  { start: 368, count: 8, fps: 12.0, loop: true, fallback: 'run_diag_sw' },
            
            // Shared States
            'death':        { start: 384, count: 8, fps: 8.0, loop: false },
            'hurt':         { start: 400, count: 4, fps: 12.0, loop: false, nextAnim: 'idle_down' },
            'sleep':        { start: 416, count: 4, fps: 2.0, loop: true, fallback: 'idle_down' }
        }
    },

    // Humanoid Extended (tpl_humanoid_ext)
    humanoid_ext: {
        id: 'tpl_humanoid_ext',
        colsPerRow: 16,
        frameWidth: 32,
        frameHeight: 48,
        directionMirrors: {
            "right": "left",
            "diag_nw": "diag_ne",
            "diag_se": "diag_sw"
        },
        animations: {
            // Swim (Rows 0-7)
            'swim_down':    { start: 0,   count: 8, fps: 6.0, loop: true, fallback: 'idle_down' },
            'swim_up':      { start: 16,  count: 8, fps: 6.0, loop: true, fallback: 'idle_up' },
            'swim_left':    { start: 32,  count: 8, fps: 6.0, loop: true, fallback: 'idle_left' },
            'swim_right':   { start: 48,  count: 8, fps: 6.0, loop: true, fallback: 'swim_left' },
            'swim_diag_ne': { start: 64,  count: 8, fps: 6.0, loop: true, fallback: 'swim_down' },
            'swim_diag_nw': { start: 80,  count: 8, fps: 6.0, loop: true, fallback: 'swim_diag_ne' },
            'swim_diag_sw': { start: 96,  count: 8, fps: 6.0, loop: true, fallback: 'swim_down' },
            'swim_diag_se': { start: 112, count: 8, fps: 6.0, loop: true, fallback: 'swim_diag_sw' },
            
            // Melee (Rows 8-15)
            'melee_down':    { start: 128, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_down' },
            'melee_up':      { start: 144, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_up' },
            'melee_left':    { start: 160, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_left' },
            'melee_right':   { start: 176, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_right' },
            'melee_diag_ne': { start: 192, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_diag_ne' },
            'melee_diag_nw': { start: 208, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_diag_nw' },
            'melee_diag_sw': { start: 224, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_diag_sw' },
            'melee_diag_se': { start: 240, count: 6, fps: 12.0, loop: false, nextAnim: 'idle_diag_se' },
            
            // Ranged (Rows 16-23)
            'ranged_down':    { start: 256, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_down' },
            'ranged_up':      { start: 272, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_up' },
            'ranged_left':    { start: 288, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_left' },
            'ranged_right':   { start: 304, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_right' },
            'ranged_diag_ne': { start: 320, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_diag_ne' },
            'ranged_diag_nw': { start: 336, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_diag_nw' },
            'ranged_diag_sw': { start: 352, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_diag_sw' },
            'ranged_diag_se': { start: 368, count: 6, fps: 10.0, loop: false, nextAnim: 'idle_diag_se' },
            
            // Cast (Rows 24-31)
            'cast_down':    { start: 384, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_down' },
            'cast_up':      { start: 400, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_up' },
            'cast_left':    { start: 416, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_left' },
            'cast_right':   { start: 432, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_right' },
            'cast_diag_ne': { start: 448, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_diag_ne' },
            'cast_diag_nw': { start: 464, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_diag_nw' },
            'cast_diag_sw': { start: 480, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_diag_sw' },
            'cast_diag_se': { start: 496, count: 8, fps: 8.0, loop: false, nextAnim: 'idle_diag_se' },
            
            // Non-directional
            'victory':      { start: 512, count: 6, fps: 8.0, loop: false, nextAnim: 'idle_down' }
        }
    }
};

/**
 * Build a standard manifest object from a template key
 * @param {string} key - humanoid_std, humanoid_base, etc.
 * @param {number} scale - 1=16-bit, 2=32-bit, etc.
 * @returns {Object}
 */
RealmKit.SpriteManifests.build = function(key, scale) {
    scale = scale || 1;
    var tpl = RealmKit.SpriteManifests[key];
    if (!tpl) return null;

    var animations = {};
    for (var name in tpl.animations) {
        var a = tpl.animations[name];
        var frames = [];
        for (var i = 0; i < a.count; i++) {
            frames.push(a.start + i);
        }
        animations[name] = {
            frames: frames,
            fps: a.fps,
            loop: a.loop,
            nextAnim: a.nextAnim
        };
    }

    return {
        id: tpl.id,
        colsPerRow: tpl.colsPerRow,
        frameWidth: tpl.frameWidth * scale,
        frameHeight: tpl.frameHeight * scale,
        directionMirrors: tpl.directionMirrors,
        animations: animations
    };
};

console.log('[SpriteManifests] Loaded');
