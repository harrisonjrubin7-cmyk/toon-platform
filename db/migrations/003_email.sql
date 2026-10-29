-- Email: an outbox every message goes through, password reset tokens, and
-- each reader's choice about release emails.
alter table users add column email_releases boolean not null default true;
alter table users add column unsubscribe_token text not null default encode(gen_random_bytes(18), 'hex');
create unique index users_unsubscribe_token on users (unsubscribe_token);

create table password_resets (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_resets_user on password_resets (user_id, created_at);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('password_reset','release')),
  -- Same key twice is ignored, so a re-publish never emails a reader twice.
  dedupe_key text not null unique,
  user_id uuid references users(id) on delete cascade,
  release_id uuid references releases(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts int not null default 0,
  last_error text,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_due on email_outbox (status, send_after);
