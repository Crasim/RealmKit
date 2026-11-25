# Entity

Base class for all game objects. Provides position, velocity, collision, and animation.

## Constructor

```javascript
var entity = new RealmKit.Entity({
    id: 'npc_001',
    type: 'npc',
    name: 'Villager',
    x: 500,
    y: 300,
    width: 32,
    height: 32,
    speed: 100,
    sprite: spriteCanvas,
    manifest: animationManifest,
    solid: true,
    interactable: true,
    faction: 'neutral'
});
```

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | auto | Unique identifier |
| `type` | `string` | 'entity' | Entity type (npc, monster, player) |
| `name` | `string` | type | Display name |
| `x`, `y` | `number` | 0 | World position (center) |
| `width`, `height` | `number` | 32 | Collision bounds |
| `velocityX`, `velocityY` | `number` | 0 | Movement velocity (px/s) |
| `speed` | `number` | 100 | Base movement speed |
| `sprite` | `Canvas` | null | Sprite canvas for rendering |
| `animation` | `string` | 'idle_down' | Current animation state |
| `direction` | `string` | 'down' | Facing direction |
| `solid` | `boolean` | true | Collides with other entities |
| `collidable` | `boolean` | true | Can be collided with |
| `interactable` | `boolean` | false | E key triggers interaction |
| `active` | `boolean` | true | Entity is updated |
| `visible` | `boolean` | true | Entity is rendered |
| `faction` | `string` | 'neutral' | Faction for combat |

## Methods

### update(deltaTime, world)

```javascript
entity.update(16, engine);
```

Update position, animation, and state. Called automatically by EntityManager.

### getBounds()

```javascript
var bounds = entity.getBounds();
// { x, y, width, height }
```

Get AABB collision rectangle (x/y is top-left).

### intersects(other)

```javascript
if (entity.intersects(otherEntity)) {
    // collision detected
}
```

Check if two entities overlap.

### checkEntityCollision(other)

```javascript
var collision = entity.checkEntityCollision(other);
if (collision) {
    console.log('Overlap:', collision.overlapX, collision.overlapY);
}
```

Get detailed collision data including overlap amounts.

### resolveEntityCollision(collision, pushForce)

```javascript
entity.resolveEntityCollision(collision, 0.5);
```

Push entity out of collision. `pushForce` 0.5 = split between both entities.

### nudgeEntity(other, strength)

```javascript
player.nudgeEntity(npc, 50);
```

Push another entity away (used when player walks into NPC).

### getTilePosition(tileWidth, tileHeight)

```javascript
var tile = entity.getTilePosition(32, 32);
// { x: 15, y: 10 }
```

Get tile coordinates for this entity.

### equipWeapon(weapon)

```javascript
entity.equipWeapon(new RealmKit.Weapon({
    name: 'Iron Sword',
    damage: 10,
    attackSpeed: 1.5
}));
```

### attack()

```javascript
if (entity.attack()) {
    // attack started
}
```

Attempt to attack with equipped weapon. Returns false if no weapon or already attacking.

## Combat Stats

Entities can have combat stats attached:

```javascript
entity.combatStats = {
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 15,
    defense: 10,
    level: 5
};
```

## Animation States

Default animation states:
- `idle_up`, `idle_down`, `idle_left`, `idle_right`
- `walk_up`, `walk_down`, `walk_left`, `walk_right`
- `attack_up`, `attack_down`, `attack_left`, `attack_right`

## Death Handling

```javascript
entity.combatStats.hp = 0;
// Entity enters death state:
// - velocity frozen
// - deathTime set
// - lootDrops spawned
// - body lingers for 3s (or until collected)
```

## Example

```javascript
var guard = new RealmKit.Entity({
    type: 'npc',
    name: 'Town Guard',
    x: 400,
    y: 500,
    speed: 80,
    solid: true,
    interactable: true,
    faction: 'town'
});

guard.combatStats = {
    hp: 150,
    maxHp: 150,
    attack: 20,
    defense: 15,
    level: 10
};

guard.dialog = [
    { text: 'Halt! Who goes there?', next: 1 },
    { text: 'State your business.', choices: [
        { text: 'Just passing through.', next: 2 },
        { text: 'I need supplies.', next: 3 }
    ]}
];
```