#!/usr/bin/env bash
# Starts the built app on :3100 against the local e2e database (for running Playwright repeatedly).
export DATABASE_URL=postgres://postgres@localhost:5433/toon_e2e ADMIN_EMAILS=boss@toon.test ALLOW_LOCAL_MEDIA=1 LOCAL_MEDIA_DIR=.data/e2e-media NEXT_DIST_DIR=.next-e2e
exec npx next start -p 3100
