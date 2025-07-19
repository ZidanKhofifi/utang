<?php
session_start();
header('Content-Type: application/json');

include 'db_connect.php';

// Pastikan user sudah login dan memiliki peran admin
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403); // Forbidden
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya admin yang dapat mengakses ini.']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'read': // Mendapatkan daftar semua user
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT id, username, role, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC");
            $stmt->execute();
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'users' => $users]);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode GET dibutuhkan untuk membaca data user.']);
        }
        break;
        
           // --- FITUR BARU: Membaca daftar user dengan total utang mereka ---
    case 'read_with_debt_summary':
        if ($method === 'GET') {
            $sql = "SELECT
                        u.id,
                        u.username,
                        u.role,
                        u.created_at,
                        COALESCE(SUM(CASE WHEN d.is_paid = FALSE THEN d.amount ELSE 0 END), 0) AS total_unpaid_debt,
                        COALESCE(SUM(d.amount), 0) AS total_all_debt
                    FROM
                        users u
                    LEFT JOIN
                        debts d ON u.id = d.user_id
                    WHERE
                        u.role = 'user'
                    GROUP BY
                        u.id, u.username, u.role, u.created_at
                    ORDER BY
                        u.created_at DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'users' => $users]);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode GET dibutuhkan untuk membaca data user dengan summary utang.']);
        }
        break;
    // --- AKHIR FITUR BARU ---

    case 'create': // Menambahkan user baru
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? '';
            $password = $input['password'] ?? ''; // Plain text password
            $role = $input['role'] ?? 'user'; // Admin bisa nambah user, default role user

            if (empty($username) || empty($password)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username dan password harus diisi.']);
                exit();
            }

            if (!in_array($role, ['user', 'admin'])) { // Admin bisa juga buat admin lain
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Role tidak valid.']);
                exit();
            }

            // Hash password sebelum disimpan
            $hashed_password = password_hash($password, PASSWORD_BCRYPT);

            try {
                $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
                $stmt->execute([$username, $hashed_password, $role]);
                echo json_encode(['success' => true, 'message' => 'User berhasil ditambahkan.', 'id' => $pdo->lastInsertId()]);
            } catch (PDOException $e) {
                if ($e->getCode() == '23000') { // Kode error untuk duplicate entry (UNIQUE constraint)
                    http_response_code(409); // Conflict
                    echo json_encode(['success' => false, 'message' => 'Username sudah ada. Silakan gunakan username lain.']);
                } else {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Gagal menambahkan user: ' . $e->getMessage()]);
                }
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode POST dibutuhkan untuk membuat user.']);
        }
        break;

    case 'delete': // Menghapus user
        if ($method === 'DELETE') {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? 0;

            if (!is_numeric($id) || $id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID user tidak valid.']);
                exit();
            }

            // Mencegah admin menghapus dirinya sendiri
            if ($id == $_SESSION['user_id']) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Tidak bisa menghapus akun sendiri.']);
                exit();
            }

            // Pastikan tidak menghapus akun admin lain (opsional, tergantung kebijakan)
            $stmt_check_role = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt_check_role->execute([$id]);
            $target_user_role = $stmt_check_role->fetchColumn();
            if ($target_user_role === 'admin') {
                 http_response_code(403);
                 echo json_encode(['success' => false, 'message' => 'Tidak bisa menghapus akun admin lain.']);
                 exit();
            }


            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ? AND role = 'user'"); // Hanya izinkan hapus user
            $stmt->execute([$id]);

            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'User berhasil dihapus.']);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User tidak ditemukan atau tidak bisa dihapus.']);
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode DELETE dibutuhkan untuk menghapus user.']);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid.']);
        break;
}
?>
