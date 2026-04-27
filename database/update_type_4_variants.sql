-- ============================================================================
-- SQL MIGRATION SCRIPT
-- Update Trolley Types to 4 Variants
-- Jalankan script ini di Supabase SQL Editor
-- ============================================================================

-- 1. Hapus constraint pengecekan tipe yang lama (karena PostgreSQL auto-generate namanya, kita gunakan nama standar tabel_kolom_check)
ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_type_check;
ALTER TABLE trolley_history_logs DROP CONSTRAINT IF EXISTS trolley_history_logs_type_check;

-- Jika Supabase menamai ulang ke nama lain, kita bisa bypass/hapus secara otomatis dengan script ini (hapus semua constraint di kolom type)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'maintenance_records' AND column_name = 'type'
    ) LOOP
        EXECUTE 'ALTER TABLE maintenance_records DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'trolley_history_logs' AND column_name = 'type'
    ) LOOP
        EXECUTE 'ALTER TABLE trolley_history_logs DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
END $$;


-- 2. Update data yang lama menjadi tipe Atlas
UPDATE maintenance_records SET type = 'FULL-ATLAS' WHERE type = 'FULL';
UPDATE maintenance_records SET type = 'HALF-ATLAS' WHERE type = 'HALF';

UPDATE trolley_history_logs SET type = 'FULL-ATLAS' WHERE type = 'FULL';
UPDATE trolley_history_logs SET type = 'HALF-ATLAS' WHERE type = 'HALF';

-- 3. Tambahkan constraint pengecekan tipe yang baru
ALTER TABLE maintenance_records 
  ADD CONSTRAINT maintenance_records_type_check 
  CHECK (type IN ('FULL-ATLAS', 'HALF-ATLAS', 'FULL-REKONDISI', 'HALF-REKONDISI'));

ALTER TABLE trolley_history_logs 
  ADD CONSTRAINT trolley_history_logs_type_check 
  CHECK (type IS NULL OR type IN ('FULL-ATLAS', 'HALF-ATLAS', 'FULL-REKONDISI', 'HALF-REKONDISI'));

-- 4. Set Default kolom type menjadi FULL-ATLAS
ALTER TABLE maintenance_records ALTER COLUMN type SET DEFAULT 'FULL-ATLAS';

SELECT 'Update tipe ke 4 varian berhasil dieksekusi!' as status;
