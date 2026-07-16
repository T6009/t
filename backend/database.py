import sqlite3
import json
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'tetris.db')


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
        das_settings TEXT NOT NULL DEFAULT '{}'
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        mode TEXT NOT NULL,
        score INTEGER NOT NULL,
        detail TEXT,
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

    def login(self, username, password):
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM accounts WHERE username = ?', (username,))
        row = c.fetchone()
        conn.close()
        if not row:
            return False, '账号不存在'
        if bcrypt.checkpw(password.encode('utf-8'), row['password_hash']):
            return True, {
                'username': row['username'],
                'key_settings': json.loads(row['key_settings']),
                'das_settings': json.loads(row['das_settings']),
            }
        return False, '密码错误'

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

    def get_speed_leaderboard(self, limit=50):
        """竞速40行排行榜：每人最短用时排名"""
        conn = get_db()
        c = conn.cursor()
        c.execute('''SELECT username, MIN(time_seconds) as best_time, MAX(score) as best_score
            FROM records WHERE mode = 'speed' AND time_seconds > 0
            GROUP BY username ORDER BY best_time ASC LIMIT ?''', (limit,))
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
