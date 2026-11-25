<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain');

$logfile = __DIR__ . '/perf.log';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = file_get_contents('php://input');
    $entry = date('Y-m-d H:i:s.v') . ' | ' . $data . "\n";
    file_put_contents($logfile, $entry, FILE_APPEND);
    echo 'OK';
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['clear'])) {
        file_put_contents($logfile, '');
        echo 'Log cleared';
    } else {
        if (file_exists($logfile)) {
            echo file_get_contents($logfile);
        } else {
            echo 'No log file';
        }
    }
}
?>