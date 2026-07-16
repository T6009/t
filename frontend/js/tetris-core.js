/**
 * SRS Tetris Core Engine
 * Modern Tetris with SRS rotation, hold, multi-preview, 7-bag
 */

const TETROMINO_SHAPES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00CED1' },
    O: { shape: [[1,1],[1,1]], color: '#FFD700' },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#9932CC' },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#32CD32' },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#FF3030' },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#4169E1' },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#FF8800' },
};

// Double-size mutation shapes (each cell expands to 2x2, area ×4)
const DOUBLE_SIZE_SHAPES = {
    I: { color: '#00CED1', shape: [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1]
    ]},
    O: { color: '#FFD700', shape: [
        [1,1,1,1],
        [1,1,1,1],
        [1,1,1,1],
        [1,1,1,1]
    ]},
    T: { color: '#9932CC', shape: [
        [0,0,1,1,0,0],
        [0,0,1,1,0,0],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1]
    ]},
    S: { color: '#32CD32', shape: [
        [0,0,1,1,1,1],
        [0,0,1,1,1,1],
        [1,1,1,1,0,0],
        [1,1,1,1,0,0]
    ]},
    Z: { color: '#FF3030', shape: [
        [1,1,1,1,0,0],
        [1,1,1,1,0,0],
        [0,0,1,1,1,1],
        [0,0,1,1,1,1]
    ]},
    J: { color: '#4169E1', shape: [
        [1,1,0,0,0,0],
        [1,1,0,0,0,0],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1]
    ]},
    L: { color: '#FF8800', shape: [
        [0,0,0,0,1,1],
        [0,0,0,0,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1]
    ]}
};

const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// SRS Wall Kick Data
const WALL_KICKS_JLSTZ = {
    '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};

const WALL_KICKS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};

class TetrisEngine {
    constructor(options = {}) {
        this.boardW = 10;
        this.boardH = 22; // 20 visible + 2 hidden
        this.visibleH = 20;
        this.board = this.createBoard();
        this.colorBoard = this.createBoard(); // stores color per cell
        this.colorOverrides = options.colors || null;

        this.current = null;
        this.currentX = 0;
        this.currentY = 0;
        this.currentRotation = 0;
        this.currentName = '';

        this.holdPiece = null;
        this.holdUsed = false;
        this.nextQueue = [];
        this.bag = [];

        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = -1;

        this.gameOver = false;
        this.paused = false;
        this.started = false;

        // Timing
        this.lockDelay = 500; // ms
        this.lockTimer = 0;
        this.lockResets = 0;
        this.maxLockResets = 15;
        this.gravityTimer = 0;
        this.gravity = 1000; // ms per cell at level 1

        // DAS/ARR
        this.das = options.das || 10;  // frames
        this.arr = options.arr || 2;   // frames
        this.sds = options.sds || 0;   // soft drop speed (0 = instant-ish)
        this.dasCounter = { left: 0, right: 0 };
        this.dasCharged = { left: false, right: false };

        // Keys
        this.keys = options.keys || {
            move_left: 'ArrowLeft',
            move_right: 'ArrowRight',
            soft_drop: 'ArrowDown',
            hard_drop: 'Space',
            rotate_cw: 'ArrowUp',
            rotate_ccw: 'KeyZ',
            rotate_180: 'KeyA',
            hold: 'KeyC',
            reset: 'KeyR',
            pause: 'Escape',
        };

        // Mode-specific
        this.mode = 'normal';
        this.modeConfig = {};
        this.previewCount = options.previewCount || 5;

        // Callbacks
        this.onBoardUpdate = null;
        this.onScoreUpdate = null;
        this.onGameOver = null;
        this.onHoldUpdate = null;
        this.onQueueUpdate = null;
        this.onTimerUpdate = null;
        this.onLineClear = null;

        // Tick system
        this.lastTick = 0;
        this.animFrameId = null;
        this.tickRate = 60; // fps

        // Mutation state
        this.mutations = new Set();
        this.mutationCounter = 0;
        this.doubleSize = false;

        // BPM mode
        this.bpm = 120;
        this.bpmLockInterval = 0;
        this.bpmLastLock = 0;
        this.bpmPieceCount = 0;
    }

    createBoard() {
        return Array.from({ length: this.boardH }, () => Array(this.boardW).fill(0));
    }

