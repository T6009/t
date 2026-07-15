/**
 * Game Mode Controllers
 * - speed: 限时消行 / 固定行数计时
 * - rhythm: BPM 强制锁定
 * - mutation: 各种变异效果
 */

class GameMode {
    constructor(engine) {
        this.engine = engine;
    }
    start() {}
    tick() {}
    onLock() {}
    onLineClear(cleared) {}
    onGameOver() {}
}

// ===== Speed Mode =====
class SpeedMode extends GameMode {
    constructor(engine, config) {
        super(engine);
        // config: { type: 'time' | 'lines', target: number }
        this.type = config.type || 'time'; // 'time' = 限时消行, 'lines' = 固定行数计时
        this.target = config.target || 40; // 40行 or 120秒
        this.startTime = 0;
        this.elapsed = 0;
    }

    start() {
        this.startTime = performance.now();
    }

    tick() {
        this.elapsed = (performance.now() - this.startTime) / 1000;
    }

    onLineClear(cleared) {
        if (this.type === 'time' && this.engine.lines >= this.target) {
            this.engine.gameOver = true;
            this.engine.onGameOver && this.engine.onGameOver({
                reason: 'win',
                message: `恭喜！限时${this.target}秒内消除了${this.engine.lines}行`,
                score: this.engine.score,
                time: this.elapsed,
            });
        } else if (this.type === 'lines' && this.engine.lines >= this.target) {
            this.engine.gameOver = true;
            this.engine.onGameOver && this.engine.onGameOver({
                reason: 'win',
                message: `恭喜！固定${this.target}行用时${this.elapsed.toFixed(1)}秒`,
                score: this.engine.score,
                time: this.elapsed,
            });
        }
    }

    getStatus() {
        if (this.type === 'time') {
            return {
                primary: `${Math.floor(this.elapsed)}秒`,
                secondary: `目标 ${this.target}行 / 已消 ${this.engine.lines}行`,
            };
        } else {
            return {
                primary: `${this.elapsed.toFixed(1)}秒`,
                secondary: `${this.engine.lines}/${this.target}行`,
            };
        }
    }
}

// ===== Rhythm Mode =====
class RhythmMode extends GameMode {
    constructor(engine, config) {
        super(engine);
        this.bpm = config.bpm || 120;
        this.engine.bpm = this.bpm;
    }

    onLineClear(cleared) {}
    getStatus() {
        return {
            primary: `${this.bpm} BPM`,
            secondary: `每 ${(60 / this.bpm).toFixed(2)}秒 锁定一个块`,
        };
    }
}

// ===== Mutation Mode =====
class MutationMode extends GameMode {
    constructor(engine, config) {
        super(engine);
        // config: { type: 'no_gravity,extra_cells,random_vanish' or single value }
        this.types = (config.type || 'no_gravity').split(',').map(s => s.trim()).filter(Boolean);
        engine.mutations = new Set(this.types);
    }

    getStatus() {
        const names = {
            'no_gravity': '消行不掉落',
            'extra_cells': '随机生成砖粒',
            'random_vanish': '随机消失砖粒',
            'double_size': '方块二倍大',
        };
        const labels = this.types.map(t => names[t] || t);
        return {
            primary: labels.join(' + '),
            secondary: '变异模式',
        };
    }
}

// ===== Normal Mode =====
class NormalMode extends GameMode {
    getStatus() {
        return { primary: '经典模式', secondary: '常规俄罗斯方块' };
    }
}
