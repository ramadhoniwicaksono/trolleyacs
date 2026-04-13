<?php
/**
 * ============================================================================
 * TROLLEY MAINTENANCE - MYSQL DATABASE CONNECTION
 * ============================================================================
 * 
 * Konfigurasi koneksi ke database MySQL (localhost/phpMyAdmin)
 * 
 * Cara menggunakan:
 * 1. Pastikan XAMPP/WAMP sudah berjalan
 * 2. Import file trolley_data.sql ke phpMyAdmin
 * 3. Sesuaikan konfigurasi di bawah sesuai environment
 * 4. Copy folder 'api' ke htdocs (XAMPP) atau www (WAMP)
 */

// ============================================================================
// KONFIGURASI DATABASE
// ============================================================================

define('DB_HOST', 'localhost');       // Host database (biasanya localhost)
define('DB_NAME', 'trolley_data'); // Nama database
define('DB_USER', 'root');            // Username (default XAMPP: root)
define('DB_PASS', '');                // Password (default XAMPP: kosong)
define('DB_PORT', 3306);              // Port MySQL (default: 3306)
define('DB_CHARSET', 'utf8mb4');      // Character set

// ============================================================================
// CLASS DATABASE CONNECTION
// ============================================================================

class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
            
        } catch (PDOException $e) {
            error_log("Database Connection Error: " . $e->getMessage());
            throw new Exception("Koneksi database gagal. Pastikan MySQL sudah berjalan.");
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    // Prevent cloning
    private function __clone() {}
    
    // Prevent unserialization
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get database connection instance
 */
function db() {
    return Database::getInstance()->getConnection();
}

/**
 * Send JSON response
 */
function jsonResponse($success, $data = null, $error = null, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Handle CORS preflight
 */
function handleCORS() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        http_response_code(204);
        exit;
    }
}

/**
 * Get request body as array
 */
function getRequestBody() {
    $json = file_get_contents('php://input');
    return json_decode($json, true) ?? [];
}

/**
 * Generate unique ID (similar to JavaScript version)
 */
function generateId() {
    return time() . '-' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 7);
}
