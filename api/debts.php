<?php
session_start();
header('Content-Type: application/json');

include 'db_connect.php';

// Pastikan user sudah login
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'Tidak terautentikasi. Silakan login.']);
    exit();
}

$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['role'];

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'read':
        if ($method === 'GET') {
            $status_filter = $_GET['status'] ?? 'all';
            $sql = "SELECT d.id, d.debtor_name, d.amount, d.debt_date, d.is_paid, u.username AS owner_username
                    FROM debts d
                    JOIN users u ON d.user_id = u.id";
            $params = [];
            $where_clauses = [];

            // Filter berdasarkan peran (role)
            if ($user_role === 'user') {
                $where_clauses[] = "d.user_id = ?";
                $params[] = $user_id;
            }

            // Filter berdasarkan status
            if ($status_filter === 'paid') {
                $where_clauses[] = "d.is_paid = TRUE";
            } elseif ($status_filter === 'unpaid') {
                $where_clauses[] = "d.is_paid = FALSE";
            }

            if (count($where_clauses) > 0) {
                $sql .= " WHERE " . implode(" AND ", $where_clauses);
            }

            $sql .= " ORDER BY d.debt_date DESC, d.id DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $debts = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'debts' => $debts]);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode GET dibutuhkan untuk membaca data utang.']);
        }
        break;

    case 'create':
        if ($method === 'POST') {
            // Hanya admin yang bisa membuat utang baru
            if ($user_role !== 'admin') {
                http_response_code(403); // Forbidden
                echo json_encode(['success' => false, 'message' => 'Tidak ada izin untuk membuat utang.']);
                exit();
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $debtor_name = $input['debtor_name'] ?? '';
            $amount = $input['amount'] ?? 0;
            $debt_date = $input['debt_date'] ?? '';
            $target_user_id = $input['user_id'] ?? $user_id; // Admin bisa assign ke user lain, default ke diri sendiri

            if (empty($debtor_name) || !is_numeric($amount) || $amount <= 0 || empty($debt_date) || !is_numeric($target_user_id)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Nama peminjam, jumlah, tanggal, dan ID pemilik harus diisi dengan benar.']);
                exit();
            }

            // Cek apakah target_user_id valid (ada di tabel users)
            $stmt_check_user = $pdo->prepare("SELECT id FROM users WHERE id = ?");
            $stmt_check_user->execute([$target_user_id]);
            if (!$stmt_check_user->fetch()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID pengguna pemilik tidak valid.']);
                exit();
            }


            $stmt = $pdo->prepare("INSERT INTO debts (user_id, debtor_name, amount, debt_date, is_paid) VALUES (?, ?, ?, ?, FALSE)");
            $stmt->execute([$target_user_id, $debtor_name, $amount, $debt_date]);

            echo json_encode(['success' => true, 'message' => 'Utang berhasil ditambahkan.', 'id' => $pdo->lastInsertId()]);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode POST dibutuhkan untuk membuat utang.']);
        }
        break;

    case 'update_status':
        if ($method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? 0;
            $is_paid = $input['is_paid'] ?? 0; // 0 atau 1

            if (!is_numeric($id) || $id <= 0 || !in_array($is_paid, [0, 1])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID utang atau status tidak valid.']);
                exit();
            }

            // Admin bisa mengubah status utang siapa saja, user hanya utangnya sendiri
            $sql = "UPDATE debts SET is_paid = ? WHERE id = ?";
            $params = [$is_paid, $id];

            if ($user_role === 'user') {
                $sql .= " AND user_id = ?";
                $params[] = $user_id;
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Status utang berhasil diperbarui.']);
            } else {
                http_response_code(404); // Not Found (jika ID tidak ada atau user tidak punya izin)
                echo json_encode(['success' => false, 'message' => 'Utang tidak ditemukan atau tidak ada izin untuk memperbarui.']);
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode PUT dibutuhkan untuk memperbarui status utang.']);
        }
        break;

    case 'delete':
        if ($method === 'DELETE') {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? 0;

            if (!is_numeric($id) || $id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID utang tidak valid.']);
                exit();
            }

            // Admin bisa menghapus utang siapa saja, user hanya utangnya sendiri
            $sql = "DELETE FROM debts WHERE id = ?";
            $params = [$id];

            if ($user_role === 'user') {
                $sql .= " AND user_id = ?";
                $params[] = $user_id;
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Utang berhasil dihapus.']);
            } else {
                http_response_code(404); // Not Found (jika ID tidak ada atau user tidak punya izin)
                echo json_encode(['success' => false, 'message' => 'Utang tidak ditemukan atau tidak ada izin untuk menghapus.']);
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode DELETE dibutuhkan untuk menghapus utang.']);
        }
        break;

    case 'total_debt': // Fitur tambahan untuk user melihat total utang
        if ($method === 'GET') {
            // Hanya user biasa yang perlu melihat total utang mereka sendiri
            if ($user_role !== 'user') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Akses ditolak. Fitur ini hanya untuk pengguna.']);
                exit();
            }
            
            $sql = "SELECT SUM(amount) AS total_unpaid_debt FROM debts WHERE user_id = ? AND is_paid = FALSE";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$user_id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'total_unpaid_debt' => (float)($result['total_unpaid_debt'] ?? 0)]);
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Metode GET dibutuhkan untuk melihat total utang.']);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid.']);
        break;
}
?>
