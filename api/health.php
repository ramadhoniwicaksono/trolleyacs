<?php
/**
 * ============================================================================
 * TROLLEY MAINTENANCE API - HEALTH CHECK
 * ============================================================================
 */

require_once __DIR__ . '/config/database.php';

handleCORS();

try {
    $pdo = db();
    
    // Test database connection
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch();
    
    if ($result && $result['test'] == 1) {
        jsonResponse(true, [
            'status' => 'healthy',
            'database' => 'connected',
            'timestamp' => date('c')
        ]);
    }
} catch (Exception $e) {
    jsonResponse(false, [
        'status' => 'unhealthy',
        'database' => 'disconnected',
        'error' => $e->getMessage()
    ], 'Database connection failed', 500);
}
