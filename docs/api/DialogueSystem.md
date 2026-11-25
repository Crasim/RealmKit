# DialogueSystem

Branching conversations with conditions, choices, and callbacks.

## Constructor

```javascript
var dialogues = new RealmKit.DialogueSystem();
```

## Methods

### start(nodeId)

```javascript
dialogues.start('villager_greeting');
```

Begin a dialogue tree at the specified node.

### advance()

```javascript
dialogues.advance();
```

Move to next dialogue line. Call when player presses E.

### choose(index)

```javascript
dialogues.choose(0);  // select first choice
```

Select a choice from the current node.

### selectChoice(index)

Alias for `choose()`. Included for API clarity.

### isActive()

```javascript
if (dialogues.isActive()) {
    // dialogue is showing
}
```

### getCurrentNode()

```javascript
var node = dialogues.getCurrentNode();
// { text: 'Hello traveler', choices: [...] }
```

## Dialogue Node Format

```javascript
{
    id: 'villager_greeting',
    text: 'Hello traveler! What brings you here?',
    speaker: 'Village Elder',
    portrait: 'elder_portrait',
    choices: [
        { text: 'Looking for adventure.', next: 'villager_quest' },
        { text: 'Just passing through.', next: 'villager_goodbye' },
        { text: '[Leave]', action: 'close' }
    ],
    condition: {
        type: 'flag',
        flag: 'met_elder',
        value: true
    },
    actions: [
        { type: 'setFlag', flag: 'met_elder', value: true }
    ]
}
```

## Condition Types

| Type | Description |
|------|-------------|
| `flag` | Check game flag |
| `item` | Check player inventory |
| `quest` | Check quest status |
| `level` | Check player level |
| `gold` | Check gold amount |

## Action Types

| Action | Description |
|--------|-------------|
| `setFlag` | Set game flag |
| `giveItem` | Add item to inventory |
| `takeItem` | Remove item from inventory |
| `giveGold` | Add gold |
| `takeGold` | Remove gold |
| `startQuest` | Start a quest |
| `completeQuest` | Complete a quest |
| `teleport` | Move player to location |

## Example

```javascript
var dialogueSystem = new RealmKit.DialogueSystem();

// Add dialogue tree
dialogueSystem.trees['guard_post'] = {
    id: 'guard_start',
    text: 'Halt! State your business.',
    speaker: 'Town Guard',
    choices: [
        { 
            text: 'I have a delivery for the blacksmith.',
            next: 'guard_delivery',
            condition: { type: 'item', itemId: 'package_01', count: 1 }
        },
        { 
            text: 'I\'m looking for work.',
            next: 'guard_work'
        },
        { 
            text: 'Never mind.',
            action: 'close'
        }
    ]
};

// Start dialogue
engine.inputHandler.onInteract = function() {
    if (nearbyNPC) {
        dialogueSystem.start(nearbyNPC.dialogId);
        engine.isPaused = true;
    }
};

// Handle choice
dialogueSystem.onChoose = function(index, choice) {
    console.log('Player chose:', choice.text);
    if (choice.action === 'giveItem') {
        engine.inventoryManager.addItem(choice.itemId, choice.count);
    }
};
```