import { test, expect, type Page } from "@playwright/test";

async function checkHeadings(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
  const headings = await page
    .locator("h1,h2,h3,h4,h5,h6")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        level: Number(node.tagName.slice(1)),
        text: node.textContent?.trim(),
      })),
    );
  expect(headings[0].level).toBe(1);
  for (const [index, heading] of headings.entries()) {
    expect(heading.text).toBeTruthy();
    if (index)
      expect(heading.level, `標題跳級：${heading.text}`).toBeLessThanOrEqual(
        headings[index - 1].level + 1,
      );
  }
}

test("initial HTML has a heading when JavaScript is disabled", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    for (const path of ["/", "/services/seal-certificate"]) {
      await page.goto(path);
      await checkHeadings(page);
      await expect(page.getByText(/請啟用 JavaScript/)).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test("service loading state has a page heading", async ({ page }) => {
  await page.route("**/v1/services/seal-certificate", () => {});
  await page.goto("/services/seal-certificate");
  await expect(page.getByRole("status")).toContainText("正在載入準備清單");
  await checkHeadings(page);
});

test("home, search and both services keep heading levels in order", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("想辦什麼業務？")).toBeVisible();
  await checkHeadings(page);
  await page.getByLabel("想辦什麼業務？").fill("印監證明");
  await expect(page.getByText("找到 1 項業務")).toBeVisible();
  await checkHeadings(page);
  for (const slug of ["seal-certificate", "marriage-divorce-certificate"]) {
    await page.goto(`/services/${slug}`);
    await expect(
      page.getByRole("heading", { name: "3. 準備清單" }),
    ).toBeVisible();
    await checkHeadings(page);
    await page.getByRole("radio", { name: "委託他人", exact: true }).check();
    await checkHeadings(page);
  }
  await page.goto("/services/not-found");
  await expect(
    page.getByRole("heading", { name: "無法載入業務" }),
  ).toBeVisible();
  await checkHeadings(page);
});
