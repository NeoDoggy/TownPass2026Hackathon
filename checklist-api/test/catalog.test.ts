import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, search, validateService, isOfficialSourceUrl } from "@townpass/checklist-shared";
import { additionalCatalog } from "../scripts/additional-catalog.js";
import sources from "../data/reviewed-sources.json";
import { loadSnapshot } from "../src/snapshots.js";

const services = additionalCatalog();
const service = (slug: string) => services.find((s) => s.slug === slug)!;
const items = (slug: string, mode: "SELF" | "DELEGATE" = "SELF", answers = {}) =>
  resolve(service(slug), mode, answers).sections.flatMap((s) =>
    s.entries.flatMap((entry) => "items" in entry ? entry.items : [entry]));

test("all seven additions validate and are present in the published snapshot", async () => {
  assert.equal(services.length, 7);
  services.forEach(validateService);
  const snapshot = await loadSnapshot();
  assert.equal(snapshot.services.length, 9);
  for (const s of services) {
    const published = snapshot.services.find((entry) => entry.slug === s.slug)!;
    assert.ok(published, s.slug);
    assert.deepEqual({ ...published, revisionNo: 1, revisionId: "" }, s);
    for (const mode of s.modes) {
      const result = resolve(published, mode.code, {});
      assert.notEqual(result.eligibility, "FALSE");
      assert.ok(result.sections.length, `${s.slug}:${mode.code}`);
    }
  }
});

test("reviewed official excerpts retain their SHA256 and verification dates", async () => {
  for (const ref of sources) {
    const text = (await readFile(new URL(`../data/reviewed/${ref.id}.txt`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(text).digest("hex"), ref.sha256, ref.id);
    assert.equal(ref.verifiedAt, "2026-11-07");
    assert.ok(isOfficialSourceUrl(ref.url));
  }
  for (const url of [
    "http://www.post.gov.tw/", "https://www.post.gov.tw.evil.test/",
    "https://evilpost.gov.tw/", "https://other.gov.tw/",
    "https://www.thb.gov.tw@evil.test/", "https://user@www.thb.gov.tw/",
    "https://www.thb.gov.tw:444/", "not-a-url",
  ]) assert.equal(isOfficialSourceUrl(url), false, url);
  assert.ok(isOfficialSourceUrl("https://www-ws.gov.taipei/official.pdf"));
});

test("postal opening keeps second ID alternatives, name-change conditions and deposit distinct from fees", () => {
  const opening = service("postal-savings-account");
  const checklist = resolve(opening, "SELF", {});
  const alternatives = checklist.sections.flatMap((s) => s.entries).find((e) => "id" in e && e.id === "second-id");
  assert.ok(alternatives && "items" in alternatives);
  assert.equal(alternatives.rule, "ONE_OF");
  assert.equal(alternatives.items.length, 5);
  const unchanged = items(opening.slug, "SELF", { q_name_changed: false });
  assert.ok(!unchanged.some((i) => i.groupId === "name-change"));
  const changed = items(opening.slug, "SELF", { q_name_changed: true });
  assert.equal(changed.filter((i) => i.groupId === "name-change").length, 2);
  assert.equal(changed.find((i) => i.key === "opening-deposit")!.kind, "ACTION");
  assert.ok(!changed.some((i) => i.kind === "FEE"));
});

test("postal maintenance never asks for a lost passbook, old seal or an unverified reset fee", () => {
  const replacement = items("postal-passbook-replacement");
  assert.ok(!replacement.some((i) => i.key === "passbook"));
  assert.ok(replacement.some((i) => i.key === "seal"));
  assert.equal(replacement.find((i) => i.kind === "FEE")!.amountTwd, 50);
  const change = items("postal-seal-change");
  assert.ok(change.some((i) => i.key === "new-seal"));
  assert.ok(!change.some((i) => i.key === "seal"));
  assert.equal(change.find((i) => i.kind === "FEE")!.amountTwd, 50);
  assert.ok(!items("postal-passbook-password-reset").some((i) => i.kind === "FEE"));
  for (const s of services.filter((s) => s.category === "郵局儲匯")) {
    assert.deepEqual(s.modes.map((m) => m.code), ["SELF"]);
    assert.throws(() => resolve(s, "DELEGATE", {}), /辦理方式/);
  }
});

test("driving license replacement distinguishes loss, damage, professional review and delegation", () => {
  const slug = "driving-license-replacement";
  const lost = items(slug, "SELF", { q_damaged: false, q_professional_review: false });
  assert.ok(!lost.some((i) => ["damaged-license", "review-form", "review"].includes(i.key)));
  assert.equal(lost.find((i) => i.key === "photos")!.quantity, 2);
  assert.equal(lost.find((i) => i.kind === "FEE")!.amountTwd, 200);
  const delegated = items(slug, "DELEGATE", { q_damaged: true, q_professional_review: true });
  for (const key of ["applicant-id", "delegate-id", "damaged-license", "review-form", "review"])
    assert.ok(delegated.some((i) => i.key === key && i.status === "REQUIRED"), key);
  assert.ok(!delegated.some((i) => i.groupId === "identity"));
});

test("international permit uses two-inch photos, passport copy, delegate ID and address-change action", () => {
  const slug = "international-driving-permit";
  const own = items(slug, "SELF", { q_address_differs: false });
  assert.ok(!own.some((i) => ["delegate-id", "address-change"].includes(i.key)));
  assert.equal(own.find((i) => i.key === "passport")!.form, "COPY");
  assert.equal(own.find((i) => i.key === "photos")!.quantity, 2);
  assert.match(own.find((i) => i.key === "photos")!.title, /2 吋/);
  assert.equal(own.find((i) => i.kind === "FEE")!.amountTwd, 250);
  const delegated = items(slug, "DELEGATE", { q_address_differs: true });
  assert.equal(delegated.find((i) => i.key === "delegate-id")!.party, "DELEGATE");
  assert.equal(delegated.find((i) => i.key === "address-change")!.status, "REQUIRED");
});

test("registration replacement blocks expired insurance and selects the correct vehicle fee", () => {
  const s = service("vehicle-registration-replacement");
  assert.equal(resolve(s, "SELF", {}).eligibility, "UNKNOWN");
  const blocked = resolve(s, "SELF", { q_insurance_valid: false });
  assert.equal(blocked.eligibility, "FALSE");
  assert.equal(blocked.sections.length, 0);
  for (const [type, amount] of [["CAR", 200], ["MOTORCYCLE", 150]] as const) {
    const selected = items(s.slug, "SELF", { q_vehicle_type: type, q_insurance_valid: true, q_inspection_due: false });
    assert.deepEqual(selected.filter((i) => i.kind === "FEE").map((i) => i.amountTwd), [amount]);
    assert.ok(!selected.some((i) => i.key === "inspection"));
  }
  assert.equal(items(s.slug, "SELF", { q_insurance_valid: true, q_inspection_due: true }).find((i) => i.key === "inspection")!.status, "REQUIRED");
  assert.equal(items(s.slug).filter((i) => i.kind === "FEE" && i.status === "CONDITIONAL").length, 2);
});

test("agency, category and common aliases find the expanded catalog", () => {
  assert.equal(search(services, "郵局").length, 4);
  assert.equal(search(services, "儲匯").length, 4);
  assert.equal(search(services, "監理").length, 3);
  for (const [query, slug] of [["存摺遺失", "postal-passbook-replacement"], ["国际驾照", "international-driving-permit"], ["行照補發", "vehicle-registration-replacement"]])
    assert.equal(search(services, query)[0].slug, slug);
});
