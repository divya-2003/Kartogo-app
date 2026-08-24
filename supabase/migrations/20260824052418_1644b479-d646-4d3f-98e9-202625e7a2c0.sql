CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_config (key text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON private.cron_config FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE ON private.cron_config TO sandbox_exec;