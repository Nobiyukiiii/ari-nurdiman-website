-- =============================================================================
-- Ari Nurdiman: CMS schema for Supabase
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to re-run: every statement is idempotent.
--
-- Model
--   * Public website  : reads PUBLISHED rows with the anon key (build time only).
--   * Admin panel     : signs in with Supabase Auth; only users listed in
--                       public.admins can write or see drafts.
--   * Photos          : Storage bucket "media" (public read, admin write).
-- =============================================================================

-- ---------- Admin allow-list ----------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------- Shared trigger: keep updated_at honest -------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Site settings (one row; JSON mirrors site/content/site.json) -----------
create table if not exists public.site_settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Releases (single / EP / album) ----------------------------------------
create table if not exists public.releases (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title             text not null,
  release_type      text not null default 'single' check (release_type in ('single', 'ep', 'album')),
  year              int  not null check (year between 1900 and 2100),
  release_date      date,
  duration          text,
  duration_seconds  int,
  cover_path        text,
  cover_alt         text,
  description       text,
  description_lang  text not null default 'id',
  spotify_track_id  text,
  youtube_video_id  text,
  lyrics_url        text,
  credits           jsonb not null default '[]'::jsonb,
  related_links     jsonb not null default '[]'::jsonb,
  tracks            jsonb not null default '[]'::jsonb,
  sort              int  not null default 0,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Gallery photos ---------------------------------------------------------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  alt        text,
  caption    text,
  width      int,
  height     int,
  sort       int  not null default 0,
  status     text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Videos -----------------------------------------------------------------
create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  youtube_id text not null,
  thumb_path text,
  sort       int  not null default 0,
  status     text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- News -------------------------------------------------------------------
create table if not exists public.news (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  date       date,
  excerpt    text,
  url        text,
  image_path text,
  image_alt  text,
  sort       int  not null default 0,
  status     text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Admin-only: secrets (deploy hook) and publish history -------------------
create table if not exists public.admin_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  by_email   text,
  note       text
);

-- ---------- updated_at triggers -----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['site_settings', 'releases', 'photos', 'videos', 'news', 'admin_settings']
  loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- Row Level Security ------------------------------------------------------
alter table public.admins         enable row level security;
alter table public.site_settings  enable row level security;
alter table public.releases       enable row level security;
alter table public.photos         enable row level security;
alter table public.videos         enable row level security;
alter table public.news           enable row level security;
alter table public.admin_settings enable row level security;
alter table public.publish_log    enable row level security;

-- admins: a signed-in user can see their own row (so the panel can verify access)
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- site_settings: public read, admin write
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings
  for select using (true);
drop policy if exists "settings admin write" on public.site_settings;
create policy "settings admin write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- content tables: public sees published rows only, admin sees and edits everything
do $$
declare t text;
begin
  foreach t in array array['releases', 'photos', 'videos', 'news']
  loop
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (status = ''published'' or public.is_admin())', t, t);
    execute format('drop policy if exists "%s admin write" on public.%I', t, t);
    execute format('create policy "%s admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- admin_settings / publish_log: admin only
drop policy if exists "admin_settings admin only" on public.admin_settings;
create policy "admin_settings admin only" on public.admin_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "publish_log admin only" on public.publish_log;
create policy "publish_log admin only" on public.publish_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage: public bucket "media" -------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------- First admin (edit the email, run AFTER creating the user in Auth > Users) --
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'YOU@EXAMPLE.COM'
-- on conflict (user_id) do nothing;

-- ---------- UI text overrides (button/nav/label copy shown across the site) --------
-- NULL value = use the site's built-in default text.
create table if not exists public.ui_text (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.ui_text enable row level security;
drop trigger if exists trg_touch on public.ui_text;
create trigger trg_touch before update on public.ui_text for each row execute function public.touch_updated_at();
drop policy if exists "ui_text public read" on public.ui_text;
create policy "ui_text public read" on public.ui_text for select using (true);
drop policy if exists "ui_text admin write" on public.ui_text;
create policy "ui_text admin write" on public.ui_text for all to authenticated using (public.is_admin()) with check (public.is_admin());
