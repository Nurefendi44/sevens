-- ==============================================================================
-- MATCHMAKING (QUICK MATCH) - MEJA DINAMIS 4-6 PEMAIN (DENGAN ANTI-DUPLIKASI)
-- Semua pemain satu game masuk SATU antrean. Pemain paling awal menjadi HOST.
-- Meja menampung maksimal 6 pemain; game dimulai otomatis saat minimal 4 pemain.
--
-- DILENGKAPI DETEKSI RECONNECT:
-- 1. Membersihkan room matchmaking kadaluarsa (>2 menit tanpa detak jantung).
-- 2. Jika pemain refresh browser di HP atau berpindah aplikasi lalu klik Cari Lawan lagi,
--    sistem akan otomatis mengenali ID atau Nama yang sama dan memasukkannya kembali
--    ke kursi semula tanpa membuat user duplikat!
--
-- Jalankan di Supabase Dashboard -> SQL Editor.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.matchmake(text, int, jsonb);
DROP FUNCTION IF EXISTS public.matchmake(text, jsonb);

CREATE OR REPLACE FUNCTION public.matchmake(
  p_game_type text,
  p_player    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max       constant int := 6;
  v_room      public.rooms%ROWTYPE;
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
  v_name      text := TRIM(COALESCE(p_player->>'name', ''));
  v_id        text := p_player->>'id';
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Player id wajib diisi';
  END IF;

  -- 0. Bersihkan room matchmaking mati / ditinggal (>2 menit tanpa update)
  DELETE FROM public.rooms
  WHERE status = 'lobby'
    AND game_state->>'matchmaking' = 'true'
    AND updated_at < now() - interval '2 minutes';

  -- Serialize antrean per game agar tidak ada dua transaksi bertabrakan
  PERFORM pg_advisory_xact_lock(hashtext('matchmake:' || v_game));

  -- ---------------------------------------------------------------------------
  -- 1. DETEKSI RECONNECT: Apakah pemain ini (berdasarkan ID atau NAMA) sudah
  --    berada di dalam salah satu room matchmaking yang masih aktif?
  -- ---------------------------------------------------------------------------
  SELECT * INTO v_room
  FROM public.rooms r
  WHERE r.status = 'lobby'
    AND r.game_state->>'matchmaking' = 'true'
    AND COALESCE(r.game_state->>'gameType', 'sevens') = v_game
    AND r.updated_at > now() - interval '2 minutes'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.players) e
      WHERE (
        e->>'id' = v_id 
        OR (v_name <> '' AND LOWER(TRIM(e->>'name')) = LOWER(v_name))
      )
      AND COALESCE((e->>'isBot')::boolean, false) = false
    )
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Temukan kursi pemain tersebut
    SELECT e INTO v_player
    FROM jsonb_array_elements(v_room.players) e
    WHERE e->>'id' = v_id 
       OR (v_name <> '' AND LOWER(TRIM(e->>'name')) = LOWER(v_name))
    LIMIT 1;

    -- Perbarui ID di daftar players dan host_id jika berubah (misal ganti session / tab)
    UPDATE public.rooms
       SET players = (
         SELECT jsonb_agg(
           CASE 
             WHEN (elem->>'id' = v_player->>'id' OR (v_name <> '' AND LOWER(TRIM(elem->>'name')) = LOWER(v_name)))
             THEN jsonb_set(jsonb_set(elem, '{id}', to_jsonb(v_id)), '{name}', to_jsonb(COALESCE(NULLIF(v_name, ''), elem->>'name')))
             ELSE elem 
           END
         )
         FROM jsonb_array_elements(v_room.players) elem
       ),
       host_id = CASE WHEN v_room.host_id = v_player->>'id' THEN v_id ELSE v_room.host_id END,
       updated_at = now()
     WHERE id = v_room.id
    RETURNING * INTO v_room;

    v_player := jsonb_set(v_player, '{id}', to_jsonb(v_id));
    IF v_name <> '' THEN
      v_player := jsonb_set(v_player, '{name}', to_jsonb(v_name));
    END IF;

    RETURN jsonb_build_object(
      'room', to_jsonb(v_room),
      'player', v_player,
      'created', (v_room.host_id = v_id),
      'isReconnected', true
    );
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. CARI ROOM YANG SEDANG MENUNGGU LAWAN (BELUM PENUH)
  -- ---------------------------------------------------------------------------
  SELECT * INTO v_room
  FROM public.rooms r
  WHERE r.status = 'lobby'
    AND r.game_state->>'matchmaking' = 'true'
    AND COALESCE(r.game_state->>'gameType', 'sevens') = v_game
    AND jsonb_array_length(r.players) BETWEEN 1 AND v_max - 1
    AND r.updated_at > now() - interval '90 seconds'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.players) e
      WHERE COALESCE((e->>'isBot')::boolean, false) = false
    )
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Pengaman tambahan: periksa apakah nama / ID ini sudah ada di room tersebut
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_room.players) e
      WHERE e->>'id' = v_id OR (v_name <> '' AND LOWER(TRIM(e->>'name')) = LOWER(v_name))
    ) THEN
      SELECT e INTO v_player
      FROM jsonb_array_elements(v_room.players) e
      WHERE e->>'id' = v_id OR (v_name <> '' AND LOWER(TRIM(e->>'name')) = LOWER(v_name))
      LIMIT 1;

      UPDATE public.rooms
         SET players = (
           SELECT jsonb_agg(
             CASE 
               WHEN (elem->>'id' = v_player->>'id' OR (v_name <> '' AND LOWER(TRIM(elem->>'name')) = LOWER(v_name)))
               THEN jsonb_set(jsonb_set(elem, '{id}', to_jsonb(v_id)), '{name}', to_jsonb(COALESCE(NULLIF(v_name, ''), elem->>'name')))
               ELSE elem 
             END
           )
           FROM jsonb_array_elements(v_room.players) elem
         ),
         host_id = CASE WHEN v_room.host_id = v_player->>'id' THEN v_id ELSE v_room.host_id END,
         updated_at = now()
       WHERE id = v_room.id
      RETURNING * INTO v_room;

      v_player := jsonb_set(v_player, '{id}', to_jsonb(v_id));
      IF v_name <> '' THEN
        v_player := jsonb_set(v_player, '{name}', to_jsonb(v_name));
      END IF;

      RETURN jsonb_build_object('room', to_jsonb(v_room), 'player', v_player, 'created', (v_room.host_id = v_id), 'isReconnected', true);
    END IF;

    -- Pemain baru di room ini
    v_seat := jsonb_array_length(v_room.players);
    v_player := jsonb_build_object(
      'id', v_id,
      'name', COALESCE(NULLIF(v_name, ''), 'Pemain'),
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

  -- ---------------------------------------------------------------------------
  -- 3. TIDAK ADA ROOM: Buat room baru dan pemain ini menjadi HOST
  -- ---------------------------------------------------------------------------
  v_prefix := CASE v_game WHEN 'bigtwo' THEN 'B2-' WHEN 'game41' THEN 'R41-' ELSE 'SV-' END;
  v_deck := CASE WHEN v_game = 'bigtwo' THEN 'double' ELSE 'single' END;

  v_player := jsonb_build_object(
    'id', v_id,
    'name', COALESCE(NULLIF(v_name, ''), 'Host'),
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
    v_id,
    'lobby',
    jsonb_build_array(v_player),
    jsonb_build_object(
      'config', jsonb_build_object(
        'playerCount', v_max,
        'roomPlayerCount', v_max,
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

GRANT EXECUTE ON FUNCTION public.matchmake(text, jsonb) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
