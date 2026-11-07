import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  validateService,
  type ServiceSnapshot,
  type Snapshot,
} from "@townpass/checklist-shared";
import { connectDb } from "../src/db.js";
const db = connectDb();
await db.connect();
async function publish() {
  await db.query("SELECT pg_advisory_lock(742603)");
  const services: ServiceSnapshot[] = (
    await db.query(
      "SELECT r.payload, s.retired_at FROM checklist.service s JOIN checklist.service_revision r ON r.id=s.published_revision_id WHERE r.status='PUBLISHED' ORDER BY s.slug",
    )
  ).rows.map((r) => ({
    ...r.payload,
    ...(r.retired_at ? { retired: true } : {}),
  }));
  if (!services.length) throw new Error("沒有已發布業務");
  services.forEach(validateService);
  for (const s of services)
    for (const source of s.sources) {
      if (Date.now() - Date.parse(source.verifiedAt) > 180 * 86400000)
        throw new Error(
          `${s.slug}: 來源已超過 180 天未查證，請重新匯入核對後再發布`,
        );
    }
  const root = new URL("../data/snapshots/", import.meta.url);
  await mkdir(root, { recursive: true });
  const digest = (s: string) => createHash("sha256").update(s).digest("hex");
  let latest = "0";
  try {
    latest = (await readFile(new URL("LATEST", root), "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (latest !== "0") {
    const previous: Snapshot = JSON.parse(
      await readFile(new URL(`${latest}.json`, root), "utf8"),
    );
    if (JSON.stringify(previous.services) === JSON.stringify(services)) {
      console.log(`快照 ${latest} 內容相同，未建立新版本`);
      return;
    }
    latest = String(Math.max(Date.now(), Number(latest) + 1));
  } else latest = String(Date.now());
  const snapshot: Snapshot = {
    schemaVersion: 1,
    version: latest,
    createdAt: new Date().toISOString(),
    services,
  };
  const content = JSON.stringify(snapshot, null, 2) + "\n";
  const sha256 = digest(content);
  await writeFile(new URL(`${latest}.json`, root), content, { flag: "wx" });
  await writeFile(new URL(`${latest}.sha256`, root), sha256 + "\n", {
    flag: "wx",
  });
  await db.query(
    "INSERT INTO checklist.snapshot(version,sha256,service_count) VALUES($1,$2,$3)",
    [latest, sha256, services.length],
  );
  await writeFile(new URL("LATEST.tmp", root), latest + "\n");
  await rename(new URL("LATEST.tmp", root), new URL("LATEST", root));
  console.log(
    `快照 ${latest} 已原子發布，${services.length} 個業務，SHA256 ${sha256}`,
  );
}
try {
  await publish();
} finally {
  await db.end();
}
