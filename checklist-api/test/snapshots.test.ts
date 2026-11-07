import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadSnapshot } from "../src/snapshots.js";
test("snapshot loader refuses path traversal and corrupt content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "townpass-snapshot-"));
  const url = pathToFileURL(dir + "/");
  try {
    await writeFile(new URL("LATEST", url), "../secret");
    await assert.rejects(loadSnapshot(url), /版本無效/);
    await writeFile(new URL("LATEST", url), "123");
    await writeFile(new URL("123.json", url), "{}");
    await writeFile(new URL("123.sha256", url), "bad");
    await assert.rejects(loadSnapshot(url), /SHA256/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
