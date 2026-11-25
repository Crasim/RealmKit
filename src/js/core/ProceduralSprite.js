var RealmKit = RealmKit || {};

RealmKit.ProceduralSprite = {
    createTestHero: function() {
        console.log('[ProceduralSprite] Creating test hero sprite with 10-column layout (legacy format)');
        
        var COLS = 10;
        var FRAME_W = 32;
        var FRAME_H = 48;
        var ROWS = 19;
        
        var manifest = {
            name: 'test_hero',
            type: 'character',
            resolution: '16bit',
            imageWidth: COLS * FRAME_W,
            imageHeight: ROWS * FRAME_H,
            frameWidth: FRAME_W,
            frameHeight: FRAME_H,
            directions: ['down', 'up', 'left', 'right', 'diag_ne', 'diag_nw', 'diag_sw', 'diag_se'],
            directionMirrors: {
                'right': 'left',
                'diag_nw': 'diag_ne',
                'diag_se': 'diag_sw'
            },
            animations: {
                idle_down:    { frames: [0, 1, 2, 3], fps: 2, loop: true },
                idle_up:      { frames: [10, 11, 12, 13], fps: 2, loop: true },
                idle_left:    { frames: [20, 21, 22, 23], fps: 2, loop: true },
                idle_right:   { frames: [30, 31, 32, 33], fps: 2, loop: true },
                idle_diag_ne: { frames: [40, 41, 42, 43], fps: 2, loop: true },
                idle_diag_nw: { frames: [50, 51, 52, 53], fps: 2, loop: true },
                idle_diag_sw: { frames: [60, 61, 62, 63], fps: 2, loop: true },
                idle_diag_se: { frames: [70, 71, 72, 73], fps: 2, loop: true },
                walk_down:    { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 8, loop: true },
                walk_up:      { frames: [10, 11, 12, 13, 14, 15, 16, 17], fps: 8, loop: true },
                walk_left:    { frames: [20, 21, 22, 23, 24, 25, 26, 27], fps: 8, loop: true },
                walk_right:   { frames: [30, 31, 32, 33, 34, 35, 36, 37], fps: 8, loop: true },
                walk_diag_ne: { frames: [40, 41, 42, 43, 44, 45, 46, 47], fps: 8, loop: true },
                walk_diag_nw: { frames: [50, 51, 52, 53, 54, 55, 56, 57], fps: 8, loop: true },
                walk_diag_sw: { frames: [60, 61, 62, 63, 64, 65, 66, 67], fps: 8, loop: true },
                walk_diag_se: { frames: [70, 71, 72, 73, 74, 75, 76, 77], fps: 8, loop: true }
            },
            metadata: {
                author: 'RealmKit',
                variant: 'procedural',
                tags: ['test', 'hero', 'procedural']
            }
        };
        
        var canvas = document.createElement('canvas');
        canvas.width = manifest.imageWidth;
        canvas.height = manifest.imageHeight;
        var ctx = canvas.getContext('2d', { alpha: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        var dirColors = {
            down: { body: '#4ecca3', outline: '#2a8a73' },
            up: { body: '#ff6b6b', outline: '#cc4444' },
            left: { body: '#feca57', outline: '#cc9933' },
            right: { body: '#5f9ea0', outline: '#337777' },
            diag_ne: { body: '#9b59b6', outline: '#7d3c98' },
            diag_nw: { body: '#e67e22', outline: '#b8560e' },
            diag_sw: { body: '#1abc9c', outline: '#148f77' },
            diag_se: { body: '#3498db', outline: '#2471a3' }
        };
        
        var ANIM_FRAMES = {
            idle: 4,
            walk: 8
        };
        
        for (var animType = 0; animType < 2; animType++) {
            var animName = ['idle', 'walk'][animType];
            var frames = ANIM_FRAMES[animName];
            var rowBase = animType * 10;
            
            for (var dir = 0; dir < 8; dir++) {
                var dirName = manifest.directions[dir];
                var colors = dirColors[dirName];
                
                for (var frame = 0; frame < frames; frame++) {
                    var col = frame;
                    var row = rowBase + dir;
                    var x = col * FRAME_W;
                    var y = row * FRAME_H;
                    
                    this.drawCharacterFrame(ctx, x, y, FRAME_W, FRAME_H, colors, frame, dirName, animName);
                }
            }
        }
        
        var imageData = canvas.toDataURL('image/png');
        
        console.log('[ProceduralSprite] Canvas data URL length:', imageData.length);
        
        var image = new Image();
        image.src = imageData;
        
        console.log('[ProceduralSprite] Image created - complete:', image.complete);
        
        return {
            image: image,
            manifest: manifest
        };
    },
    
    drawCharacterFrame: function(ctx, x, y, w, h, colors, frameNum, direction, animType) {
        var bounce = 0;
        var armSwing = 0;
        var legSwing = 0;
        var speed = animType === 'run' ? 2 : (animType === 'walk' ? 1 : 0.5);
        
        if (animType === 'idle') {
            bounce = Math.sin(frameNum * 0.8) * 1;
        } else {
            bounce = Math.sin((frameNum / 8) * Math.PI * 2) * 2;
            armSwing = Math.sin((frameNum / 8) * Math.PI * 2) * 8 * speed;
            legSwing = (frameNum % 2 === 0) ? 3 * speed : -3 * speed;
        }
        
        ctx.strokeStyle = colors.outline;
        ctx.lineWidth = 1;
        
        var centerX = x + w / 2;
        var torsoY = y + h * 0.4 + bounce;
        
        ctx.fillStyle = colors.body;
        ctx.beginPath();
        ctx.ellipse(centerX, torsoY, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = colors.outline;
        ctx.beginPath();
        ctx.arc(centerX, y + h * 0.2 + bounce, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#1a1a2e';
        var eyeOffsetX = 0;
        var eyeOffsetY = 0;
        if (direction === 'left') eyeOffsetX = -2;
        if (direction === 'right') eyeOffsetX = 2;
        if (direction === 'up' || direction === 'diag_nw' || direction === 'diag_up') eyeOffsetY = -1;
        ctx.beginPath();
        ctx.arc(centerX - 2 + eyeOffsetX, y + h * 0.18 + bounce + eyeOffsetY, 1.5, 0, Math.PI * 2);
        ctx.arc(centerX + 2 + eyeOffsetX, y + h * 0.18 + bounce + eyeOffsetY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.outline;
        var armDir = direction.includes('left') ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 8 * armDir, torsoY + 12);
        ctx.lineTo(centerX - 8 * armDir - armSwing * 0.5 * armDir, y + h * 0.75 + legSwing);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX + 8 * armDir, torsoY + 12);
        ctx.lineTo(centerX + 8 * armDir + armSwing * 0.5 * armDir, y + h * 0.75 - legSwing);
        ctx.stroke();
        
        ctx.fillStyle = colors.body;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.ellipse(centerX - 8 * armDir - armSwing * 0.5 * armDir, y + h * 0.75 + legSwing, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(centerX + 8 * armDir + armSwing * 0.5 * armDir, y + h * 0.75 - legSwing, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#888';
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        var label = direction.substring(0, 2).toUpperCase() + (animType ? animType[0] : 'i') + frameNum;
        ctx.fillText(label, centerX, y + h - 10);
    },
    
    createTileset: function(tileSize, tilesX, tilesY) {
        tileSize = tileSize || 32;
        tilesX = tilesX || 8;
        tilesY = tilesY || 8;
        
        var canvas = document.createElement('canvas');
        canvas.width = tileSize * tilesX;
        canvas.height = tileSize * tilesY;
        var ctx = canvas.getContext('2d');
        
        for (var ty = 0; ty < tilesY; ty++) {
            for (var tx = 0; tx < tilesX; tx++) {
                var x = tx * tileSize;
                var y = ty * tileSize;
                var tileIndex = ty * tilesX + tx;
                
                this.drawTile(ctx, x, y, tileSize, tileIndex);
            }
        }
        
        var image = new Image();
        image.src = canvas.toDataURL('image/png');
        image.width = canvas.width;
        image.height = canvas.height;
        
        return {
            image: image,
            tileSize: tileSize,
            tilesX: tilesX,
            tilesY: tilesY
        };
    },
    
    drawTile: function(ctx, x, y, size, index) {
        var patterns = [
            { bg: '#2d5a27', pattern: 'grass' },
            { bg: '#4a7c59', pattern: 'grass' },
            { bg: '#5a6a7a', pattern: 'stone' },
            { bg: '#8b7355', pattern: 'dirt' },
            { bg: '#4682b4', pattern: 'water' },
            { bg: '#3a3a3a', pattern: 'floor' },
            { bg: '#654321', pattern: 'wood' },
            { bg: '#d4d4d4', pattern: 'stone' }
        ];
        
        var pattern = patterns[index % patterns.length];
        
        ctx.fillStyle = pattern.bg;
        ctx.fillRect(x, y, size, size);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
        
        if (pattern.pattern === 'grass') {
            ctx.fillStyle = 'rgba(0,100,0,0.3)';
            for (var i = 0; i < 5; i++) {
                var gx = x + (Math.random() * (size - 4) + 2);
                var gy = y + (Math.random() * (size - 4) + 2);
                ctx.fillRect(gx, gy, 2, 2);
            }
        } else if (pattern.pattern === 'water') {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + size/2);
            ctx.quadraticCurveTo(x + size/2, y + size/3, x + size - 4, y + size/2);
            ctx.stroke();
        } else if (pattern.pattern === 'stone') {
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            for (var j = 0; j < 3; j++) {
                ctx.strokeRect(
                    x + Math.random() * (size - 8) + 2,
                    y + Math.random() * (size - 8) + 2,
                    4,
                    4
                );
            }
        }
        
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index.toString(), x + size/2, y + size/2);
    }
};

console.log('[ProceduralSprite] Module loaded - legacy 10-column format');
