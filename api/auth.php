<?php
/**
 * ============================================================================
 * TROLLEY MAINTENANCE - AUTHENTICATION API
 * ============================================================================
 * 
 * Endpoints:
 * - POST ?action=login     : Login user
 * - POST ?action=logout    : Logout user
 * - GET  ?action=me        : Get current user info
 * - GET  ?action=check     : Check if user is authenticated
 */

// Get the origin from the request
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';

// CORS headers MUST be set FIRST, before anything else
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/database.php';

// Configure session for cross-origin requests
ini_set('session.cookie_samesite', 'None');
ini_set('session.cookie_secure', 'false'); // Set to true in production with HTTPS
ini_set('session.cookie_httponly', 'true');

// Start session for authentication
session_start();

// Set session cookie with SameSite=None for cross-origin
if (session_status() === PHP_SESSION_ACTIVE) {
    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => time() + 86400,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => false, // Set to true in production with HTTPS
        'httponly' => true,
        'samesite' => 'None'
    ]);
}

// Get action from query parameter
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'login':
            handleLogin();
            break;
        case 'logout':
            handleLogout();
            break;
        case 'me':
            handleGetCurrentUser();
            break;
        case 'check':
            handleCheckAuth();
            break;
        default:
            sendJsonResponse(false, null, 'Invalid action', 400);
    }
} catch (Exception $e) {
    error_log("Auth Error: " . $e->getMessage());
    sendJsonResponse(false, null, $e->getMessage(), 500);
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

/**
 * Handle user login
 */
function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJsonResponse(false, null, 'Method not allowed', 405);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = $body['username'] ?? '';
    $password = $body['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendJsonResponse(false, null, 'Username dan password harus diisi', 400);
    }

    $pdo = db();
    
    // Check if users table exists
    try {
        $stmt = $pdo->query("SELECT 1 FROM users LIMIT 1");
    } catch (PDOException $e) {
        // Users table doesn't exist, create it with default admin
        createUsersTable($pdo);
    }

    // Find user
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = TRUE");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        sendJsonResponse(false, null, 'Username tidak ditemukan', 401);
    }

    // Verify password
    if (!password_verify($password, $user['password'])) {
        sendJsonResponse(false, null, 'Password salah', 401);
    }

    // Set session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['name'] = $user['name'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['logged_in'] = true;

    // Return user data (without password)
    sendJsonResponse(true, [
        'id' => $user['id'],
        'username' => $user['username'],
        'name' => $user['name'],
        'role' => $user['role'],
        'message' => 'Login berhasil'
    ]);
}

/**
 * Handle user logout
 */
function handleLogout() {
    // Clear session
    $_SESSION = [];
    
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    
    session_destroy();
    
    sendJsonResponse(true, ['message' => 'Logout berhasil']);
}

/**
 * Get current logged in user
 */
function handleGetCurrentUser() {
    if (!isAuthenticated()) {
        sendJsonResponse(false, null, 'Tidak terautentikasi', 401);
    }

    sendJsonResponse(true, [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'name' => $_SESSION['name'],
        'role' => $_SESSION['role']
    ]);
}

/**
 * Check if user is authenticated
 */
function handleCheckAuth() {
    if (isAuthenticated()) {
        sendJsonResponse(true, [
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'name' => $_SESSION['name'],
                'role' => $_SESSION['role']
            ]
        ]);
    } else {
        sendJsonResponse(true, ['authenticated' => false]);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send JSON response
 */
function sendJsonResponse($success, $data = null, $error = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

/**
 * Create users table with default admin if it doesn't exist
 */
function createUsersTable($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) NOT NULL UNIQUE,
        `password` VARCHAR(255) NOT NULL,
        `name` VARCHAR(100) NOT NULL,
        `role` ENUM('admin', 'operator') NOT NULL DEFAULT 'operator',
        `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_username` (`username`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    
    // Check if admin user exists
    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE username = 'admin'");
    $count = $stmt->fetchColumn();
    
    if ($count == 0) {
        // Create default admin user with password 'admin123'
        $hashedPassword = password_hash('admin123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)");
        $stmt->execute(['admin', $hashedPassword, 'Administrator', 'admin']);
    }
    
    // Check if operator user exists
    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE username = 'operator'");
    $count = $stmt->fetchColumn();
    
    if ($count == 0) {
        // Create default operator user with password 'operator123'
        $hashedPassword = password_hash('operator123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)");
        $stmt->execute(['operator', $hashedPassword, 'Operator Staff', 'operator']);
    }
}
