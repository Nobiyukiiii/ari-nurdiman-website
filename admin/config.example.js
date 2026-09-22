// Copy to config.js and fill in. The anon key is PUBLIC by design: what a signed-out visitor
// can do is limited by the Row Level Security policies in supabase/schema.sql.
// NEVER put the service role key here.
window.ADMIN_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
};
