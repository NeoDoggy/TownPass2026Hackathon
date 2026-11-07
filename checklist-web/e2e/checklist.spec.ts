import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ])
    .analyze();
  await test.info().attach(`axe-${label}`, {
    body: JSON.stringify(
      {
        url: page.url(),
        violations: result.violations,
        incomplete: result.incomplete,
        passes: result.passes.map((p) => p.id),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(result.violations, `${label}: axe violations`).toEqual([]);
}
test("home, search, conditions and saved checklist are accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "辦事帶什麼", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".service-link")).toHaveCount(0);
  await audit(page, "home");
  await page.getByLabel("想辦什麼業務？").fill("印監證明");
  await expect(page.getByText("找到 1 項業務")).toBeVisible();
  await audit(page, "search");
  await page.getByRole("link", { name: /^印鑑證明/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "印鑑證明" }),
  ).toBeFocused();
  await page.getByRole("radio", { name: "委託他人", exact: true }).check();
  await audit(page, "questions-unknown");
  const conditions = page.getByRole("group", {
    name: "委任書、授權書或同意書在哪裡作成？",
  });
  await conditions.getByRole("radio", { name: "國外", exact: true }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "已依所選條件更新清單" }),
  ).toContainText("已確認必備：先完成駐外館處驗證");
  await expect(
    page.getByText("先完成駐外館處驗證", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("先完成指定機構驗證", { exact: true }),
  ).toHaveCount(0);
  await audit(page, "checklist-overseas");
  await page.getByRole("checkbox", { name: "受委任人身分證明文件" }).check();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "委託他人", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "受委任人身分證明文件" }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "國外", exact: true }),
  ).toBeChecked();
  await expect(page).toHaveURL(/\/services\/seal-certificate$/);
  await audit(page, "checklist-saved");
  await page.getByRole("radio", { name: "法定代理人", exact: true }).check();
  await audit(page, "legal-representative");
  expect(errors).toEqual([]);
});
test("minimal home reveals live results and offers all services only after no matches", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("想辦什麼業務？");
  const all = page.getByRole("button", { name: "查看所有業務", exact: true });
  await expect(search).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator(".service-link")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("home.png"), fullPage: true });
  await search.fill("   ");
  await expect(page.locator(".service-link")).toHaveCount(0);
  await expect(all).toHaveCount(0);
  await search.fill("印鑑");
  await expect(page.getByRole("status")).toContainText("找到 2 項業務");
  await expect(search).toBeFocused();
  await expect(all).toHaveCount(0);
  const seal = page.getByRole("link", { name: /^印鑑證明/ });
  expect((await seal.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await seal.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "印鑑證明" })).toBeFocused();
  await page.getByRole("link", { name: "回到業務搜尋" }).click();
  await expect(page.locator(".service-link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "最近看過" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("townpass-checklist:recent"))).toBeNull();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: `
    html { font-size: 225% !important; }
    * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
    p { margin-bottom: 2em !important; }
  ` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await audit(page, "home-enlarged");
  await search.fill("郵局");
  await expect(page.getByText("找到 4 項業務")).toBeVisible();
  await expect(search).toBeFocused();
  await expect(page.locator(".service-link")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await audit(page, "search-enlarged");
  await search.fill("不存在業務");
  await expect(all).toBeVisible();
  await all.click();
  await expect(page.getByText("目前提供 9 項業務")).toBeVisible();
  await expect(page.getByRole("heading", { name: "所有業務", exact: true })).toBeFocused();
  await expect(page.locator(".service-link")).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await audit(page, "all-services-enlarged");
  await search.fill("郵局");
  await expect(page.locator(".service-link")).toHaveCount(4);
  await search.clear();
  await expect(page.locator(".service-link")).toHaveCount(0);
  await expect(all).toHaveCount(0);
});

test("loading and network errors hide stale cards and the all-services entry", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("想辦什麼業務？");
  await search.fill("印鑑");
  await expect(page.locator(".service-link")).toHaveCount(2);
  let pendingRoute: Route | undefined;
  await page.route("**/v1/search", (route) => { pendingRoute = route; });
  await search.fill("郵局");
  await expect.poll(() => Boolean(pendingRoute)).toBe(true);
  await expect(page.getByRole("status")).toContainText("正在搜尋");
  await expect(page.locator(".service-link")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看所有業務" })).toHaveCount(0);
  await pendingRoute!.fulfill({ status: 503, json: {} });
  await expect(page.getByRole("alert")).toContainText("目前無法連線");
  await expect(page.getByRole("button", { name: "查看所有業務" })).toHaveCount(0);
  await audit(page, "search-network-error");
  await page.unroute("**/v1/search");
  await page.getByRole("button", { name: "重新載入" }).click();
  await expect(page.locator(".service-link")).toHaveCount(4);
});

test("keyboard, empty/error states, zoom reflow and offline cache", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要內容" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.getByLabel("想辦什麼業務？").fill("不存在業務");
  await expect(
    page.getByRole("heading", { name: "還沒找到想辦的業務？" }),
  ).toBeVisible();
  await audit(page, "empty");
  await page.goto("/services/seal-certificate");
  await expect(
    page.getByRole("heading", { level: 1, name: "印鑑證明" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "html{font-size:225% !important}" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await audit(page, "text-zoom-reflow");
  await page.route("**/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByText(/目前無法連線，顯示本機保留版本/)).toBeVisible();
  await page.getByRole("checkbox", { name: "原登記之印鑑章" }).check();
  await page.goto("/services/not-found");
  await expect(
    page.getByRole("heading", { name: "無法載入業務" }),
  ).toBeVisible();
  await audit(page, "error");
});
test("revision updates preserve stable checks and storage failures are announced", async ({
  page,
}) => {
  await page.goto("/services/seal-certificate");
  await expect(
    page.getByRole("heading", { level: 1, name: "印鑑證明" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "原登記之印鑑章" }).check();
  await page.evaluate(() => {
    const key = "townpass-checklist:seal-certificate:SELF";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.revisionNo = 0;
    saved.itemKeys = ["seal", "removed-item"];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByText(/規定已更新至第 1 版/)).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "原登記之印鑑章" }),
  ).toBeChecked();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "QuotaExceededError");
    };
  });
  await page.getByRole("checkbox", { name: "原登記之印鑑章" }).uncheck();
  await expect(page.getByRole("alert")).toContainText("瀏覽器無法保存資料");
  await audit(page, "storage-error");
});
test("browser back returns to search; condition changes and clearing work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("想辦什麼業務？").fill("結離婚");
  await page
    .getByRole("link", { name: /^中、英文結離婚證明書/ })
    .click();
  const english = page.getByRole("group", { name: "是否申請英文證明書？" });
  await english.getByRole("radio", { name: "是", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "當事人中華民國護照" }),
  ).toBeVisible();
  await english.getByRole("radio", { name: "否", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "當事人中華民國護照" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "當事人國民身分證" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("checkbox", { name: "當事人國民身分證" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "清除本辦理方式的勾選與條件" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "當事人國民身分證" }),
  ).not.toBeChecked();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "辦事帶什麼", exact: true }),
  ).toBeFocused();
});
