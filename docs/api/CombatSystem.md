# CombatSystem

Handles attack rolls, damage calculation, aggro, and combat flow.

## Constructor

```javascript
var combat = new RealmKit.CombatSystem();
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `onDamage` | `function` | Callback when damage dealt |
| `onKill` | `function` | Callback when entity killed |
| `onCritical` | `function` | Callback on critical hit |
| `log` | `array` | Combat log entries |

## Methods

### attack(attacker, target, weapon)

```javascript
var result = combat.attack(player, monster, player.weapon);
// { hit: true, damage: 15, critical: false }
```

Perform a melee attack roll.

### rangedAttack(attacker, target, weapon)

```javascript
combat.rangedAttack(player, target, bow);
// Creates projectile in ProjectileSystem
```

Perform a ranged attack. Creates projectile that travels to target.

### calculateDamage(attacker, target, weapon)

```javascript
var damage = combat.calculateDamage(player, monster, sword);
```

Calculate base damage without hit roll.

### rollHit(attacker, target, weapon)

```javascript
if (combat.rollHit(attacker, target, weapon)) {
    // attack hits
}
```

D&D-style to-hit roll: d20 + attack_bonus vs AC.

### checkCritical(weapon)

```javascript
if (combat.checkCritical(weapon)) {
    // critical hit!
}
```

Roll for critical hit (usually 5% chance, can be modified).

### getThreat(attacker, target)

```javascript
var threat = combat.getThreat(attacker, monster);
```

Get current threat value for aggro calculation.

### addThreat(attacker, target, amount)

```javascript
combat.addThreat(player, boss, 50);
```

Add threat to aggro table. High-threat targets are prioritized.

## Hit Roll Formula

```
To Hit = d20 + attack_bonus + stat_modifier
AC = base_AC + armor_bonus + shield_bonus
Hit if: To Hit >= AC
```

## Damage Formula

```
Base Damage = weapon_damage + stat_bonus
Actual Damage = max(1, Base Damage - defense)
Critical Damage = Base Damage * critical_multiplier
```

## Example

```javascript
var combat = new RealmKit.CombatSystem();

combat.onDamage = function(attacker, target, damage, critical) {
    console.log(attacker.name, 'hit', target.name, 'for', damage);
    engine.addScreenShake(critical ? 0.8 : 0.3, critical ? 400 : 200);
};

combat.onKill = function(killer, victim) {
    console.log(killer.name, 'killed', victim.name);
    engine.questSystem.checkObjective('kill', victim.type);
};

// Player attacks monster
var result = combat.attack(player, goblin, player.weapon);
if (result.hit) {
    goblin.combatStats.hp -= result.damage;
    if (goblin.combatStats.hp <= 0) {
        combat.onKill(player, goblin);
    }
}
```

## Integration

CombatSystem is created by Engine and wired to:
- `StatusEffectManager` for buff/debuff modifiers
- `ThreatManager` for aggro tables
- `ProjectileSystem` for ranged attacks
- `ParticleSystem` for hit effects