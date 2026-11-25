var RealmKit = RealmKit || {};

RealmKit.PerlinNoise = (function() {
    var permutation = [];
    var p = [];
    
    function seed(s) {
        s = s || Math.random() * 65536;
        
        permutation = [];
        for (var i = 0; i < 256; i++) {
            permutation[i] = i;
        }
        
        var n = s;
        for (var i = 255; i > 0; i--) {
            n = (n * 16807) % 2147483647;
            var j = n % (i + 1);
            var tmp = permutation[i];
            permutation[i] = permutation[j];
            permutation[j] = tmp;
        }
        
        p = [];
        for (var i = 0; i < 512; i++) {
            p[i] = permutation[i % 256];
        }
    }
    
    function fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    function lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    function grad(hash, x, y) {
        var h = hash & 3;
        var u = h < 2 ? x : y;
        var v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    function noise2d(x, y) {
        if (p.length === 0) seed(0);
        
        var X = Math.floor(x) & 255;
        var Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        var u = fade(x);
        var v = fade(y);
        
        var A = p[X] + Y;
        var B = p[X + 1] + Y;
        
        return lerp(
            lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
            lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
            v
        );
    }
    
    function octave(x, y, octaves, persistence, lacunarity) {
        octaves = octaves || 4;
        persistence = persistence || 0.5;
        lacunarity = lacunarity || 2.0;
        
        var total = 0;
        var frequency = 1;
        var amplitude = 1;
        var maxValue = 0;
        
        for (var i = 0; i < octaves; i++) {
            total += noise2d(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    function ridged(x, y, octaves, lacunarity) {
        octaves = octaves || 4;
        lacunarity = lacunarity || 2.0;
        
        var total = 0;
        var frequency = 1;
        var amplitude = 1;
        var maxValue = 0;
        
        for (var i = 0; i < octaves; i++) {
            var n = noise2d(x * frequency, y * frequency);
            n = 1 - Math.abs(n);
            n = n * n;
            total += n * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= lacunarity;
        }
        
        return total / maxValue;
    }
    
    function billow(x, y, octaves, persistence) {
        octaves = octaves || 4;
        persistence = persistence || 0.5;
        
        var total = 0;
        var frequency = 1;
        var amplitude = 1;
        var maxValue = 0;
        
        for (var i = 0; i < octaves; i++) {
            var n = Math.abs(noise2d(x * frequency, y * frequency));
            total += n * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        return total / maxValue;
    }
    
    seed(0);
    
    return {
        seed: seed,
        noise: noise2d,
        octave: octave,
        ridged: ridged,
        billow: billow
    };
})();

console.log('[PerlinNoise] Module loaded');