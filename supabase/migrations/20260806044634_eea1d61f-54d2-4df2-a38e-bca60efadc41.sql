CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('kartogo-inventory-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kartogo-inventory-digest');

SELECT cron.schedule(
  'kartogo-inventory-digest',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--d2006ba3-49d0-4e1b-a1e2-4185f124983c.lovable.app/api/public/inventory-digest',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbXN2Z256amVsbmhtZGFwYWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDg5MTEsImV4cCI6MjA5NjIyNDkxMX0.vgxpXHtklqioIKLiiz6zvKD9dCkJBJbO5GiItpSgs00"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);