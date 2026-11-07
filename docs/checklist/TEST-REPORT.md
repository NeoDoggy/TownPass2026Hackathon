# 本次實測紀錄

執行日期：2026-11-07（Asia/Taipei）。本文件列出實際執行的檢查及未完成項目，不代表正式 AA 認證。

## 已執行

### 首頁即時搜尋極簡化補測

首頁移除預設業務列表與搜尋按鈕，保留標題及單一輸入框；輸入後以既有 150ms debounce 顯示符合的卡片，清空時隱藏。只有輸入文字且查無結果才提供「查看所有業務」，展開後可重新輸入縮小範圍。移除最近看過的顯示與寫入，保留業務定義的離線快取及清單勾選保存。頁尾縮成文件規定／本機保存提醒與 1999 協助連結。

`npm.cmd run build` 通過，`npm.cmd run test:a11y` 共 20 個桌面／手機 Chromium 情境通過；28 次完整頁面 axe 掃描為 0 violations、0 incomplete。涵蓋空白／純空白輸入、即時結果與焦點、清空、鍵盤進入業務、最近使用不再寫入、無結果展開全部九項、重新搜尋、載入中隱藏舊卡片、失敗時不顯示全部入口及重試；320px 加 225% 根字級與文字間距設定下的首頁、搜尋結果及全部業務均無橫向溢出。已檢視桌面／手機首頁截圖。

本次未執行 Freego GUI、TalkBack／VoiceOver 或 Flutter 真機測試；上述自動檢查不代表正式 AA 驗證通過。

### 首頁簡化補測

首頁改為搜尋與分類業務入口，依現有分類顯示戶政、監理、郵局儲匯；移除重複的步驟文案、機關名稱、卡片操作文字及宣傳說明。一般瀏覽僅列業務名稱，搜尋結果保留摘要；完整資訊與官方來源仍在業務頁。沿用 18px 基準文字、高對比配色、可見鍵盤焦點與原生連結，業務入口至少 64px 高，窄螢幕及文字放大時自動改為直向排列。沒有新增套件。

`npm.cmd run build` 通過。`npm.cmd run test:a11y` 的桌面／手機 Chromium 共 18 個情境通過，24 次完整頁面 axe 掃描為 0 violations、0 incomplete。新增情境涵蓋三類九項業務、點擊高度、鍵盤開啟與返回、最近看過、搜尋送出焦點，以及 320px 加 225% 根字級及文字間距設定下的首頁／搜尋結果，兩者均無橫向溢出。原有條件、勾選保存、錯誤及離線快取情境亦通過；已檢視兩種尺寸的首頁截圖。

本次未重跑資料庫／Flutter 測試，也未執行 Freego GUI、TalkBack／VoiceOver 或跨年齡使用者實測；上述結果不能代表取得 Freego AA 通過報告或正式 AA 認證。依 [無障礙文件](ACCESSIBILITY.md) 進行 Freego 與實機人工驗收。

### 郵局與監理資料擴充補測

