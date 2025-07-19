<?php
session_start(); // Mulai sesi untuk menyimpan status login
header('Content-Type: application/json'); // Beri tahu browser bahwa respons adalah JSON

include 'db_connect.php'; // Sertakan file koneksi database

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'login':
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? '';
            $password = $input['password'] ?? '';

            if (empty($username) || empty($password)) {
                echo json_encode(['success' => false, 'message' => 'Username dan password harus diisi.']);
                exit();
            }

            $stmt = $pdo->prepare("SELECT id, username, password, role FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            // Verifikasi password yang di-hash
            // Untuk data awal di database yang di-hash pakai SHA256, kita pakai SHA256 juga di sini.
            // Untuk akun yang terdaftar dari frontend, akan pakai password_verify().
            $is_password_valid = false;
            if ($user && hash('sha256', $password) === $user['password']) {
                 $is_password_valid = true; // Untuk password awal SHA256
            }
            // Jika Anda ingin semua password di-hash dengan password_hash() dari awal,
            // Anda bisa mengganti ini dengan: if ($user && password_verify($password, $user['password'])) { ... }
            // Dan ubah insert data awal di database menjadi menggunakan password_hash() juga.

            if ($user && $is_password_valid) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['role'] = $user['role'];

                echo json_encode([
                    'success' => true,
                    'message' => 'Login berhasil!',
                    'role' => $user['role'],
                    'username' => $user['username']
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Username atau password salah.']);
            }
        } else {
            http_response_code(405); // Method Not Allowed
            echo json_encode(['success' => false, 'message' => 'Metode POST dibutuhkan untuk login.']);
        }
        break;

    case 'logout':
        if ($method === 'POST') {
            session_unset(); // Hapus semua variabel sesi
            session_destroy(); // Hancurkan sesi
            echo json_encode(['success' => true, 'message' => 'Logout berhasil.']);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode POST dibutuhkan untuk logout.']);
        }
        break;

    case 'check_session': // Untuk memeriksa status login dan peran saat halaman dimuat
        if ($method === 'GET') {
            if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
                echo json_encode([
                    'success' => true,
                    'logged_in' => true,
                    'user_id' => $_SESSION['user_id'],
                    'username' => $_SESSION['username'],
                    'role' => $_SESSION['role']
                ]);
            } else {
                echo json_encode(['success' => true, 'logged_in' => false]);
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode GET dibutuhkan untuk memeriksa sesi.']);
        }
        break;

    default:
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid.']);
        break;
}
?>