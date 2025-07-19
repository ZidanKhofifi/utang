<?php
// Konfigurasi Database - Membaca dari Environment Variables Railway
$host = getenv('MYSQL_HOST');
$db_name = getenv('MYSQL_DATABASE');
$username = getenv('MYSQL_USER');
$password = getenv('MYSQL_PASSWORD');
$port = getenv('MYSQL_PORT'); // Railway menyediakan port terpisah

try {
    // Gabungkan host dan port dalam DSN
    $dsn = "mysql:host=$host;dbname=$db_name;charset=utf8";
    if ($port) {
        $dsn .= ";port=$port";
    }
    $pdo = new PDO($dsn, $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Koneksi database gagal: ' . $e->getMessage()]);
    exit();
}