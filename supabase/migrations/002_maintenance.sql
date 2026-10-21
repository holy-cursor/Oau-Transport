-- Requires pg_cron support; enable Cron in the project's Integrations first if needed.
create extension if not exists pg_cron;
select cron.schedule('transport-refresh','10 seconds',$$select private.refresh_state()$$);
select cron.schedule('transport-retention','15 2 * * *',$$
 delete from public.queue_reports where created_at < now()-make_interval(days=>private.setting('retention_days')::integer);
 update public.buses set last_lat=null,last_lng=null,last_accuracy=null,last_speed=null
 where not shift_active and last_seen<now()-make_interval(days=>private.setting('retention_days')::integer);
$$);
