-- DEV ONLY: drops all Recall tables so 0001_init.sql can be re-applied on a fresh project. Never run in production.
drop table if exists public.quests_daily, public.achievements, public.usage, public.subscriptions, public.activity, public.srs_cards, public.progress, public.generations, public.materials, public.topics, public.subjects, public.library, public.user_meta, public.profiles cascade;
drop function if exists public.increment_usage(uuid, text, text), public.my_total_xp(), public.log_activity(int, int), public.log_activity(int, int, date), public.weekly_leaderboard(int), public.my_weekly_rank(), public.handle_new_user(), public.touch_updated_at() cascade;
drop type if exists public.generation_status, public.plan, public.stage cascade;
delete from storage.objects where bucket_id = 'materials';
delete from storage.buckets where id = 'materials';
