# 辦事帶什麼 Checklist

Checklist 是獨立的 **React + TypeScript + Vite Web App**。Flutter 僅透過既有 `TPInAppWebView` 承載網頁，入口為「服務 → 城市生活 → 辦事帶什麼」。原有服務、導覽及一般 WebView 行為保留。

## 開始使用

需要 Node.js 22.16+ 與 npm。這台電腦已下載可攜版到忽略的 `.tools/node-v22.16.0-win-x64`，尚未加入系統 PATH；PowerShell 可先執行：

```powershell
$env:PATH = "$PWD/.tools/node-v22.16.0-win-x64;" + $env:PATH
npm ci
npm run dev:api
```

另一個終端執行 `npm run dev:web`，開啟 `http://localhost:5173`。Repo 已附官方資料編譯的快照，**公開搜尋、清單與勾選不需啟動 PostgreSQL**。Vite 將 `/v1` 轉送 `127.0.0.1:3001`；手機和模擬器看到的是相同來源，不會把手機的 localhost 當 API 主機。

目前提供 **9 項業務、3 類資料**，本次查證日期為 **2026-11-07**：

| 分類 | 可用業務 | 涵蓋範圍 |
| --- | --- | --- |
| 戶政（2 項） | 印鑑證明、中／英文結離婚證明書 | 既有本人／委託／法定代理分支依各業務規定 |
| 郵局儲匯（4 項） | 存簿儲金開戶、存摺掛失補發、存簿更換印鑑、儲金簿密碼重設 | 持國民身分證的一般成年個人戶親辦；維護業務區分通儲戶／非通儲戶辦理地點 |
| 監理（3 項） | 汽機車駕照遺失／毀損補發、申領國際駕照、行照遺失／損壞補發 | 前兩項支援本人／委託；行照限個人車主親辦，含車種費用、保險效期與到期檢驗條件 |

搜尋可輸入業務名稱、同義詞、機關或分類，例如「郵局」、「儲匯」、「監理」、「存摺遺失」、「國際駕照」。郵局未成年、團體、外籍等特殊身分，及公司行號行照、行照代辦文件尚未納入，請先向承辦窗口確認。儲金簿密碼重設不適用金融卡或網路郵局密碼。

## 目錄與核心模型

| 位置 | 用途 |
| --- | --- |
| `checklist-web` | 手機優先 React UI、LocalStorage 保存、API 失效時使用先前業務定義 |
| `checklist-api/src` | Fastify 公開 REST API、只讀記憶體快照，每 60 秒校驗並換版 |
| `checklist-api/db` | PostgreSQL migration；已發布修訂與子表有不可變觸發器 |
| `checklist-api/scripts` | 官方下載／核對、seed、發布 |
| `checklist-api/data` | 來源清冊、匯入結果、版本化快照與 SHA256 |
| `checklist-shared` | Service／Revision／Mode／Party／Document／Item／Group／Question／Source 型別、驗證、三值規則引擎與搜尋 |
| `lib/page/checklist` | Flutter WebView 容器；沒有 Checklist 原生 UI |
| `deploy` | Dockerfile、Caddy HTTPS 與 CSP |

按照架構 PDF 的 M1 市民端流程實作。內容先以受控 CLI 維護；未實作 M2 的後台編輯／四眼審核／排程、M3 的 iSSO／跨裝置同步、Redis、S3、Kubernetes 或推播。當前快照用唯讀檔案替代物件儲存，維持公開查詢不接資料庫的界線。

項目以穩定 `key` 保存勾選，按 Party 分組，支援正本／影本、數量、規費、擇一／全部／至少 N 項群組。條件是白名單 JSON Logic；未知條件顯示「視情況需要」，不當成否。問題依賴先排序，隱藏問題的舊答案不參與計算。前後端匯入同一個 `resolve()`，API 測試比較相同輸出。資料更新時保留仍存在項目的勾選，提示新增／移除數量，提醒重新核對。

搜尋有 150ms debounce、名稱與同義詞、機關與分類、已核對的簡體別名、NFKC 正規化與一字編輯距離容錯；不是全量 OpenCC 或大型中文搜尋索引。不呈現虛構的熱門排名。最近瀏覽只存本機業務識別。

## 官方 Import → Seed → Publish

