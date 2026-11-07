import { test, expect } from "@playwright/test";

test("postal and motor services can be found and link to their own official sources", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("想辦什麼業務？").fill("郵局");
  await expect(page.getByText("找到 4 項業務")).toBeVisible();
  await page.getByRole("link", { name: /^郵局存摺掛失補發/ }).click();
  await expect(page.getByRole("checkbox", { name: "國民身分證" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "儲金簿（存摺）" })).toHaveCount(0);
  const source = page.locator(".check-item").filter({ has: page.getByRole("checkbox", { name: "國民身分證" }) }).getByRole("link", { name: "官方依據（另開視窗）", exact: true });
  await expect(source).toHaveAttribute("href", "https://www.post.gov.tw/post/internet/B_saving/index.jsp?ID=3010102");
  await expect(page.locator("#sources")).toContainText("中華郵政股份有限公司");

  await page.goto("/");
  await page.getByLabel("想辦什麼業務？").fill("監理");
  await expect(page.getByText("找到 3 項業務")).toBeVisible();
  await page.getByRole("link", { name: /行照遺失/ }).click();
  await page.getByRole("group", { name: "強制汽車責任保險證有效期間是否至少還有 30 日？" }).getByRole("radio", { name: "是", exact: true }).check();
  await page.getByRole("radio", { name: "機車（含大型重型機車）", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "機車行照規費" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "汽車行照規費" })).toHaveCount(0);
  await expect(page.locator(".check-item").filter({ has: page.getByRole("checkbox", { name: "機車行照規費" }) }).getByRole("link", { name: "官方依據（另開視窗）", exact: true })).toHaveAttribute("href", "https://www.thb.gov.tw/cp.aspx?n=437");
  await page.getByRole("group", { name: "強制汽車責任保險證有效期間是否至少還有 30 日？" }).getByRole("radio", { name: "否", exact: true }).check();
  await expect(page.getByText("此方式不可辦理：強制險有效期間不足 30 日，不得補發行照；請先續保。", { exact: true })).toBeVisible();
  await expect(page.locator(".check-item")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "材料已準備完成！" })).toHaveCount(0);
});
