-- ============================================================================
-- TROLLEY MAINTENANCE DATABASE SETUP
-- Jalankan di phpMyAdmin
-- ============================================================================

-- 1. Buat database
CREATE DATABASE IF NOT EXISTS trolley_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Pilih database
USE trolley_data;

-- 3. Hapus tabel lama jika ada
DROP TABLE IF EXISTS maintenance_records;
DROP TABLE IF EXISTS users;

-- 4. Buat tabel maintenance_records
CREATE TABLE maintenance_records (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    no INT NOT NULL,
    part_no VARCHAR(100) NOT NULL,
    serial VARCHAR(100) NOT NULL UNIQUE,
    type ENUM('FULL', 'HALF') NOT NULL DEFAULT 'FULL',
    remark_lock_part BOOLEAN NOT NULL DEFAULT FALSE,
    remark_brake_system BOOLEAN NOT NULL DEFAULT FALSE,
    remark_body_part BOOLEAN NOT NULL DEFAULT FALSE,
    remark_swivel_single BOOLEAN NOT NULL DEFAULT FALSE,
    remark_magnet_rusak BOOLEAN NOT NULL DEFAULT FALSE,
    remark_magnet_baru BOOLEAN NOT NULL DEFAULT FALSE,
    remark_roda_rusak BOOLEAN NOT NULL DEFAULT FALSE,
    remark_roda_baru BOOLEAN NOT NULL DEFAULT FALSE,
    remark_rem_baru BOOLEAN NOT NULL DEFAULT FALSE,
    from_location VARCHAR(100) NOT NULL,
    delivery VARCHAR(100) NOT NULL,
    input_type ENUM('IN', 'OUT', 'REP', 'COD') NOT NULL DEFAULT 'IN',
    status ENUM('SERVICEABLE', 'UNSERVICEABLE') NOT NULL DEFAULT 'SERVICEABLE',
    maintenance_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_part_no (part_no),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_input_type (input_type),
    INDEX idx_maintenance_date (maintenance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Buat tabel users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'operator') NOT NULL DEFAULT 'operator',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Insert default users
-- Password untuk keduanya: password
INSERT INTO users (username, password, name, role, is_active) VALUES 
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin', TRUE),
('operator', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operator Staff', 'operator', TRUE);

-- 7. Verifikasi
SELECT 'Database trolley_data berhasil dibuat!' AS Status;
SHOW TABLES;
SELECT * FROM users;