戶政來源：[臺北市政府申請案件處理時限表（戶政類）](https://www-ws.gov.taipei/001/Upload/426/relfile/18393/8903/b6ef09df-e397-4ef6-b8b2-2dfcd26eaaa1.pdf)，115 年 10 月 7 日修訂。印鑑證明在 PDF 41–42 頁，結離婚證明書在 43 頁。

新增網頁來源與官方頁面修訂日期：

| 資料 | 官方來源 | 官方修訂 |
| --- | --- | --- |
| 郵局開戶及三項存簿維護 | [中華郵政開戶及憑辦文件與頁內問題集](https://www.post.gov.tw/post/internet/B_saving/index.jsp?ID=3010102) | 2026-08-10 |
| 駕照補發 | [公路局遺失與毀損補發](https://www.thb.gov.tw/cp.aspx?n=163) | 2025-10-29 |
| 國際駕照 | [公路局申領國際駕照](https://www.thb.gov.tw/cp.aspx?n=96) | 2026-08-12 |
| 行照補發 | [公路局行照遺失損壞換發](https://www.thb.gov.tw/cp.aspx?n=437) | 2026-10-22 |

每個項目都有 SourceRef。戶政 SHA256 對應原始 PDF；新增網頁的 SHA256 對應 `data/reviewed/*.txt` 已核對摘錄（UTF-8、換行正規化為 LF），**不是整份 HTML 的雜湊**。中華郵政摘錄取自實際下載頁面；公路局直連下載遇到防護頁，改由瀏覽工具讀取官方頁面並保存相關段落。來源清冊 `data/reviewed-sources.json` 記錄各頁官方修訂日期、人工查證日期、段落與摘錄雜湊；結構化映射在 `scripts/additional-catalog.ts`。

1. 啟動 PostgreSQL 16；可使用 `compose.checklist.yaml`：

   ```powershell
   $env:CHECKLIST_DB_PASSWORD = 'replace-with-a-local-password'
   docker compose -f compose.checklist.yaml up -d postgres
   ```

2. 複製 `checklist-api/.env.example` 為 `checklist-api/.env`，設定自己的 `DATABASE_URL`。也可在環境變數設定。`.env` 已忽略，請勿將正式密碼寫進 Repo。
3. 在 Repo 根目錄依序執行：

   ```text
   npm run db:migrate
   npm run data:import
   npm run db:seed
   npm run data:publish
   ```

`data:import` 先校驗已核對網頁摘錄，再下載官方戶政 PDF，檢查 HTTPS 主機、10 MB 上限、60 秒逾時與檔案雜湊，解析指定頁碼，合併兩份 catalog 並驗證後輸出全部 9 項至 `data/imported.json`。**不以爬蟲猜測行政條件**；若官方 PDF 變動，先停住，人工重新核對 `scripts/catalog.ts` 和頁碼後更新 `data/source.json` 的 `reviewedSha256`，才能再次匯入。`data/raw/` 保留下載 PDF 與頁面擷取，已忽略。

網頁資料採人工核對後固定摘錄；重跑 import **不會重新下載郵局／公路局網頁，也不會更新其查證日期**。更新時須重新閱讀官方頁面、保存相關完整段落至 `data/reviewed`、調整 `additional-catalog.ts`，再更新清冊的修訂／查證日期及摘錄 SHA256；頁面無法取得或只回傳防護頁，不能據此視為重新查證。摘錄不符雜湊時匯入會失敗，保留既有輸出。

要重播已下載檔案，可執行 `npm run import -w checklist-api -- --file=C:/path/to/official.pdf`。本機檔案仍須符合已核對雜湊；這不是線上重新查證，使用時應自行記錄下載日期。

Migration 有資料庫鎖與版本表；Seed 使用交易與內容雜湊，相同內容不重建修訂。新內容建立新 revision，不覆寫已發布內容。Publish 先寫新快照與 SHA256、記錄 DB，再原子更新 `LATEST`；相同內容直接結束。查詢端載入新快照失敗時保留原版本。快照與匯入結果可提交版控，不包含個資。

新增業務時在 catalog 加入文件／模式／條件／來源，加入內容測試，再執行上述流程；新增機關需一併調整 `scripts/seed.ts` 的機關／分類對應與 shared 的來源主機允許清單。Seed 會依各業務寫入正確機關與分類。正式發布前仍需承辦機關審閱；本次核對不等同機關背書。戶政線上匯入的查證日期反映執行日，網頁摘錄保留人工查證日；規定改變應重新檢查全部相關分支。

## URL、CORS 與 Flutter

| 設定 | 用途 |
| --- | --- |
| `CHECKLIST_WEB_URL` | Flutter `--dart-define`，完整網頁 URL；不得含帳密、query 或 fragment |
| `CHECKLIST_ALLOW_LOCAL_HTTP=true` | 僅 debug 允許 localhost、127.0.0.1、10.0.2.2 的 HTTP |
| `VITE_API_URL` | Web 建置時 API base URL，預設空字串採同源 `/v1`；改值須重新 build |
| `CORS_ORIGINS` | API 可接受的明確 origin，以逗號分隔；不能含萬用字元或路徑 |
| `HOST`／`PORT` | API 綁定位置，開發預設 127.0.0.1:3001 |

Android Emulator：

```text
flutter run -d emulator-5554 --dart-define=CHECKLIST_WEB_URL=http://10.0.2.2:5173 --dart-define=CHECKLIST_ALLOW_LOCAL_HTTP=true
```

Debug manifest 只為上述本機主機開放 HTTP；release 不使用該 debug 設定，URL 驗證只接受 HTTPS。真機與 iOS 優先使用有受信任憑證的 HTTPS 網址：

```text
flutter run --dart-define=CHECKLIST_WEB_URL=https://checklist.example.org
```

未配置 URL 時顯示服務尚未啟用，避免連到虛構正式網址。返回優先走 WebView history，首頁再退回 TownPass；外部 HTTPS、電話及郵件使用外部 App。其他 scheme、跨來源內嵌導覽被取消；`target=_blank` 交由外部瀏覽器。沒有忽略憑證錯誤的程式。

Checklist **停用 TownPass `flutterObject` Bridge**，不傳帳號、token、定位或裝置資料，也不註冊 JS handler；不需要以 URL 傳登入資料。本次沒有更改其他舊服務的 Bridge 行為，原有 listener 的信任來源設定應另案盤點。若未來加入 Bridge，必須先設定明確 `allowedOriginRules` 並驗證 `sourceOrigin`／`isMainFrame`；不得啟用全域 `*` 或把現有帳號 Bridge 直接打開。

Web App 搜尋走 POST body，條件於本機重算，不進公開 URL；伺服器重算亦提供 no-store POST。分享只包含業務 slug。API 關閉請求 URL／body 記錄；Caddy 範例未啟用 access log。反向代理／WAF 也應避免記錄 body、遮罩意外輸入個資。資料儲存失敗時顯示提示；清除按鈕清除當前辦理方式的答案與勾選。

## HTTPS 部署

```powershell
$env:CHECKLIST_DOMAIN = 'checklist.example.org'
$env:CHECKLIST_DB_PASSWORD = 'your-secret'
docker compose -f compose.checklist.yaml up -d --build web
```

`web` 依賴 query API，**不依賴 PostgreSQL**。DNS 指向主機，開放 80/443，Caddy 申請 TLS 憑證，提供 SPA fallback、同源 API proxy、CSP、禁止 framing、Referrer-Policy 與 HSTS。快照目錄唯讀掛載。`localhost` 模式是本機 CA，不能當成真機信任憑證；不要略過憑證檢查。

若使用不同 API 網域，設定 Web build arg `VITE_API_URL`、API `CORS_ORIGINS`，並在 Caddy `API_ORIGIN` 加入該 HTTPS origin。Repo 的 compose 預設同源最簡單。實際正式 DNS／公信憑證與 Docker 執行需於部署環境驗證，本次不宣稱已部署。

## 測試與驗收

```text
npm run build
npm test
npx playwright install chromium
npm run test:a11y
flutter test test/checklist_config_test.dart test/checklist_entry_test.dart
```

資料庫不可變測試需要**獨立測試 DB**，先 migrate、seed，再設定 `CHECKLIST_TEST_DATABASE_URL` 後執行 `npm test`；未設定會清楚標記 skipped。`.github/workflows/checklist.yml` 已提供 PostgreSQL + build + 引擎/API + Playwright 流程，但尚未在遠端 CI 執行。

Playwright 自動啟動 API 與 Vite，在手機尺寸與桌面 Chromium 執行首頁、搜尋、條件、清單與錯誤狀態 axe 掃描；也測鍵盤、勾選重整、版本更新、保存失敗、API 離線與 320px／文字兩倍 reflow。`playwright-report/index.html` 有各情境 axe JSON（包括 incomplete，不把它當成通過證據），`test-results/results.json` 有機器可讀結果。

請接著閱讀 [無障礙／Freego／輔助科技手測](ACCESSIBILITY.md) 與 [本次實測與限制](TEST-REPORT.md)。
