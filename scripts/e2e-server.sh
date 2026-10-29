#!/usr/bin/env bash
# Starts the built app on :3100 against the local e2e database (for running Playwright repeatedly).
# One variable per line: the local database URL has no password.
export DATABASE_URL=postgres://postgres@localhost:5433/toon_e2e
export ADMIN_EMAILS=boss@toon.test
export PAYMENTS_PROVIDER=test
export ALLOW_LOCAL_MEDIA=1
export EMAIL_DEV_TRANSPORT=1
export APP_URL=http://localhost:3100
export LOCAL_MEDIA_DIR=.data/e2e-media
export NEXT_DIST_DIR=.next-e2e
exec npx next start -p 3100
