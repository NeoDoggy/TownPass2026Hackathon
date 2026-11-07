import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { loadSnapshot } from "../src/snapshots.js";
import { resolve } from "@townpass/checklist-shared";
const snapshot = await loadSnapshot();
test("expanded categories, agency searches and all new checklist endpoints are available", async () => {
  const app = buildApp(() => snapshot);
  try {
    const categories = (await app.inject("/v1/categories")).json().items;
    assert.deepEqual(Object.fromEntries(categories.map((c: { name: string; count: number }) => [c.name, c.count])), { "戶政": 2, "郵局儲匯": 4, "監理": 3 });
    for (const [q, count] of [["郵局", 4], ["監理", 3]] as const) {
      const found = await app.inject({ method: "POST", url: "/v1/search", payload: { q } });
      assert.equal(found.json().total, count);
    }
    for (const service of snapshot.services.filter((s) => s.category !== "戶政")) {
      assert.equal((await app.inject(`/v1/services/${service.slug}`)).json().service.agency, service.agency);
      for (const mode of service.modes) {
        const response = await app.inject({ method: "POST", url: `/v1/services/${service.slug}/checklist`, payload: { mode: mode.code, answers: {} } });
        assert.equal(response.statusCode, 200, `${service.slug}:${mode.code}`);
        assert.deepEqual(response.json().checklist, resolve(service, mode.code, {}));
      }
    }
  } finally {
    await app.close();
  }
});
test("API: cache, CORS, parameter limits, privacy, engine parity and retirement", async () => {
  const app = buildApp(() => snapshot);
  try {
    const list = await app.inject("/v1/services");
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().items.length, snapshot.services.length);
    assert.equal(list.headers["x-snapshot-version"], snapshot.version);
    assert.equal(
      (
        await app.inject({
          url: "/v1/services",
          headers: { "if-none-match": list.headers.etag! },
        })
      ).statusCode,
      304,
    );
    assert.equal(
      (
        await app.inject({
          url: "/v1/services",
          headers: { origin: "https://evil.test" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: "/v1/services",
          headers: { origin: "http://localhost:5173" },
        })
      ).headers["access-control-allow-origin"],
      "http://localhost:5173",
    );
    for (const url of [
      "/v1/suggest",
      "/v1/suggest?q=" + encodeURIComponent("印".repeat(31)),
      "/v1/services/seal-certificate/checklist?mode=SELF&a.q_no_current_id=true",
    ])
      assert.equal((await app.inject(url)).statusCode, 400, url);
    assert.equal((await app.inject("/v1/services/missing")).statusCode, 404);
    assert.equal(
      (
        await app.inject(
          "/v1/services/marriage-divorce-certificate/checklist?mode=LEGAL_REP",
        )
      ).statusCode,
      422,
    );
    const answer = {
      mode: "DELEGATE",
      answers: { q_document_region: "OVERSEAS" },
    };
    const post = await app.inject({
      method: "POST",
      url: "/v1/services/seal-certificate/checklist",
      payload: answer,
    });
    assert.equal(post.statusCode, 200);
    assert.equal(post.headers["cache-control"], "no-store");
    assert.deepEqual(
      post.json().checklist,
      resolve(
        snapshot.services.find((s) => s.slug === "seal-certificate")!,
        "DELEGATE",
        answer.answers,
      ),
    );
    for (const answers of [
      { q_document_region: "bad" },
      { unknown: true },
      { q_no_current_id: "true" },
      { constructor: true },
    ])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/v1/services/seal-certificate/checklist",
            payload: { mode: "SELF", answers },
          })
        ).statusCode,
        400,
      );
    const query = await app.inject({
      method: "POST",
      url: "/v1/search",
      payload: { q: "印鑑" },
    });
    assert.equal(query.json().items[0].slug, "seal-certificate");
    assert.equal(query.headers["cache-control"], "no-store");
    const retired = structuredClone(snapshot);
    retired.services[0].retired = true;
    const retiredApp = buildApp(() => retired);
    try {
      assert.equal(
        (await retiredApp.inject(`/v1/services/${retired.services[0].slug}`))
          .statusCode,
        410,
      );
    } finally {
      await retiredApp.close();
    }
  } finally {
    await app.close();
  }
});
