import { mkdirSync } from "fs";
import { join } from "path";
import Database from "bun:sqlite";

const dbDir = join(process.cwd(), "..", "databases");
mkdirSync(dbDir, { recursive: true }); // creates the folder if it doesn’t exist

const dbPath = join(dbDir, "users.db");
const db = new Database(dbPath);

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT
)
`).run();

export interface User {
id: number;
username: string;
password: string;
}

export default db;