    // ---- Bag Randomizer ----
    fillBag() {
        const bag = [...PIECE_NAMES];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        return bag;
    }

    nextFromBag() {
        if (this.bag.length === 0) this.bag = this.fillBag();
        return this.bag.pop();
    }

    fillQueue(n) {
        while (this.nextQueue.length < n) {
            this.nextQueue.push(this.nextFromBag());
        }
    }

    // ---- Spawn Piece ----
    spawnPiece() {
        this.fillQueue(this.previewCount + 1);
        const name = this.nextQueue.shift();
        this.fillQueue(this.previewCount + 1);
        const piece = TETROMINO_SHAPES[name];
        const shape = piece.shape;

        this.currentName = name;
        this.current = shape.map(r => [...r]);
        this.currentRotation = 0;

        // Spawn position: centered, top of visible area (row 0-1 in board coords)
        const spawnX = Math.floor((this.boardW - shape[0].length) / 2);
        const spawnY = 0;

        if (!this.isValidPosition(this.current, spawnX, spawnY)) {
            this.gameOver = true;
            if (this.onGameOver) this.onGameOver();
            return false;
        }

        this.currentX = spawnX;
        this.currentY = spawnY;
        this.holdUsed = false;
        this.lockTimer = 0;
        this.lockResets = 0;
        return true;
    }

