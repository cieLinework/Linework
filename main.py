"""
LINEWORK — CIE Ltd. Projects Department
© 2026 Kahlil Ambrose. All rights reserved.
"""

import os, json, bcrypt, jwt, requests as req
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────
SUPABASE_URL      = os.environ.get('SUPABASE_URL', 'https://ugtpdlgxqclhrxgxespl.supabase.co')
SUPABASE_ANON     = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVndHBkbGd4cWNsaHJ4Z3hlc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzc3MjMsImV4cCI6MjA4OTAxMzcyM30.3RWzZcMp2HEg6jaLMVGZ_ADjP71_3_HAsNOVMe-zYrA')
SUPABASE_SERVICE  = os.environ.get('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVndHBkbGd4cWNsaHJ4Z3hlc3BsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQzNzcyMywiZXhwIjoyMDg5MDEzNzIzfQ.FNmKD8ghFbb84YBc7xbsfgudqC2_p8PAAzyLrSJg6xw')
JWT_SECRET        = os.environ.get('JWT_SECRET', 'linework-cie-2026-secret')
SESSION_DAYS      = 7
APP_URL           = os.environ.get('APP_URL', 'https://linework.onrender.com')

# ── Supabase REST client (pure requests, no SDK) ──────────────
class SupabaseTable:
    def __init__(self, base_url, key, table):
        self.url     = f"{base_url}/rest/v1/{table}"
        self.headers = {
            'apikey':        key,
            'Authorization': f'Bearer {key}',
            'Content-Type':  'application/json',
            'Prefer':        'return=representation'
        }

    def _h(self, extra=None):
        h = dict(self.headers)
        if extra: h.update(extra)
        return h

    def select(self, cols='*', count=None):
        self._cols  = cols
        self._filters = []
        self._order  = None
        self._limit_val = None
        self._count  = count
        return self

    def eq(self, col, val):
        self._filters.append(f'{col}=eq.{val}')
        return self

    def in_(self, col, vals):
        self._filters.append(f'{col}=in.({",".join(str(v) for v in vals)})')
        return self

    def gte(self, col, val):
        self._filters.append(f'{col}=gte.{val}')
        return self

    def ilike(self, col, val):
        self._filters.append(f'{col}=ilike.{val}')
        return self

    def order(self, col, desc=False):
        self._order = f'{col}.{"desc" if desc else "asc"}'
        return self

    def limit(self, n):
        self._limit_val = n
        return self

    def execute(self):
        params = {}
        if hasattr(self, '_cols') and self._cols != '*':
            params['select'] = self._cols
        else:
            params['select'] = getattr(self, '_cols', '*')
        if hasattr(self, '_order') and self._order:
            params['order'] = self._order
        if hasattr(self, '_limit_val') and self._limit_val:
            params['limit'] = self._limit_val
        url = self.url
        for f in getattr(self, '_filters', []):
            url += ('&' if '?' in url else '?') + f
        h = self._h()
        if getattr(self, '_count', None):
            h['Prefer'] = 'count=exact'
        r = req.get(url, params=params, headers=h, timeout=15)
        r.raise_for_status()
        data = r.json() if r.text else []
        result = type('R', (), {'data': data if isinstance(data, list) else [data]})()
        if getattr(self, '_count', None):
            result.count = int(r.headers.get('content-range', '0/0').split('/')[-1] or 0)
        return result

    def insert(self, body):
        self._filters = []
        self._body = body if isinstance(body, list) else [body]
        return self

    def update(self, body):
        self._filters = []
        self._body = body
        self._is_update = True
        return self

    def upsert(self, body):
        self._filters = []
        self._body = body if isinstance(body, list) else [body]
        self._is_upsert = True
        return self

    def delete(self):
        self._filters = []
        self._is_delete = True
        return self

    def single(self):
        self._single = True
        return self

    def _build_filter_url(self):
        url = self.url
        for f in getattr(self, '_filters', []):
            url += ('&' if '?' in url else '?') + f
        return url

    def _do_execute(self):
        url = self._build_filter_url()
        h   = self._h()
        if getattr(self, '_is_delete', False):
            r = req.delete(url, headers=h, timeout=15)
            r.raise_for_status()
            return type('R', (), {'data': []})()
        if getattr(self, '_is_update', False):
            r = req.patch(url, json=self._body, headers=h, timeout=15)
            r.raise_for_status()
            data = r.json() if r.text else []
            if not isinstance(data, list): data = [data]
            result = type('R', (), {'data': data})()
            if getattr(self, '_single', False) and data:
                result.data = data
            return result
        if getattr(self, '_is_upsert', False):
            h2 = self._h({'Prefer': 'return=representation,resolution=merge-duplicates'})
            r  = req.post(url, json=self._body, headers=h2, timeout=15)
            r.raise_for_status()
            data = r.json() if r.text else []
            if not isinstance(data, list): data = [data]
            return type('R', (), {'data': data})()
        # INSERT
        r = req.post(url, json=self._body, headers=h, timeout=15)
        r.raise_for_status()
        data = r.json() if r.text else []
        if not isinstance(data, list): data = [data]
        return type('R', (), {'data': data})()

    def __getattr__(self, name):
        # Allow chaining: .insert().execute(), .update().eq().execute() etc
        if name == 'execute':
            return self._do_execute
        raise AttributeError(name)

