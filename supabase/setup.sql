-- Run AFTER Prisma and Payload migrations, using the SQL editor.
-- Pikol authorizes database access on the server. No browser CRUD policies.
REVOKE ALL ON SCHEMA cms FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA cms FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cms FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cms REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cms REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Leave this bucket PRIVATE. Pikol's API checks venue/booking access before
-- reading an object with the server-only secret key. No browser policies needed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pikol-uploads', 'pikol-uploads', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
