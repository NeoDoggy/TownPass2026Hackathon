import { readFile } from "node:fs/promises";
import { connectDb } from "../src/db.js";
export async function migrate() {
  const db = connectDb();
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(742601)");
    await db.query(
      "CREATE SCHEMA IF NOT EXISTS checklist; CREATE TABLE IF NOT EXISTS checklist.migration (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    const name = "001_initial.sql";
    if (
      !(
        await db.query("SELECT 1 FROM checklist.migration WHERE name=$1", [
          name,
        ])
      ).rowCount
    ) {
      await db.query(
        await readFile(new URL(`../db/${name}`, import.meta.url), "utf8"),
      );
      await db.query("INSERT INTO checklist.migration(name) VALUES($1)", [
        name,
      ]);
    }
    await db.query("COMMIT");
    console.log("Migration 完成（可重複執行）");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
await migrate();
