-- Card battle game: collections, decks, packs, purchases and matches.
-- Card definitions live in code (src/lib/game/cards.ts); the database stores who owns what.

create table game_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  starter_granted_at timestamptz,
  public_collection boolean not null default false, -- show my collection and big pulls to other players
  created_at timestamptz not null default now()
);

-- How many copies of each card (and cosmetic variant) a player owns.
create table card_collection (
  user_id uuid not null references users(id) on delete cascade,
  card_id text not null,
  variant text not null default 'base' check (variant in ('base','reverse_holo','scar_foil')),
  quantity int not null check (quantity >= 0),
  first_acquired_at timestamptz not null default now(),
  primary key (user_id, card_id, variant)
);

-- Pack types for sale. Odds are stored per pack so they are shown exactly as used.
create table pack_products (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 50),
  currency text not null default 'usd',
  odds jsonb not null, -- {slots:[{count, weights:{rarity:weight}}], variants:{base:w, reverse_holo:w, scar_foil:w}}
  active boolean not null default false,
  position int not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- One row per checkout. A purchase is fulfilled (packs created) exactly once, when it becomes paid.
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  product_id text not null references pack_products(id),
  quantity int not null check (quantity between 1 and 10),
  unit_price_cents int not null,
  amount_cents int not null,
  currency text not null,
  provider text not null check (provider in ('stripe','test','grant')),
  provider_ref text, -- Stripe Checkout session id
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','expired')),
  country text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  odds_snapshot jsonb not null
);
create unique index purchases_provider_ref on purchases(provider, provider_ref) where provider_ref is not null;
create index purchases_user on purchases(user_id, created_at desc);

-- Sealed packs a player owns, and what came out when opened.
create table packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id text not null references pack_products(id),
  purchase_id uuid references purchases(id) on delete set null,
  source text not null check (source in ('purchase','grant')),
  odds_snapshot jsonb not null,
  status text not null default 'sealed' check (status in ('sealed','opened','revoked')),
  contents jsonb, -- [{cardId, variant, rarity}] once opened
  created_at timestamptz not null default now(),
  opened_at timestamptz
);
create index packs_user on packs(user_id, status, created_at desc);
create index packs_opened on packs(opened_at desc) where status = 'opened';

-- Every card a player gets, for history and the "recent pulls" feed.
create table card_grants (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  card_id text not null,
  variant text not null,
  source text not null check (source in ('starter','pack','admin')),
  pack_id uuid references packs(id) on delete set null,
  serial int, -- scar foil copies are numbered 1..50 across all players
  created_at timestamptz not null default now()
);
create index card_grants_user on card_grants(user_id, created_at desc);
create unique index card_grants_serial on card_grants(card_id, variant, serial) where serial is not null;

create table decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  cards jsonb not null, -- array of card ids
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decks_user on decks(user_id, updated_at desc);

-- Matches. Against the computer the browser runs the engine and only the result is recorded
-- (it never awards anything). Between players the server holds the state and runs every move.
create table matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('ai','pvp')),
  status text not null check (status in ('open','active','done','cancelled')),
  player_a uuid not null references users(id) on delete cascade,
  player_b uuid references users(id) on delete cascade,
  ai_opponent text,
  deck_a jsonb not null,
  deck_b jsonb,
  state jsonb,
  seq int not null default 0,
  winner text check (winner in ('a','b','draw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_open on matches(status, created_at desc) where mode = 'pvp';
create index matches_player_a on matches(player_a, updated_at desc);
create index matches_player_b on matches(player_b, updated_at desc);

-- Starter booster. Proposed price and odds; the owner sets the final numbers in the studio.
insert into pack_products (id, name, description, price_cents, odds, active, position) values (
  'ember-heart-booster',
  'Ember Heart Booster',
  'Five cards from Volcano Racers Series 1: The Ember Heart Saga.',
  299,
  '{"slots":[{"count":3,"weights":{"common":100}},{"count":1,"weights":{"rare":78,"epic":16,"legendary":5,"secret":1}},{"count":1,"weights":{"common":60,"rare":27,"epic":9,"legendary":3,"secret":1}}],"variants":{"base":88,"reverse_holo":10,"scar_foil":2}}',
  true,
  0
);
