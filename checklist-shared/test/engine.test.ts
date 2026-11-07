import test from "node:test";
import assert from "node:assert/strict";
import {
  evalTri,
  resolve,
  search,
  validateService,
  type ServiceSnapshot,
  type Question,
} from "../src/index.js";
import { catalog } from "../../checklist-api/scripts/catalog.js";
import source from "../../checklist-api/data/source.json";
const services = catalog({
  id: source.id,
  url: source.url,
  title: source.title,
  clause: "41",
  updatedAt: source.updatedAt,
  verifiedAt: "2026-11-07",
  sha256: source.reviewedSha256,
});
const service = services[0];
const flat = (result: ReturnType<typeof resolve>) =>
  result.sections.flatMap((s) =>
    s.entries.flatMap((i) => ("items" in i ? i.items : [i])),
  );
test("reviewed catalog passes static validation", () =>
  services.forEach(validateService));
test("unknown is not false; irrelevant variables do not become pending", () => {
  const qs: Question[] = [
    { code: "a", prompt: "A", type: "BOOLEAN" },
    { code: "b", prompt: "B", type: "BOOLEAN" },
  ];
  assert.deepEqual(evalTri({ "==": [{ var: "a" }, true] }, {}, qs), {
    v: "UNKNOWN",
    dependsOn: ["a"],
  });
  assert.deepEqual(evalTri({ or: [true, { var: "a" }] }, {}, qs), {
    v: "TRUE",
    dependsOn: [],
  });
  assert.deepEqual(evalTri({ and: [false, { var: "a" }] }, {}, qs), {
    v: "FALSE",
    dependsOn: [],
  });
  assert.deepEqual(
    evalTri({ or: [{ var: "a" }, { and: [false, { var: "b" }] }] }, {}, qs),
    { v: "UNKNOWN", dependsOn: ["a"] },
  );
  assert.equal(
    evalTri({ in: [{ var: "a" }, [true]] }, { a: true }, qs).v,
    "TRUE",
  );
});
test("delegation keeps document owners and correct original/copy forms", () => {
  const r = resolve(service, "DELEGATE", { q_document_region: "TW" });
  const items = flat(r);
  assert.equal(items.find((i) => i.key === "delegate-id")?.party, "DELEGATE");
  assert.equal(items.find((i) => i.key === "applicant-copy-id")?.form, "COPY");
  assert.equal(items.find((i) => i.key === "poa")?.form, "ORIGINAL");
  assert.equal(
    items.some((i) => i.key === "self-id"),
    false,
  );
  assert.equal(
    items.some((i) => i.key === "poa-overseas"),
    false,
  );
});
test("unknown conditions remain visible, region answers update verification actions", () => {
  const unknown = flat(resolve(service, "DELEGATE"));
  assert.equal(
    unknown.find((i) => i.key === "poa-overseas")?.status,
    "CONDITIONAL",
  );
  const overseas = flat(
    resolve(service, "DELEGATE", { q_document_region: "OVERSEAS" }),
  );
  assert.equal(
    overseas.find((i) => i.key === "poa-overseas")?.status,
    "REQUIRED",
  );
  assert.equal(
    overseas.some((i) => i.key === "poa-mainland"),
    false,
  );
});
test("legal representative multiple-party documents are conditional until answered", () => {
  assert.equal(
    flat(resolve(service, "LEGAL_REP")).find((i) => i.key === "other-reps-id")
      ?.status,
    "CONDITIONAL",
  );
  assert.equal(
    flat(resolve(service, "LEGAL_REP", { q_multiple_reps: false })).some(
      (i) => i.key === "other-reps-id",
    ),
    false,
  );
  assert.equal(
    flat(resolve(service, "LEGAL_REP", { q_multiple_reps: true })).find(
      (i) => i.key === "other-reps-id",
    )?.status,
    "REQUIRED",
  );
});
test("hidden answers are discarded and never influence items", () => {
  const s: ServiceSnapshot = structuredClone(service);
  s.questions.push({
    code: "q_nested",
    type: "BOOLEAN",
    prompt: "Nested",
    visibleWhen: { "==": [{ var: "q_no_current_id" }, true] },
  });
  const r = resolve(s, "SELF", {
    q_no_current_id: false,
    q_nested: true,
    q_document_region: "OVERSEAS",
    unknown: true,
  });
  assert.deepEqual(r.answers, { q_no_current_id: false });
});
test("blocked mode returns reason and no requirements", () => {
  const s = structuredClone(service);
  s.modes[1].allowed = false;
  s.modes[1].disallowedReason = "須親辦";
  const r = resolve(s, "DELEGATE");
  assert.equal(r.eligibility, "FALSE");
  assert.equal(r.mode.disallowedReason, "須親辦");
  assert.equal(r.sections.length, 0);
});
test("group cardinality and merge keep deterministic outputs", () => {
  const s = structuredClone(service);
  s.items.push({
    ...s.items.find((i) => i.key === "seal")!,
    key: "seal-duplicate",
    quantity: 2,
    note: "加註",
  });
  const r = resolve(s, "SELF", { q_no_current_id: false });
  assert.equal(
    flat(r).filter((i) => i.documentCode === "registered-seal").length,
    1,
  );
  assert.equal(flat(r).find((i) => i.key === "seal")?.quantity, 2);
  assert.equal(
    r.sections[0].entries.some((i) => "items" in i && i.id === "self-identity"),
    false,
  );
  assert.deepEqual(resolve(s, "SELF", { q_no_current_id: false }), r);
});
test("validator rejects unknown operators, missing sources, cross-party groups and cycles", () => {
  for (const mutate of [
    (s: ServiceSnapshot) => {
      s.items[0].condition = { eval: "unsafe" };
    },
    (s: ServiceSnapshot) => {
      s.items[0].sourceIds = [];
    },
    (s: ServiceSnapshot) => {
      s.questions[0].visibleWhen = { var: s.questions[0].code };
    },
    (s: ServiceSnapshot) => {
      s.items.find((i) => i.groupId === "self-identity")!.party = "DELEGATE";
    },
  ]) {
    const s = structuredClone(service);
    mutate(s);
    assert.throws(() => validateService(s));
  }
});
test("search supports common terms, aliases, known typos, NFKC and one-edit typos", () => {
  for (const q of ["印鑑", "印監證明", "印鉴证明", "印鑑証明"])
    assert.equal(search(services, q)[0]?.slug, "seal-certificate");
  assert.equal(
    search(services, "結婚證明")[0]?.slug,
    "marriage-divorce-certificate",
  );
  assert.equal(search(services, "不存在業務").length, 0);
});
test("all complete answer combinations resolve without conditional items", () => {
  for (const s of services)
    for (const mode of s.modes) {
      const questions = s.questions.filter(
        (q) => !q.modes || q.modes.includes(mode.code),
      );
      let combinations: Record<string, boolean | string>[] = [{}];
      for (const q of questions)
        combinations = combinations.flatMap((a) =>
          (q.type === "BOOLEAN"
            ? [true, false]
            : q.options!.map((o) => o.value)
          ).map((v) => ({ ...a, [q.code]: v })),
        );
      for (const answers of combinations)
        assert.equal(
          flat(resolve(s, mode.code, answers)).some(
            (i) => i.status === "CONDITIONAL",
          ),
          false,
          JSON.stringify({ slug: s.slug, mode: mode.code, answers }),
        );
    }
});
