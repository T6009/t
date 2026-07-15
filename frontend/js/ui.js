/**
 * UI Helpers and Common Functions
 */

const UI = {
    showMessage(text, type = 'info', duration = 2500) {
        const existing = document.getElementById('global-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'global-toast';
        toast.className = `toast toast-${type}`;
        toast.textContent = text;
        Object.assign(toast.style, {
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: '8px',
            color: '#fff',
            zIndex: '9999',
            fontSize: '0.9em',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            background: type === 'error' ? '#FF3030' : type === 'success' ? '#32CD32' : '#4169E1',
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    },

    confirm(message) {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'game-overlay';
            modal.innerHTML = `
                <div class="overlay-box">
                    <h2 style="color:#FFD700;">确认</h2>
                    <p style="margin:16px 0;color:#e0e0e0;">${message}</p>
                    <div class="btn-group" style="justify-content:center;">
                        <button class="btn btn-primary" data-action="yes">确认</button>
                        <button class="btn btn-outline" data-action="no">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', e => {
                if (e.target.dataset.action === 'yes') { modal.remove(); resolve(true); }
                else if (e.target.dataset.action === 'no' || e.target === modal) {
                    modal.remove(); resolve(false);
                }
            });
        });
    },

    updateNav() {
        const nav = document.querySelector('.nav-bar');
        if (!nav) return;
        const userInfo = nav.querySelector('.user-info');
        if (userInfo) userInfo.remove();

        if (Auth.isLoggedIn()) {
            const info = document.createElement('span');
            info.className = 'user-info';
            info.innerHTML = `当前: <b>${Auth.user.username}</b> <a class="link-text" id="logout-btn">[退出]</a>`;
            nav.appendChild(info);
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    Auth.logout();
                    UI.showMessage('已退出', 'success');
                    updateNav();
                };
            }
        }
    },

    keyCodeToLabel(code) {
        const map = {
            'ArrowLeft': '←', 'ArrowRight': '→', 'ArrowUp': '↑', 'ArrowDown': '↓',
            'Space': 'SPACE', 'Enter': 'ENTER', 'Escape': 'ESC',
        };
        if (map[code]) return map[code];
        if (code.startsWith('Key')) return code.replace('Key', '');
        if (code.startsWith('Digit')) return code.replace('Digit', '');
        return code;
    },

    waitForKey() {
        return new Promise(resolve => {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.removeEventListener('keydown', handler, true);
                resolve(e.code);
            };
            window.addEventListener('keydown', handler, true);
        });
    },
};

function updateNav() { UI.updateNav(); }
