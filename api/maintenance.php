<?php
/**
 * ============================================================================
 * TROLLEY MAINTENANCE API - MAINTENANCE RECORDS
 * ============================================================================
 * 
 * RESTful API untuk mengelola data maintenance records
 * 
 * Endpoints:
 * - GET    /maintenance.php           - Ambil semua records
 * - GET    /maintenance.php?id=xxx    - Ambil satu record
 * - GET    /maintenance.php?start=xxx&end=xxx - Ambil by date range
 * - POST   /maintenance.php           - Buat record baru
 * - PUT    /maintenance.php?id=xxx    - Update record
 * - DELETE /maintenance.php?id=xxx    - Hapus record
 * - DELETE /maintenance.php           - Hapus semua records
 * - DELETE /maintenance.php?date=xxx  - Hapus records by date
 */

require_once __DIR__ . '/config/database.php';

// Configure session for cross-origin requests
ini_set('session.cookie_samesite', 'None');
ini_set('session.cookie_secure', 'false');
ini_set('session.cookie_httponly', 'true');

// Start session to access user role
session_start();

// Set session cookie with SameSite=None for cross-origin
if (session_status() === PHP_SESSION_ACTIVE) {
    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => time() + 86400,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => false,
        'httponly' => true,
        'samesite' => 'None'
    ]);
}

handleCORS();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet();
            break;
        case 'POST':
            handlePost();
            break;
        case 'PUT':
            handlePut();
            break;
        case 'DELETE':
            handleDelete();
            break;
        default:
            jsonResponse(false, null, 'Method not allowed', 405);
    }
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    jsonResponse(false, null, $e->getMessage(), 500);
}

// ============================================================================
// GET - Retrieve Records
// ============================================================================

function handleGet() {
    $pdo = db();
    
    // Get single record by ID
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        $record = $stmt->fetch();
        
        if ($record) {
            jsonResponse(true, formatRecord($record));
        } else {
            jsonResponse(false, null, 'Record not found', 404);
        }
        return;
    }
    
    // Get records by date range
    if (isset($_GET['start']) && isset($_GET['end'])) {
        $stmt = $pdo->prepare("
            SELECT * FROM maintenance_records 
            WHERE maintenance_date BETWEEN ? AND ?
            ORDER BY maintenance_date DESC, created_at DESC
        ");
        $stmt->execute([$_GET['start'], $_GET['end']]);
        $records = $stmt->fetchAll();
        
        jsonResponse(true, array_map('formatRecord', $records));
        return;
    }
    
    // Get all records
    $stmt = $pdo->query("SELECT * FROM maintenance_records ORDER BY created_at DESC");
    $records = $stmt->fetchAll();
    
    jsonResponse(true, array_map('formatRecord', $records));
}

// ============================================================================
// POST - Create Record(s)
// ============================================================================

