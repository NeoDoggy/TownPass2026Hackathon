import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import {
  validateService,
  type ServiceSnapshot,
} from "@townpass/checklist-shared";
import { connectDb } from "../src/db.js";
const services: ServiceSnapshot[] = JSON.parse(
  await readFile(new URL("../data/imported.json", import.meta.url), "utf8"),
);
services.forEach(validateService);
const db = connectDb();
await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(742602)");
  await db.query("SET LOCAL search_path TO checklist, public");
  const agencies = [
    { id: "household", name: "臺北市各區戶政事務所", url: "https://ca.gov.taipei", category: "戶政" },
    { id: "postal", name: "中華郵政股份有限公司", url: "https://www.post.gov.tw", category: "郵局儲匯" },
    { id: "motor", name: "交通部公路局各區監理所（站）", url: "https://www.thb.gov.tw", category: "監理" },
  ];
  for (const agency of agencies) {
    await db.query("INSERT INTO agency(id,name,website_url) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, website_url=EXCLUDED.website_url", [agency.id, agency.name, agency.url]);
    await db.query("INSERT INTO category(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name", [agency.id, agency.category]);
  }
  for (const s of services) {
    const agency = agencies.find((a) => a.name === s.agency && a.category === s.category);
    if (!agency) throw new Error(`${s.slug}: 未設定機關與分類對應`);
    const hash = createHash("sha256").update(JSON.stringify(s)).digest("hex");
    await db.query(
      "INSERT INTO service(slug,agency_id,category_id) VALUES($1,$2,$2) ON CONFLICT(slug) DO UPDATE SET agency_id=EXCLUDED.agency_id, category_id=EXCLUDED.category_id",
      [s.slug, agency.id],
    );
    const found = await db.query(
      "SELECT id FROM service_revision WHERE service_slug=$1 AND content_hash=$2",
      [s.slug, hash],
    );
    if (found.rowCount) {
      console.log(`${s.slug}: 相同內容，保留目前發布版本`);
      continue;
    }
    const revisionNo = Number(
      (
        await db.query(
          "SELECT COALESCE(MAX(rev_no),0)+1 AS n FROM service_revision WHERE service_slug=$1",
          [s.slug],
        )
      ).rows[0].n,
    );
    const id = randomUUID();
    const payload = { ...s, revisionNo, revisionId: id };
    await db.query(
      "INSERT INTO service_revision(id,service_slug,rev_no,status,content_hash,title,summary,processing_time,handling_unit,payload) VALUES($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9)",
      [
        id,
        s.slug,
        revisionNo,
        hash,
        s.title,
        s.summary,
        s.processingTime,
        s.handlingUnit,
        payload,
      ],
    );
    for (const m of s.modes)
      await db.query("INSERT INTO mode VALUES($1,$2,$3,$4,$5,$6)", [
        id,
        m.code,
        m.label,
        m.allowed,
        m.allowedWhen ?? null,
        m.disallowedReason ?? null,
      ]);
    for (const [index, p] of s.parties.entries())
      await db.query("INSERT INTO party VALUES($1,$2,$3,$4)", [
        id,
        p.code,
        p.label,
        index,
      ]);
    for (const q of s.questions)
      await db.query("INSERT INTO question VALUES($1,$2,$3)", [id, q.code, q]);
    for (const g of s.groups)
      await db.query("INSERT INTO requirement_group VALUES($1,$2,$3,$4,$5)", [
        id,
        g.id,
        g.rule,
        g.label,
        g.minCount ?? null,
      ]);
    for (const ref of s.sources)
      await db.query("INSERT INTO source_ref VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [
        id,
        ref.id,
        ref.url,
        ref.title,
        ref.clause,
        ref.verifiedAt,
        ref.updatedAt,
        ref.sha256,
      ]);
    for (const item of s.items) {
      if (item.documentCode)
        await db.query(
          "INSERT INTO document VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name",
          [item.documentCode, item.title],
        );
      await db.query(
        "INSERT INTO requirement_item VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          item.key,
          item.documentCode ?? null,
          item.party,
          item.kind,
          item.modes,
          item.form,
          item.quantity,
          item.condition ?? null,
          item.groupId ?? null,
          item,
        ],
      );
      for (const source of item.sourceIds)
        await db.query("INSERT INTO item_source VALUES($1,$2,$3)", [
          id,
          item.key,
          source,
        ]);
    }
    for (const keyword of s.keywords)
      await db.query(
        "INSERT INTO keyword VALUES($1,$2) ON CONFLICT DO NOTHING",
        [s.slug, keyword],
      );
    await db.query(
      "UPDATE service_revision SET status='PUBLISHED' WHERE id=$1",
      [id],
    );
    await db.query(
      "UPDATE service SET published_revision_id=$1 WHERE slug=$2",
      [id, s.slug],
    );
    console.log(`${s.slug}: 發布 revision ${revisionNo}`);
  }
  await db.query("COMMIT");
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
