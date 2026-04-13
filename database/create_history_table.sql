-- ============================================================================
-- TROLLEY MAINTENANCE - HISTORY LOG TABLE
-- Jalankan di phpMyAdmin setelah setup_complete.sql
-- ============================================================================

USE trolley_data;

-- Buat tabel history logs
CREATE TABLE IF NOT EXISTS trolley_history_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    record_id VARCHAR(50) NOT NULL,
    serial VARCHAR(100) NOT NULL,
    action ENUM('CREATED','UPDATED','DELETED') NOT NULL,
    -- Snapshot lengkap kondisi trolley saat itu
    part_no VARCHAR(100),
    type ENUM('FULL','HALF'),
    status ENUM('SERVICEABLE','UNSERVICEABLE'),
    input_type ENUM('IN','OUT','REP','COD'),
    from_location VARCHAR(100),
    delivery VARCHAR(100),
    maintenance_date DATE,
    -- Semua remark flags (kondisi detail)
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
    -- Deskripsi perubahan yang mudah dibaca
    description TEXT,
    changed_by VARCHAR(100) DEFAULT 'admin',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_serial (serial),
    INDEX idx_record_id (record_id),
    INDEX idx_changed_at (changed_at),
    INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verifikasi
SELECT 'Tabel trolley_history_logs berhasil dibuat!' AS Status;
DESCRIBE trolley_history_logs;
