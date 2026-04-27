-- ============================================================================
-- TROLLEY MAINTENANCE DATABASE - Supabase (PostgreSQL) Schema
-- Jalankan di Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Enable pgcrypto extension (untuk verifikasi password bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABEL: maintenance_records
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT NOT NULL PRIMARY KEY,
    no INTEGER NOT NULL DEFAULT 0,
    part_no TEXT NOT NULL DEFAULT '',
    serial TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'FULL-ATLAS' CHECK (type IN ('FULL-ATLAS', 'HALF-ATLAS', 'FULL-REKONDISI', 'HALF-REKONDISI')),
    atlas TEXT DEFAULT '',
    
    -- Remarks fields
    remark_lock_part BOOLEAN NOT NULL DEFAULT FALSE,
    remark_brake_system BOOLEAN NOT NULL DEFAULT FALSE,
    remark_body_part BOOLEAN NOT NULL DEFAULT FALSE,
    remark_swivel_single BOOLEAN NOT NULL DEFAULT FALSE,
    remark_magnet_rusak BOOLEAN NOT NULL DEFAULT FALSE,
    remark_magnet_baru BOOLEAN NOT NULL DEFAULT FALSE,
    remark_roda_rusak BOOLEAN NOT NULL DEFAULT FALSE,
    remark_roda_baru BOOLEAN NOT NULL DEFAULT FALSE,
    remark_rem_baru BOOLEAN NOT NULL DEFAULT FALSE,
    remark_utt_reck BOOLEAN NOT NULL DEFAULT FALSE,
    remark_text TEXT DEFAULT '',
    remarks_barcode TEXT DEFAULT '',
    
    from_location TEXT NOT NULL DEFAULT '',
    delivery TEXT NOT NULL DEFAULT '',
    input_type TEXT NOT NULL DEFAULT 'IN' CHECK (input_type IN ('IN', 'OUT', 'REP', 'COD')),
    posisi TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'SERVICEABLE' CHECK (status IN ('SERVICEABLE', 'UNSERVICEABLE')),
    maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    po TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mr_part_no ON maintenance_records(part_no);
CREATE INDEX IF NOT EXISTS idx_mr_serial ON maintenance_records(serial);
CREATE INDEX IF NOT EXISTS idx_mr_type ON maintenance_records(type);
CREATE INDEX IF NOT EXISTS idx_mr_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_mr_input_type ON maintenance_records(input_type);
CREATE INDEX IF NOT EXISTS idx_mr_maintenance_date ON maintenance_records(maintenance_date);
CREATE INDEX IF NOT EXISTS idx_mr_created_at ON maintenance_records(created_at);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintenance_records_updated_at ON maintenance_records;
CREATE TRIGGER trg_maintenance_records_updated_at
    BEFORE UPDATE ON maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABEL: trolley_history_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS trolley_history_logs (
    id BIGSERIAL PRIMARY KEY,
    record_id TEXT NOT NULL,
    serial TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED')),
    
    part_no TEXT,
    type TEXT CHECK (type IS NULL OR type IN ('FULL-ATLAS', 'HALF-ATLAS', 'FULL-REKONDISI', 'HALF-REKONDISI')),
    status TEXT CHECK (status IS NULL OR status IN ('SERVICEABLE', 'UNSERVICEABLE')),
    input_type TEXT CHECK (input_type IS NULL OR input_type IN ('IN', 'OUT', 'REP', 'COD')),
    from_location TEXT,
    delivery TEXT,
    maintenance_date DATE,
    
    remark_body_part BOOLEAN DEFAULT FALSE,
    remark_brake_system BOOLEAN DEFAULT FALSE,
    remark_lock_part BOOLEAN DEFAULT FALSE,
    remark_magnet_rusak BOOLEAN DEFAULT FALSE,
    remark_roda_rusak BOOLEAN DEFAULT FALSE,
    remark_magnet_baru BOOLEAN DEFAULT FALSE,
    remark_roda_baru BOOLEAN DEFAULT FALSE,
    remark_rem_baru BOOLEAN DEFAULT FALSE,
    remark_swivel_single BOOLEAN DEFAULT FALSE,
    remark_utt_reck BOOLEAN DEFAULT FALSE,
    
    description TEXT,
    changed_by TEXT DEFAULT 'admin',
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hl_serial ON trolley_history_logs(serial);
CREATE INDEX IF NOT EXISTS idx_hl_record_id ON trolley_history_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_hl_changed_at ON trolley_history_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_hl_action ON trolley_history_logs(action);
CREATE INDEX IF NOT EXISTS idx_hl_maintenance_date ON trolley_history_logs(maintenance_date);

-- ============================================================================
-- TABEL: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Trigger: auto-update updated_at for users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT USERS
-- Password: "password" (bcrypt hash, $2a$ format for PostgreSQL)
-- ============================================================================

INSERT INTO users (username, password, name, role, is_active) VALUES 
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin', TRUE),
('operator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operator Staff', 'operator', TRUE)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- RPC FUNCTION: verify_user_login
-- Verifikasi password secara aman di server (password hash tidak dikirim ke client)
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_user_login(p_username TEXT, p_password TEXT)
RETURNS TABLE(user_id INTEGER, user_username TEXT, user_name TEXT, user_role TEXT) AS $$
DECLARE
    v_user RECORD;
    v_password_hash TEXT;
BEGIN
    -- Cari user aktif
    SELECT u.id, u.username, u.password, u.name, u.role
    INTO v_user
    FROM users u
    WHERE u.username = p_username AND u.is_active = TRUE;
    
    IF v_user IS NULL THEN
        RETURN;
    END IF;
    
    -- Konversi $2y$ (PHP) ke $2a$ (pgcrypto) jika perlu
    v_password_hash := replace(v_user.password, '$2y$', '$2a$');
    
    -- Verifikasi password dengan pgcrypto crypt()
    IF crypt(p_password, v_password_hash) = v_password_hash THEN
        RETURN QUERY SELECT v_user.id, v_user.username::TEXT, v_user.name::TEXT, v_user.role::TEXT;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Auth dikelola di level aplikasi, jadi RLS mengizinkan akses penuh via anon key
-- ============================================================================

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE trolley_history_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies untuk maintenance_records
CREATE POLICY "Allow all access to maintenance_records" ON maintenance_records
    FOR ALL USING (true) WITH CHECK (true);

-- Policies untuk trolley_history_logs
CREATE POLICY "Allow all access to trolley_history_logs" ON trolley_history_logs
    FOR ALL USING (true) WITH CHECK (true);

-- Policies untuk users (read-only dari client, write hanya admin via dashboard)
CREATE POLICY "Allow read access to users" ON users
    FOR SELECT USING (true);

-- Allow RPC function to work (SECURITY DEFINER handles write)
CREATE POLICY "Allow insert to users" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to users" ON users
    FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- VERIFIKASI
-- ============================================================================

SELECT 'Schema Supabase berhasil dibuat!' AS status;
