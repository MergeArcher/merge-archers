<?php
// Copy this file to config.php (same folder) and fill in the MySQL database
// you created in hPanel → Databases → MySQL Databases. Hostinger prefixes
// names with your account id, e.g. u123456789_playmcd.
//
// config.php is never overwritten by re-uploads (it's not in the zip), so you
// only do this once.
return [
  'dsn' => 'mysql:host=localhost;dbname=uXXXXXXXXX_playmcd;charset=utf8mb4',
  'user' => 'uXXXXXXXXX_playmcd',
  'password' => 'YOUR_DB_PASSWORD',
];
