<?php

declare(strict_types=1);

ini_set('session.gc_maxlifetime', (string)(86400 * 30));
session_set_cookie_params(86400 * 30);
session_start();

const DB_HOST = 'localhost';
const DB_USER = 'u527763935_prostomiz';
const DB_PASS = 'Yamaha1337@';
const DB_NAME = 'u527763935_BlackLeet';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die('DB ERROR');
}
$conn->set_charset('utf8mb4');