function handlePost() {
    // PROTECT: Only admin can create data
    requireAdmin();

    $pdo = db();
    $body = getRequestBody();
    
    // Handle batch import
    if (isset($body['records']) && is_array($body['records'])) {
        $result = batchCreate($pdo, $body['records']);
        jsonResponse(true, $result);
        return;
    }
    
    // Validate required fields
    if (empty($body['serial'])) {
        jsonResponse(false, null, 'Serial number harus diisi', 400);
        return;
    }
    
    // Check if serial number already exists
    $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE serial = ?");
    $stmt->execute([$body['serial']]);
    $existing = $stmt->fetch();
    
    $remarks = $body['remarks'] ?? [];
    
    // Save old record for history comparison
    $oldRecord = $existing ? $existing : null;
    
    if ($existing) {
        // AUTO-UPDATE: Serial exists, update the existing record
        $existingId = $existing['id'];
        $updateStmt = $pdo->prepare("
            UPDATE maintenance_records SET
                no = ?, part_no = ?, type = ?, atlas = ?,
                remark_lock_part = ?, remark_brake_system = ?, remark_body_part = ?,
                remark_swivel_single = ?, remark_magnet_rusak = ?, remark_magnet_baru = ?,
                remark_roda_rusak = ?, remark_roda_baru = ?, remark_rem_baru = ?,
                remark_utt_reck = ?, remark_text = ?, remarks_barcode = ?,
                from_location = ?, delivery = ?, input_type = ?, posisi = ?,
                status = ?, maintenance_date = ?, po = ?
            WHERE id = ?
        ");
        
        $updateStmt->execute([
            $body['no'] ?? 0,
            $body['partNo'] ?? '',
            $body['type'] ?? 'FULL',
            $body['atlas'] ?? '',
            toBoolInt($remarks['lockPart'] ?? false),
            toBoolInt($remarks['brakeSystem'] ?? false),
            toBoolInt($remarks['bodyPart'] ?? false),
            toBoolInt($remarks['swivelSingle'] ?? false),
            toBoolInt($remarks['magnetRusak'] ?? false),
            toBoolInt($remarks['magnetBaru'] ?? false),
            toBoolInt($remarks['rodaRusak'] ?? false),
            toBoolInt($remarks['rodaBaru'] ?? false),
            toBoolInt($remarks['stikerBarcode'] ?? false),
            toBoolInt($remarks['uttReck'] ?? false),
            $body['remarkText'] ?? '',
            $body['remarksBarcode'] ?? '',
            $body['from'] ?? '',
            $body['delivery'] ?? '',
            $body['input'] ?? 'IN',
            $body['posisi'] ?? '',
            $body['status'] ?? 'SERVICEABLE',
            convertToMySQLDate($body['date'] ?? null),
            $body['po'] ?? '',
            $existingId
        ]);
        
        // Fetch and return the updated record
        $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
        $stmt->execute([$existingId]);
        $record = $stmt->fetch();
        
        // Log history: UPDATED
        logHistory($pdo, $record, 'UPDATED', $oldRecord);
        
        jsonResponse(true, formatRecord($record), 'Serial number sudah ada, data berhasil diupdate!', 200);
        return;
    }
    
    // Single record creation (new serial)
    $id = generateId();
    
    $stmt = $pdo->prepare("
        INSERT INTO maintenance_records (
            id, no, part_no, serial, type, atlas,
            remark_lock_part, remark_brake_system, remark_body_part,
            remark_swivel_single, remark_magnet_rusak, remark_magnet_baru,
            remark_roda_rusak, remark_roda_baru, remark_rem_baru,
            remark_utt_reck, remark_text, remarks_barcode,
            from_location, delivery, input_type, posisi, status, maintenance_date, po
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
        )
    ");
    
    $stmt->execute([
        $id,
        $body['no'] ?? 0,
        $body['partNo'] ?? '',
        $body['serial'] ?? '',
        $body['type'] ?? 'FULL',
        $body['atlas'] ?? '',
        toBoolInt($remarks['lockPart'] ?? false),
        toBoolInt($remarks['brakeSystem'] ?? false),
        toBoolInt($remarks['bodyPart'] ?? false),
        toBoolInt($remarks['swivelSingle'] ?? false),
        toBoolInt($remarks['magnetRusak'] ?? false),
        toBoolInt($remarks['magnetBaru'] ?? false),
        toBoolInt($remarks['rodaRusak'] ?? false),
        toBoolInt($remarks['rodaBaru'] ?? false),
        toBoolInt($remarks['stikerBarcode'] ?? false),
        toBoolInt($remarks['uttReck'] ?? false),
        $body['remarkText'] ?? '',
        $body['remarksBarcode'] ?? '',
        $body['from'] ?? '',
        $body['delivery'] ?? '',
        $body['input'] ?? 'IN',
        $body['posisi'] ?? '',
        $body['status'] ?? 'SERVICEABLE',
        convertToMySQLDate($body['date'] ?? null),
        $body['po'] ?? ''
    ]);
    
    // Fetch and return the created record
    $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    
    // Log history: CREATED
    logHistory($pdo, $record, 'CREATED');
    
    jsonResponse(true, formatRecord($record), null, 201);
}

// ============================================================================
// PUT - Update Record
// ============================================================================

function handlePut() {
    // PROTECT: Only admin can update data
    requireAdmin();

    if (!isset($_GET['id'])) {
        jsonResponse(false, null, 'ID required', 400);
        return;
    }
    
    $pdo = db();
    $id = $_GET['id'];
    $body = getRequestBody();
    
    // Check if record exists (keep full old record for history)
    $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    $oldRecord = $existing;
    
    if (!$existing) {
        jsonResponse(false, null, 'Record not found', 404);
        return;
    }
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    
    $fieldMap = [
        'no' => 'no',
        'partNo' => 'part_no',
        'serial' => 'serial',
        'type' => 'type',
        'atlas' => 'atlas',
        'from' => 'from_location',
        'delivery' => 'delivery',
        'input' => 'input_type',
        'posisi' => 'posisi',
        'status' => 'status',
        'date' => 'maintenance_date',
        'remarkText' => 'remark_text',
        'remarksBarcode' => 'remarks_barcode',
        'po' => 'po'
    ];
    
    foreach ($fieldMap as $jsonKey => $dbKey) {
        if (isset($body[$jsonKey])) {
            $updates[] = "$dbKey = ?";
            // Convert date to MySQL format if it's a date field
            if ($jsonKey === 'date') {
                $params[] = convertToMySQLDate($body[$jsonKey]);
            } else {
                $params[] = $body[$jsonKey];
            }
        }
    }
    
    // Handle remarks
    if (isset($body['remarks'])) {
        $remarkMap = [
            'lockPart' => 'remark_lock_part',
            'brakeSystem' => 'remark_brake_system',
            'bodyPart' => 'remark_body_part',
            'swivelSingle' => 'remark_swivel_single',
            'magnetRusak' => 'remark_magnet_rusak',
            'magnetBaru' => 'remark_magnet_baru',
            'rodaRusak' => 'remark_roda_rusak',
            'rodaBaru' => 'remark_roda_baru',
            'stikerBarcode' => 'remark_rem_baru',
            'uttReck' => 'remark_utt_reck'
        ];
        
        foreach ($remarkMap as $jsonKey => $dbKey) {
            if (isset($body['remarks'][$jsonKey])) {
                $updates[] = "$dbKey = ?";
                $params[] = $body['remarks'][$jsonKey] ? 1 : 0;
            }
        }
    }
    
    if (empty($updates)) {
        jsonResponse(false, null, 'No fields to update', 400);
        return;
    }
    
    $params[] = $id;
    $sql = "UPDATE maintenance_records SET " . implode(', ', $updates) . " WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    // Fetch and return updated record
    $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    
    // Log history: UPDATED
    logHistory($pdo, $record, 'UPDATED', $oldRecord);
    
    jsonResponse(true, formatRecord($record));
}

// ============================================================================
// DELETE - Delete Record(s)
// ============================================================================

function handleDelete() {
    // PROTECT: Only admin can delete data
    requireAdmin();

    $pdo = db();
    
    // Delete single record by ID
    if (isset($_GET['id'])) {
        // Fetch record before deleting for history log
        $stmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        $recordToDelete = $stmt->fetch();
        
        $stmt = $pdo->prepare("DELETE FROM maintenance_records WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        
        if ($stmt->rowCount() > 0) {
            // Log history: DELETED
            if ($recordToDelete) {
                logHistory($pdo, $recordToDelete, 'DELETED');
            }
            jsonResponse(true, ['deleted' => true]);
        } else {
            jsonResponse(false, null, 'Record not found', 404);
        }
        return;
    }
    
    // Delete records by date
    if (isset($_GET['date'])) {
        $stmt = $pdo->prepare("DELETE FROM maintenance_records WHERE DATE(maintenance_date) = ?");
        $stmt->execute([$_GET['date']]);
        
        jsonResponse(true, ['deletedCount' => $stmt->rowCount()]);
        return;
    }
    
    // Delete all records
    $stmt = $pdo->query("DELETE FROM maintenance_records");
    jsonResponse(true, ['deletedCount' => $stmt->rowCount()]);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format database record to match frontend expected format
 */
function formatRecord($record) {
    return [
        'id' => $record['id'],
        'no' => (int)$record['no'],
        'partNo' => $record['part_no'],
        'serial' => $record['serial'],
        'type' => $record['type'],
        'atlas' => $record['atlas'] ?? '',
        'remarks' => [
            'lockPart' => (bool)($record['remark_lock_part'] ?? false),
            'brakeSystem' => (bool)($record['remark_brake_system'] ?? false),
            'bodyPart' => (bool)($record['remark_body_part'] ?? false),
            'swivelSingle' => (bool)($record['remark_swivel_single'] ?? false),
            'magnetRusak' => (bool)($record['remark_magnet_rusak'] ?? false),
            'magnetBaru' => (bool)($record['remark_magnet_baru'] ?? false),
            'rodaRusak' => (bool)($record['remark_roda_rusak'] ?? false),
            'rodaBaru' => (bool)($record['remark_roda_baru'] ?? false),
            'stikerBarcode' => (bool)($record['remark_rem_baru'] ?? false),
            'uttReck' => (bool)($record['remark_utt_reck'] ?? false)
        ],
        'from' => $record['from_location'],
        'delivery' => $record['delivery'],
        'input' => $record['input_type'],
        'posisi' => $record['posisi'] ?? '',
        'remarkText' => $record['remark_text'] ?? '',
        'remarksBarcode' => $record['remarks_barcode'] ?? '',
        'status' => $record['status'],
        'date' => $record['maintenance_date'],
        'po' => $record['po'] ?? '',
        'createdAt' => $record['created_at']
    ];
}

/**
 * Batch create records for import
 */
function batchCreate($pdo, $records) {
    $successCount = 0;
    $updateCount = 0;
    $errorCount = 0;
    $errors = [];
    
    $pdo->beginTransaction();
    
    try {
        $insertStmt = $pdo->prepare("
            INSERT INTO maintenance_records (
                id, no, part_no, serial, type, atlas,
                remark_lock_part, remark_brake_system, remark_body_part,
                remark_swivel_single, remark_magnet_rusak, remark_magnet_baru,
                remark_roda_rusak, remark_roda_baru, remark_rem_baru,
                remark_utt_reck, remark_text, remarks_barcode,
                from_location, delivery, input_type, posisi, status, maintenance_date, po
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
        ");
        
        $updateStmt = $pdo->prepare("
            UPDATE maintenance_records SET
                no = ?, part_no = ?, type = ?, atlas = ?,
                remark_lock_part = ?, remark_brake_system = ?, remark_body_part = ?,
                remark_swivel_single = ?, remark_magnet_rusak = ?, remark_magnet_baru = ?,
                remark_roda_rusak = ?, remark_roda_baru = ?, remark_rem_baru = ?,
                remark_utt_reck = ?, remark_text = ?, remarks_barcode = ?,
                from_location = ?, delivery = ?, input_type = ?, posisi = ?,
                status = ?, maintenance_date = ?, po = ?
            WHERE serial = ?
        ");
        
        foreach ($records as $index => $record) {
            try {
                $serial = $record['serial'] ?? '';
                
                // Skip if serial is empty
                if (empty($serial)) {
                    $errorCount++;
                    $errors[] = "Record " . ($index + 1) . ": Serial number kosong";
                    continue;
                }
                
                $remarks = $record['remarks'] ?? [];
                $dataParams = [
                    $record['no'] ?? 0,
                    $record['partNo'] ?? '',
                    $record['type'] ?? 'FULL',
                    $record['atlas'] ?? '',
                    toBoolInt($remarks['lockPart'] ?? false),
                    toBoolInt($remarks['brakeSystem'] ?? false),
                    toBoolInt($remarks['bodyPart'] ?? false),
                    toBoolInt($remarks['swivelSingle'] ?? false),
                    toBoolInt($remarks['magnetRusak'] ?? false),
                    toBoolInt($remarks['magnetBaru'] ?? false),
                    toBoolInt($remarks['rodaRusak'] ?? false),
                    toBoolInt($remarks['rodaBaru'] ?? false),
                    toBoolInt($remarks['stikerBarcode'] ?? false),
                    toBoolInt($remarks['uttReck'] ?? false),
                    $record['remarkText'] ?? '',
                    $record['remarksBarcode'] ?? '',
                    $record['from'] ?? '',
                    $record['delivery'] ?? '',
                    $record['input'] ?? 'IN',
                    $record['posisi'] ?? '',
                    $record['status'] ?? 'SERVICEABLE',
                    convertToMySQLDate($record['date'] ?? null),
                    $record['po'] ?? ''
                ];
                
                // Check if serial already exists
                $checkStmt = $pdo->prepare("SELECT * FROM maintenance_records WHERE serial = ?");
                $checkStmt->execute([$serial]);
                
                $existingRecord = $checkStmt->fetch();
                if ($existingRecord) {
                    // AUTO-UPDATE: Serial exists, update existing record
                    $updateStmt->execute(array_merge($dataParams, [$serial]));
                    $updateCount++;
                    
                    // Log history for batch update
                    $fetchUpdated = $pdo->prepare("SELECT * FROM maintenance_records WHERE serial = ?");
                    $fetchUpdated->execute([$serial]);
                    $updatedRec = $fetchUpdated->fetch();
                    if ($updatedRec) {
                        logHistory($pdo, $updatedRec, 'UPDATED', $existingRecord);
                    }
                } else {
                    // INSERT: New serial — need id + no + partNo + serial + rest
                    $id = generateId() . '-' . $index;
                    $insertParams = $dataParams;
                    // Insert serial after partNo (index 1) to match: id, no, part_no, serial, type, ...
                    array_splice($insertParams, 2, 0, [$serial]);
                    $insertStmt->execute(array_merge([$id], $insertParams));
                    
                    // Log history for batch create
                    $fetchCreated = $pdo->prepare("SELECT * FROM maintenance_records WHERE id = ?");
                    $fetchCreated->execute([$id]);
                    $createdRec = $fetchCreated->fetch();
                    if ($createdRec) {
                        logHistory($pdo, $createdRec, 'CREATED');
                    }
                }
                
                $successCount++;
            } catch (Exception $e) {
                $errorCount++;
                $errors[] = "Record " . ($index + 1) . ": " . $e->getMessage();
            }
        }
        
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
    return [
        'successCount' => $successCount,
        'updateCount' => $updateCount,
        'errorCount' => $errorCount,
        'errors' => $errors
    ];
}

/**
 * Convert ISO date string (from JavaScript) to MySQL DATE format
 * Example: "2026-02-06T09:05:06.000Z" -> "2026-02-06"
 */
function convertToMySQLDate($dateString) {
    if (empty($dateString)) {
        return date('Y-m-d'); // Default to today
    }
    
    try {
        // Handle ISO 8601 format (from JavaScript toISOString())
        if (strpos($dateString, 'T') !== false) {
            $dateObj = new DateTime($dateString);
            return $dateObj->format('Y-m-d');
        }
        
        // Already in Y-m-d format or other date format
        $timestamp = strtotime($dateString);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }
        
        // Fallback to today
        return date('Y-m-d');
    } catch (Exception $e) {
        return date('Y-m-d');
    }
}

/**
 * Convert boolean value to MySQL integer (0 or 1)
 */
function toBoolInt($value) {
    if ($value === true || $value === 'true' || $value === 1 || $value === '1') {
        return 1;
    }
    return 0;
}

/**
 * Require Admin Role Middleware
 * Returns 403 Forbidden if user is not admin
 * Checks both session and X-User-Role header for flexibility
 */
function requireAdmin() {
    // First check session
    if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
        return; // Session auth OK
    }
    
    // Fallback: Check X-User-Role header (for development/proxy scenarios)
    $headers = getallheaders();
    $userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? null;
    
    if ($userRole === 'admin') {
        return; // Header auth OK
    }
    
    // No valid admin auth found
    jsonResponse(false, null, 'Akses Ditolak: Anda tidak memiliki izin Admin', 403);
}

// ============================================================================
// HISTORY LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a history entry with full snapshot of the trolley state.
 * Auto-generates a human-readable description of what happened.
 *
 * @param PDO $pdo Database connection
 * @param array $record Current record state (from maintenance_records)
 * @param string $action 'CREATED', 'UPDATED', or 'DELETED'
 * @param array|null $oldRecord Previous record state (for UPDATED comparisons)
 */
function logHistory($pdo, $record, $action, $oldRecord = null) {
    try {
        $description = buildHistoryDescription($record, $action, $oldRecord);
        
        $stmt = $pdo->prepare("
            INSERT INTO trolley_history_logs (
                record_id, serial, action,
                part_no, type, status, input_type,
                from_location, delivery, maintenance_date,
                remark_body_part, remark_brake_system, remark_lock_part,
                remark_magnet_rusak, remark_roda_rusak,
                remark_magnet_baru, remark_roda_baru, remark_rem_baru,
                remark_swivel_single, remark_utt_reck,
                description, changed_by
            ) VALUES (
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?
            )
        ");
        
        // Determine who made the change
        $changedBy = 'admin';
        if (isset($_SESSION['username'])) {
            $changedBy = $_SESSION['username'];
        } else {
            $headers = getallheaders();
            $changedBy = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'admin';
        }
        
        $stmt->execute([
            $record['id'],
            $record['serial'],
            $action,
            $record['part_no'],
            $record['type'],
            $record['status'],
            $record['input_type'],
            $record['from_location'],
            $record['delivery'],
            $record['maintenance_date'],
            (int)($record['remark_body_part'] ?? 0),
            (int)($record['remark_brake_system'] ?? 0),
            (int)($record['remark_lock_part'] ?? 0),
            (int)($record['remark_magnet_rusak'] ?? 0),
            (int)($record['remark_roda_rusak'] ?? 0),
            (int)($record['remark_magnet_baru'] ?? 0),
            (int)($record['remark_roda_baru'] ?? 0),
            (int)($record['remark_rem_baru'] ?? 0),
            (int)($record['remark_swivel_single'] ?? 0),
            (int)($record['remark_utt_reck'] ?? 0),
            $description,
            $changedBy
        ]);
    } catch (Exception $e) {
        // Don't fail the main operation if logging fails
        error_log("History log error: " . $e->getMessage());
    }
}

/**
 * Build a human-readable description of what happened.
 */
function buildHistoryDescription($record, $action, $oldRecord = null) {
    $remarkLabels = [
        'remark_body_part' => 'Body Part Rusak',
        'remark_brake_system' => 'Rem Rusak',
        'remark_lock_part' => 'Lock Part Rusak',
        'remark_magnet_rusak' => 'Magnet Rusak',
        'remark_roda_rusak' => 'Roda Rusak',
        'remark_magnet_baru' => 'Magnet Baru',
        'remark_roda_baru' => 'Roda Baru',
        'remark_rem_baru' => 'Rem Baru',
        'remark_swivel_single' => 'Swivel Single',
        'remark_utt_reck' => 'UTT Reck',
    ];
    
    if ($action === 'CREATED') {
        $parts = ['Data baru ditambahkan.'];
        
        // List active remarks
        $activeRemarks = [];
        foreach ($remarkLabels as $key => $label) {
            if (!empty($record[$key])) {
                $activeRemarks[] = $label;
            }
        }
        if (!empty($activeRemarks)) {
            $parts[] = 'Kondisi: ' . implode(', ', $activeRemarks) . '.';
        }
        $parts[] = 'Status: ' . ($record['status'] ?? 'SERVICEABLE') . '.';
        $parts[] = 'Type: ' . ($record['type'] ?? 'FULL') . '.';
        $parts[] = 'Input: ' . ($record['input_type'] ?? 'IN') . '.';
        
        return implode(' ', $parts);
    }
    
    if ($action === 'DELETED') {
        return 'Data dihapus. Serial: ' . ($record['serial'] ?? '') . '.';
    }
    
    if ($action === 'UPDATED' && $oldRecord) {
        $changes = [];
        
        // Check status change
        if (($oldRecord['status'] ?? '') !== ($record['status'] ?? '')) {
            $changes[] = 'Status: ' . ($oldRecord['status'] ?? '-') . ' → ' . ($record['status'] ?? '-');
        }
        
        // Check type change
        if (($oldRecord['type'] ?? '') !== ($record['type'] ?? '')) {
            $changes[] = 'Type: ' . ($oldRecord['type'] ?? '-') . ' → ' . ($record['type'] ?? '-');
        }
        
        // Check input_type change
        if (($oldRecord['input_type'] ?? '') !== ($record['input_type'] ?? '')) {
            $changes[] = 'Input: ' . ($oldRecord['input_type'] ?? '-') . ' → ' . ($record['input_type'] ?? '-');
        }
        
        // Check from_location change
        if (($oldRecord['from_location'] ?? '') !== ($record['from_location'] ?? '')) {
            $changes[] = 'From: ' . ($oldRecord['from_location'] ?? '-') . ' → ' . ($record['from_location'] ?? '-');
        }
        
        // Check delivery change
        if (($oldRecord['delivery'] ?? '') !== ($record['delivery'] ?? '')) {
            $changes[] = 'Delivery: ' . ($oldRecord['delivery'] ?? '-') . ' → ' . ($record['delivery'] ?? '-');
        }
        
        // Check remark changes
        $newRemarks = [];
        $removedRemarks = [];
        foreach ($remarkLabels as $key => $label) {
            $oldVal = !empty($oldRecord[$key]);
            $newVal = !empty($record[$key]);
            if (!$oldVal && $newVal) {
                $newRemarks[] = $label;
            } else if ($oldVal && !$newVal) {
                $removedRemarks[] = $label;
            }
        }
        
        if (!empty($newRemarks)) {
            $changes[] = 'Ditambahkan: ' . implode(', ', $newRemarks);
        }
        if (!empty($removedRemarks)) {
            $changes[] = 'Dihilangkan: ' . implode(', ', $removedRemarks);
        }
        
        if (empty($changes)) {
            return 'Data diupdate (tidak ada perubahan signifikan).';
        }
        
        return 'Data diupdate. ' . implode('. ', $changes) . '.';
    }
    
    return 'Data ' . strtolower($action) . '.';
}
