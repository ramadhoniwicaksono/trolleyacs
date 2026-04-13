-- ============================================================================
-- TROLLEY MAINTENANCE DATABASE - MySQL Schema
-- Untuk diimpor ke phpMyAdmin (localhost)
-- ============================================================================

-- Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS `trolley_data` 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE `trolley_data`;

-- ============================================================================
-- TABEL: maintenance_records
-- Menyimpan data maintenance trolley
-- ============================================================================

DROP TABLE IF EXISTS `maintenance_records`;

CREATE TABLE `maintenance_records` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT 'Unique identifier (timestamp-random)',
    `no` INT NOT NULL COMMENT 'Nomor urut record',
    `part_no` VARCHAR(100) NOT NULL COMMENT 'Part number trolley',
    `serial` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Serial number (harus unik)',
    `type` ENUM('FULL', 'HALF') NOT NULL DEFAULT 'FULL' COMMENT 'Jenis trolley: FULL atau HALF',
    
    -- Remarks fields (dipisahkan dari JSON untuk optimasi query)
    `remark_lock_part` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Lock part perlu diperbaiki',
    `remark_brake_system` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Brake system perlu diperbaiki',
    `remark_body_part` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Body part perlu diperbaiki',
    `remark_swivel_single` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Swivel single perlu diperbaiki',
    `remark_magnet_rusak` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Magnet rusak',
    `remark_magnet_baru` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Magnet baru dipasang',
    `remark_roda_rusak` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Roda rusak',
    `remark_roda_baru` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Roda baru dipasang',
    `remark_rem_baru` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Rem baru dipasang (N.BR)',
    
    `from_location` VARCHAR(100) NOT NULL COMMENT 'Asal lokasi trolley',
    `delivery` VARCHAR(100) NOT NULL COMMENT 'Tujuan delivery',
    `input_type` ENUM('IN', 'OUT', 'REP', 'COD') NOT NULL DEFAULT 'IN' COMMENT 'Jenis input: IN/OUT/REP/COD',
    `status` ENUM('SERVICEABLE', 'UNSERVICEABLE') NOT NULL DEFAULT 'SERVICEABLE' COMMENT 'Status kondisi trolley',
    `maintenance_date` DATE NOT NULL COMMENT 'Tanggal maintenance',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu pembuatan record',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Waktu update terakhir',
    
    -- Indexes untuk optimasi query
    INDEX `idx_part_no` (`part_no`),
    INDEX `idx_serial` (`serial`),
    INDEX `idx_type` (`type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_input_type` (`input_type`),
    INDEX `idx_maintenance_date` (`maintenance_date`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Data maintenance trolley';

-- ============================================================================
-- INSERT CONTOH DATA (opsional)
-- ============================================================================

INSERT INTO `maintenance_records` (
    `id`, `no`, `part_no`, `serial`, `type`,
    `remark_lock_part`, `remark_brake_system`, `remark_body_part`, 
    `remark_swivel_single`, `remark_magnet_rusak`, `remark_magnet_baru`,
    `remark_roda_rusak`, `remark_roda_baru`, `remark_rem_baru`,
    `from_location`, `delivery`, `input_type`, `status`, `maintenance_date`
) VALUES 
(
    'sample-001', 1, 'TRL-2024-001', 'SN-ABC123', 'FULL',
    FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE,
    'Terminal 1', 'Gudang A', 'IN', 'SERVICEABLE', CURDATE()
),
(
    'sample-002', 2, 'TRL-2024-002', 'SN-DEF456', 'HALF',
    TRUE, FALSE, TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE,
    'Terminal 2', 'Bengkel', 'REP', 'UNSERVICEABLE', CURDATE()
);

-- ============================================================================
-- VIEW: Laporan Maintenance Harian
-- ============================================================================

CREATE OR REPLACE VIEW `v_daily_maintenance_report` AS
SELECT 
    DATE(`maintenance_date`) AS `tanggal`,
    COUNT(*) AS `total_records`,
    SUM(CASE WHEN `type` = 'FULL' THEN 1 ELSE 0 END) AS `total_full`,
    SUM(CASE WHEN `type` = 'HALF' THEN 1 ELSE 0 END) AS `total_half`,
    SUM(CASE WHEN `status` = 'SERVICEABLE' THEN 1 ELSE 0 END) AS `serviceable`,
    SUM(CASE WHEN `status` = 'UNSERVICEABLE' THEN 1 ELSE 0 END) AS `unserviceable`,
    SUM(CASE WHEN `input_type` = 'IN' THEN 1 ELSE 0 END) AS `input_in`,
    SUM(CASE WHEN `input_type` = 'OUT' THEN 1 ELSE 0 END) AS `input_out`,
    SUM(CASE WHEN `input_type` = 'REP' THEN 1 ELSE 0 END) AS `input_rep`,
    SUM(CASE WHEN `input_type` = 'COD' THEN 1 ELSE 0 END) AS `input_cod`
FROM `maintenance_records`
GROUP BY DATE(`maintenance_date`)
ORDER BY `tanggal` DESC;

-- ============================================================================
-- VIEW: Statistik Remarks
-- ============================================================================

CREATE OR REPLACE VIEW `v_remarks_statistics` AS
SELECT 
    SUM(CASE WHEN `remark_lock_part` = TRUE THEN 1 ELSE 0 END) AS `lock_part_issues`,
    SUM(CASE WHEN `remark_brake_system` = TRUE THEN 1 ELSE 0 END) AS `brake_system_issues`,
    SUM(CASE WHEN `remark_body_part` = TRUE THEN 1 ELSE 0 END) AS `body_part_issues`,
    SUM(CASE WHEN `remark_swivel_single` = TRUE THEN 1 ELSE 0 END) AS `swivel_single_issues`,
    SUM(CASE WHEN `remark_magnet_rusak` = TRUE THEN 1 ELSE 0 END) AS `magnet_rusak_count`,
    SUM(CASE WHEN `remark_magnet_baru` = TRUE THEN 1 ELSE 0 END) AS `magnet_baru_count`,
    SUM(CASE WHEN `remark_roda_rusak` = TRUE THEN 1 ELSE 0 END) AS `roda_rusak_count`,
    SUM(CASE WHEN `remark_roda_baru` = TRUE THEN 1 ELSE 0 END) AS `roda_baru_count`,
    SUM(CASE WHEN `remark_rem_baru` = TRUE THEN 1 ELSE 0 END) AS `stiker_barcode_count`,
    COUNT(*) AS `total_records`
FROM `maintenance_records`;

-- ============================================================================
-- STORED PROCEDURE: Get Records by Date Range
-- ============================================================================

DELIMITER //

CREATE PROCEDURE `sp_get_records_by_date_range`(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT * FROM `maintenance_records`
    WHERE `maintenance_date` BETWEEN p_start_date AND p_end_date
    ORDER BY `maintenance_date` DESC, `created_at` DESC;
END //

DELIMITER ;

-- ============================================================================
-- STORED PROCEDURE: Delete Records by Date
-- ============================================================================

DELIMITER //

CREATE PROCEDURE `sp_delete_records_by_date`(
    IN p_target_date DATE
)
BEGIN
    DELETE FROM `maintenance_records`
    WHERE DATE(`maintenance_date`) = p_target_date;
    
    SELECT ROW_COUNT() AS `deleted_count`;
END //

DELIMITER ;

-- ============================================================================
-- TAMPILKAN STRUKTUR TABEL
-- ============================================================================

DESCRIBE `maintenance_records`;

SELECT 'Database trolley_maintenance berhasil dibuat!' AS 'Status';
