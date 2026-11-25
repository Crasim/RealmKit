var RealmKit = RealmKit || {};

RealmKit.DefaultStory = {
    id: 'default',
    title: 'The Uncharted Realm',
    slug: 'uncharted-realm',
    description: 'A vast procedurally generated world awaits. Explore forests, swamps, mountains, and discover hidden treasures.',
    genre: 'medieval_fantasy',
    is_published: true,
    
    engine_configs: {
        terrain_water_level: 0.22,
        terrain_hill_level: 0.78,
        terrain_mountain_level: 0.88,
        terrain_elevation_scale: 0.008,
        default_weather: 'clear',
        weather_intensity: 0.3,
        day_night_speed: 120,
        lighting_theme: 'warm',
        ui_theme: 'parchment',
        default_map_width: 256,
        default_map_height: 256
    },
    
    factions: [
        { id: 'faction_player', name: 'player', display_name: 'Player', color: '#44ff44' },
        { id: 'faction_friendly', name: 'friendly', display_name: 'Friendly', color: '#44cc44' },
        { id: 'faction_guards', name: 'Guards', display_name: 'Town Guard', color: '#4488ff' },
        { id: 'faction_merchants', name: 'Merchants', display_name: 'Merchants Guild', color: '#44cc44' },
        { id: 'faction_bandits', name: 'Bandits', display_name: 'Bandits', color: '#aa4444' },
        { id: 'faction_wildlife', name: 'Wildlife', display_name: 'Wild Creatures', color: '#886644' },
        { id: 'faction_hostile', name: 'hostile', display_name: 'Hostile Enemies', color: '#ff4444' }
    ],
    
    faction_relations: [
        { faction_a_id: 'faction_player', faction_b_id: 'faction_friendly', relation_type: 'ally' },
        { faction_a_id: 'faction_player', faction_b_id: 'faction_hostile', relation_type: 'enemy' },
        { faction_a_id: 'faction_player', faction_b_id: 'faction_bandits', relation_type: 'enemy' },
        { faction_a_id: 'faction_player', faction_b_id: 'faction_guards', relation_type: 'ally' },
        { faction_a_id: 'faction_player', faction_b_id: 'faction_merchants', relation_type: 'ally' },
        { faction_a_id: 'faction_player', faction_b_id: 'faction_wildlife', relation_type: 'enemy' },
        { faction_a_id: 'faction_friendly', faction_b_id: 'faction_hostile', relation_type: 'enemy' },
        { faction_a_id: 'faction_guards', faction_b_id: 'faction_bandits', relation_type: 'enemy' },
        { faction_a_id: 'faction_guards', faction_b_id: 'faction_merchants', relation_type: 'ally' },
        { faction_a_id: 'faction_merchants', faction_b_id: 'faction_bandits', relation_type: 'enemy' },
        { faction_a_id: 'faction_wildlife', faction_b_id: 'faction_guards', relation_type: 'neutral' },
        { faction_a_id: 'faction_wildlife', faction_b_id: 'faction_bandits', relation_type: 'neutral' },
        { faction_a_id: 'faction_hostile', faction_b_id: 'faction_guards', relation_type: 'enemy' },
        { faction_a_id: 'faction_hostile', faction_b_id: 'faction_merchants', relation_type: 'enemy' },
        { faction_a_id: 'faction_hostile', faction_b_id: 'faction_friendly', relation_type: 'enemy' }
    ],
    
    story_flag_definitions: [
        { flag_key: 'met_merchant', flag_type: 'boolean', default_value: 'false', description: 'Has met the traveling merchant' },
        { flag_key: 'killed_first_goblin', flag_type: 'boolean', default_value: 'false', description: 'Killed the first goblin' },
        { flag_key: 'reputation_score', flag_type: 'integer', default_value: '0', description: 'Reputation with local factions' },
        { flag_key: 'chosen_faction', flag_type: 'string', default_value: '', description: 'The faction the player has aligned with' }
    ],
    
    characters: [
        {
            id: 'char_guard_captain',
            name: 'guard_captain',
            display_name: 'Captain Aldric',
            faction_id: 'faction_guards',
            behavior: 'idle',
            base_hp: 150,
            base_attack: 15,
            base_defense: 10,
            base_speed: 80
        },
        {
            id: 'char_merchant',
            name: 'traveling_merchant',
            display_name: 'Haldor the Merchant',
            faction_id: 'faction_merchants',
            behavior: 'wander',
            base_hp: 60,
            base_attack: 5,
            base_defense: 5,
            base_speed: 60
        },
        {
            id: 'char_bandit_leader',
            name: 'bandit_leader',
            display_name: 'Grimald the Ruthless',
            faction_id: 'faction_bandits',
            behavior: 'hostile',
            base_hp: 100,
            base_attack: 20,
            base_defense: 8,
            base_speed: 90
        },
        {
            id: 'char_wolf',
            name: 'wolf',
            display_name: 'Wild Wolf',
            faction_id: 'faction_wildlife',
            behavior: 'hostile',
            base_hp: 40,
            base_attack: 12,
            base_defense: 3,
            base_speed: 120
        },
        {
            id: 'char_goblin',
            name: 'goblin',
            display_name: 'Goblin Scout',
            faction_id: 'faction_bandits',
            behavior: 'hostile',
            base_hp: 30,
            base_attack: 8,
            base_defense: 2,
            base_speed: 100
        }
    ],
    
    quests: [
        {
            id: 'quest_first_kill',
            title: 'First Blood',
            description: 'Defeat your first enemy in the Uncharted Realm.',
            giver_character_id: null,
            reward_gold: 50,
            reward_xp: 100,
            auto_complete: true,
            objectives: [
                { objective_type: 'kill', target_name: 'any', required_count: 1 }
            ]
        },
        {
            id: 'quest_goblin_slayer',
            title: 'Goblin Slayer',
            description: 'Clear the goblin threat from the forest.',
            giver_character_id: 'char_guard_captain',
            prerequisite_quest_id: 'quest_first_kill',
            reward_gold: 200,
            reward_xp: 500,
            auto_complete: true,
            objectives: [
                { objective_type: 'kill', target_name: 'goblin', required_count: 5 }
            ]
        }
    ],
    
    scenes: [
        {
            id: 'scene_starting_village',
            name: 'Starting Village',
            description: 'A peaceful village on the edge of civilization.',
            map_seed: 12345,
            map_width: 128,
            map_height: 128,
            is_entry_point: true,
            spawn_templates: [
                { character_id: 'char_guard_captain', spawn_x: 400, spawn_y: 350, max_count: 1 },
                { character_id: 'char_merchant', spawn_x: 500, spawn_y: 380, max_count: 1 }
            ]
        }
    ],
    
    dialogues: [
        {
            id: 'dialog_guard_captain',
            character_id: 'char_guard_captain',
            name: 'Captain Aldric\'s Greeting',
            nodes: [
                { id: 'node_gc_1', speaker_character_id: 'char_guard_captain', text: 'Hail, traveler! I am Captain Aldric of the Town Guard.', node_type: 'line' },
                { id: 'node_gc_2', speaker_character_id: 'char_guard_captain', text: 'These are dangerous lands. Bandits lurk in the forests, and wolves stalk the hills.', node_type: 'line' },
                { id: 'node_gc_3', speaker_character_id: 'char_guard_captain', text: 'If you\'re looking to prove yourself, I have tasks that need doing.', node_type: 'choice', set_flag: 'met_guard_captain', set_flag_value: 'true' }
            ],
            choices: [
                { node_id: 'node_gc_3', text: 'I\'m ready for a challenge.', next_node_id: 'node_gc_quest' },
                { node_id: 'node_gc_3', text: 'What dangers await?', next_node_id: 'node_gc_danger' },
                { node_id: 'node_gc_3', text: 'I\'ll be on my way.', next_node_id: 'node_gc_end' },
                { node_id: 'node_gc_danger', text: 'Tell me more.', next_node_id: 'node_gc_quest' }
            ],
            entry_node_id: 'node_gc_1'
        },
        {
            id: 'dialog_guard_captain_quest',
            character_id: 'char_guard_captain',
            name: 'Goblin Slayer Quest',
            nodes: [
                { id: 'node_gc_quest', speaker_character_id: 'char_guard_captain', text: 'Goblins have been raiding our supply caravans. Clear out 5 of them, and I\'ll see you\'re rewarded.', node_type: 'line' },
                { id: 'node_gc_quest_accept', speaker_character_id: 'char_guard_captain', text: 'Good hunting, adventurer. Return when the job is done.', node_type: 'end', set_flag: 'quest_goblin_slayer_active', set_flag_value: 'true' }
            ],
            choices: [
                { node_id: 'node_gc_quest', text: 'I\'ll handle it.', next_node_id: 'node_gc_quest_accept' },
                { node_id: 'node_gc_quest', text: 'I need more time.', next_node_id: 'node_gc_end' }
            ],
            entry_node_id: 'node_gc_quest'
        },
        {
            id: 'dialog_merchant',
            character_id: 'char_merchant',
            name: 'Haldor\'s Greeting',
            nodes: [
                { id: 'node_m_1', speaker_character_id: 'char_merchant', text: 'Welcome, welcome! Haldor\'s the name, trading\'s my game!', node_type: 'line' },
                { id: 'node_m_2', speaker_character_id: 'char_merchant', text: 'I deal in rare goods from distant lands. Potions, trinkets, things travelers find useful.', node_type: 'choice' },
                { id: 'node_m_trade', speaker_character_id: 'char_merchant', text: 'Splendid! Let me show you my wares...', node_type: 'end' },
                { id: 'node_m_rumor', speaker_character_id: 'char_merchant', text: 'I\'ve heard the ancient ruins to the east hold forgotten treasures. But beware—the guardians there are fierce!', node_type: 'line' }
            ],
            choices: [
                { node_id: 'node_m_2', text: 'What do you have for sale?', next_node_id: 'node_m_trade' },
                { node_id: 'node_m_2', text: 'Any news from the roads?', next_node_id: 'node_m_rumor' },
                { node_id: 'node_m_2', text: 'I should go.', next_node_id: 'node_m_end' },
                { node_id: 'node_m_rumor', text: 'Interesting. Thanks for the warning.', next_node_id: 'node_m_end' }
            ],
            entry_node_id: 'node_m_1'
        }
    ]
};

console.log('[DefaultStory] Loaded');