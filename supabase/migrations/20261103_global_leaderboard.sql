-- ==============================================================================
-- GLOBAL LEADERBOARD MIGRATION
-- Enables Cross-Player Top Global Leaderboard per Game & Overall
-- ==============================================================================

-- 1. Create leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT NOT NULL,
    player_name VARCHAR(60) NOT NULL,
    avatar TEXT DEFAULT '👤',
    game_type VARCHAR(20) NOT NULL, -- 'sevens', 'bigtwo', 'game41'
    wins INT NOT NULL DEFAULT 0,
    games_played INT NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    last_played_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_leaderboard_player_game UNIQUE (player_id, game_type)
);

-- 2. Indexes for high performance queries & ranking
CREATE INDEX IF NOT EXISTS idx_leaderboard_player_game ON public.leaderboard(player_id, game_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_ranking ON public.leaderboard(game_type, wins DESC, score DESC, games_played ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_wins_overall ON public.leaderboard(wins DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Set Replica Identity to FULL for Realtime broadcast
ALTER TABLE public.leaderboard REPLICA IDENTITY FULL;

-- 5. RLS Policies (Allow anon & authenticated read and write)
DROP POLICY IF EXISTS "Allow anon read leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow anon insert leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow anon update leaderboard" ON public.leaderboard;

CREATE POLICY "Allow anon read leaderboard"
ON public.leaderboard FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anon insert leaderboard"
ON public.leaderboard FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon update leaderboard"
ON public.leaderboard FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 6. Add leaderboard table to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'leaderboard'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
  END IF;
END $$;

-- 7. RPC to record / increment player stats safely (Aggregated by Username)
-- Wins = Jumlah kemenangan Juara 1
-- Score = Total poin yang didapatkan dari keseluruhan permainan
CREATE OR REPLACE FUNCTION public.record_game_stats(
    p_player_id TEXT,
    p_player_name TEXT,
    p_avatar TEXT,
    p_game_type VARCHAR,
    p_is_win BOOLEAN,
    p_score INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_name VARCHAR(60);
    v_existing_id TEXT;
BEGIN
    v_clean_name := COALESCE(NULLIF(TRIM(p_player_name), ''), 'Pemain');

    -- Cari apakah username yang sama (case-insensitive) sudah ada di game_type ini
    SELECT player_id INTO v_existing_id
    FROM public.leaderboard
    WHERE game_type = p_game_type
      AND LOWER(TRIM(player_name)) = LOWER(v_clean_name)
    ORDER BY last_played_at DESC
    LIMIT 1;

    IF v_existing_id IS NULL THEN
        v_existing_id := COALESCE(NULLIF(TRIM(p_player_id), ''), 'user_' || LOWER(v_clean_name));
    END IF;

    INSERT INTO public.leaderboard (
        player_id,
        player_name,
        avatar,
        game_type,
        wins,
        games_played,
        score,
        last_played_at
    )
    VALUES (
        v_existing_id,
        v_clean_name,
        COALESCE(NULLIF(TRIM(p_avatar), ''), '👤'),
        p_game_type,
        CASE WHEN p_is_win THEN 1 ELSE 0 END,
        1,
        GREATEST(0, COALESCE(p_score, 0)),
        timezone('utc'::text, now())
    )
    ON CONFLICT (player_id, game_type) DO UPDATE SET
        player_name = CASE 
            WHEN TRIM(EXCLUDED.player_name) <> '' THEN EXCLUDED.player_name 
            ELSE public.leaderboard.player_name 
        END,
        avatar = COALESCE(NULLIF(TRIM(EXCLUDED.avatar), ''), public.leaderboard.avatar),
        wins = public.leaderboard.wins + (CASE WHEN p_is_win THEN 1 ELSE 0 END),
        games_played = public.leaderboard.games_played + 1,
        score = public.leaderboard.score + GREATEST(0, COALESCE(p_score, 0)),
        last_played_at = timezone('utc'::text, now());
END;
$$;

-- 8. RPC to retrieve Top Global leaderboard (supports 'all' or specific game_type, grouped by username)
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
    p_game_type VARCHAR DEFAULT 'all',
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    player_id TEXT,
    player_name VARCHAR,
    avatar TEXT,
    game_type VARCHAR,
    wins BIGINT,
    games_played BIGINT,
    score BIGINT,
    last_played_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_game_type IS NULL OR p_game_type = 'all' THEN
        RETURN QUERY
        SELECT
            (ARRAY_AGG(l.player_id ORDER BY l.last_played_at DESC))[1]::TEXT AS player_id,
            (ARRAY_AGG(l.player_name ORDER BY l.last_played_at DESC))[1]::VARCHAR AS player_name,
            (ARRAY_AGG(l.avatar ORDER BY l.last_played_at DESC))[1]::TEXT AS avatar,
            'all'::VARCHAR AS game_type,
            SUM(l.wins)::BIGINT AS wins,
            SUM(l.games_played)::BIGINT AS games_played,
            GREATEST(SUM(l.score), SUM(l.wins) * 3)::BIGINT AS score,
            MAX(l.last_played_at) AS last_played_at
        FROM public.leaderboard l
        GROUP BY LOWER(TRIM(l.player_name))
        HAVING SUM(l.games_played) > 0
        ORDER BY wins DESC, score DESC, games_played ASC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT
            (ARRAY_AGG(l.player_id ORDER BY l.last_played_at DESC))[1]::TEXT AS player_id,
            (ARRAY_AGG(l.player_name ORDER BY l.last_played_at DESC))[1]::VARCHAR AS player_name,
            (ARRAY_AGG(l.avatar ORDER BY l.last_played_at DESC))[1]::TEXT AS avatar,
            p_game_type::VARCHAR AS game_type,
            SUM(l.wins)::BIGINT AS wins,
            SUM(l.games_played)::BIGINT AS games_played,
            GREATEST(SUM(l.score), SUM(l.wins) * 3)::BIGINT AS score,
            MAX(l.last_played_at) AS last_played_at
        FROM public.leaderboard l
        WHERE l.game_type = p_game_type
        GROUP BY LOWER(TRIM(l.player_name))
        HAVING SUM(l.games_played) > 0
        ORDER BY wins DESC, score DESC, games_played ASC
        LIMIT p_limit;
    END IF;
END;
$$;

-- 9. Grant permissions to anon, authenticated, service_role
GRANT ALL ON TABLE public.leaderboard TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_game_stats(TEXT, TEXT, TEXT, VARCHAR, BOOLEAN, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(VARCHAR, INT) TO anon, authenticated, service_role;

-- 10. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