    // ---- Collision Detection ----
    isValidPosition(shape, px, py) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (!shape[y][x]) continue;
                const bx = px + x;
                const by = py + y;
                if (bx < 0 || bx >= this.boardW || by >= this.boardH) return false;
                if (by < 0) continue;
                if (this.board[by][bx]) return false;
            }
        }
        return true;
    }

    // ---- Movement ----
    move(dx, dy) {
        if (!this.current || this.paused || this.gameOver) return false;
        if (this.isValidPosition(this.current, this.currentX + dx, this.currentY + dy)) {
            this.currentX += dx;
            this.currentY += dy;
            this.resetLockIfGrounded();
            this.render();
            return true;
        }
        return false;
    }

    moveLeft()  { return this.move(-1, 0); }
    moveRight() { return this.move(1, 0); }
    moveDown()  { return this.move(0, 1); }

    // ---- Rotation with SRS ----
    rotate(direction) {
        if (!this.current || this.paused || this.gameOver) return false;
        if (this.currentName === 'O') return false; // O doesn't rotate

        const oldRotation = this.currentRotation;
        let newRotation;

        if (direction === 'cw') {
            newRotation = (oldRotation + 1) % 4;
        } else if (direction === 'ccw') {
            newRotation = (oldRotation + 3) % 4;
        } else if (direction === '180') {
            newRotation = (oldRotation + 2) % 4;
        }

        const newShape = this.getRotatedShape(this.currentName, newRotation);

        if (this.doubleSize) {
            // Basic rotation with 1-cell offset tries for double-size pieces (no SRS wall kicks)
            const basicKicks = [[0,0], [-1,0], [1,0], [0,-1], [-1,-1], [1,-1], [-2,0], [2,0]];
            for (const [kx, ky] of basicKicks) {
                if (this.isValidPosition(newShape, this.currentX + kx, this.currentY + ky)) {
                    this.current = newShape;
                    this.currentX += kx;
                    this.currentY += ky;
                    this.currentRotation = newRotation;
                    this.resetLockIfGrounded();
                    this.render();
                    return true;
                }
            }
            return false;
        }

        const kickKey = `${oldRotation}>${newRotation}`;
        const kickTable = this.currentName === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSTZ;
        const kicks = kickTable[kickKey] || [[0, 0]];

        for (const [kx, ky] of kicks) {
            if (this.isValidPosition(newShape, this.currentX + kx, this.currentY - ky)) {
                this.current = newShape;
                this.currentX += kx;
                this.currentY -= ky;
                this.currentRotation = newRotation;
                this.resetLockIfGrounded();
                this.render();
                return true;
            }
        }
        return false;
    }

    getRotatedShape(name, rotation) {
        let shape = TETROMINO_SHAPES[name].shape.map(r => [...r]);
        for (let r = 0; r < rotation; r++) {
            shape = this.rotateMatrixCW(shape);
        }
        return shape;
    }

    rotateMatrixCW(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = Array.from({ length: cols }, () => Array(rows).fill(0));
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                result[x][rows - 1 - y] = matrix[y][x];
            }
        }
        return result;
    }

    // ---- Hard Drop ----
    hardDrop() {
        if (!this.current || this.paused || this.gameOver) return;
        let dropDist = 0;
        while (this.isValidPosition(this.current, this.currentX, this.currentY + 1)) {
            this.currentY++;
            dropDist++;
        }
        this.score += dropDist * 2;
        this.lockPiece();
    }

    // ---- Soft Drop ----
    softDrop() {
        if (this.moveDown()) {
            this.score += 1;
            return true;
        }
        return false;
    }

    // ---- Lock Delay Logic ----
    isGrounded() {
        if (!this.current) return false;
        return !this.isValidPosition(this.current, this.currentX, this.currentY + 1);
    }

    resetLockIfGrounded() {
        if (this.isGrounded() && this.lockResets < this.maxLockResets) {
            this.lockTimer = 0;
            this.lockResets++;
        }
    }

    // ---- Lock Piece ----
    lockPiece() {
        if (!this.current) return;
        const color = TETROMINO_SHAPES[this.currentName].color;
        for (let y = 0; y < this.current.length; y++) {
            for (let x = 0; x < this.current[y].length; x++) {
                if (!this.current[y][x]) continue;
                const by = this.currentY + y;
                const bx = this.currentX + x;
                if (by < 0) {
                    // Skip cells above board (from rotation kicks), same as isValidPosition
                    continue;
                }
                if (by >= this.boardH) {
                    this.gameOver = true;
                    if (this.onGameOver) this.onGameOver();
                    return;
                }
                this.board[by][bx] = 1;
                this.colorBoard[by][bx] = color;
            }
        }
        this.current = null;
        this.bpmPieceCount++;

        // Check for mutation effects before clearing lines
        if (this.mutations.has('no_gravity')) {
            this.clearLinesNoGravity();
        } else {
            this.clearLines();
        }
    }

    // ---- Line Clear ----
    clearLines() {
        const cleared = [];
        for (let y = 0; y < this.boardH; y++) {
            if (this.board[y].every(cell => cell === 1)) {
                cleared.push(y);
            }
        }

        if (cleared.length > 0) {
            if (this.onLineClear) this.onLineClear(cleared);

            // Remove cleared lines
            for (const y of cleared) {
                this.board.splice(y, 1);
                this.colorBoard.splice(y, 1);
                this.board.unshift(Array(this.boardW).fill(0));
                this.colorBoard.unshift(Array(this.boardW).fill(0));
            }

            // Apply mutation: random extra cells
            if (this.mutations.has('extra_cells')) {
                this.mutationCounter++;
                if (this.mutationCounter % 4 === 0) {
                    this.spawnRandomCells();
                }
            }

            // Apply mutation: random vanish
            if (this.mutations.has('random_vanish')) {
                this.mutationCounter++;
                if (this.mutationCounter % 3 === 0) {
                    this.vanishRandomCells();
                }
            }

            // Scoring
            const basePoints = [0, 100, 300, 500, 800];
            this.combo++;
            const comboBonus = this.combo * 50;
            this.score += basePoints[cleared.length] * this.level + comboBonus;
            this.lines += cleared.length;
            this.level = Math.floor(this.lines / 10) + 1;
            this.gravity = Math.max(50, 1000 - (this.level - 1) * 80);
        } else {
            this.combo = -1;
        }

        if (!this.spawnPiece() && !this.gameOver) {
            this.gameOver = true;
            if (this.onGameOver) this.onGameOver();
        }
        if (this.onScoreUpdate) this.onScoreUpdate();
        this.render();
    }

    clearLinesNoGravity() {
        // Mutation: cleared lines don't cause gravity
        const cleared = [];
        for (let y = 0; y < this.boardH; y++) {
            if (this.board[y].every(cell => cell === 1)) {
                cleared.push(y);
            }
        }

        if (cleared.length > 0) {
            if (this.onLineClear) this.onLineClear(cleared);

            for (const y of cleared) {
                for (let x = 0; x < this.boardW; x++) {
                    this.board[y][x] = 0;
                    this.colorBoard[y][x] = '';
                }
            }

            const basePoints = [0, 100, 300, 500, 800];
            this.combo++;
            const comboBonus = this.combo * 50;
            this.score += basePoints[cleared.length] * this.level + comboBonus;
            this.lines += cleared.length;
            this.level = Math.floor(this.lines / 10) + 1;
            this.gravity = Math.max(50, 1000 - (this.level - 1) * 80);

            // Mutations within no-gravity mode
            if (this.mutations.has('extra_cells')) {
                this.mutationCounter++;
                if (this.mutationCounter % 4 === 0) this.spawnRandomCells();
            }
            if (this.mutations.has('random_vanish')) {
                this.mutationCounter++;
                if (this.mutationCounter % 3 === 0) this.vanishRandomCells();
            }
        } else {
            this.combo = -1;
        }

        if (!this.spawnPiece() && !this.gameOver) {
            this.gameOver = true;
            if (this.onGameOver) this.onGameOver();
        }
        if (this.onScoreUpdate) this.onScoreUpdate();
        this.render();
    }

    spawnRandomCells() {
        // Collect all existing brick positions (settled bricks)
        const existing = [];
        for (let y = 0; y < this.boardH; y++) {
            for (let x = 0; x < this.boardW; x++) {
                if (this.board[y][x]) existing.push([y, x]);
            }
        }
        if (existing.length === 0) {
            // No bricks on board: spawn in the middle of visible area
            const midY = Math.floor(this.visibleH / 2) + 2;
            const midX = Math.floor(this.boardW / 2);
            if (!this.board[midY][midX]) {
                this.board[midY][midX] = 1;
                const colorKeys = Object.keys(TETROMINO_SHAPES);
                this.colorBoard[midY][midX] = TETROMINO_SHAPES[colorKeys[Math.floor(Math.random() * colorKeys.length)]].color;
            }
            return;
        }

        const colorKeys = Object.keys(TETROMINO_SHAPES);
        const count = Math.floor(Math.random() * 4) + 1;
        let placed = 0;
        const maxAttempts = count * 20;

        for (let attempts = 0; attempts < maxAttempts && placed < count; attempts++) {
            // Pick a random existing brick
            const idx = Math.floor(Math.random() * existing.length);
            let [baseY, baseX] = existing[idx];
            // Try to place one cell above it
            let candidateY = baseY - 1;
            // If above is out of bounds or occupied, try moving upward until we find an empty cell
            while (candidateY >= 0 && this.board[candidateY][baseX]) {
                candidateY--;
            }
            if (candidateY >= 0 && !this.board[candidateY][baseX]) {
                this.board[candidateY][baseX] = 1;
                this.colorBoard[candidateY][baseX] = TETROMINO_SHAPES[colorKeys[Math.floor(Math.random() * colorKeys.length)]].color;
                placed++;
            }
        }
    }

    vanishRandomCells() {
        // Collect all filled cells (the actual settled bricks, not ghost/current piece)
        const filled = [];
        for (let y = 0; y < this.boardH; y++) {
            for (let x = 0; x < this.boardW; x++) {
                if (this.board[y][x]) filled.push([y, x]);
            }
        }
        if (filled.length === 0) return;
        const count = Math.min(Math.floor(Math.random() * 3) + 1, filled.length);
        // Shuffle and pick `count` random cells to remove (uniformly random over all existing bricks)
        for (let i = filled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [filled[i], filled[j]] = [filled[j], filled[i]];
        }
        for (let i = 0; i < count; i++) {
            const [y, x] = filled[i];
            this.board[y][x] = 0;
            this.colorBoard[y][x] = '';
        }
    }

    // ---- Hold ----
    doHold() {
        if (!this.current || this.holdUsed || this.paused || this.gameOver) return;
        this.holdUsed = true;
        const name = this.currentName;

        if (this.holdPiece) {
            // Swap
            const oldHold = this.holdPiece;
            this.holdPiece = name;
            this.current = TETROMINO_SHAPES[oldHold].shape.map(r => [...r]);
            this.currentName = oldHold;
            this.currentRotation = 0;
            this.currentX = Math.floor((this.boardW - this.current[0].length) / 2);
            this.currentY = 0;
            this.lockTimer = 0;
            this.lockResets = 0;
        } else {
            this.holdPiece = name;
            this.spawnPiece();
        }

        if (this.onHoldUpdate) this.onHoldUpdate(this.holdPiece);
        this.render();
    }

    // ---- Ghost Piece ----
    getGhostY() {
        if (!this.current) return this.currentY;
        let gy = this.currentY;
        while (this.isValidPosition(this.current, this.currentX, gy + 1)) {
            gy++;
        }
        return gy;
    }

    // ---- Get Display Board (with current piece and ghost) ----
    getDisplayBoard() {
        const display = this.board.map((r, y) => r.map((c, x) => ({
            filled: c === 1,
            color: this.colorBoard[y][x] || '',
            type: 'locked'
        })));

        if (this.current && !this.gameOver) {
            const ghostY = this.getGhostY();
            // Ghost
            for (let y = 0; y < this.current.length; y++) {
                for (let x = 0; x < this.current[y].length; x++) {
                    if (!this.current[y][x]) continue;
                    const by = ghostY + y;
                    const bx = this.currentX + x;
                    if (by >= 0 && by < this.boardH && bx >= 0 && bx < this.boardW) {
                        if (by !== this.currentY + y || ghostY !== this.currentY) {
                            display[by][bx] = {
                                filled: true,
                                color: TETROMINO_SHAPES[this.currentName].color,
                                type: 'ghost'
                            };
                        }
                    }
                }
            }

            // Current piece
            const locking = this.isGrounded();
            for (let y = 0; y < this.current.length; y++) {
                for (let x = 0; x < this.current[y].length; x++) {
                    if (!this.current[y][x]) continue;
                    const by = this.currentY + y;
                    const bx = this.currentX + x;
                    if (by >= 0 && by < this.boardH && bx >= 0 && bx < this.boardW) {
                        display[by][bx] = {
                            filled: true,
                            color: TETROMINO_SHAPES[this.currentName].color,
                            type: locking ? 'locking' : 'active'
                        };
                    }
                }
            }
        }

        return display;
    }

    // ---- Game Tick ----
    start() {
        this.started = true;
        this.gameOver = false;
        this.paused = false;
        this.board = this.createBoard();
        this.colorBoard = this.createBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = -1;
        this.gravity = 1000;
        this.holdPiece = null;
        this.nextQueue = [];
        this.bag = [];
        this.current = null;
        this.gravityTimer = 0;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.mutationCounter = 0;
        this.bpmPieceCount = 0;
        this.bpmLastLock = 0;

        this.spawnPiece();
        if (this.onHoldUpdate) this.onHoldUpdate(null);
        if (this.onScoreUpdate) this.onScoreUpdate();
        this.render();

        this.lastTick = performance.now();
        this.loop();
    }

    loop() {
        if (this.gameOver) {
            this.animFrameId = null;
            return;
        }
        this.animFrameId = requestAnimationFrame(() => this.loop());

        const now = performance.now();
        const dt = now - this.lastTick;
        this.lastTick = now;

        if (this.paused || !this.current) return;

        // BPM mode lock
        if (this.mode === 'rhythm') {
            this.bpmLockInterval = 60000 / this.bpm;
            this.bpmLastLock += dt;
            if (this.bpmLastLock >= this.bpmLockInterval) {
                this.bpmLastLock = 0;
                if (this.current) {
                    this.hardDrop();
                    return;
                }
            }
        }

        // Gravity
        this.gravityTimer += dt;
        if (this.gravityTimer >= this.gravity) {
            this.gravityTimer = 0;
            if (!this.moveDown()) {
                // Piece can't move down
            }
        }

        // Lock delay
        if (this.isGrounded()) {
            this.lockTimer += dt;
            if (this.lockTimer >= this.lockDelay) {
                this.lockPiece();
                return;
            }
        } else {
            this.lockTimer = 0;
        }
    }

    stop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    togglePause() {
        if (this.gameOver) return;
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTick = performance.now();
        }
        this.render();
    }

    // ---- Reset ----
    reset() {
        this.stop();
        this.start();
    }

    // ---- Double Size Mutation ----
    enableDoubleSize() {
        this._originalShapes = {};
        for (const key of Object.keys(DOUBLE_SIZE_SHAPES)) {
            this._originalShapes[key] = TETROMINO_SHAPES[key].shape;
            TETROMINO_SHAPES[key].shape = DOUBLE_SIZE_SHAPES[key].shape;
        }
        this.doubleSize = true;
    }

    setColors(colors) {
        this.colorOverrides = colors;
        this.render();
    }

    // ---- Render ----
    render() {
        if (this.onBoardUpdate) this.onBoardUpdate(this.getDisplayBoard());
        if (this.onQueueUpdate) this.onQueueUpdate(this.nextQueue.slice(0, this.previewCount));
    }
}
