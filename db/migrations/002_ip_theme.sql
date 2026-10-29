-- Per-IP look: brand theme key (maps to .tn-ip--<theme>) and the IP's own mark.
alter table series add column theme text not null default 'studio' check (theme ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table series add column logo_url text;
