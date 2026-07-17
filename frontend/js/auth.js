/**
 * Authentication & API Client
 */

const API_BASE = '';

const Auth = {
    user: null,

    async register(username, password) {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return res.json();
    },

    async login(username, password) {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.success) {
            this.user = data.data;
            localStorage.setItem('tetris_user', JSON.stringify(this.user));
        }
        return data;
    },

    async guestLogin() {
        const guestName = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const res = await fetch(`${API_BASE}/api/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: guestName }),
        });
        const data = await res.json();
        if (data.success) {
            this.user = data.data;
            localStorage.setItem('tetris_user', JSON.stringify(this.user));
        }
        return data;
    },

    async changePassword(old_password, new_password) {
        if (!this.user) return { success: false, message: '未登录' };
        const res = await fetch(`${API_BASE}/api/change_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.user.username,
                old_password, new_password,
            }),
        });
        return res.json();
    },

    async checkUsername(username) {
        const res = await fetch(`${API_BASE}/api/check_username`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });
        return res.json();
    },

    async saveSettings(keySettings, dasSettings) {
        if (!this.user) return { success: false, message: '未登录' };
        if (this.user.is_guest) return { success: true, message: '游客模式不保存设置' };
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.user.username,
                key_settings: keySettings,
                das_settings: dasSettings,
            }),
        });
        return res.json();
    },

    async saveRecord(mode, score, lines_cleared = 0, time_seconds = 0, detail = '') {
        if (!this.user) return { success: false };
        if (this.user.is_guest) return { success: true, message: '游客模式不保存记录' };
        const res = await fetch(`${API_BASE}/api/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: this.user.username,
                mode, score, lines_cleared, time_seconds, detail,
            }),
        });
        return res.json();
    },

    async getRecords(mode) {
        const res = await fetch(`${API_BASE}/api/records?mode=${mode || ''}`);
        return res.json();
    },

    async getSpeedLeaderboard() {
        const res = await fetch(`${API_BASE}/api/speed_leaderboard`);
        return res.json();
    },

    logout() {
        this.user = null;
        localStorage.removeItem('tetris_user');
    },

    loadFromStorage() {
        try {
            const data = localStorage.getItem('tetris_user');
            if (data) this.user = JSON.parse(data);
        } catch (e) {
            this.user = null;
        }
        return this.user;
    },

    isLoggedIn() { return !!this.user; },
};

// Load from storage on init
Auth.loadFromStorage();
