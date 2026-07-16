from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import Database, init_db
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)
db = Database()

# Initialize database on startup
init_db()


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/game')
def game():
    return send_from_directory(app.static_folder, 'game.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)


# ---- Auth Routes ----

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'success': False, 'message': '用户名和密码不能为空'})
    if len(username) < 2 or len(username) > 20:
        return jsonify({'success': False, 'message': '用户名长度2-20个字符'})
    if len(password) < 6:
        return jsonify({'success': False, 'message': '密码至少6位'})

    success, message = db.register(username, password)
    return jsonify({'success': success, 'message': message})


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'success': False, 'message': '请输入用户名和密码'})

    ip = request.remote_addr or ''
    success, result = db.login(username, password, ip)
    if success:
        return jsonify({'success': True, 'data': result})
    return jsonify({'success': False, 'message': result})


@app.route('/api/change_password', methods=['POST'])
def change_password():
    data = request.json
    username = data.get('username', '')
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return jsonify({'success': False, 'message': '请输入旧密码和新密码'})
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': '新密码至少6位'})

    success, message = db.change_password(username, old_password, new_password)
    return jsonify({'success': success, 'message': message})


@app.route('/api/check_username', methods=['POST'])
def check_username():
    data = request.json
    username = data.get('username', '').strip()
    exists = db.check_username(username)
    return jsonify({'exists': exists})


@app.route('/api/confirm_ip_link', methods=['POST'])
def confirm_ip_link():
    data = request.json
    username = data.get('username', '')
    other_username = data.get('other_username', '')
    ip = request.remote_addr or ''

    if not username or not other_username:
        return jsonify({'success': False, 'message': '参数错误'})

    db.confirm_ip_link(ip, username, other_username)
    return jsonify({'success': True})


# ---- Settings Routes ----

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    username = data.get('username', '')
    key_settings = data.get('key_settings')
    das_settings = data.get('das_settings')

    if not username:
        return jsonify({'success': False, 'message': '未登录'})

    db.update_settings(username, key_settings, das_settings)
    return jsonify({'success': True, 'message': '设置已保存'})


@app.route('/api/settings/<username>', methods=['GET'])
def get_settings(username):
    import json
    from database import get_db
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT key_settings, das_settings FROM accounts WHERE username = ?', (username,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({'success': False, 'message': '账号不存在'})
    return jsonify({
        'success': True,
        'data': {
            'key_settings': json.loads(row['key_settings']),
            'das_settings': json.loads(row['das_settings']),
        }
    })


# ---- Record Routes ----

@app.route('/api/records', methods=['POST'])
def save_record():
    data = request.json
    username = data.get('username', '')
    mode = data.get('mode', '')
    score = data.get('score', 0)
    detail = data.get('detail', '')
    lines_cleared = data.get('lines_cleared', 0)
    time_seconds = data.get('time_seconds', 0)

    if not username or not mode:
        return jsonify({'success': False, 'message': '参数错误'})

    db.save_record(username, mode, score, lines_cleared, time_seconds, detail)

    # 竞速模式检查个人最佳
    is_new_pb = False
    old_best = None
    if mode == 'speed' and time_seconds > 0:
        old_best = db.get_personal_best(username, mode)
        if old_best and time_seconds < old_best['time']:
            is_new_pb = True

    return jsonify({'success': True, 'message': '记录已保存', 'is_new_pb': is_new_pb, 'old_best': old_best})


@app.route('/api/records', methods=['GET'])
def get_records():
    username = request.args.get('username')
    mode = request.args.get('mode')
    records = db.get_records(username, mode)
    return jsonify({'success': True, 'data': records})


@app.route('/api/speed_leaderboard', methods=['GET'])
def speed_leaderboard():
    data = db.get_speed_leaderboard()
    return jsonify({'success': True, 'data': data})


if __name__ == '__main__':
    init_db()
    app.run(host='127.0.0.1', port=8765, debug=True)
