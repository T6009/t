from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from database import Database, init_db
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.secret_key = os.urandom(24).hex()
CORS(app)
db = Database()

init_db()


# ---- Admin Auth Check ----
def require_admin():
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': '请先登录', 'redirect': '/admin'})
    return None


@app.route('/admin')
def admin_index():
    return send_from_directory(app.static_folder, 'admin.html')


@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'success': False, 'message': '请输入用户名和密码'})

    success, result = db.admin_login(username, password)
    if success:
        session['admin_logged_in'] = True
        session['admin_username'] = result['username']
        return jsonify({'success': True, 'data': result})
    return jsonify({'success': False, 'message': result})


@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/admin/check', methods=['GET'])
def admin_check():
    if session.get('admin_logged_in'):
        return jsonify({'success': True, 'username': session.get('admin_username')})
    return jsonify({'success': False})


@app.route('/api/admin/accounts', methods=['GET'])
def admin_accounts():
    check = require_admin()
    if check:
        return check
    accounts = db.get_all_accounts()
    return jsonify({'success': True, 'data': accounts})


@app.route('/api/admin/leaderboard', methods=['GET'])
def admin_leaderboard():
    check = require_admin()
    if check:
        return check
    data = db.get_speed_leaderboard()
    return jsonify({'success': True, 'data': data})


@app.route('/api/admin/reset_password', methods=['POST'])
def admin_reset_password():
    check = require_admin()
    if check:
        return check
    data = request.json
    username = data.get('username', '')
    new_password = data.get('new_password', '')

    if not username:
        return jsonify({'success': False, 'message': '请指定账号'})
    if not new_password or len(new_password) < 6:
        return jsonify({'success': False, 'message': '新密码至少6位'})

    success, message = db.admin_reset_password(username, new_password)
    return jsonify({'success': success, 'message': message})


@app.route('/api/admin/ban', methods=['POST'])
def admin_ban():
    check = require_admin()
    if check:
        return check
    data = request.json
    username = data.get('username', '')

    if not username:
        return jsonify({'success': False, 'message': '请指定账号'})

    success, message = db.ban_account(username)
    return jsonify({'success': success, 'message': message})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=9047, debug=False)
