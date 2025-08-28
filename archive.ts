// src/archive.ts
import Database from "bun:sqlite";
import { join } from "path";

// Initialize SQLite database
const dbPath = join(process.cwd(), "binaries.db");
const db = new Database(dbPath);

// Create table if it doesn't exist
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

/**
 * Archive a binary file in the database.
 * @param binaryId Unique identifier for the binary (e.g., digest)
 * @param version Version string
 * @param path Local path to the binary on disk
 */
export function archiveBinary(binaryId: string, version: string, path: string) {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO binaries (binary_id, version, path) VALUES (?, ?, ?)"
  );
  stmt.run(binaryId, version, path);
}

/**
 * Get the latest version of a binary.
 * @param binaryId Unique identifier for the binary
 * @returns Array of matching rows (should be 0 or 1)
 */
export function getLatest(binaryId: string) {
  const stmt = db.prepare(
    "SELECT * FROM binaries WHERE binary_id = ? ORDER BY date_pushed DESC LIMIT 1"
  );
  return stmt.all(binaryId);
}

/**
 * Get all archived versions of a binary.
 * @param binaryId Unique identifier for the binary
 * @returns Array of rows ordered by newest first
 */
export function getAllVersions(binaryId: string) {
  const stmt = db.prepare(
    "SELECT * FROM binaries WHERE binary_id = ? ORDER BY date_pushed DESC"
  );
  return stmt.all(binaryId);
}

/**
 * Optional: Remove old versions older than a certain date
 */
export function deleteOlderThan(dateISO: string) {
  const stmt = db.prepare(
    "DELETE FROM binaries WHERE date_pushed < ?"
  );
  stmt.run(dateISO);
}
