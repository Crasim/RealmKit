var RealmKit = RealmKit || {};

RealmKit.TestHarness = class TestHarness {
    constructor(engine) {
        this.engine = engine;
        this.combatSystem = new RealmKit.CombatSystem();
        this.testResults = [];
        this.logUrl = 'log.php';
        this.sessionId = Date.now();
        
        this.autoTestInterval = null;
        this.testPhase = 0;
        
        console.log('[TestHarness] Initialized');
    }
    
    startAutoTest() {
        var self = this;
        this.runMapGenerationTests();
        
        console.log('[TestHarness] Starting auto-test');
        console.log('[TestHarness] Combat tests will run every 10 seconds');
        
        this.autoTestInterval = setInterval(function() {
            self.runCombatTests();
        }, 10000);
        
        this.hudReady = false;
        window.testHarness = this;
    }
    
    stopAutoTest() {
        if (this.autoTestInterval) {
            clearInterval(this.autoTestInterval);
            this.autoTestInterval = null;
        }
    }
    
    runMapGenerationTests() {
        console.log('[TestHarness] Running map generation tests...');
        
        var dungeonMap = RealmKit.MapData.generateDungeon({
            width: 30,
            height: 20,
            roomCount: 4
        });
        
        var openWorldMap = RealmKit.MapData.generateOpenWorld({
            width: 50,
            height: 50,
            treeDensity: 0.03,
            waterDensity: 0.01
        });
        
        this.testResults.push({
            type: 'map_generation',
            dungeon: {
                id: dungeonMap.id,
                width: dungeonMap.width,
                height: dungeonMap.height,
                rooms: dungeonMap.spawns ? dungeonMap.spawns.length : 0,
                collisionTiles: this.countCollisionTiles(dungeonMap.collisionLayer)
            },
            openWorld: {
                id: openWorldMap.id,
                width: openWorldMap.width,
                height: openWorldMap.height,
                collisionTiles: this.countCollisionTiles(openWorldMap.collisionLayer)
            }
        });
        
        this.logTest('map_generation', {
            dungeon_rooms: this.testResults[0].dungeon.rooms,
            dungeon_collision: this.testResults[0].dungeon.collisionTiles,
            openworld_collision: this.testResults[0].openWorld.collisionTiles
        });
        
        console.log('[TestHarness] Map generation tests complete');
        console.log('  Dungeon:', dungeonMap.width + 'x' + dungeonMap.height, 'rooms:', this.testResults[0].dungeon.rooms);
        console.log('  OpenWorld:', openWorldMap.width + 'x' + openWorldMap.height, 'collision tiles:', this.testResults[0].openWorld.collisionTiles);
    }
    
    countCollisionTiles(collisionLayer) {
        if (!collisionLayer) return 0;
        var count = 0;
        for (var i = 0; i < collisionLayer.length; i++) {
            if (collisionLayer[i] === 1) count++;
        }
        return count;
    }
    
    runCombatTests() {
        console.log('[TestHarness] Running combat tests...');
        
        this.combatSystem = new RealmKit.CombatSystem();
        
        var fighter1 = RealmKit.EntityFactory.create('enemy_goblin', { id: 'goblin_test' });
        var fighter2 = RealmKit.EntityFactory.create('enemy_skeleton', { id: 'skeleton_test' });
        var fighter3 = RealmKit.EntityFactory.create('enemy_mage', { id: 'mage_test' });
        
        var stats1 = this.combatSystem.registerEntity({ id: fighter1.id }, fighter1.stats);
        var stats2 = this.combatSystem.registerEntity({ id: fighter2.id }, fighter2.stats);
        var stats3 = this.combatSystem.registerEntity({ id: fighter3.id }, fighter3.stats);
        
        var combatLog = [];
        var round = 0;
        var maxRounds = 20;
        
        while (stats1.hp > 0 && stats2.hp > 0 && round < maxRounds) {
            round++;
            
            var action1 = this.combatSystem.aiSelectAction(
                { entity: { id: fighter1.id }, stats: stats1 },
                { entity: { id: fighter2.id }, stats: stats2 }
            );
            var result1 = this.combatSystem.attack(fighter1.id, fighter2.id, action1.abilityId || 'basic_attack');
            if (result1) combatLog.push(result1);
            
            if (stats2.hp <= 0) break;
            
            var action2 = this.combatSystem.aiSelectAction(
                { entity: { id: fighter2.id }, stats: stats2 },
                { entity: { id: fighter1.id }, stats: stats1 }
            );
            var result2 = this.combatSystem.attack(fighter2.id, fighter1.id, action2.abilityId || 'basic_attack');
            if (result2) combatLog.push(result2);
            
            this.combatSystem.update(100);
        }
        
        var winner = stats1.hp > 0 ? fighter1.id : (stats2.hp > 0 ? fighter2.id : 'draw');
        
        this.testResults.push({
            type: 'combat_test',
            round: this.testResults.length,
            fighter1: { id: fighter1.id, hp: stats1.hp, maxHp: stats1.maxHp },
            fighter2: { id: fighter2.id, hp: stats2.hp, maxHp: stats2.maxHp },
            winner: winner,
            rounds: round,
            totalDamage: this.calculateTotalDamage(combatLog)
        });
        
        this.logTest('combat', {
            f1_hp: stats1.hp + '/' + stats1.maxHp,
            f2_hp: stats2.hp + '/' + stats2.maxHp,
            rounds: round,
            winner: winner
        });
        
        console.log('[TestHarness] Combat test round', this.testResults.length - 1, 
            '- Winner:', winner, 'Rounds:', round);
        
        this.testPhase++;
    }
    
    calculateTotalDamage(log) {
        var total = 0;
        for (var i = 0; i < log.length; i++) {
            if (log[i].damage) {
                total += log[i].damage;
            }
        }
        return total;
    }
    
    logTest(testType, data) {
        var entry = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString().substr(11, 12),
            type: 'test_' + testType
        };
        
        for (var key in data) {
            entry[key] = data[key];
        }
        
        var params = 'sid=' + this.sessionId + '&ts=' + encodeURIComponent(entry.timestamp) + '&type=' + entry.type;
        for (var key in data) {
            params += '&' + key + '=' + encodeURIComponent(data[key]);
        }
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.logUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(params);
    }
    
    getTestResults() {
        return this.testResults.slice();
    }
    
    runStressTest(entityCount, rounds) {
        console.log('[TestHarness] Running stress test:', entityCount, 'entities,', rounds, 'rounds');
        
        var startTime = performance.now();
        
        for (var r = 0; r < rounds; r++) {
            var tempCombat = new RealmKit.CombatSystem();
            var entities = [];
            
            for (var i = 0; i < entityCount; i++) {
                var template = i % 3 === 0 ? 'enemy_goblin' : (i % 3 === 1 ? 'enemy_skeleton' : 'enemy_mage');
                var entity = RealmKit.EntityFactory.create(template, { id: 'stress_' + i });
                tempCombat.registerEntity({ id: entity.id }, entity.stats);
                entities.push({ entity: { id: entity.id }, stats: entity.stats });
            }
            
            for (var e = 0; e < entities.length - 1; e++) {
                tempCombat.attack(entities[e].entity.id, entities[e + 1].entity.id);
            }
        }
        
        var duration = performance.now() - startTime;
        
        console.log('[TestHarness] Stress test complete:', rounds, 'rounds in', duration.toFixed(1), 'ms');
        console.log('  Average:', (duration / rounds).toFixed(2), 'ms per round for', entityCount, 'entities');
        
        return {
            type: 'stress_test',
            entityCount: entityCount,
            rounds: rounds,
            durationMs: duration,
            avgMs: duration / rounds
        };
    }
};

console.log('[TestHarness] Class loaded');