var RealmKit = RealmKit || {};

RealmKit.Config = {
    version: '1.1.0',
    
    resolution: {
        base: '16bit',
        tileSize: 32,
        scale: 2
    },
    
    viewport: {
        width: 800,
        height: 600,
        defaultScale: 2,
        scaleRange: {
            min: 1,
            max: 4
        }
    },
    
    gameLoop: {
        targetFPS: 60,
        fixedDelta: 1000 / 60
    },
    
    assets: {
        basePath: '',
        testSprite: {
            image: 'assets/sprites/test_hero.png',
            manifest: 'assets/sprites/test_hero.json'
        },
        preload: {
            enabled: true,
            showProgress: true,
            timeout: 30000,
            retryCount: 3,
            retryDelay: 1000
        }
    },
    
    debug: {
        enabled: true,
        logFPS: true,
        logAssets: true,
        showHitboxes: false,
        showGrid: false,
        showCoordinates: false,
        showTerrainDebug: false,
        showSpawnerDebug: false,
        showTriggerDebug: false,
        showPathDebug: false
    },

    loot: {
        autoPickup: true,           // auto-collect drops when walking over
        bodyInteractRadius: 50,     // distance to show E prompt for bodies
        bodyLootKey: 'e'            // key to loot bodies (auto-pickup ignores this)
    }
};

console.log('[RealmKit] Config loaded:', RealmKit.Config);