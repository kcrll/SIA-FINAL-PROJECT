<?php
require __DIR__ . '/../config.php';
require_admin();

$filename = 'aniyatrack_backup_' . date('Y-m-d_H-i-s') . '.sql';

$sql  = "-- Ani database backup\n-- Generated: " . date('Y-m-d H:i:s') . "\n-- Database: {$db}\n\n";
$sql .= "SET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\nSTART TRANSACTION;\n\n";

// Every table in the database, so nothing is left out of a restore.
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch();
    $sql .= "DROP TABLE IF EXISTS `$table`;\n" . $create['Create Table'] . ";\n\n";

    foreach ($pdo->query("SELECT * FROM `$table`") as $row) {
        $values = array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote((string)$v), array_values($row));
        $sql .= "INSERT INTO `$table` (`" . implode('`, `', array_keys($row)) . '`) VALUES (' . implode(', ', $values) . ");\n";
    }
    $sql .= "\n";
}

$sql .= "COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n";

log_activity($pdo, 'Database Backup', "Generated $filename");

header('Content-Type: application/sql; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($sql));
echo $sql;
