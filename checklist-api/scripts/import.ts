import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import source from "../data/source.json";
import { catalog } from "./catalog.js";
import { additionalCatalog } from "./additional-catalog.js";
import reviewedSources from "../data/reviewed-sources.json";
import { validateService } from "@townpass/checklist-shared";
// Web excerpts retain their manual verification date; an offline replay is not a new verification.
for (const ref of reviewedSources) {
  if (!/^[a-z0-9-]+$/.test(ref.id)) throw new Error("核對摘錄識別碼無效");
  const excerpt = (await readFile(new URL(`../data/reviewed/${ref.id}.txt`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  if (createHash("sha256").update(excerpt).digest("hex") !== ref.sha256)
    throw new Error(`${ref.id}: 核對摘錄 SHA256 不符，未覆蓋匯入資料`);
}
const url = new URL(source.url);
if (url.protocol !== "https:" || url.hostname !== "www-ws.gov.taipei")
  throw new Error("來源不在允許清單");
const local = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
const bytes = local
  ? await readFile(local)
  : new Uint8Array(
      await (async () => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(60000),
          redirect: "error",
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("pdf")
        )
          throw new Error("無法取得官方 PDF");
        if (Number(response.headers.get("content-length")) > 10000000)
          throw new Error("來源超過 10 MB");
        return response.arrayBuffer();
      })(),
    );
if (bytes.length > 10000000) throw new Error("來源超過 10 MB");
const hash = createHash("sha256").update(bytes).digest("hex");
if (hash !== source.reviewedSha256)
  throw new Error(
    `官方來源已變更（${hash}）；請先人工核對 catalog 與頁碼，再更新 reviewedSha256。未覆蓋已發布資料。`,
  );
const pdf = await getDocument({
  data: new Uint8Array(bytes),
  useSystemFonts: true,
}).promise;
const pages: Record<string, string> = {};
for (const n of [1, 41, 42, 43]) {
  const page = await pdf.getPage(n);
  pages[n] = (await page.getTextContent()).items
    .map((i) => ("str" in i ? i.str : ""))
    .join(" ");
}
if (
  !pages[41].includes("印鑑證明") ||
  !pages[43].includes("結離婚證明書") ||
  !pages[41].includes("委任書")
)
  throw new Error("來源結構不符，請重新核對");
const verifiedAt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const services = [...catalog({
  id: source.id,
  title: source.title,
  url: source.url,
  clause: "",
  updatedAt: source.updatedAt,
  verifiedAt,
  sha256: hash,
}), ...additionalCatalog()];
services.forEach(validateService);
await mkdir(new URL("../data/raw/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/raw/household.pdf", import.meta.url), bytes);
await writeFile(
  new URL("../data/raw/excerpts.json", import.meta.url),
  JSON.stringify(pages, null, 2),
);
await writeFile(
  new URL("../data/imported.json", import.meta.url),
  JSON.stringify(services, null, 2) + "\n",
);
console.log(
  `已匯入 ${services.length} 個業務（戶政 PDF＋已核對網頁摘錄）；戶政查證 ${verifiedAt}；PDF SHA256 ${hash}`,
);
