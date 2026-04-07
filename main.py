"""
LINEWORK - CIE Ltd. Projects Department
Minimal startup test
"""
import os, sys, json, bcrypt, jwt, requests as req
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_cors import CORS

print(f"Python: {sys.version}", flush=True)
print("Imports OK", flush=True)

# Config
SUPABASE_URL     = os.environ.get('SUPABASE_URL', 'https://ugtpdlgxqclhrxgxespl.supabase.co')
SUPABASE_SERVICE = os.environ.get('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVndHBkbGd4cWNsaHJ4Z3hlc3BsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQzNzcyMywiZXhwIjoyMDg5MDEzNzIzfQ.FNmKD8ghFbb84YBc7xbsfgudqC2_p8PAAzyLrSJg6xw')
SUPABASE_ANON    = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVndHBkbGd4cWNsaHJ4Z3hlc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mzc3MjMsImV4cCI6MjA4OTAxMzcyM30.3RWzZcMp2HEg6jaLMVGZ_ADjP71_3_HAsNOVMe-zYrA')
JWT_SECRET       = os.environ.get('JWT_SECRET', 'linework-cie-2026-secret')
SESSION_DAYS     = 7
APP_URL          = os.environ.get('APP_URL', 'https://linework.onrender.com')

print(f"Config loaded. Supabase: {SUPABASE_URL[:40]}", flush=True)

