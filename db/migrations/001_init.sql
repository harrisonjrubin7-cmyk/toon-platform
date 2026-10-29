-- Toon publishing platform: initial schema
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  password_hash text not null,
  role text not null default 'reader' check (role in ('reader','editor','admin')),
  age_confirmed_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index users_email_lower on users (lower(email));

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on sessions(user_id);

-- An IP (e.g. Volcano Racers). Holds both its comics and its shows.
create table series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  tagline text not null default '',
  synopsis text not null default '',
  rating text not null default 'TV-MA' check (rating in ('TV-MA','TV-14','TV-PG','R','PG-13','Teen','Mature','Unrated')),
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  position int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A run inside an IP: a comic saga/arc or a show season.
create table volumes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  format text not null check (format in ('comic','show')),
  title text not null,
  description text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index volumes_series on volumes(series_id, position);

-- A comic issue or a show episode.
create table releases (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid not null references volumes(id) on delete cascade,
  number int not null check (number > 0),
  title text not null,
  synopsis text not null default '',
  cover_url text,
  video_url text,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'draft' check (status in ('draft','published')),
  publish_at timestamptz,
  published_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volume_id, number)
);
create index releases_visible on releases(status, publish_at);

create table pages (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  position int not null,
  image_url text not null,
  width int,
  height int,
  alt text not null default '',
  created_at timestamptz not null default now(),
  unique (release_id, position) deferrable initially deferred
);

create table progress (
  user_id uuid not null references users(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  position int not null default 0, -- page index (comics) or seconds (episodes)
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create table follows (
  user_id uuid not null references users(id) on delete cascade,
  series_id uuid not null references series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created on audit_log(created_at desc);
