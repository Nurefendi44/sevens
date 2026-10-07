-- ==============================================================================
-- SEVENS (TUJUH SEKOP) MULTIPLAYER MIGRATION
-- Enables Realtime Multiplayer Rooms with Supabase
-- ==============================================================================

-- 1. Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby', -- 'lobby', 'playing', 'game_over'
    players JSONB NOT NULL DEFAULT '[]'::jsonb,
    game_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for high performance lookup
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- 4. Set Replica Identity to FULL
-- Ensures Supabase Realtime broadcast payloads include the full record
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- 5. RLS Policies (Frontend-only multiplayer with anon key)
DROP POLICY IF EXISTS "Allow anon read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anon insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anon update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anon delete rooms" ON public.rooms;

CREATE POLICY "Allow anon read rooms"
ON public.rooms FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anon insert rooms"
ON public.rooms FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon update rooms"
ON public.rooms FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete rooms"
ON public.rooms FOR DELETE
TO anon, authenticated
USING (true);

-- 6. Add rooms table to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
END $$;

-- 7. Grant access rights to anon, authenticated, and service_role
GRANT ALL ON TABLE public.rooms TO anon, authenticated, service_role;

-- 8. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