資料由 2 項擴充至 9 項：戶政 2 項、郵局儲匯 4 項、監理 3 項。新增內容逐項核對中華郵政、公路局官方頁面，保存來源日期及附 SHA256 的核對摘錄；摘錄重播保留人工查證日，詳見 [來源與涵蓋範圍](README.md#官方-import--seed--publish)。

已重新執行 `data:import`、migration、seed 與 publish，產生快照 `1794063327118`（9 項，SHA256 `ddc75537143502c50392af1060859380552dd1c86330312edb503a92387cac41`）。既有兩項戶政修訂保留，七項新業務各建立 revision 1。資料庫測試核對每項機關／分類外鍵與業務內容一致。

`npm.cmd run build` 通過；`npm.cmd test` 23 個測試通過，0 skipped，包含本機 PostgreSQL 不可變測試、新來源主機限制與摘錄完整性、郵局第二證件／更名分支、遺失存簿不要求舊簿、更印不要求舊印鑑、駕照代辦／職業審驗、國際駕照照片／護照／地址分支，以及行照保險不足阻擋及汽機車規費分流。本次未修改 Flutter，也未重跑 Flutter 真機或 Freego GUI 驗證。

桌面／手機 Chromium 的 14 個既有情境通過；新增的 2 個資料情境以 `npm.cmd run test:a11y -- checklist-web/e2e/datasets.spec.ts` 補測通過，驗證郵局／監理搜尋、遺失存摺的清單、官方網頁連結、機車行照費用分流，以及保險不足時顯示原因並清空清單。既有測試已調整 9 項資料與搜尋命中數假設。重跑 seed／publish 後 9 項均沿用既有修訂、快照未增加；無新增套件。

### Freego 標題結構修正補測

針對使用者回報的 HM1130100C 類型訊息，新增標題回歸測試。修正前實際重現「JavaScript 停用時的初始 HTML」及「業務資料載入中」各缺少 h1；完整渲染頁面的標題順序檢查則通過。已在初始 HTML 補可見 h1、說明、noscript 提示與官方聯絡連結，並補上載入中 h1；React 啟動後替換初始內容，不產生重複主標題。

修正後 `npm.cmd run build` 通過，`npm.cmd run test:a11y` 共 14 個桌面／手機情境通過（原 8 個流程加 6 個標題測試）。20 次 axe 掃描仍為 0 violations，裝飾箭頭仍有 color-contrast incomplete。本次未執行 Freego GUI，且尚未取得該次 Freego 詳細受測網址／節點，不能宣稱已確認 Freego 報告中的同一節點通過；請依 [操作文件](ACCESSIBILITY.md#freego-標題結構-hm1130100c) 重跑單頁檢測。

以下為首次完整實作時的其他實測紀錄。

| 檢查 | 結果與範圍 |
| --- | --- |
| Repo／架構 PDF 檢查 | 已讀 33 頁架構內容、核心 DDL、規則與 API 定義；沿用 GetX 導覽、TownPass 色票、TPAppBar、TPInAppWebView |
| 官方資料 | 直接下載架構 PDF 引用的臺北市政府戶政時限表，解析 41–43 頁；已實際執行 `npm run data:import` 以 fetch 從官方 HTTPS 抓取。另重播本機下載檔案，結果一致 |
| 官方文件指紋 | 修訂 2026-10-07，查證 2026-11-07；SHA256 `d0e2a34c1d20eaa73c2756e9c6b7d0b40a4234d9d269dcee9489141fe0c39431` |
| PostgreSQL 16.15 | 本機獨立 localhost:55432 測試資料庫；migration 兩次、seed 多次、publish 多次。相同內容保留 2 個 revision，不建立重複快照 |
| 快照 | `1794055317370`，2 個業務；SHA256 `27b80b2620cd868cb1deb031fc64d0ec2c1f2fd565bba81d90e4cd7864e86e67`。查詢可不連 DB 載入 |
| `npm run build` | TypeScript 檢查與 Vite production build 通過 |
| `npm test` | 14 個測試通過，包含 PostgreSQL 不可變測試，0 skipped。涵蓋三值邏輯、清單所屬人與正影本、未知條件、法定代理人、隱藏答案清理、群組、去重、規則白名單與循環、搜尋、全部已答組合、API 同源限制／參數／錯誤／ETag／引擎一致性、損毀快照 |
| `npm run test:a11y` | 8 個桌面／手機 Chromium 流程通過；20 次完整頁面 axe 掃描，0 violations。包括首頁、搜尋、條件、清單與錯誤／放大等狀態 |
| Axe incomplete | 仍有 `color-contrast` 對裝飾箭頭「→」的非文字判定，需人工核對，不宣稱所有對比都已由機器證實。原本無角色 div 的 aria-label 已改為合法 group |
| Flutter 針對性測試 | `checklist_config_test.dart` 2 個、`checklist_entry_test.dart` 1 個通過；涵蓋 HTTPS、debug 本機 HTTP、禁止 credentials／query、精確 origin、城市生活路由 |
| Android debug APK | Flutter 3.47.9／Dart 3.13.7 建置成功並安裝至 emulator-5554（Android 17） |
| 實際 Flutter WebView | 由既有「城市生活」卡片進入；Web 業務列表 → 印鑑證明 → 委託 → 國外 → 勾選 → 重載，條件與勾選恢復。以 debug WebView CDP 連到實際 native WebView，不是桌面模擬 |
| Bridge | 實際 Android WebView Console 驗證 `typeof window.flutterObject === 'undefined'` |
| 系統返回 | 實際 `adb shell input keyevent 4`：清單先回網頁首頁，再按返回回原本 TownPass 服務頁 |
| 外部來源 | 官方 PDF 點擊後轉到外部 `com.android.chrome`，內嵌 URL 保持原清單。Chrome 停在 FirstRunActivity，未繼續接受其首次設定，PDF 完整呈現尚未確認 |
| npm production audit | `npm audit --omit=dev` 當次為 0 已知弱點；不等同滲透測試或 Flutter 依賴安全審核 |
| Freego 安裝 | 已讀本機執行檔 ProductVersion `freegodec192025` 及 FAQ，未執行 GUI 掃描 |

測試中曾發現並修正 seed SQL 欄位數、AJV 將字串答案自動轉布林、品牌連結可見文字／名稱不一致、320px 加倍文字時 header 及 checkbox 文字溢出。最終結果見上述實測，而非只憑程式碼推測。

最終 20 次掃描的可攜摘要保存在 [axe-summary.json](axe-summary.json)。Playwright HTML 報告位於 Repo 根目錄 `playwright-report/index.html`，JSON 為 `test-results/results.json`，均已忽略版控。報告附各次 axe violations／incomplete 明細。執行 `npx playwright show-report` 查看。Android 當次截圖與操作結果在忽略的 `.tools/`，不是正式輔助科技驗收紀錄。

## 全套 Flutter 測試的既有失敗

另執行 `flutter test --no-pub`：新增 3 個測試通過，但既有 `test/widget_test.dart` 的 `Counter increments smoke test` 失敗。該檔案期待原始 Flutter Counter 的 `0`／`Icons.add`，目前 TownPass 沒有 Counter，且未初始化 SharedPreferencesService，先產生 null-check 例外。未修改或跳過該測試來掩蓋失敗；也沒有宣稱整個 TownPass regression suite 通過。

建議另案用可初始化服務的 TownPass app-shell／底部分頁 smoke test 替代 Counter 範例。本次已針對實際新增入口提供獨立 widget 測試，並在模擬器確認回原服務頁。

## 未執行、限制與改善順序

1. **Freego GUI、Android TalkBack、iOS VoiceOver／WKWebView 尚未執行。** 按 [無障礙文件](ACCESSIBILITY.md) 完成人工檢測並留證，才能作 AA 驗收判斷。
2. **正式 HTTPS、Docker compose／Caddy 執行及公信憑證未在此環境驗證。** 已提供配置；本機無 Docker。Android 本次驗證的是嚴格限制 debug 主機的 HTTP。應在實際部署環境測 DNS、TLS、redirect、CORS、CSP、系統放大與有效／無效憑證；不得關閉 TLS 驗證。
3. **目前提供 9 個業務。** 尚非 PDF M0 的 20 項機關驗收資料集；內容依官方來源映射，未經各承辦機關正式審核。郵局特殊身分與公司行號行照等分支尚未涵蓋。新增網頁資料為人工查證摘錄，匯入不會自動重新查證線上頁面。
4. **iSSO／雲端保存、後台編輯／審核／排程、S3／Redis／K8s、SLO 壓測尚未實作。** 依使用者本次功能完成 M1 市民端與 CLI 發布，公開資料與私有條件分界保留，無虛構登入整合。
5. **本機保存與離線有範圍。** 無完整 PWA offline shell、跨裝置同步或伺服器個人檔案；只有已載入的業務定義和本機勾選，儲存可能被系統清除。
6. **舊 Bridge 信任來源未全域改寫。** 新入口停用 Bridge；其他舊服務依原行為保留。建議另案盤點信任域名後限制 `allowedOriginRules` 與 frame／origin，避免破壞原有服務。
7. **外部官方 PDF 可及性及顯示尚未完整檢測。** 需在已完成瀏覽器初始化的真機驗證，必要時請發布機關提供可及替代格式。
8. **CI workflow 已加入但未於遠端執行。** 本次結果來自本機實測；build 過程亦見既有 fluttertoast Kotlin Gradle Plugin 遷移警告，未更換原有 Flutter 套件。

目前不宣稱完整 AA 合規、正式上線、iOS 通過、原專案所有功能回歸通過或達成架構 PDF 的全部 M0–M4 里程碑。
