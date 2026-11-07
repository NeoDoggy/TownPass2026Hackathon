import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateService, type Snapshot } from "@townpass/checklist-shared";
// shortcut: Local immutable files replace object storage; use shared object storage for multiple publisher hosts.
export const snapshotDirectory = new URL("../data/snapshots/", import.meta.url);
export async function loadSnapshot(
  directory: URL = snapshotDirectory,
): Promise<Snapshot> {
  const version = (await readFile(new URL("LATEST", directory), "utf8")).trim();
  if (!/^\d{1,16}$/.test(version)) throw new Error("快照版本無效");
  const bytes = await readFile(new URL(`${version}.json`, directory));
  const hash = (
    await readFile(new URL(`${version}.sha256`, directory), "utf8")
  ).trim();
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw new Error("快照 SHA256 不符");
  const snapshot: Snapshot = JSON.parse(bytes.toString());
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.version !== version ||
    !snapshot.services.length
  )
    throw new Error("快照格式不符");
  snapshot.services.forEach(validateService);
  return snapshot;
}