class DB:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key
    def table(self, name):
        return SupabaseTable(self.url, self.key, name)

db = DB(SUPABASE_URL, SUPABASE_SERVICE)
print(f'DB ready: {SUPABASE_URL[:40]}...')

app = Flask(__name__, static_folder='static')
CORS(app, supports_credentials=True)

@app.route('/health')
def health():
    try:
        db.table('users').select('id').limit(1).execute()
        db_ok = 'connected'
    except Exception as e:
        db_ok = f'error: {str(e)[:120]}'
    return jsonify({'status': 'ok', 'db': db_ok, 'url': SUPABASE_URL[:40]})




# ── Auth helpers ──────────────────────────────────────────────
def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def check_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode(), hashed.encode())

def make_token(user: dict) -> str:
    payload = {
        'sub':      user['id'],
        'name':     user['name'],
        'initials': user['initials'],
        'color':    user['color'],
        'is_admin': user.get('is_admin', False),
        'exp':      datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def get_session():
    token = request.cookies.get('lw_session')
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        session = get_session()
        if not session:
            return jsonify({'error': 'Unauthorised'}), 401
        request.user = session
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        session = get_session()
        if not session:
            return jsonify({'error': 'Unauthorised'}), 401
        if not session.get('is_admin'):
            return jsonify({'error': 'Forbidden — admin only'}), 403
        request.user = session
        return f(*args, **kwargs)
    return decorated

def set_cookie(response, token):
    response.set_cookie(
        'lw_session', token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        samesite='Lax',
        secure=False  # set True in production with HTTPS
    )
    return response

# ── Drawing stage templates ───────────────────────────────────
DRAWING_STAGES = [
    {'key': 'site',           'icon': '🌍', 'label': 'Site Drawings',
     'items': ['Location Plan','Site Plan','Traffic Management Plan','Site Management Plan','Solid Waste Management Plan']},
    {'key': 'architectural',  'icon': '🏛', 'label': 'Architectural',
     'items': ['Ground Floor Plan','First Floor Plan','Roof Plan','Elevations','Sections','Door & Window Schedule','Ceiling Plans','Kitchen & Bathroom Elevations','Architectural Details']},
    {'key': 'structural',     'icon': '🏗', 'label': 'Structural',
     'items': ['Foundation Plan','Column Details','Stair Plan','First Floor Reinforcement','Floor Beam Sections','Roof Beam Sections','Roof Plan','Structural Details']},
    {'key': 'electrical',     'icon': '⚡', 'label': 'Electrical',
     'items': ['GF Small Power','FF Small Power','GF Lighting','FF Lighting']},
    {'key': 'plumbing',       'icon': '🔧', 'label': 'Plumbing',
     'items': ['Plumbing Isometrics','GF Plumbing Layout','FF Plumbing Layout']},
]

# ══════════════════════════════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/api/auth/check')
def auth_check():
    session = get_session()
    return jsonify({'user': session})

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Self-registration — creates account in pending/inactive state for admin approval."""
    body     = request.json
    name     = body.get('name', '').strip()
    initials = body.get('initials', '').strip().upper()
    color    = body.get('color', '#2dce89')
    pin      = body.get('pin', '')

    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400

    # Check name not already taken
    existing = db.table('users').select('id').ilike('name', name).execute()
    if existing.data:
        return jsonify({'error': 'An account with that name already exists'}), 409

    # Create as inactive (is_admin=False, is_active=False via metadata)
    # We store pending in a separate column — use email field as flag for now
    user = db.table('users').insert({
        'name':     name,
        'initials': initials,
        'color':    color,
        'pin_hash': hash_pin(pin),
        'is_admin': False,
        'email':    'PENDING_APPROVAL'
    }).execute().data[0]

    return jsonify({'ok': True, 'message': 'Account requested — awaiting admin approval'})

@app.route('/api/auth/setup', methods=['POST'])
def auth_setup():
    # Only works if no users exist
    count_r = db.table('users').select('id').execute()
    count = type('C', (), {'count': len(count_r.data)})()
    if count.count and count.count > 0:
        return jsonify({'error': 'Setup already complete'}), 400

    body = request.json
    name     = body.get('name', '').strip()
    initials = body.get('initials', '').strip().upper()
    color    = body.get('color', '#4f8eff')
    pin      = body.get('pin', '')

    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400

    user = db.table('users').insert({
        'name': name, 'initials': initials, 'color': color,
        'pin_hash': hash_pin(pin), 'is_admin': True
    }).execute().data[0]

    token = make_token(user)
    resp  = make_response(jsonify({'user': user}))
    set_cookie(resp, token)
    return resp

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    body    = request.json
    user_id = body.get('userId')
    pin     = body.get('pin', '')

    result = db.table('users').select('*').eq('id', user_id).execute()
    if not result.data:
        return jsonify({'error': 'User not found'}), 404

    user = result.data[0]
    if user.get('email') == 'PENDING_APPROVAL':
        return jsonify({'error': 'Your account is pending administrator approval. Please contact Kahlil Ambrose.'}), 403

    if not check_pin(pin, user['pin_hash']):
        return jsonify({'error': 'Incorrect PIN'}), 401

    # Update presence
    db.table('presence').upsert({
        'user_id': user['id'], 'user_name': user['name'],
        'initials': user['initials'], 'color': user['color'],
        'last_seen': datetime.now(timezone.utc).isoformat()
    }).execute()

    token = make_token(user)
    resp  = make_response(jsonify({'user': {k: user[k] for k in ('id','name','initials','color','is_admin')}}))
    set_cookie(resp, token)
    return resp

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session = get_session()
    if session:
        db.table('presence').delete().eq('user_id', session['sub']).execute()
    resp = make_response(jsonify({'ok': True}))
    resp.delete_cookie('lw_session')
    return resp

# ══════════════════════════════════════════════════════════════
# USERS ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/api/users')
def get_users():
    data = db.table('users').select('id,name,initials,color,is_admin,email').order('created_at').execute()
    # Return all users for admin panel, but flag pending ones
    return jsonify(data.data)

@app.route('/api/users', methods=['POST'])
@require_admin
def add_user():
    body     = request.json
    name     = body.get('name', '').strip()
    initials = body.get('initials', '').strip().upper()
    pin      = body.get('pin', '')
    color    = body.get('color', '#4f8eff')
    email    = body.get('email', '')

    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400

    user = db.table('users').insert({
        'name': name, 'initials': initials, 'color': color,
        'pin_hash': hash_pin(pin), 'is_admin': False,
        'email': email or None
    }).execute().data[0]

    return jsonify({k: user[k] for k in ('id','name','initials','color','is_admin')})

@app.route('/api/users/<user_id>', methods=['PATCH'])
@require_auth
def update_user(user_id):
    session = request.user
    # Only self or admin
    if session['sub'] != user_id and not session.get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    body    = request.json
    updates = {}

    if 'name'     in body: updates['name']     = body['name']
    if 'initials' in body: updates['initials'] = body['initials'].upper()
    if 'color'    in body: updates['color']    = body['color']
    if 'email'    in body: updates['email']    = body['email']  # None clears PENDING_APPROVAL

    # Admin can toggle is_admin on other users
    if 'is_admin' in body and session.get('is_admin') and session['sub'] != user_id:
        updates['is_admin'] = bool(body['is_admin'])

    if 'pin' in body:
        new_pin = body['pin']
        if not new_pin.isdigit() or len(new_pin) != 4:
            return jsonify({'error': 'PIN must be 4 digits'}), 400
        # If updating own PIN, verify current PIN first
        if session['sub'] == user_id and not session.get('is_admin'):
            cur_pin = body.get('currentPin', '')
            user = db.table('users').select('pin_hash').eq('id', user_id).execute().data[0]
            if not check_pin(cur_pin, user['pin_hash']):
                return jsonify({'error': 'Current PIN is incorrect'}), 401
        updates['pin_hash'] = hash_pin(new_pin)

    user = db.table('users').update(updates).eq('id', user_id).execute().data[0]
    return jsonify({k: user[k] for k in ('id','name','initials','color','is_admin')})

@app.route('/api/users/<user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    session = request.user
    if session['sub'] == user_id:
        return jsonify({'error': 'Cannot remove yourself'}), 400
    db.table('users').delete().eq('id', user_id).execute()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# PROJECTS ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/api/projects')
@require_auth
def get_projects():
    data = db.table('projects').select('*').order('name').execute()
    return jsonify(data.data)

@app.route('/api/projects', methods=['POST'])
@require_auth
def create_project():
    body = request.json
    body['created_by'] = request.user['sub']
    proj = db.table('projects').insert(body).execute().data[0]
    return jsonify(proj)

@app.route('/api/projects/<proj_id>', methods=['PATCH'])
@require_auth
def update_project(proj_id):
    body = request.json
    proj = db.table('projects').update(body).eq('id', proj_id).execute().data[0]
    return jsonify(proj)

@app.route('/api/projects/<proj_id>', methods=['DELETE'])
@require_admin
def delete_project(proj_id):
    db.table('projects').delete().eq('id', proj_id).execute()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# TASKS ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/api/tasks')
@require_auth
def get_tasks():
    project_id = request.args.get('project_id')
    q = db.table('tasks').select(
        '*, '
        'project:projects(id,name,color), '
        'assignee:users!assignee_id(id,name,initials,color), '
        'assigner:users!assigned_by(id,name,initials,color), '
        'creator:users!created_by(id,name,initials,color), '
        'comments(id,author_name,text,created_at,author:users!author_id(id,name,initials,color)), '
        'subtasks(id,title,completed,sort_order), '
        'watchers:task_watchers(user:users!user_id(id,name,initials,color)), '
        'time_logs(id,user_name,hours,note,logged_at), '
        'drawing_stages(id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order))'
    ).order('created_at', desc=True)

    if project_id and project_id != 'all':
        q = q.eq('project_id', project_id)

    tasks = q.execute().data or []

    # Get dependencies
    task_ids = [t['id'] for t in tasks]
    if task_ids:
        deps = db.table('task_dependencies').select('task_id,blocked_by_id').in_('task_id', task_ids).execute().data or []
        deps_map = {}
        for d in deps:
            deps_map.setdefault(d['task_id'], []).append(d['blocked_by_id'])
        for t in tasks:
            t['blocked_by'] = deps_map.get(t['id'], [])
            stages = t.get('drawing_stages') or []
            t['drawing_stages'] = sorted(stages, key=lambda s: s.get('sort_order', 0))
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
@require_auth
def create_task():
    body = request.json
    blocked_by = body.pop('blocked_by', [])
    body['created_by'] = request.user['sub']
    assignee_id = body.get('assignee_id')
    # If assigning to someone, record who assigned it
    if assignee_id:
        body['assigned_by'] = request.user['sub']

    task = db.table('tasks').insert(body).execute().data[0]

    # Insert dependencies
    if blocked_by:
        db.table('task_dependencies').insert([
            {'task_id': task['id'], 'blocked_by_id': bid} for bid in blocked_by
        ]).execute()

    # Create drawing breakdown
    for i, tmpl in enumerate(DRAWING_STAGES):
        stage = db.table('drawing_stages').insert({
            'task_id': task['id'], 'stage_key': tmpl['key'],
            'collapsed': True, 'sort_order': i
        }).execute().data[0]
        db.table('drawing_items').insert([
            {'drawing_stage_id': stage['id'], 'name': name, 'progress': 0, 'sort_order': j}
            for j, name in enumerate(tmpl['items'])
        ]).execute()

    # Attach assignee info to response for mailto notification
    response_data = dict(task)
    if assignee_id and assignee_id != request.user['sub']:
        asgn_q = db.table('users').select('id,name,email').eq('id', assignee_id).execute()
        if asgn_q.data:
            response_data['_notify_assignee'] = asgn_q.data[0]
    return jsonify(response_data), 201

@app.route('/api/tasks/<task_id>', methods=['PATCH'])
@require_auth
def update_task(task_id):
    body = request.json
    blocked_by = body.pop('blocked_by', None)
    new_assignee_id = body.get('assignee_id')

    # Get old assignee to detect changes
    old = db.table('tasks').select('assignee_id').eq('id', task_id).execute()
    old_assignee_id = old.data[0]['assignee_id'] if old.data else None

    # If assignee is being set or changed, record who did it
    if 'assignee_id' in body and body['assignee_id']:
        body['assigned_by'] = request.user['sub']
    elif 'assignee_id' in body and not body['assignee_id']:
        body['assigned_by'] = None  # cleared

    task = db.table('tasks').update(body).eq('id', task_id).execute().data[0]

    if blocked_by is not None:
        db.table('task_dependencies').delete().eq('task_id', task_id).execute()
        if blocked_by:
            db.table('task_dependencies').insert([
                {'task_id': task_id, 'blocked_by_id': bid} for bid in blocked_by
            ]).execute()

    # Attach assignee email to response if assignee changed (for mailto notification)
    response_data = dict(task)
    if (new_assignee_id and new_assignee_id != old_assignee_id):
        asgn_q = db.table('users').select('id,name,email').eq('id', new_assignee_id).execute()
        if asgn_q.data:
            response_data['_notify_assignee'] = asgn_q.data[0]
    return jsonify(response_data)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@require_auth
def delete_task(task_id):
    db.table('tasks').delete().eq('id', task_id).execute()
    return jsonify({'ok': True})

# ── Comments ──────────────────────────────────────────────────
@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
@require_auth
def add_comment(task_id):
    body = request.json
    comment = db.table('comments').insert({
        'task_id':     task_id,
        'author_id':   request.user['sub'],
        'author_name': body.get('author_name', request.user['name']),
        'text':        body['text'].strip()
    }).execute().data[0]
    return jsonify(comment), 201

# ── Drawing breakdown ─────────────────────────────────────────
@app.route('/api/tasks/<task_id>/drawings', methods=['PATCH'])
@require_auth
def update_drawing(task_id):
    body = request.json
    db.table('drawing_items').update({'progress': body['progress']}).eq('id', body['itemId']).execute()
    return jsonify(recalc_drawing_progress(task_id))

def recalc_drawing_progress(task_id):
    """Recalculate overall task progress from drawing items and return updated stages."""
    stages = db.table('drawing_stages').select(
        'id, items:drawing_items(progress)'
    ).eq('task_id', task_id).execute().data or []

    all_items = [item for s in stages for item in (s.get('items') or [])]
    overall   = round(sum(i['progress'] for i in all_items) / len(all_items)) if all_items else 0
    db.table('tasks').update({'progress': overall}).eq('id', task_id).execute()

    updated = db.table('drawing_stages').select(
        'id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order)'
    ).eq('task_id', task_id).order('sort_order').execute().data
    return {'stages': updated, 'overallProgress': overall}

# ── Add drawing item ──────────────────────────────────────────
@app.route('/api/tasks/<task_id>/drawings/items', methods=['POST'])
@require_auth
def add_drawing_item(task_id):
    body     = request.json
    stage_id = body.get('stageId')
    name     = body.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name required'}), 400

    # Get current max sort_order for this stage
    existing = db.table('drawing_items').select('sort_order').eq('drawing_stage_id', stage_id).execute().data or []
    sort_order = max((i.get('sort_order', 0) for i in existing), default=-1) + 1

    db.table('drawing_items').insert({
        'drawing_stage_id': stage_id, 'name': name,
        'progress': 0, 'sort_order': sort_order
    }).execute()

    result = recalc_drawing_progress(task_id)
    return jsonify(result)

# ── Rename drawing item ───────────────────────────────────────
@app.route('/api/tasks/<task_id>/drawings/items/<item_id>', methods=['PATCH'])
@require_auth
def rename_drawing_item(task_id, item_id):
    body = request.json
    updates = {}
    if 'name'     in body: updates['name']     = body['name'].strip()
    if 'progress' in body: updates['progress'] = body['progress']
    if not updates:
        return jsonify({'error': 'Nothing to update'}), 400

    db.table('drawing_items').update(updates).eq('id', item_id).execute()
    result = recalc_drawing_progress(task_id)
    return jsonify(result)

# ── Delete drawing item ───────────────────────────────────────
@app.route('/api/tasks/<task_id>/drawings/items/<item_id>', methods=['DELETE'])
@require_auth
def delete_drawing_item(task_id, item_id):
    db.table('drawing_items').delete().eq('id', item_id).execute()
    result = recalc_drawing_progress(task_id)
    return jsonify(result)

# ── Reset drawing breakdown to default template ───────────────
@app.route('/api/tasks/<task_id>/drawings/reset', methods=['POST'])
@require_auth
def reset_drawings(task_id):
    # Delete all existing stages and items (cascade)
    db.table('drawing_stages').delete().eq('task_id', task_id).execute()

    # Re-create from template
    for i, tmpl in enumerate(DRAWING_STAGES):
        stage = db.table('drawing_stages').insert({
            'task_id': task_id, 'stage_key': tmpl['key'],
            'collapsed': True, 'sort_order': i
        }).execute().data[0]
        db.table('drawing_items').insert([
            {'drawing_stage_id': stage['id'], 'name': name, 'progress': 0, 'sort_order': j}
            for j, name in enumerate(tmpl['items'])
        ]).execute()

    # Reset task progress to 0
    db.table('tasks').update({'progress': 0}).eq('id', task_id).execute()

    stages = db.table('drawing_stages').select(
        'id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order)'
    ).eq('task_id', task_id).order('sort_order').execute().data
    return jsonify({'stages': stages, 'overallProgress': 0})

# ══════════════════════════════════════════════════════════════
# STATUSES & PRIORITIES
# ══════════════════════════════════════════════════════════════

@app.route('/api/statuses')
def get_statuses():
    data = db.table('statuses').select('*').order('sort_order').execute()
    return jsonify(data.data)

@app.route('/api/statuses', methods=['POST'])
@require_auth
def add_status():
    body = request.json
    if not body.get('name'):
        return jsonify({'error': 'Name required'}), 400
    s = db.table('statuses').insert(body).execute().data[0]
    return jsonify(s), 201

@app.route('/api/statuses/<status_id>', methods=['PATCH'])
@require_auth
def update_status(status_id):
    body = request.json
    updates = {}
    if 'name'    in body: updates['name']    = body['name']
    if 'color'   in body: updates['color']   = body['color']
    if 'is_done' in body: updates['is_done'] = bool(body['is_done'])
    s = db.table('statuses').update(updates).eq('id', status_id).execute().data[0]
    return jsonify(s)

@app.route('/api/statuses/<status_id>', methods=['DELETE'])
@require_auth
def delete_status(status_id):
    # Don't allow deleting default statuses
    result = db.table('statuses').select('is_default').eq('id', status_id).execute()
    if result.data and result.data[0].get('is_default'):
        return jsonify({'error': 'Cannot delete default status'}), 400
    db.table('statuses').delete().eq('id', status_id).execute()
    return jsonify({'ok': True})

@app.route('/api/priorities')
def get_priorities():
    data = db.table('priorities').select('*').order('sort_order').execute()
    return jsonify(data.data)

@app.route('/api/priorities', methods=['POST'])
@require_auth
def add_priority():
    body = request.json
    if not body.get('name'):
        return jsonify({'error': 'Name required'}), 400
    p = db.table('priorities').insert(body).execute().data[0]
    return jsonify(p), 201

@app.route('/api/priorities/<priority_id>', methods=['PATCH'])
@require_auth
def update_priority(priority_id):
    body = request.json
    updates = {}
    if 'name'  in body: updates['name']  = body['name']
    if 'color' in body: updates['color'] = body['color']
    p = db.table('priorities').update(updates).eq('id', priority_id).execute().data[0]
    return jsonify(p)

@app.route('/api/priorities/<priority_id>', methods=['DELETE'])
@require_auth
def delete_priority(priority_id):
    result = db.table('priorities').select('is_default').eq('id', priority_id).execute()
    if result.data and result.data[0].get('is_default'):
        return jsonify({'error': 'Cannot delete default priority'}), 400
    db.table('priorities').delete().eq('id', priority_id).execute()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# PRESENCE
# ══════════════════════════════════════════════════════════════

@app.route('/api/presence', methods=['POST'])
@require_auth
def heartbeat():
    u = request.user
    db.table('presence').upsert({
        'user_id': u['sub'], 'user_name': u['name'],
        'initials': u['initials'], 'color': u['color'],
        'last_seen': datetime.now(timezone.utc).isoformat()
    }).execute()
    return jsonify({'ok': True})

@app.route('/api/presence')
@require_auth
def get_presence():
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    data   = db.table('presence').select('*').gte('last_seen', cutoff).execute()
    return jsonify(data.data)

# ══════════════════════════════════════════════════════════════
# SUB-TASKS
# ══════════════════════════════════════════════════════════════

@app.route('/api/tasks/<task_id>/subtasks')
@require_auth
def get_subtasks(task_id):
    data = db.table('subtasks').select('*').eq('task_id', task_id).order('sort_order').execute()
    return jsonify(data.data)

@app.route('/api/tasks/<task_id>/subtasks', methods=['POST'])
@require_auth
def add_subtask(task_id):
    body = request.json
    title = body.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title required'}), 400
    # Get next sort_order
    existing = db.table('subtasks').select('sort_order').eq('task_id', task_id).execute().data or []
    sort_order = max((s['sort_order'] for s in existing), default=-1) + 1
    sub = db.table('subtasks').insert({
        'task_id': task_id, 'title': title,
        'completed': False, 'sort_order': sort_order,
        'created_by': request.user['sub']
    }).execute().data[0]
    return jsonify(sub), 201

@app.route('/api/tasks/<task_id>/subtasks/<sub_id>', methods=['PATCH'])
@require_auth
def update_subtask(task_id, sub_id):
    body = request.json
    updates = {}
    if 'title'     in body: updates['title']     = body['title'].strip()
    if 'completed' in body: updates['completed'] = bool(body['completed'])
    sub = db.table('subtasks').update(updates).eq('id', sub_id).execute().data[0]
    return jsonify(sub)

@app.route('/api/tasks/<task_id>/subtasks/<sub_id>', methods=['DELETE'])
@require_auth
def delete_subtask(task_id, sub_id):
    db.table('subtasks').delete().eq('id', sub_id).execute()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# TASK TEMPLATES
# ══════════════════════════════════════════════════════════════

@app.route('/api/templates')
@require_auth
def get_templates():
    templates = db.table('task_templates').select(
        '*, tasks:template_tasks(id,title,description,status,priority,sort_order)'
    ).order('name').execute().data or []
    return jsonify(templates)

@app.route('/api/templates', methods=['POST'])
@require_auth
def create_template():
    body  = request.json
    name  = body.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name required'}), 400
    tmpl  = db.table('task_templates').insert({
        'name': name,
        'description': body.get('description', ''),
        'category':    body.get('category', ''),
        'created_by':  request.user['sub']
    }).execute().data[0]
    # Insert template tasks
    for i, t in enumerate(body.get('tasks', [])):
        db.table('template_tasks').insert({
            'template_id': tmpl['id'], 'title': t['title'],
            'description': t.get('description', ''),
            'status': t.get('status', 'Backlog'),
            'priority': t.get('priority', 'Medium'),
            'sort_order': i
        }).execute()
    return jsonify(tmpl), 201

@app.route('/api/templates/<tmpl_id>', methods=['DELETE'])
@require_auth
def delete_template(tmpl_id):
    db.table('task_templates').delete().eq('id', tmpl_id).execute()
    return jsonify({'ok': True})

@app.route('/api/templates/<tmpl_id>/apply', methods=['POST'])
@require_auth
def apply_template(tmpl_id):
    """Create tasks from a template into a project."""
    body       = request.json
    project_id = body.get('project_id')
    tmpl_tasks = db.table('template_tasks').select('*').eq('template_id', tmpl_id).order('sort_order').execute().data or []

    created = []
    for t in tmpl_tasks:
        task = db.table('tasks').insert({
            'title':       t['title'],
            'description': t.get('description', ''),
            'status':      t.get('status', 'Backlog'),
            'priority':    t.get('priority', 'Medium'),
            'project_id':  project_id,
            'created_by':  request.user['sub'],
            'progress':    0
        }).execute().data[0]
        # Create drawing breakdown for each
        for i, stage_tmpl in enumerate(DRAWING_STAGES):
            stage = db.table('drawing_stages').insert({
                'task_id': task['id'], 'stage_key': stage_tmpl['key'],
                'collapsed': True, 'sort_order': i
            }).execute().data[0]
            db.table('drawing_items').insert([
                {'drawing_stage_id': stage['id'], 'name': name, 'progress': 0, 'sort_order': j}
                for j, name in enumerate(stage_tmpl['items'])
            ]).execute()
        created.append(task)
    return jsonify({'created': len(created), 'tasks': created})

# ══════════════════════════════════════════════════════════════
# TIME TRACKING
# ══════════════════════════════════════════════════════════════

@app.route('/api/tasks/<task_id>/time')
@require_auth
def get_time_logs(task_id):
    data = db.table('time_logs').select('*').eq('task_id', task_id).order('logged_at', desc=True).execute()
    return jsonify(data.data)

@app.route('/api/tasks/<task_id>/time', methods=['POST'])
@require_auth
def log_time(task_id):
    body  = request.json
    hours = float(body.get('hours', 0))
    if hours <= 0:
        return jsonify({'error': 'Hours must be greater than 0'}), 400
    log = db.table('time_logs').insert({
        'task_id':   task_id,
        'user_id':   request.user['sub'],
        'user_name': request.user['name'],
        'hours':     hours,
        'note':      body.get('note', '').strip() or None
    }).execute().data[0]
    return jsonify(log), 201

@app.route('/api/tasks/<task_id>/time/<log_id>', methods=['DELETE'])
@require_auth
def delete_time_log(task_id, log_id):
    # Only allow deleting own logs (unless admin)
    log = db.table('time_logs').select('user_id').eq('id', log_id).execute()
    if log.data and log.data[0]['user_id'] != request.user['sub'] and not request.user.get('is_admin'):
        return jsonify({'error': 'Cannot delete another user\'s time log'}), 403
    db.table('time_logs').delete().eq('id', log_id).execute()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# TASK WATCHERS
# ══════════════════════════════════════════════════════════════

@app.route('/api/tasks/<task_id>/watch', methods=['POST'])
@require_auth
def watch_task(task_id):
    user_id = request.user['sub']
    db.table('task_watchers').upsert({'task_id': task_id, 'user_id': user_id}).execute()
    return jsonify({'watching': True})

@app.route('/api/tasks/<task_id>/watch', methods=['DELETE'])
@require_auth
def unwatch_task(task_id):
    user_id = request.user['sub']
    db.table('task_watchers').delete().eq('task_id', task_id).eq('user_id', user_id).execute()
    return jsonify({'watching': False})

@app.route('/api/tasks/<task_id>/watchers')
@require_auth
def get_watchers(task_id):
    data = db.table('task_watchers').select(
        'user:users!user_id(id,name,initials,color)'
    ).eq('task_id', task_id).execute()
    return jsonify([d['user'] for d in (data.data or []) if d.get('user')])

# ══════════════════════════════════════════════════════════════
# SERVE FRONTEND
# ══════════════════════════════════════════════════════════════

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
