-- ==============================================================================
-- RESET TOP GLOBAL LEADERBOARD (JALANKAN SATU KALI)
-- Data lama tidak valid karena:
--   1. Versi lama mencatat skor = 0 (poin belum direkam).
--   2. Versi lama mencatat hasil yang sama berulang kali (setiap browser di room
--      ikut mencatat semua pemain), sehingga MAIN & MENANG bisa terhitung ganda.
--   3. Skrip "backfill" sebelumnya mengisi skor dari tebakan (sessionScores room
--      & wins x 3), bukan dari poin yang benar-benar didapat.
-- Poin per game tidak pernah disimpan, jadi data lama tidak bisa dipulihkan
-- secara akurat. Mulai bersih dari 0 adalah satu-satunya opsi yang jujur.
-- ==============================================================================

TRUNCATE TABLE public.leaderboard;

NOTIFY pgrst, 'reload schema';

