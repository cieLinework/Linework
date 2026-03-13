-- ============================================================
-- LINEWORK — Supabase Database Schema
-- Run this in Supabase → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS (team members / logins) ────────────────────────────
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  initials    text not null,
  color       text not null default '#4f8eff',
  email       text,
  pin_hash    text not null,
  is_admin    boolean not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── PROJECTS ─────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  color       text not null default '#4f8eff',
  start_date  date,
  end_date    date,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── STATUSES ─────────────────────────────────────────────────
create table if not exists statuses (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  color       text not null default '#4a5275',
  is_done     boolean not null default false,
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

-- ── PRIORITIES ───────────────────────────────────────────────
create table if not exists priorities (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  color       text not null default '#ffb800',
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

-- ── TASKS ────────────────────────────────────────────────────
create table if not exists tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  project_id      uuid references projects(id) on delete cascade,
  assignee_id     uuid references users(id) on delete set null,
  status          text not null default 'Backlog',
  priority        text,
  progress        integer not null default 0 check (progress >= 0 and progress <= 100),
  due_date        date,
  start_date      date,
  file_ref        text,
  attachment_name text,
  attachment_size integer,
  attachment_type text,
  attachment_data text, -- base64
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── TASK DEPENDENCIES (blocked_by) ───────────────────────────
create table if not exists task_dependencies (
  task_id         uuid references tasks(id) on delete cascade,
  blocked_by_id   uuid references tasks(id) on delete cascade,
  primary key (task_id, blocked_by_id)
);

-- ── TASK COMMENTS ────────────────────────────────────────────
create table if not exists comments (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid references tasks(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  author_name text not null,
  text        text not null,
  created_at  timestamptz default now()
);

-- ── DRAWING STAGES ───────────────────────────────────────────
create table if not exists drawing_stages (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid references tasks(id) on delete cascade,
  stage_key   text not null, -- 'site', 'architectural', etc
  collapsed   boolean not null default true,
  sort_order  integer not null default 0
);

-- ── DRAWING ITEMS (individual sheets) ────────────────────────
create table if not exists drawing_items (
  id              uuid primary key default uuid_generate_v4(),
  drawing_stage_id uuid references drawing_stages(id) on delete cascade,
  name            text not null,
  progress        integer not null default 0 check (progress >= 0 and progress <= 100),
  sort_order      integer not null default 0
);

-- ── ONLINE PRESENCE ──────────────────────────────────────────
create table if not exists presence (
  user_id     uuid primary key references users(id) on delete cascade,
  user_name   text not null,
  initials    text not null,
  color       text not null,
  last_seen   timestamptz default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- Allow all operations from service role (our API handles auth)
alter table users           enable row level security;
alter table projects        enable row level security;
alter table statuses        enable row level security;
alter table priorities      enable row level security;
alter table tasks           enable row level security;
alter table task_dependencies enable row level security;
alter table comments        enable row level security;
alter table drawing_stages  enable row level security;
alter table drawing_items   enable row level security;
alter table presence        enable row level security;

-- Service role bypasses RLS
create policy "service_role_all" on users           for all using (true);
create policy "service_role_all" on projects        for all using (true);
create policy "service_role_all" on statuses        for all using (true);
create policy "service_role_all" on priorities      for all using (true);
create policy "service_role_all" on tasks           for all using (true);
create policy "service_role_all" on task_dependencies for all using (true);
create policy "service_role_all" on comments        for all using (true);
create policy "service_role_all" on drawing_stages  for all using (true);
create policy "service_role_all" on drawing_items   for all using (true);
create policy "service_role_all" on presence        for all using (true);

-- ── SEED DEFAULT STATUSES ────────────────────────────────────
insert into statuses (name, color, is_done, is_default, sort_order) values
  ('Backlog',     '#4a5275', false, true, 0),
  ('In Progress', '#4f8eff', false, true, 1),
  ('Review',      '#7c5cfc', false, true, 2),
  ('Done',        '#2dce89', true,  true, 3)
on conflict do nothing;

-- ── SEED DEFAULT PRIORITIES ──────────────────────────────────
insert into priorities (name, color, is_default, sort_order) values
  ('Low',      '#2dce89', true, 0),
  ('Medium',   '#ffb800', true, 1),
  ('High',     '#ff7730', true, 2),
  ('Critical', '#ff4757', true, 3),
  ('RAYNEAU',  '#b000ff', true, 4)
on conflict do nothing;

-- ── SEED PROJECTS ────────────────────────────────────────────
insert into projects (name, description, color) values
  ('Grenada Quarry',                 'Accommodation Building',     '#ff7730'),
  ('Morne Du Don Development',       null,                         '#4f8eff'),
  ('Bonne Terre Development',        'Almost complete',            '#7c5cfc'),
  ('Pooja Apartments',               null,                         '#2dce89'),
  ('Bois D''Orange Development',     null,                         '#ffb800'),
  ('Montserrat Hospital',            null,                         '#ff4757'),
  ('La Toc Development',             null,                         '#00c9b1'),
  ('Laborie Quarry',                 null,                         '#e91e8c'),
  ('St. Vincent Quarry',             null,                         '#4f8eff'),
  ('Mt. Kumar to Tempe',             'Grenada Roads',              '#ff7730'),
  ('Mabouya Landslide Remediation',  'Grenada Roads',              '#7c5cfc'),
  ('Castries North Beautification',  null,                         '#2dce89'),
  ('Antigua Apartments',             null,                         '#ffb800'),
  ('Antigua Warehouse',              null,                         '#ff4757'),
  ('Calabash Street (Vieux Fort)',   null,                         '#00c9b1'),
  ('Excel Signs',                    null,                         '#e91e8c'),
  ('Office Upgrades & Repair',       'Ongoing — CIE Ltd.',         '#a0a8c0')
on conflict do nothing;

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at    before update on tasks    for each row execute function update_updated_at();
create trigger projects_updated_at before update on projects for each row execute function update_updated_at();
create trigger users_updated_at    before update on users    for each row execute function update_updated_at();
