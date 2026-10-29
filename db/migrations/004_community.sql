-- Community: creator profiles, fan comics (incl. spinoffs of official series),
-- ideas/pitches, follows between people, likes, comments, reports, moderation,
-- in-app notifications, and studio-wide community settings.
-- Additive only: no existing table is changed.

-- One row; the studio's community rules. Editable in Studio → Community.
create table community_settings (
  id boolean primary key default true check (id),
  -- true: new posts wait for an editor to approve them.
  pre_moderation boolean not null default false,
  -- true: fans may post spinoffs/fan works that use the studio's series.
  allow_fan_works boolean not null default true,
  -- Distinct open reports that hide a post automatically until reviewed.
  auto_hide_reports int not null default 3 check (auto_hide_reports between 1 and 100),
  version int not null default 1,
  updated_at timestamptz not null default now()
);
insert into community_settings (id) values (true);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  bio text not null default '',
  avatar_url text,
  -- Owner agreed to the community guidelines and creator terms (time + version).
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  suspended_until timestamptz,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_handle on profiles (lower(handle));

create table user_follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index user_follows_followee on user_follows (followee_id);

-- A comic a community member made. Pages are one validated JSON document:
-- [{ layout, panels: [{ imageUrl, alt, lettering: [{ kind, speaker, text }] }] }]
-- Lettering is always shown in a strip under its panel, never over the art.
create table fan_comics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  rating text not null default 'Mature' check (rating in ('Teen','Mature')),
  content_notes text not null default '',
  spinoff_of uuid references series(id) on delete set null,
  cover_url text,
  pages jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  -- visible: public when published. pending: waiting for approval. hidden: hidden by
  -- reports or a moderator, can be restored. removed: taken down by a moderator.
  moderation text not null default 'visible' check (moderation in ('visible','pending','hidden','removed')),
  moderation_note text,
  published_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fan_comics_author on fan_comics (author_id, updated_at desc);
create index fan_comics_feed on fan_comics (status, moderation, published_at desc);
create index fan_comics_spinoff on fan_comics (spinoff_of) where spinoff_of is not null;

-- A pitch for a new story or a spinoff, posted for the community to discuss.
create table ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  spinoff_of uuid references series(id) on delete set null,
  rating text not null default 'Mature' check (rating in ('Teen','Mature')),
  moderation text not null default 'visible' check (moderation in ('visible','pending','hidden','removed')),
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_feed on ideas (moderation, created_at desc);

create table likes (
  user_id uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('comic','idea')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index likes_target on likes (target_type, target_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('comic','idea')),
  target_id uuid not null,
  body text not null,
  moderation text not null default 'visible' check (moderation in ('visible','hidden','removed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_target on comments (target_type, target_id, created_at);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  target_type text not null check (target_type in ('comic','idea','comment','profile')),
  target_id uuid not null,
  reason text not null check (reason in ('minor_safety','sexual','harassment','hate','violence','copyright','spam','wrong_rating','other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
-- One open report per person per item.
create unique index reports_open_once on reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_queue on reports (status, created_at);
create index reports_target on reports (target_type, target_id);

create table community_notifications (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('like','comment','follow','moderation','approved')),
  actor_id uuid references users(id) on delete set null,
  target_type text,
  target_id uuid,
  detail text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index community_notifications_user on community_notifications (user_id, created_at desc);

-- Fan uploads, so panels can only use images their author uploaded and so a daily cap applies.
create table community_uploads (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  pathname text not null,
  created_at timestamptz not null default now()
);
create index community_uploads_user on community_uploads (user_id, created_at desc);
