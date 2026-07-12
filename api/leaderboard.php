<?php
// Leaderboard API for shared Hostinger (no Node.js on shared plans).
// Lives at /api/leaderboard.php next to the static export, so the browser
// talks same-origin — no CORS, no separate backend.
//
//   GET  → JSON top scores, same shape as server/leaderboard.js topScores():
//          [{ name, best, total, games }, …]
//   POST → JSON body { name, score } saves one run (mirrors server/socket.js
//          validation), then returns the updated top scores.
//
// The scores table is created on first request (idempotent), so the only
// manual step on Hostinger is creating the MySQL database and filling
// config.php (copy config.sample.php).
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GAME = 'kingdom-archers'; // DEFAULT_GAME in lib/events.js
const MAX_NAME = 20;            // MAX_NAME in lib/events.js
const TOP_LIMIT = 10;

if (!is_file(__DIR__ . '/config.php')) {
  http_response_code(500);
  echo json_encode(['error' => 'api/config.php missing — copy config.sample.php and fill in the MySQL credentials']);
  exit;
}
$config = require __DIR__ . '/config.php';

try {
  $pdo = new PDO($config['dsn'], $config['user'] ?? null, $config['password'] ?? null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => 'database connection failed']);
  exit;
}

// Mirrors db/schema.sql. SQLite is only used by the local test harness
// (deploy/hostinger/test.sh); Hostinger runs MySQL.
$sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
$pdo->exec(
  $sqlite
    ? "CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        game TEXT NOT NULL DEFAULT 'tap-battle',
        score INTEGER NOT NULL DEFAULT 0,
        room TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    : "CREATE TABLE IF NOT EXISTS scores (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        player_name VARCHAR(191) NOT NULL,
        game VARCHAR(64) NOT NULL DEFAULT 'tap-battle',
        score INT NOT NULL DEFAULT 0,
        room VARCHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_scores_game_score (game, score),
        KEY idx_scores_player (player_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode((string) file_get_contents('php://input'), true);
  $payload = is_array($payload) ? $payload : [];
  $name = mb_substr(trim((string) ($payload['name'] ?? '')), 0, MAX_NAME);
  if ($name === '') $name = 'Anon';
  $score = max(0, (int) ($payload['score'] ?? 0));
  if ($score > 0) { // ignore empty runs, like server/socket.js
    $stmt = $pdo->prepare(
      'INSERT INTO scores (player_name, game, score, room) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$name, GAME, $score, 'solo']);
  }
}

$stmt = $pdo->prepare(
  'SELECT player_name AS name,
          MAX(score)  AS best,
          SUM(score)  AS total,
          COUNT(*)    AS games
     FROM scores
    WHERE game = ?
 GROUP BY player_name
 ORDER BY best DESC, total DESC
    LIMIT ' . TOP_LIMIT
);
$stmt->execute([GAME]);

$rows = array_map(
  static fn(array $r): array => [
    'name' => $r['name'],
    'best' => (int) $r['best'],
    'total' => (int) $r['total'],
    'games' => (int) $r['games'],
  ],
  $stmt->fetchAll()
);

// Seed roster so the board reads "alive" before real runs accumulate.
// Real scores win by name and outrank seeds purely on `best`, so genuine
// players naturally climb over (and eventually bury) the seed.
$seed = [
  ['ArrowKingpin', 48920], ['Sir_Lancelot', 46180], ['xX_Voidhunter_Xx', 44050],
  ['QueenBallista', 41730], ['DrumBoy', 39990], ['FrostWarden', 38210],
  ['PixelPaladin', 36540], ['GaleStriker', 34870], ['IronQuiver', 33120],
  ['CrownSlayer', 31450], ['ShadowFletch', 29880], ['EmberKnight', 28230],
  ['StormRanger', 26670], ['ThornGuard', 25010], ['ByteArcher', 23480],
];
$byName = [];
foreach ($seed as $s) {
  $best = $s[1];
  $byName[$s[0]] = ['name' => $s[0], 'best' => $best, 'total' => (int) round($best * 1.6), 'games' => 3 + (crc32($s[0]) % 14)];
}
foreach ($rows as $r) { $byName[$r['name']] = $r; } // real runs override seed
$merged = array_values($byName);
usort($merged, static fn($a, $b) => $b['best'] <=> $a['best'] ?: $b['total'] <=> $a['total']);

echo json_encode(array_slice($merged, 0, TOP_LIMIT));
