import sqlite3
import json
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), 'tetris.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database with tables and three demo accounts."""
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        key_settings TEXT NOT NULL DEFAULT '{}',
        das_settings TEXT NOT NULL DEFAULT '{}',
        color_settings TEXT NOT NULL DEFAULT '{}',
        role TEXT NOT NULL DEFAULT 'user',
        is_banned INTEGER NOT NULL DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        mode TEXT NOT NULL,
        score INTEGER NOT NULL,
        detail TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS ip_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        username1 TEXT NOT NULL,
        username2 TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    # Migrate: add new columns if they don't exist
    try:
        c.execute('ALTER TABLE records ADD COLUMN lines_cleared INTEGER DEFAULT 0')
    except:
        pass
    try:
        c.execute('ALTER TABLE records ADD COLUMN time_seconds REAL DEFAULT 0')
    except:
        pass
    try:
        c.execute('ALTER TABLE accounts ADD COLUMN color_settings TEXT NOT NULL DEFAULT \'{}\'')
    except:
        pass
    try:
        c.execute('ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT \'user\'')
    except:
        pass
    try:
        c.execute('ALTER TABLE accounts ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0')
    except:
        pass

    # Check if demo accounts exist
    c.execute('SELECT COUNT(*) FROM accounts')
    count = c.fetchone()[0]

    if count == 0:
        demo_accounts = [
            ('Player1', '111111'),
            ('DemoUser', '222222'),
            ('TestPlayer', '333333'),
        ]

        for username, password in demo_accounts:
            pwhash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            c.execute(
                'INSERT INTO accounts (username, password_hash, key_settings, das_settings) VALUES (?, ?, ?, ?)',
                (username, pwhash,
                 '{"move_left":"ArrowLeft","move_right":"ArrowRight","soft_drop":"ArrowDown","hard_drop":"Space","rotate_cw":"ArrowUp","rotate_ccw":"KeyZ","rotate_180":"KeyA","hold":"KeyC","reset":"KeyR"}',
                 '{"das":10,"arr":2,"sds":0,"preview_count":5}')
            )

    c.execute('''CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        publisher TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked INTEGER DEFAULT 0
    )''')

    # Ensure admin account exists
    c.execute('SELECT id FROM accounts WHERE username = ?', ('admin',))
    if not c.fetchone():
        admin_hash = bcrypt.hashpw('admin123456'.encode('utf-8'), bcrypt.gensalt())
        c.execute(
            'INSERT INTO accounts (username, password_hash, key_settings, das_settings, role) VALUES (?, ?, ?, ?, ?)',
            ('admin', admin_hash, '{}', '{}', 'admin')
        )

    conn.commit()
    conn.close()


