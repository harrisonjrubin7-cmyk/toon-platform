-- 002: unsubscribe links and welcome-email tracking (applied 2026-10-29).
-- The app role vr_signup_writer can no longer touch the table directly;
-- it may only call the three functions below, which run as the owner.
ALTER TABLE newsletter_signups
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_signups_unsub_token ON newsletter_signups (unsubscribe_token);

-- New sign-up: returns the unsubscribe token, or NULL when the email is already on the list.
CREATE OR REPLACE FUNCTION vr_subscribe(p_email text, p_user_agent text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO newsletter_signups (email, age_confirmed, source, user_agent)
  VALUES (p_email, true, 'landing-page', left(p_user_agent, 300))
  ON CONFLICT (email_normalized) DO NOTHING
  RETURNING unsubscribe_token;
$$;

CREATE OR REPLACE FUNCTION vr_mark_welcome_sent(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE newsletter_signups SET welcome_sent_at = now() WHERE unsubscribe_token = p_token;
$$;

-- Returns true when the token matched a sign-up (repeat calls stay true).
CREATE OR REPLACE FUNCTION vr_unsubscribe(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH u AS (
    UPDATE newsletter_signups SET unsubscribed_at = COALESCE(unsubscribed_at, now())
    WHERE unsubscribe_token = p_token RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;

REVOKE ALL ON FUNCTION vr_subscribe(text, text), vr_mark_welcome_sent(uuid), vr_unsubscribe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vr_subscribe(text, text), vr_mark_welcome_sent(uuid), vr_unsubscribe(uuid) TO vr_signup_writer;
REVOKE INSERT ON newsletter_signups FROM vr_signup_writer;
