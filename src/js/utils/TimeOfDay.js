var RealmKit = RealmKit || {};

RealmKit.TimeOfDay = {
    
    PHASES: {
        MIDNIGHT: 'midnight',
        PRE_DAWN: 'pre_dawn',
        DAWN: 'dawn',
        MORNING: 'morning',
        NOON: 'noon',
        AFTERNOON: 'afternoon',
        DUSK: 'dusk',
        EVENING: 'evening',
        NIGHT: 'night'
    },
    
    PHASE_TIMES: {
        midnight: { start: 0, end: 4 },
        pre_dawn: { start: 4, end: 6 },
        dawn: { start: 6, end: 8 },
        morning: { start: 8, end: 12 },
        noon: { start: 12, end: 14 },
        afternoon: { start: 14, end: 18 },
        dusk: { start: 18, end: 20 },
        evening: { start: 20, end: 22 },
        night: { start: 22, end: 24 }
    },
    
    getTimeOfDay: function(seconds) {
        var hour = (seconds / 3600) % 24;
        
        if (hour < 4) return 'night';
        if (hour < 6) return 'pre_dawn';
        if (hour < 8) return 'dawn';
        if (hour < 12) return 'morning';
        if (hour < 14) return 'noon';
        if (hour < 18) return 'afternoon';
        if (hour < 20) return 'dusk';
        if (hour < 22) return 'evening';
        return 'night';
    },
    
    getHour: function(seconds) {
        return Math.floor((seconds / 3600) % 24);
    },
    
    getMinute: function(seconds) {
        return Math.floor((seconds / 60) % 60);
    },
    
    formatTime: function(seconds) {
        var h = this.getHour(seconds);
        var m = this.getMinute(seconds);
        var period = h >= 12 ? 'PM' : 'AM';
        var h12 = h % 12 || 12;
        return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + period;
    },
    
    formatTime24: function(seconds) {
        var h = this.getHour(seconds);
        var m = this.getMinute(seconds);
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    },
    
    isDaytime: function(seconds) {
        var phase = this.getTimeOfDay(seconds);
        return phase === 'morning' || phase === 'noon' || phase === 'afternoon';
    },
    
    isNighttime: function(seconds) {
        var phase = this.getTimeOfDay(seconds);
        return phase === 'night' || phase === 'midnight' || phase === 'pre_dawn';
    },
    
    isDawn: function(seconds) {
        return this.getTimeOfDay(seconds) === 'dawn';
    },
    
    isDusk: function(seconds) {
        return this.getTimeOfDay(seconds) === 'dusk';
    },
    
    getLightLevel: function(seconds) {
        var hour = (seconds / 3600) % 24;
        
        if (hour < 5) return 0.1;
        if (hour < 6) return 0.1 + (hour - 5) * 0.4;
        if (hour < 7) return 0.5 + (hour - 6) * 0.3;
        if (hour < 18) return 0.8 + Math.sin((hour - 6) * Math.PI / 12) * 0.2;
        if (hour < 19) return 0.8 - (hour - 18) * 0.3;
        if (hour < 20) return 0.5 - (hour - 19) * 0.3;
        if (hour < 22) return 0.2 - (hour - 20) * 0.05;
        return 0.1;
    },
    
    getAmbientColor: function(seconds) {
        var hour = (seconds / 3600) % 24;
        
        if (hour < 5) return { r: 20, g: 20, b: 40 };
        if (hour < 7) return { r: 255, g: 180, b: 100 };
        if (hour < 18) return { r: 255, g: 255, b: 240 };
        if (hour < 20) return { r: 255, g: 120, b: 50 };
        return { r: 20, g: 20, b: 40 };
    },
    
    getPhaseEmoji: function(seconds) {
        var phase = this.getTimeOfDay(seconds);
        switch (phase) {
            case 'night':
            case 'midnight':
                return '🌙';
            case 'pre_dawn':
                return '🌑';
            case 'dawn':
                return '🌅';
            case 'morning':
                return '☀';
            case 'noon':
                return '☀';
            case 'afternoon':
                return '⛅';
            case 'dusk':
                return '🌇';
            case 'evening':
                return '🌆';
            default:
                return '•';
        }
    },
    
    getPhaseLabel: function(seconds) {
        var phase = this.getTimeOfDay(seconds);
        var labels = {
            night: 'Night',
            midnight: 'Midnight',
            pre_dawn: 'Pre-dawn',
            dawn: 'Dawn',
            morning: 'Morning',
            noon: 'Noon',
            afternoon: 'Afternoon',
            dusk: 'Dusk',
            evening: 'Evening'
        };
        return labels[phase] || phase;
    }
};

console.log('[TimeOfDay] Module loaded');