# Supabase REST client - no SDK, pure requests
SB_HEADERS = {
    'apikey': SUPABASE_SERVICE,
    'Authorization': f'Bearer {SUPABASE_SERVICE}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}
REST = SUPABASE_URL.rstrip('/') + '/rest/v1'

def sb_get(table, params=None, filters=None, single=False):
    url = f"{REST}/{table}"
    if filters:
        url += '?' + '&'.join(filters)
    r = req.get(url, params=params, headers=SB_HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json() if r.text else []
    if single:
        return data[0] if data else None
    return data if isinstance(data, list) else [data]

def sb_post(table, body, upsert=False):
    h = dict(SB_HEADERS)
    if upsert:
        h['Prefer'] = 'return=representation,resolution=merge-duplicates'
    url = f"{REST}/{table}"
    r = req.post(url, json=body if isinstance(body, list) else [body], headers=h, timeout=15)
    r.raise_for_status()
    data = r.json() if r.text else []
    if not isinstance(data, list): data = [data]
    return data[0] if data else {}

def sb_patch(table, body, filters):
    url = f"{REST}/{table}?" + '&'.join(filters)
    r = req.patch(url, json=body, headers=SB_HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json() if r.text else []
    if not isinstance(data, list): data = [data]
    return data[0] if data else {}

def sb_delete(table, filters):
    url = f"{REST}/{table}?" + '&'.join(filters)
    r = req.delete(url, headers=SB_HEADERS, timeout=15)
    r.raise_for_status()
    return True

print("DB helpers defined", flush=True)

# Drawing stage templates
DRAWING_STAGES = [
    {'key': 'site',          'label': 'Site Drawings',
     'items': ['Location Plan','Site Plan','Traffic Management Plan','Site Management Plan','Solid Waste Management Plan']},
    {'key': 'architectural', 'label': 'Architectural',
     'items': ['Ground Floor Plan','First Floor Plan','Roof Plan','Elevations','Sections','Door & Window Schedule','Ceiling Plans','Kitchen & Bathroom Elevations','Architectural Details']},
    {'key': 'structural',    'label': 'Structural',
     'items': ['Foundation Plan','Column Details','Stair Plan','First Floor Reinforcement','Floor Beam Sections','Roof Beam Sections','Roof Plan','Structural Details']},
    {'key': 'electrical',    'label': 'Electrical',
     'items': ['GF Small Power','FF Small Power','GF Lighting','FF Lighting']},
    {'key': 'plumbing',      'label': 'Plumbing',
     'items': ['Plumbing Isometrics','GF Plumbing Layout','FF Plumbing Layout']},
]

# Auth helpers
def hash_pin(pin):
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def check_pin(pin, hashed):
    return bcrypt.checkpw(pin.encode(), hashed.encode())

def make_token(user):
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
    if not token: return None
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
            return jsonify({'error': 'Forbidden'}), 403
        request.user = session
        return f(*args, **kwargs)
    return decorated

def set_cookie(response, token):
    response.set_cookie('lw_session', token, max_age=SESSION_DAYS*86400,
                        httponly=True, samesite='Lax')
    return response

print("Auth helpers defined", flush=True)

app = Flask(__name__, static_folder='static')
CORS(app, supports_credentials=True)

print("Flask app created", flush=True)

# ── HEALTH ────────────────────────────────────────────────────
@app.route('/health')
def health():
    try:
        sb_get('users', params={'select':'id','limit':'1'})
        db_ok = 'connected'
    except Exception as e:
        db_ok = f'error: {str(e)[:200]}'
    return jsonify({'status':'ok', 'db':db_ok, 'python':sys.version, 'url':SUPABASE_URL[:40]})

# ── AUTH ──────────────────────────────────────────────────────
@app.route('/api/auth/check')
def auth_check():
    session = get_session()
    return jsonify({'user': session})

@app.route('/api/auth/setup', methods=['POST'])
def auth_setup():
    count = sb_get('users', params={'select':'id'})
    if len(count) > 0:
        return jsonify({'error': 'Setup already complete'}), 400
    body = request.json
    name     = body.get('name','').strip()
    initials = body.get('initials','').strip().upper()
    color    = body.get('color','#4f8eff')
    pin      = body.get('pin','')
    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400
    user = sb_post('users', {'name':name,'initials':initials,'color':color,'pin_hash':hash_pin(pin),'is_admin':True})
    token = make_token(user)
    resp  = make_response(jsonify({'user': user}))
    return set_cookie(resp, token)

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    body     = request.json
    name     = body.get('name','').strip()
    initials = body.get('initials','').strip().upper()
    color    = body.get('color','#2dce89')
    pin      = body.get('pin','')
    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400
    existing = sb_get('users', filters=[f'name=ilike.{name}'], params={'select':'id'})
    if existing:
        return jsonify({'error': 'An account with that name already exists'}), 409
    sb_post('users', {'name':name,'initials':initials,'color':color,'pin_hash':hash_pin(pin),'is_admin':False,'email':'PENDING_APPROVAL'})
    return jsonify({'ok': True})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    body    = request.json
    user_id = body.get('userId')
    pin     = body.get('pin','')
    users = sb_get('users', filters=[f'id=eq.{user_id}'])
    if not users:
        return jsonify({'error': 'User not found'}), 404
    user = users[0]
    if user.get('email') == 'PENDING_APPROVAL':
        return jsonify({'error': 'Account pending approval'}), 403
    if not check_pin(pin, user['pin_hash']):
        return jsonify({'error': 'Incorrect PIN'}), 401
    try:
        sb_post('presence', {'user_id':user['id'],'user_name':user['name'],'initials':user['initials'],'color':user['color'],'last_seen':datetime.now(timezone.utc).isoformat()}, upsert=True)
    except: pass
    token = make_token(user)
    resp  = make_response(jsonify({'user': {k:user[k] for k in ('id','name','initials','color','is_admin')}}))
    return set_cookie(resp, token)

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session = get_session()
    if session:
        try: sb_delete('presence', [f"user_id=eq.{session['sub']}"])
        except: pass
    resp = make_response(jsonify({'ok': True}))
    resp.delete_cookie('lw_session')
    return resp

# ── USERS ─────────────────────────────────────────────────────
@app.route('/api/users')
def get_users():
    data = sb_get('users', params={'select':'id,name,initials,color,is_admin,email','order':'created_at.asc'})
    return jsonify(data)

@app.route('/api/users', methods=['POST'])
@require_admin
def add_user():
    body     = request.json
    name     = body.get('name','').strip()
    initials = body.get('initials','').strip().upper()
    pin      = body.get('pin','')
    color    = body.get('color','#4f8eff')
    email    = body.get('email','')
    if not name or not initials or not pin:
        return jsonify({'error': 'Name, initials and PIN required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be 4 digits'}), 400
    user = sb_post('users', {'name':name,'initials':initials,'color':color,'pin_hash':hash_pin(pin),'is_admin':False,'email':email or None})
    return jsonify({k:user[k] for k in ('id','name','initials','color','is_admin')})

@app.route('/api/users', methods=['PATCH'])
@require_auth
def update_self():
    session = request.user
    body    = request.json
    updates = {}
    if 'name'     in body: updates['name']     = body['name']
    if 'initials' in body: updates['initials'] = body['initials'].upper()
    if 'color'    in body: updates['color']    = body['color']
    if 'email'    in body: updates['email']    = body['email']
    if 'pin' in body:
        new_pin = body['pin']
        if not new_pin.isdigit() or len(new_pin) != 4:
            return jsonify({'error': 'PIN must be 4 digits'}), 400
        if not session.get('is_admin'):
            cur_pin = body.get('currentPin','')
            users = sb_get('users', filters=[f"id=eq.{session['sub']}"], params={'select':'pin_hash'})
            if not users or not check_pin(cur_pin, users[0]['pin_hash']):
                return jsonify({'error': 'Current PIN is incorrect'}), 401
        updates['pin_hash'] = hash_pin(new_pin)
    user = sb_patch('users', updates, [f"id=eq.{session['sub']}"])
    return jsonify({k:user[k] for k in ('id','name','initials','color','is_admin') if k in user})

@app.route('/api/users/<user_id>', methods=['PATCH'])
@require_auth
def update_user(user_id):
    session = request.user
    if session['sub'] != user_id and not session.get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    body    = request.json
    updates = {}
    if 'name'     in body: updates['name']     = body['name']
    if 'initials' in body: updates['initials'] = body['initials'].upper()
    if 'color'    in body: updates['color']    = body['color']
    if 'email'    in body: updates['email']    = body['email']
    if 'is_admin' in body and session.get('is_admin') and session['sub'] != user_id:
        updates['is_admin'] = bool(body['is_admin'])
    if 'pin' in body:
        new_pin = str(body['pin'])
        if not new_pin.isdigit() or len(new_pin) != 4:
            return jsonify({'error': 'PIN must be 4 digits'}), 400
        updates['pin_hash'] = hash_pin(new_pin)
    user = sb_patch('users', updates, [f'id=eq.{user_id}'])
    return jsonify(user)

@app.route('/api/users/<user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    if request.user['sub'] == user_id:
        return jsonify({'error': 'Cannot remove yourself'}), 400
    sb_delete('users', [f'id=eq.{user_id}'])
    return jsonify({'ok': True})

# ── PROJECTS ──────────────────────────────────────────────────
@app.route('/api/projects')
@require_auth
def get_projects():
    data = sb_get('projects', params={'select':'*','order':'name.asc'})
    return jsonify(data)

@app.route('/api/projects', methods=['POST'])
@require_auth
def create_project():
    body = request.json
    body['created_by'] = request.user['sub']
    proj = sb_post('projects', body)
    return jsonify(proj)

@app.route('/api/projects/<proj_id>', methods=['PATCH'])
@require_auth
def update_project(proj_id):
    proj = sb_patch('projects', request.json, [f'id=eq.{proj_id}'])
    return jsonify(proj)

@app.route('/api/projects/<proj_id>', methods=['DELETE'])
@require_admin
def delete_project(proj_id):
    sb_delete('projects', [f'id=eq.{proj_id}'])
    return jsonify({'ok': True})

# ── TASKS ─────────────────────────────────────────────────────
TASK_SELECT = (
    '*,'
    'project:projects(id,name,color),'
    'assignee:users!assignee_id(id,name,initials,color),'
    'assigner:users!assigned_by(id,name,initials,color),'
    'creator:users!created_by(id,name,initials,color),'
    'comments(id,author_name,text,created_at,author:users!author_id(id,name,initials,color)),'
    'subtasks(id,title,completed,sort_order),'
    'time_logs(id,user_name,hours,note,logged_at),'
    'drawing_stages(id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order))'
)

@app.route('/api/tasks')
@require_auth
def get_tasks():
    filters = ['order=created_at.desc']
    proj_id = request.args.get('project_id')
    if proj_id and proj_id != 'all':
        filters.append(f'project_id=eq.{proj_id}')
    tasks = sb_get('tasks', params={'select': TASK_SELECT}, filters=filters)
    # Get deps
    task_ids = [t['id'] for t in tasks]
    if task_ids:
        ids_str = ','.join(task_ids)
        deps = sb_get('task_dependencies', filters=[f'task_id=in.({ids_str})'], params={'select':'task_id,blocked_by_id'})
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
    body       = request.json
    blocked_by = body.pop('blocked_by', [])
    body['created_by'] = request.user['sub']
    assignee_id = body.get('assignee_id')
    if assignee_id:
        body['assigned_by'] = request.user['sub']
    task = sb_post('tasks', body)
    if blocked_by:
        sb_post('task_dependencies', [{'task_id':task['id'],'blocked_by_id':bid} for bid in blocked_by])
    for i, tmpl in enumerate(DRAWING_STAGES):
        stage = sb_post('drawing_stages', {'task_id':task['id'],'stage_key':tmpl['key'],'collapsed':True,'sort_order':i})
        sb_post('drawing_items', [{'drawing_stage_id':stage['id'],'name':n,'progress':0,'sort_order':j} for j,n in enumerate(tmpl['items'])])
    response_data = dict(task)
    if assignee_id and assignee_id != request.user['sub']:
        asgn = sb_get('users', filters=[f'id=eq.{assignee_id}'], params={'select':'id,name,email'})
        if asgn: response_data['_notify_assignee'] = asgn[0]
    return jsonify(response_data), 201

@app.route('/api/tasks/<task_id>', methods=['PATCH'])
@require_auth
def update_task(task_id):
    body = request.json
    blocked_by      = body.pop('blocked_by', None)
    new_assignee_id = body.get('assignee_id')
    old = sb_get('tasks', filters=[f'id=eq.{task_id}'], params={'select':'assignee_id'})
    old_assignee_id = old[0]['assignee_id'] if old else None
    if 'assignee_id' in body and body['assignee_id']:
        body['assigned_by'] = request.user['sub']
    elif 'assignee_id' in body and not body['assignee_id']:
        body['assigned_by'] = None
    task = sb_patch('tasks', body, [f'id=eq.{task_id}'])
    if blocked_by is not None:
        sb_delete('task_dependencies', [f'task_id=eq.{task_id}'])
        if blocked_by:
            sb_post('task_dependencies', [{'task_id':task_id,'blocked_by_id':bid} for bid in blocked_by])
    response_data = dict(task)
    if new_assignee_id and new_assignee_id != old_assignee_id:
        asgn = sb_get('users', filters=[f'id=eq.{new_assignee_id}'], params={'select':'id,name,email'})
        if asgn: response_data['_notify_assignee'] = asgn[0]
    return jsonify(response_data)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@require_auth
def delete_task(task_id):
    sb_delete('tasks', [f'id=eq.{task_id}'])
    return jsonify({'ok': True})

# ── COMMENTS ─────────────────────────────────────────────────
@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
@require_auth
def add_comment(task_id):
    body = request.json
    comment = sb_post('comments', {'task_id':task_id,'author_id':request.user['sub'],'author_name':body.get('author_name',request.user['name']),'text':body['text'].strip()})
    return jsonify(comment), 201

# ── DRAWINGS ──────────────────────────────────────────────────
def recalc_progress(task_id):
    stages = sb_get('drawing_stages', filters=[f'task_id=eq.{task_id}'], params={'select':'id,items:drawing_items(progress)'})
    all_items = [i for s in stages for i in (s.get('items') or [])]
    overall   = round(sum(i['progress'] for i in all_items) / len(all_items)) if all_items else 0
    sb_patch('tasks', {'progress': overall}, [f'id=eq.{task_id}'])
    updated = sb_get('drawing_stages', filters=[f'task_id=eq.{task_id}'], params={'select':'id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order)','order':'sort_order.asc'})
    return {'stages': updated, 'overallProgress': overall}

@app.route('/api/tasks/<task_id>/drawings', methods=['PATCH'])
@require_auth
def update_drawing(task_id):
    body = request.json
    sb_patch('drawing_items', {'progress': body['progress']}, [f"id=eq.{body['itemId']}"])
    return jsonify(recalc_progress(task_id))

@app.route('/api/tasks/<task_id>/drawings/items', methods=['POST'])
@require_auth
def add_drawing_item(task_id):
    body     = request.json
    stage_id = body.get('stageId')
    name     = body.get('name','').strip()
    if not name: return jsonify({'error':'Name required'}), 400
    existing = sb_get('drawing_items', filters=[f'drawing_stage_id=eq.{stage_id}'], params={'select':'sort_order'})
    sort_order = max((i.get('sort_order',0) for i in existing), default=-1) + 1
    sb_post('drawing_items', {'drawing_stage_id':stage_id,'name':name,'progress':0,'sort_order':sort_order})
    return jsonify(recalc_progress(task_id))

@app.route('/api/tasks/<task_id>/drawings/items/<item_id>', methods=['PATCH'])
@require_auth
def rename_drawing_item(task_id, item_id):
    body = request.json
    updates = {}
    if 'name'     in body: updates['name']     = body['name'].strip()
    if 'progress' in body: updates['progress'] = body['progress']
    sb_patch('drawing_items', updates, [f'id=eq.{item_id}'])
    return jsonify(recalc_progress(task_id))

@app.route('/api/tasks/<task_id>/drawings/items/<item_id>', methods=['DELETE'])
@require_auth
def delete_drawing_item(task_id, item_id):
    sb_delete('drawing_items', [f'id=eq.{item_id}'])
    return jsonify(recalc_progress(task_id))

@app.route('/api/tasks/<task_id>/drawings/reset', methods=['POST'])
@require_auth
def reset_drawings(task_id):
    sb_delete('drawing_stages', [f'task_id=eq.{task_id}'])
    for i, tmpl in enumerate(DRAWING_STAGES):
        stage = sb_post('drawing_stages', {'task_id':task_id,'stage_key':tmpl['key'],'collapsed':True,'sort_order':i})
        sb_post('drawing_items', [{'drawing_stage_id':stage['id'],'name':n,'progress':0,'sort_order':j} for j,n in enumerate(tmpl['items'])])
    sb_patch('tasks', {'progress':0}, [f'id=eq.{task_id}'])
    stages = sb_get('drawing_stages', filters=[f'task_id=eq.{task_id}'], params={'select':'id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order)','order':'sort_order.asc'})
    return jsonify({'stages':stages,'overallProgress':0})

# ── SUBTASKS ──────────────────────────────────────────────────
@app.route('/api/tasks/<task_id>/subtasks', methods=['POST'])
@require_auth
def add_subtask(task_id):
    title = request.json.get('title','').strip()
    if not title: return jsonify({'error':'Title required'}), 400
    existing  = sb_get('subtasks', filters=[f'task_id=eq.{task_id}'], params={'select':'sort_order'})
    sort_order = max((s.get('sort_order',0) for s in existing), default=-1) + 1
    sub = sb_post('subtasks', {'task_id':task_id,'title':title,'completed':False,'sort_order':sort_order,'created_by':request.user['sub']})
    return jsonify(sub), 201

@app.route('/api/tasks/<task_id>/subtasks/<sub_id>', methods=['PATCH'])
@require_auth
def update_subtask(task_id, sub_id):
    body = request.json
    updates = {}
    if 'title'     in body: updates['title']     = body['title'].strip()
    if 'completed' in body: updates['completed'] = bool(body['completed'])
    return jsonify(sb_patch('subtasks', updates, [f'id=eq.{sub_id}']))

@app.route('/api/tasks/<task_id>/subtasks/<sub_id>', methods=['DELETE'])
@require_auth
def delete_subtask(task_id, sub_id):
    sb_delete('subtasks', [f'id=eq.{sub_id}'])
    return jsonify({'ok':True})

# ── TIME LOGS ─────────────────────────────────────────────────
@app.route('/api/tasks/<task_id>/time', methods=['POST'])
@require_auth
def log_time(task_id):
    hours = float(request.json.get('hours',0))
    if hours <= 0: return jsonify({'error':'Hours must be > 0'}), 400
    log = sb_post('time_logs', {'task_id':task_id,'user_id':request.user['sub'],'user_name':request.user['name'],'hours':hours,'note':request.json.get('note','').strip() or None})
    return jsonify(log), 201

@app.route('/api/tasks/<task_id>/time/<log_id>', methods=['DELETE'])
@require_auth
def delete_time_log(task_id, log_id):
    logs = sb_get('time_logs', filters=[f'id=eq.{log_id}'], params={'select':'user_id'})
    if logs and logs[0]['user_id'] != request.user['sub'] and not request.user.get('is_admin'):
        return jsonify({'error':'Cannot delete another user\'s log'}), 403
    sb_delete('time_logs', [f'id=eq.{log_id}'])
    return jsonify({'ok':True})

# ── WATCHERS ──────────────────────────────────────────────────
@app.route('/api/tasks/<task_id>/watch', methods=['POST'])
@require_auth
def watch_task(task_id):
    sb_post('task_watchers', {'task_id':task_id,'user_id':request.user['sub']}, upsert=True)
    return jsonify({'watching':True})

@app.route('/api/tasks/<task_id>/watch', methods=['DELETE'])
@require_auth
def unwatch_task(task_id):
    sb_delete('task_watchers', [f"task_id=eq.{task_id}",f"user_id=eq.{request.user['sub']}"])
    return jsonify({'watching':False})

@app.route('/api/tasks/<task_id>/watchers')
@require_auth
def get_watchers(task_id):
    data = sb_get('task_watchers', filters=[f'task_id=eq.{task_id}'], params={'select':'user:users!user_id(id,name,initials,color)'})
    return jsonify([d['user'] for d in data if d.get('user')])

# ── STATUSES & PRIORITIES ─────────────────────────────────────
@app.route('/api/statuses')
def get_statuses():
    return jsonify(sb_get('statuses', params={'select':'*','order':'sort_order.asc'}))

@app.route('/api/statuses', methods=['POST'])
@require_auth
def add_status():
    body = request.json
    if not body.get('name'): return jsonify({'error':'Name required'}), 400
    return jsonify(sb_post('statuses', body)), 201

@app.route('/api/statuses/<status_id>', methods=['PATCH'])
@require_auth
def update_status(status_id):
    return jsonify(sb_patch('statuses', request.json, [f'id=eq.{status_id}']))

@app.route('/api/statuses/<status_id>', methods=['DELETE'])
@require_auth
def delete_status(status_id):
    s = sb_get('statuses', filters=[f'id=eq.{status_id}'], params={'select':'is_default'})
    if s and s[0].get('is_default'): return jsonify({'error':'Cannot delete default status'}), 400
    sb_delete('statuses', [f'id=eq.{status_id}'])
    return jsonify({'ok':True})

@app.route('/api/priorities')
def get_priorities():
    return jsonify(sb_get('priorities', params={'select':'*','order':'sort_order.asc'}))

@app.route('/api/priorities', methods=['POST'])
@require_auth
def add_priority():
    body = request.json
    if not body.get('name'): return jsonify({'error':'Name required'}), 400
    return jsonify(sb_post('priorities', body)), 201

@app.route('/api/priorities/<priority_id>', methods=['PATCH'])
@require_auth
def update_priority(priority_id):
    return jsonify(sb_patch('priorities', request.json, [f'id=eq.{priority_id}']))

@app.route('/api/priorities/<priority_id>', methods=['DELETE'])
@require_auth
def delete_priority(priority_id):
    p = sb_get('priorities', filters=[f'id=eq.{priority_id}'], params={'select':'is_default'})
    if p and p[0].get('is_default'): return jsonify({'error':'Cannot delete default priority'}), 400
    sb_delete('priorities', [f'id=eq.{priority_id}'])
    return jsonify({'ok':True})

# ── TEMPLATES ─────────────────────────────────────────────────
@app.route('/api/templates')
@require_auth
def get_templates():
    tmpls = sb_get('task_templates', params={'select':'*','order':'name.asc'})
    for t in tmpls:
        t['tasks'] = sb_get('template_tasks', filters=[f"template_id=eq.{t['id']}"], params={'select':'*','order':'sort_order.asc'})
    return jsonify(tmpls)

@app.route('/api/templates', methods=['POST'])
@require_auth
def create_template():
    body  = request.json
    tasks = body.pop('tasks', [])
    body['created_by'] = request.user['sub']
    tmpl  = sb_post('task_templates', body)
    for i, t in enumerate(tasks):
        sb_post('template_tasks', {'template_id':tmpl['id'],'title':t['title'],'description':t.get('description',''),'status':t.get('status','Backlog'),'priority':t.get('priority','Medium'),'sort_order':i})
    return jsonify(tmpl), 201

@app.route('/api/templates/<tmpl_id>', methods=['DELETE'])
@require_auth
def delete_template(tmpl_id):
    sb_delete('task_templates', [f'id=eq.{tmpl_id}'])
    return jsonify({'ok':True})

@app.route('/api/templates/<tmpl_id>/apply', methods=['POST'])
@require_auth
def apply_template(tmpl_id):
    project_id  = request.json.get('project_id')
    tmpl_tasks  = sb_get('template_tasks', filters=[f'template_id=eq.{tmpl_id}'], params={'select':'*','order':'sort_order.asc'})
    created = []
    for t in tmpl_tasks:
        task = sb_post('tasks', {'title':t['title'],'description':t.get('description',''),'status':t.get('status','Backlog'),'priority':t.get('priority','Medium'),'project_id':project_id,'created_by':request.user['sub'],'progress':0})
        for i, tmpl in enumerate(DRAWING_STAGES):
            stage = sb_post('drawing_stages', {'task_id':task['id'],'stage_key':tmpl['key'],'collapsed':True,'sort_order':i})
            sb_post('drawing_items', [{'drawing_stage_id':stage['id'],'name':n,'progress':0,'sort_order':j} for j,n in enumerate(tmpl['items'])])
        created.append(task)
    return jsonify({'created':len(created),'tasks':created})

# ── PRESENCE ──────────────────────────────────────────────────
@app.route('/api/presence', methods=['POST'])
@require_auth
def heartbeat():
    u = request.user
    sb_post('presence', {'user_id':u['sub'],'user_name':u['name'],'initials':u['initials'],'color':u['color'],'last_seen':datetime.now(timezone.utc).isoformat()}, upsert=True)
    return jsonify({'ok':True})

@app.route('/api/presence')
@require_auth
def get_presence():
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    data   = sb_get('presence', filters=[f'last_seen=gte.{cutoff}'], params={'select':'*'})
    return jsonify(data)

# ── SERVE FRONTEND ────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    return send_from_directory('static', 'index.html')

print("All routes registered", flush=True)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting on port {port}", flush=True)
    app.run(host='0.0.0.0', port=port, debug=False)
