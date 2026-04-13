-- ============================================================================
-- TROLLEY MAINTENANCE DATABASE - Users Table
-- Untuk autentikasi user (Multi-User dengan Role)
-- ============================================================================

USE `trolley_data`;

-- ============================================================================
-- TABEL: users
-- Menyimpan data user untuk login
-- ============================================================================

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Username untuk login',
    `password` VARCHAR(255) NOT NULL COMMENT 'Password terenkripsi (bcrypt)',
    `name` VARCHAR(100) NOT NULL COMMENT 'Nama lengkap user',
    `role` ENUM('admin', 'operator') NOT NULL DEFAULT 'operator' COMMENT 'Role user',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Status aktif user',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu dibuat',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    INDEX `idx_username` (`username`),
    INDEX `idx_role` (`role`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Data user untuk autentikasi';

-- ============================================================================
-- INSERT DEFAULT USERS
-- Password di-hash dengan bcrypt oleh PHP saat pertama kali
-- ============================================================================

-- Admin user: Full access (CRUD, Import, Delete All)
-- Password: admin123
INSERT INTO `users` (`username`, `password`, `name`, `role`, `is_active`) VALUES 
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin', TRUE);

-- Operator user: Read-only access (View data, Export Excel)
-- Password: operator123
INSERT INTO `users` (`username`, `password`, `name`, `role`, `is_active`) VALUES 
('operator', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Operator Staff', 'operator', TRUE);

-- ============================================================================
-- ROLE PERMISSIONS:
-- ============================================================================
-- ADMIN:
--   ✓ Form Input (Create/Edit data)
--   ✓ Import Excel
--   ✓ Export Excel
--   ✓ Delete individual records
--   ✓ Delete All data
--   ✓ View Dashboard & Data Table
--
-- OPERATOR:
--   ✓ View Data Table
--   ✓ View Dashboard
--   ✓ Export Excel
--   ✓ Download Template
--   ✗ Form Input (hidden)
--   ✗ Import Excel (hidden)
--   ✗ Edit/Delete records (hidden)
--   ✗ Delete All (hidden)
-- ============================================================================

SELECT 'Tabel users berhasil dibuat dengan 2 default users!' AS 'Status';
SELECT username, name, role FROM users;
