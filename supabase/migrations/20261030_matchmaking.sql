-- ==============================================================================
-- MATCHMAKING (QUICK MATCH)
-- Pemain pertama yang masuk antrean otomatis menjadi HOST. Pemain berikutnya
-- mengisi room matchmaking yang paling lama (created_at ASC) dan belum penuh.
--
-- Jalankan sekali di Supabase Dashboard -> SQL Editor.
-- Tidak mengubah struktur tabel; penanda room matchmaking disimpan di
-- rooms.game_state->'matchmaking' = true.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.matchmake(
  p_game_type   text,
  p_max_players int,
  p_player      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room      public.rooms%ROWTYPE;
  v_players   jsonb;
  v_player    jsonb;
  v_seat      int;
  v_code      text;
  v_prefix    text;
  v_chars     text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rand      text;
  v_tries     int := 0;
  v_deck      text;
  v_avatars   text[] := ARRAY['👤','🦊','🐼','🦁','🐯','🐨'];
  v_game      text := COALESCE(NULLIF(p_game_type, ''), 'sevens');
BEGIN
  IF p_max_players NOT IN (4, 5, 6) THEN
    RAISE EXCEPTION 'Matchmaking hanya untuk 4, 5, atau 6 pemain';
  END IF;

  IF p_player->>'id' IS NULL THEN
    RAISE EXCEPTION 'Player id wajib diisi';
  END IF;

  -- Serialize antrean per (game, ukuran meja) agar tidak ada dua host sekaligus
  PERFORM pg_advisory_xact_lock(hashtext('matchmake:' || v_game || ':' || p_max_players));

  -- Cari room matchmaking terlama yang masih hidup, belum penuh, dan ada manusianya
  SELECT * INTO v_room
  FROM public.rooms r
  WHERE r.status = 'lobby'
    AND r.game_state->>'matchmaking' = 'true'
    AND COALESCE(r.game_state->>'gameType', 'sevens') = v_game
    AND COALESCE(
          (r.game_state->'config'->>'roomPlayerCount')::int,
          (r.game_state->'config'->>'playerCount')::int
        ) = p_max_players
    AND jsonb_array_length(r.players) BETWEEN 1 AND p_max_players - 1
    AND r.updated_at > now() - interval '75 seconds'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.players) e
      WHERE COALESCE((e->>'isBot')::boolean, false) = false
    )
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Sudah ada di room ini? kembalikan apa adanya (reconnect)
    SELECT e INTO v_player
    FROM jsonb_array_elements(v_room.players) e
    WHERE e->>'id' = p_player->>'id'
    LIMIT 1;

    IF v_player IS NOT NULL THEN
      RETURN jsonb_build_object('room', to_jsonb(v_room), 'player', v_player, 'created', false);
    END IF;

    v_seat := jsonb_array_length(v_room.players);
    v_player := jsonb_build_object(
      'id', p_player->>'id',
      'name', COALESCE(NULLIF(p_player->>'name', ''), 'Pemain'),
      'seatIndex', v_seat,
      'isHost', false,
      'isReady', true,
      'avatar', v_avatars[LEAST(v_seat + 1, 6)],
      'joinedAt', (extract(epoch FROM clock_timestamp()) * 1000)::bigint
    );

    UPDATE public.rooms
       SET players = v_room.players || jsonb_build_array(v_player),
           updated_at = now()
     WHERE id = v_room.id
    RETURNING * INTO v_room;

    RETURN jsonb_build_object('room', to_jsonb(v_room), 'player', v_player, 'created', false);
  END IF;

  -- Tidak ada room: buat baru, pemain ini menjadi HOST (paling awal di antrean)
  v_prefix := CASE v_game WHEN 'bigtwo' THEN 'B2-' WHEN 'game41' THEN 'R41-' ELSE 'SV-' END;
  v_deck := CASE WHEN v_game = 'bigtwo' AND p_max_players > 4 THEN 'double' ELSE 'single' END;

  v_player := jsonb_build_object(
    'id', p_player->>'id',
    'name', COALESCE(NULLIF(p_player->>'name', ''), 'Host'),
    'seatIndex', 0,
    'isHost', true,
    'isReady', true,
    'avatar', v_avatars[1],
    'joinedAt', (extract(epoch FROM clock_timestamp()) * 1000)::bigint
  );

  LOOP
    v_rand := '';
    FOR i IN 1..4 LOOP
      v_rand := v_rand || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    v_code := v_prefix || v_rand;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = v_code);
    v_tries := v_tries + 1;
    IF v_tries > 20 THEN
      RAISE EXCEPTION 'Gagal membuat kode room unik';
    END IF;
  END LOOP;

  INSERT INTO public.rooms (code, host_id, status, players, game_state)
  VALUES (
    v_code,
    p_player->>'id',
    'lobby',
    jsonb_build_array(v_player),
    jsonb_build_object(
      'config', jsonb_build_object(
        'playerCount', p_max_players,
        'roomPlayerCount', p_max_players,
        'deckMode', v_deck
      ),
      'gameType', v_game,
      'matchmaking', true
    )
  )
  RETURNING * INTO v_room;

  RETURN jsonb_build_object('room', to_jsonb(v_room), 'player', v_player, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmake(text, int, jsonb) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