class Database:
    def register(self, username, password):
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM accounts WHERE username = ?', (username,))
        if c.fetchone():
            conn.close()
            return False, '这个名称别人在用'

        pwhash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        c.execute(
            'INSERT INTO accounts (username, password_hash) VALUES (?, ?)',
            (username, pwhash))
        conn.commit()
        conn.close()
        return True, '注册成功'

    def login(self, username, password, ip=''):
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM accounts WHERE username = ?', (username,))
        row = c.fetchone()
        conn.close()
        if not row:
            return False, '账号不存在'
        if row['is_banned']:
            return False, '该账号已被封禁'
        if bcrypt.checkpw(password.encode('utf-8'), row['password_hash']):
            # 记录登录日志
            if ip:
                self.log_login(username, ip)
            # 检测同 IP 其他账号
            ip_warning = None
            if ip:
                ip_warning = self.check_same_ip(ip, username)

            result = {
                'username': row['username'],
                'key_settings': json.loads(row['key_settings']),
                'das_settings': json.loads(row['das_settings']),
                'role': row['role'],
            }
            if ip_warning:
                result['ip_warning'] = ip_warning
            return True, result
        return False, '密码错误'

    def log_login(self, username, ip):
        conn = get_db()
        c = conn.cursor()
        c.execute('INSERT INTO login_logs (username, ip_address) VALUES (?, ?)',
                  (username, ip))
        conn.commit()
        conn.close()

    def check_same_ip(self, ip, current_username):
        """检测同 IP 下是否有其他未关联的玩家账号（排除管理员）。有则返回对方用户名，无则返回 None"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT DISTINCT l.username FROM login_logs l
            JOIN accounts a ON l.username = a.username
            WHERE l.ip_address = ? AND l.username != ? AND a.role != 'admin' ''',
            (ip, current_username))
        others = [r['username'] for r in c.fetchall()]
        conn.close()
        for other in others:
            if not self._is_ip_linked(ip, current_username, other):
                return other
        return None

    def _is_ip_linked(self, ip, user1, user2):
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT id FROM ip_links WHERE ip_address = ?
            AND ((username1 = ? AND username2 = ?) OR (username1 = ? AND username2 = ?))''',
                  (ip, user1, user2, user2, user1))
        exists = c.fetchone() is not None
        conn.close()
        return exists

    def confirm_ip_link(self, ip, username1, username2):
        """确认两个账号为同 IP 小号关系"""
        conn = get_db()
        c = conn.cursor()
        u1, u2 = sorted([username1, username2])
        c.execute('INSERT INTO ip_links (ip_address, username1, username2) VALUES (?, ?, ?)',
                  (ip, u1, u2))
        conn.commit()
        conn.close()

    def get_account_ips(self, username):
        """获取某账号的历史登录 IP 列表"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT DISTINCT ip_address, MAX(login_time) as last_login
            FROM login_logs WHERE username = ?
            GROUP BY ip_address ORDER BY last_login DESC''', (username,))
        ips = [r['ip_address'] for r in c.fetchall()]
        conn.close()
        return ips

    def change_password(self, username, old_password, new_password):
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT password_hash FROM accounts WHERE username = ?', (username,))
        row = c.fetchone()
        if not row:
            conn.close()
            return False, '账号不存在'
        if not bcrypt.checkpw(old_password.encode('utf-8'), row['password_hash']):
            conn.close()
            return False, '旧密码错误'

        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        c.execute('UPDATE accounts SET password_hash = ? WHERE username = ?',
                  (new_hash, username))
        conn.commit()
        conn.close()
        return True, '密码修改成功'

    def update_settings(self, username, key_settings=None, das_settings=None):
        conn = get_db()
        c = conn.cursor()
        if key_settings is not None:
            c.execute('UPDATE accounts SET key_settings = ? WHERE username = ?',
                      (json.dumps(key_settings), username))
        if das_settings is not None:
            c.execute('UPDATE accounts SET das_settings = ? WHERE username = ?',
                      (json.dumps(das_settings), username))
        conn.commit()
        conn.close()
        return True

    def save_record(self, username, mode, score, lines_cleared=0, time_seconds=0, detail=''):
        conn = get_db()
        c = conn.cursor()
        c.execute('INSERT INTO records (username, mode, score, lines_cleared, time_seconds, detail) VALUES (?, ?, ?, ?, ?, ?)',
                  (username, mode, score, lines_cleared, time_seconds, detail))
        conn.commit()
        conn.close()

    def get_personal_best(self, username, mode):
        """返回用户在某个模式下的个人最佳成绩 {time, lines, score} 或 None"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT MIN(time_seconds) as best_time, MAX(score) as best_score, MAX(lines_cleared) as best_lines
            FROM records WHERE username = ? AND mode = ? AND time_seconds > 0''', (username, mode))
        row = c.fetchone()
        conn.close()
        if row and row['best_time'] is not None:
            return {'time': row['best_time'], 'score': row['best_score'], 'lines': row['best_lines']}
        return None

    def delete_player_speed_records(self, username):
        """删除某玩家的所有竞速40行记录，返回删除条数"""
        conn = get_db()
        c = conn.cursor()
        c.execute('DELETE FROM records WHERE username = ? AND mode = ?', (username, 'speed'))
        deleted = c.rowcount
        conn.commit()
        conn.close()
        return deleted

    def get_speed_leaderboard(self, limit=50):
        """竞速40行排行榜：每人最短用时排名，排除封禁账号"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT r.username, MIN(r.time_seconds) as best_time, MAX(r.score) as best_score
            FROM records r
            LEFT JOIN accounts a ON r.username = a.username
            WHERE r.mode = 'speed' AND r.time_seconds > 0
            AND (a.is_banned IS NULL OR a.is_banned = 0)
            GROUP BY r.username ORDER BY best_time ASC LIMIT ?''', (limit,))
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    def get_records(self, username=None, mode=None, limit=50):
        conn = get_db()
        c = conn.cursor()
        query = 'SELECT username, mode, score, detail, created_at FROM records WHERE 1=1'
        params = []
        if username:
            query += ' AND username = ?'
            params.append(username)
        if mode:
            query += ' AND mode = ?'
            params.append(mode)
        query += ' ORDER BY score DESC LIMIT ?'
        params.append(limit)
        c.execute(query, params)
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    def check_username(self, username):
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM accounts WHERE username = ?', (username,))
        exists = c.fetchone() is not None
        conn.close()
        return exists

    # ---- Admin Methods ----

    def admin_login(self, username, password, ip=''):
        """管理员登录，返回 role 信息，并记录 IP"""
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM accounts WHERE username = ? AND role = ?', (username, 'admin'))
        row = c.fetchone()
        conn.close()
        if not row:
            return False, '管理员账号不存在'
        if bcrypt.checkpw(password.encode('utf-8'), row['password_hash']):
            if ip:
                self.log_login(username, ip)
            return True, {'username': row['username'], 'role': row['role']}
        return False, '密码错误'

    def get_all_accounts(self):
        """获取所有非管理员账号详情（含40行最佳、DAS/ARR、颜色设置、登录IP）"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT a.id, a.username, a.key_settings, a.das_settings,
            a.color_settings, a.is_banned, a.role,
            (SELECT MIN(r.time_seconds) FROM records r
             WHERE r.username = a.username AND r.mode = 'speed' AND r.time_seconds > 0
            ) as best_time,
            (SELECT MAX(r.score) FROM records r
             WHERE r.username = a.username AND r.mode = 'speed' AND r.time_seconds > 0
            ) as best_score,
            (SELECT GROUP_CONCAT(DISTINCT l.ip_address) FROM login_logs l
             WHERE l.username = a.username
            ) as login_ips
            FROM accounts a
            WHERE a.role != 'admin'
            ORDER BY a.id''')
        rows = []
        for r in c.fetchall():
            row = dict(r)
            row['key_settings'] = json.loads(row['key_settings'])
            row['das_settings'] = json.loads(row['das_settings'])
            row['color_settings'] = json.loads(row['color_settings'])
            row['login_ips'] = row['login_ips'].split(',') if row['login_ips'] else []
            rows.append(row)
        conn.close()
        return rows

    def admin_reset_password(self, username, new_password):
        """管理员重置某用户密码"""
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id FROM accounts WHERE username = ?', (username,))
        if not c.fetchone():
            conn.close()
            return False, '账号不存在'

        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        c.execute('UPDATE accounts SET password_hash = ? WHERE username = ?',
                  (new_hash, username))
        conn.commit()
        conn.close()
        return True, '密码已重置'

    def ban_account(self, username):
        """封禁/解封账号"""
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, is_banned FROM accounts WHERE username = ? AND role != ?',
                  (username, 'admin'))
        row = c.fetchone()
        if not row:
            conn.close()
            return False, '账号不存在或为管理员'
        new_status = 0 if row['is_banned'] else 1
        c.execute('UPDATE accounts SET is_banned = ? WHERE username = ?',
                  (new_status, username))
        conn.commit()
        conn.close()
        return True, '已封禁' if new_status else '已解封'

    # ---- Announcement Methods ----

    def add_announcement(self, title, content, publisher):
        """发布公告，返回公告id"""
        conn = get_db()
        c = conn.cursor()
        c.execute('INSERT INTO announcements (title, content, publisher) VALUES (?, ?, ?)',
                  (title, content, publisher))
        conn.commit()
        aid = c.lastrowid
        conn.close()
        return aid

    def get_announcements(self, include_revoked=False):
        """获取公告列表。玩家默认不含已撤回，管理员含已撤回。按时间倒序。"""
        conn = get_db()
        c = conn.cursor()
        if include_revoked:
            c.execute('SELECT id, title, content, publisher, created_at, is_revoked FROM announcements ORDER BY created_at DESC')
        else:
            c.execute('SELECT id, title, content, publisher, created_at FROM announcements WHERE is_revoked = 0 ORDER BY created_at DESC')
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    def revoke_announcement(self, announcement_id):
        """撤回公告，返回 (success, message)"""
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT id, is_revoked FROM announcements WHERE id = ?', (announcement_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return False, '公告不存在'
        if row['is_revoked']:
            conn.close()
            return False, '公告已撤回'
        c.execute('UPDATE announcements SET is_revoked = 1 WHERE id = ?', (announcement_id,))
        conn.commit()
        conn.close()
        return True, '公告已撤回'
