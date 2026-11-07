import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import imported from "../data/imported.json";
test(
  "PostgreSQL: published revisions and their child content are immutable",
  { skip: !process.env.CHECKLIST_TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({
      connectionString: process.env.CHECKLIST_TEST_DATABASE_URL,
    });
    await db.connect();
    try {
      assert.match(
        (await db.query("SELECT version() AS v")).rows[0].v,
        /PostgreSQL/,
      );
      const revisions = (
        await db.query(
          "SELECT r.id FROM checklist.service s JOIN checklist.service_revision r ON r.id=s.published_revision_id WHERE r.status='PUBLISHED'",
        )
      ).rows;
      assert.equal(
        revisions.length,
        imported.length,
        "Run migration + seed against an isolated test database first",
      );
      const linked = (await db.query("SELECT s.slug, a.name AS agency, c.name AS category FROM checklist.service s JOIN checklist.agency a ON a.id=s.agency_id JOIN checklist.category c ON c.id=s.category_id ORDER BY s.slug")).rows;
      assert.deepEqual(linked, imported.map((s) => ({ slug: s.slug, agency: s.agency, category: s.category })).sort((a, b) => a.slug.localeCompare(b.slug)));
      const revisionCount = Number((await db.query("SELECT COUNT(*) AS n FROM checklist.service_revision")).rows[0].n);
      const id = revisions[0].id;
      for (const [sql, args] of [
        [
          "UPDATE checklist.service_revision SET title='tamper' WHERE id=$1",
          [id],
        ],
        ["DELETE FROM checklist.service_revision WHERE id=$1", [id]],
        [
          "UPDATE checklist.requirement_item SET quantity=99 WHERE revision_id=$1",
          [id],
        ],
        [
          "INSERT INTO checklist.mode(revision_id,code,label,allowed) VALUES($1,'INJECT','bad',true)",
          [id],
        ],
      ] as const) {
        await assert.rejects(db.query(sql, [...args]), /immutable/);
      }
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT COUNT(*) AS n FROM checklist.service_revision",
            )
          ).rows[0].n,
        ),
        revisionCount,
      );
    } finally {
      await db.end();
    }
  },
);
