import { mkdirSync } from "fs";
import { join } from "path";
import Database from "bun:sqlite";

const dbDir = join(process.cwd(), "..", "databases");
mkdirSync(dbDir, { recursive: true }); // creates the folder if it doesn’t exist

const dbPath = join(dbDir, "binaries.db");
const db = new Database(dbPath);


db.run(`
  CREATE TABLE IF NOT EXISTS binaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    binary_id TEXT NOT NULL,
    version TEXT NOT NULL,
    path TEXT NOT NULL,
    date_pushed DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(binary_id, version)
  )
`);

export function archiveBinary(binaryId: string, version: string, path: string) {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO binaries (binary_id, version, path) VALUES (?, ?, ?)"
  );
  stmt.run(binaryId, version, path);
}

export function getLatest(binaryId: string) {
  const stmt = db.prepare(
    "SELECT * FROM binaries WHERE binary_id = ? ORDER BY date_pushed DESC LIMIT 1"
  );
  return stmt.all(binaryId);
}

export function getAllVersions(binaryId: string) {
  const stmt = db.prepare(
    "SELECT * FROM binaries WHERE binary_id = ? ORDER BY date_pushed DESC"
  );
  return stmt.all(binaryId);
}

export function deleteOlderThan(dateISO: string) {
  const stmt = db.prepare(
    "DELETE FROM binaries WHERE date_pushed < ?"
  );
  stmt.run(dateISO);
}
