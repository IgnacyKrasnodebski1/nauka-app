-- Cramfox — migracja 0005: pliki materiałów do 50 MB (było 25 MB).
-- Duże PDF-y backend wysyła do Claude przez Files API (raz na generację), więc limit 32 MB zapytania już ich nie dotyczy.
-- 50 MB to też maksimum wgrywania na darmowym planie Supabase (globalny limit projektu). Idempotentna.
update storage.buckets set file_size_limit = 52428800 where id = 'materials';
