<?php
/**
 * ============================================================================
 * TROLLEY MAINTENANCE API - HISTORY LOGS
 * ============================================================================
 * 
 * Endpoint untuk mengambil history log per serial number
 * 
 * Endpoints:
 * - GET /history.php?serial=xxx    - History per serial number
 * - GET /history.php               - Semua history (limit 1000)
 * - GET /history.php?start=xxx&end=xxx - History per date range
 */

require_once __DIR__ . '/config/database.php';

// Configure session
ini_set('session.cookie_samesite', 'None');
ini_set('session.cookie_secure', 'false');
ini_set('session.cookie_httponly', 'true');
session_start();

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
    if ($method === 'GET') {
        handleGetHistory();
    } else {
        jsonResponse(false, null, 'Method not allowed', 405);
    }
} catch (Exception $e) {
    error_log("History API Error: " . $e->getMessage());
    jsonResponse(false, null, $e->getMessage(), 500);
}

function handleGetHistory() {
    $pdo = db();
    
    // Get history by serial number
    if (isset($_GET['serial'])) {
        $stmt = $pdo->prepare("
            SELECT * FROM trolley_history_logs 
            WHERE serial = ? 
            ORDER BY maintenance_date ASC, changed_at ASC
        ");
        $stmt->execute([$_GET['serial']]);
        $logs = $stmt->fetchAll();
        
        jsonResponse(true, array_map('formatHistoryLog', $logs));
        return;
    }
    
    // Get history by date range
    if (isset($_GET['start']) && isset($_GET['end'])) {
        $stmt = $pdo->prepare("
            SELECT * FROM trolley_history_logs 
            WHERE maintenance_date BETWEEN ? AND ?
            ORDER BY maintenance_date DESC, changed_at DESC
            LIMIT 5000
        ");
        $stmt->execute([$_GET['start'], $_GET['end']]);
        $logs = $stmt->fetchAll();
        
        jsonResponse(true, array_map('formatHistoryLog', $logs));
        return;
    }
    
    // Get all history (limited)
    $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 5000) : 1000;
    $stmt = $pdo->prepare("
        SELECT * FROM trolley_history_logs 
        ORDER BY maintenance_date DESC, changed_at DESC 
        LIMIT ?
    ");
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll();
    
    jsonResponse(true, array_map('formatHistoryLog', $logs));
}

/**
 * Format history log record for frontend
 */
function formatHistoryLog($log) {
    return [
        'id' => (int)$log['id'],
        'recordId' => $log['record_id'],
        'serial' => $log['serial'],
        'action' => $log['action'],
        'partNo' => $log['part_no'],
        'type' => $log['type'],
        'status' => $log['status'],
        'inputType' => $log['input_type'],
        'fromLocation' => $log['from_location'],
        'delivery' => $log['delivery'],
        'maintenanceDate' => $log['maintenance_date'],
        'remarks' => [
            'bodyPart' => (bool)($log['remark_body_part'] ?? false),
            'brakeSystem' => (bool)($log['remark_brake_system'] ?? false),
            'lockPart' => (bool)($log['remark_lock_part'] ?? false),
            'magnetRusak' => (bool)($log['remark_magnet_rusak'] ?? false),
            'rodaRusak' => (bool)($log['remark_roda_rusak'] ?? false),
            'magnetBaru' => (bool)($log['remark_magnet_baru'] ?? false),
            'rodaBaru' => (bool)($log['remark_roda_baru'] ?? false),
            'remBaru' => (bool)($log['remark_rem_baru'] ?? false),
            'swivelSingle' => (bool)($log['remark_swivel_single'] ?? false),
            'uttReck' => (bool)($log['remark_utt_reck'] ?? false),
        ],
        'description' => $log['description'],
        'changedBy' => $log['changed_by'],
        'changedAt' => $log['changed_at'],
    ];
}
