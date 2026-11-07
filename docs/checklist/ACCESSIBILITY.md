# 無障礙驗證操作

檢測基準為使用者指定的臺灣「網站無障礙規範 110.07」AA，另參照 [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/)。[數發部下載專區](https://accessibility.moda.gov.tw/Download) 提供適用 110.07 的 Freego。Axe 自動檢查、Freego 機器檢查與人工輔助科技操作是不同證據，任一單項通過都不能代表取得 AA 標章。

## 自動檢測

Repo 根目錄執行：

```text
npm ci
npx playwright install chromium
npm run test:a11y
npx playwright show-report
```

`@axe-core/playwright` 使用 `wcag2a`、`wcag2aa`、`wcag21a`、`wcag21aa`、`wcag22aa` 與 `best-practice` 標籤，不停用規則、不排除頁面區域。每次掃描保存 violations、incomplete 與通過規則 ID。任何 violation 都使測試失敗；incomplete 必須看報告逐項判斷。手機 Chromium 模擬尺寸不等同真實 Android TalkBack 或 iOS VoiceOver。

涵蓋首頁、搜尋結果、未答條件、委託／境外條件、保存後清單、法定代理人、無結果、320px 加文字兩倍、API 錯誤、儲存失敗。其他行為檢查包括鍵盤 skip link、checkbox Space 操作、返回、勾選／條件重新整理、清單改版與本機業務快取。

### Freego 標題結構 HM1130100C

[官方檢測碼 HM1130100C](https://accessibility.moda.gov.tw/Download/Detail/1506?Category=63) 對應 A 級 1.3.1／H42，需以適當的 h1–h6 表達標題結構。本專案各頁採一個 h1，主要區塊 h2、區塊內的業務／文件所屬人 h3，不向下跳級。

已修正兩個可重現缺口：初始 HTML 原本只有空的 React root；業務資料載入中原本也沒有 h1。現在初始 HTML 有可見主標題、功能說明、未啟用 JavaScript 的提示及官方聯絡管道；React 啟動後會替換這些內容，不會保留重複的 h1。資料載入中亦提供主標題。

`checklist-web/e2e/headings.spec.ts` 額外檢查停用 JavaScript、資料載入中、首頁、搜尋、兩個業務的本人／委託模式及錯誤頁：h1 恰有一個、標題非空、h1–h6 不向下跳級。只讀初始 HTML 的工具無法測到完整條件清單，Freego 仍須確認 JavaScript 渲染與動態狀態，並重新執行單頁檢測；這些瀏覽器測試不代表 Freego GUI 已通過。

## Freego Dec 19 2025

本機已讀取 `C:\MODA\Freego\freego.exe` 的 ProductVersion：`freegodec192025`，並讀取附帶 `faq.html` 操作說明。**這只確認安裝與操作方式；本次沒有透過 GUI 執行 Freego 檢測或上傳報告。** 以下由人工操作，完成後將結果填入實測紀錄。

1. 啟動 API 與 Web，先用一般瀏覽器確認頁面出現「辦事帶什麼」、業務列表及清單。正式驗收使用測試環境 HTTPS，並保留 build／commit／資料快照版本。
2. 開啟 Freego（本機預設 `C:\MODA\Freego\freego.exe`），「檔案 → 新增」（Ctrl+N）。輸入完整網址，不使用 `file://`。
3. 「設定 → 設定檢測等級」選 **AA**（工具預設為 A，務必修改）。「設定網頁等待時間」先設 10 秒，依實際載入調整，最多 30 秒。選擇本機可用且 Driver 對應的 Chrome 或 Firefox；若出現版本不符，依[官方 Freego FAQ](https://accessibility.moda.gov.tw/Questions/Category/20/1)處理。
4. 檢查此版本的 JavaScript 選項並啟用動態渲染；若選項未提供，以瀏覽器預覽確認工具確實檢查渲染後內容。不能把只有 `<div id="root">` 的空殼判為成功檢測。
5. 先以「單一網頁」檢查三個實際路徑：

   ```text
   http://localhost:5173/
   http://localhost:5173/services/seal-certificate
   http://localhost:5173/services/marriage-divorce-certificate
   ```

6. 再以「全網站」掃描首頁可探索的連結。SPA 的搜尋與條件狀態不會產生新 URL，全站掃描不會自動涵蓋這些狀態；在預覽瀏覽器手動搜尋「印鑑」、選「委託他人 → 國外」、選「法定代理人 → 多位代理人」，以及英文證明分支，逐一執行單頁重新檢測。若工具重新載入使條件重置，先在同一瀏覽器完成保存並確認重載後狀態；不能以人工選過卻未被掃描的狀態冒充通過。
7. 查看 NO／逾時項目，開啟「修正工具」（Alt+T）核對檢測碼與實際 DOM。依 A／AA 規則修正，重新檢測，不以排除檔案／網頁掩蓋問題。
8. Ctrl+S 保留 `.cat` 專案；「報告 → 單一網頁檢測報告」（Alt+5）及「全網站檢測報告」（Alt+6）匯出結果。記錄工具版本、瀏覽器與 Driver、受測 URL、日期、內容版本、各動態狀態及未完成項目。
9. 標章申請的正式報告上傳是另一步驟；本次未執行「上傳檢測結果」。正式申請請依主管機關規定辦理。

## 必須人工驗證的清單

以下是驗收待辦，未勾選代表未完成人工驗證。

| 待驗項目 | 方法與預期結果 | 參考準則 |
| --- | --- | --- |
| [ ] 結構與閱讀順序 | 頁面語言正體中文；landmark、h1/h2/h3 與 fieldset／legend 可理解；視覺與朗讀順序一致 | 1.3.1、1.3.2、3.1.1 |
| [ ] 所有互動名稱 | 搜尋框 label、辦理方式、問題、勾選名稱及狀態可辨識；正／影本與所屬人不混淆；名稱包含可見文字 | 2.5.3、3.3.2、4.1.2 |
| [ ] 完整鍵盤 | Tab／Shift+Tab、Enter、Space、radio 方向鍵均可用；skip link 移至 main；無陷阱、不使用正 tabIndex | 2.1.1、2.1.2、2.4.3 |
| [ ] 焦點 | 新業務標題取得焦點，條件更新時留在所選問題；返回後有合理位置；焦點清晰且未被鍵盤、App bar 遮住 | 2.4.7、WCAG 2.2 2.4.11 |
| [ ] 動態通知 | 搜尋結果數量、清單變更、已備妥項數透過 polite status 讀出；儲存失敗 alert 可聽到；不反覆插話 | 4.1.3 |
| [ ] 條件理解 | 「不確定」仍讀到視情況文件；切到國外能理解新增驗證、移除其他分支；擇一群組不能誤認全部要帶 | 1.3.1、3.3.2、4.1.3 |
| [ ] 對比 | 一般文字至少 4.5:1，大字至少 3:1；邊框、radio、checkbox、進度、焦點至少 3:1；不能只靠顏色 | 1.4.1、1.4.3、1.4.11 |
| [ ] 縮放／reflow | 瀏覽器 200% 文字、400% zoom／320 CSS px、系統最大字級均無截字或操作重疊；無雙向捲動 | 1.4.4、1.4.10 |
| [ ] 文字間距 | line-height 1.5、段後 2em、letter-spacing .12em、word-spacing .16em 時仍完整可操作 | 1.4.12 |
| [ ] 高齡觸控 | 主要 button／整個 radio 和 checkbox label 可點，至少約 48 CSS px 高；單手可操作、不需精準手勢 | WCAG 2.2 2.5.8（最低 24px，本介面採更大目標） |
| [ ] 保存與失敗 | 重開／換辦理方式保存正確；清除即生效；無儲存權限有提示；跨 App／瀏覽器儲存隔離有明確告知 | 3.3.1、4.1.3 |
| [ ] 官方文件 | PDF 在外部開啟前有提示；核對內容、頁碼、日期與來源有效性；外部 PDF 可及性另行評估 | 2.4.4、3.2.2 |
| [ ] 橫直向／高對比 | Android 與 iOS 旋轉、高對比／forced colors、減少動態設定可用；不限制單一方向 | 1.3.4、1.4.11 |

需測的文字間距可在瀏覽器開發工具加入下列樣式，測完移除：

```css
* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
p { margin-bottom: 2em !important; }
```

## Android TalkBack

1. 使用實體 Android 手機，記錄機型、系統、Android System WebView／Chrome、TalkBack 與 App 版本；在「設定 → 無障礙 → TalkBack」啟用。模擬器的無障礙樹不能替代語音操作。
2. 從 TownPass「服務」找到「城市生活，辦事帶什麼」，左右滑確認名稱與 button 語意，雙擊進入。App bar 返回與 Web 主內容之間不應有焦點陷阱。
3. 透過標題／控制項導覽找到搜尋框，輸入「印鑑」。確認聽到結果數，進入印鑑證明後讀到標題、承辦機關、查證日期。
4. 選「委託他人」，確認 radio 群組、已選狀態；依序選「不確定 → 國外 → 臺灣」。焦點應留在題目選項，同時聽到清單更新通知；文件的受託人／當事人所屬、正／影本、視情況說明均可辨識。
5. 讀到擇一群組、勾選受委任人身分證明、聽到已備妥數量，重開頁面確認恢復。再選法定代理人，測「多位代理人」是／否分支。
6. 使用系統返回手勢：先回網頁首頁，再回 TownPass；開啟官方 PDF 後回 App，原勾選應保留。
7. 開啟最大字級／顯示縮放，測旋轉與螢幕鍵盤收起後的焦點；記錄朗讀原文與預期差異。完成後還原個人的輔助科技設定。

## iOS VoiceOver

1. 在實體 iPhone「設定 → 輔助使用 → VoiceOver」啟用，記錄 iOS、裝置、App／Safari 版本。先在 Safari 的 HTTPS 網站，再在 TownPass WKWebView 各跑一輪。
2. Rotor 以標題／表單控制項／連結導覽；確認 main、搜尋 label、h1、題目 legend 與清單區標題可理解，且原生 App bar 與 WebView 邊界可進出。
3. 搜尋、雙擊開啟業務、切本人／委託／法定代理人；選條件時讀到 radio 選取狀態與 polite 清單更新，不能整頁跳回頂端或把焦點丟掉。
4. 逐項檢查「本人／受託人」文件所屬、影本、規費、擇一／不確定項目。勾選後聽到狀態和進度，退出再進仍保留。
5. 開官方 PDF、返回 App，測原生返回及 Web history；測最大文字、縮放、橫向、螢幕鍵盤。Safari 與 App 儲存不共用，預期各自保存。
6. 記錄實際朗讀、焦點位置、可重現操作和截圖；未實測前不得填寫通過。

## Flutter WebView 測試

1. 依 [README](README.md) 配置 Web URL；Android Emulator 用 `10.0.2.2`，真機／iOS 用受信任 HTTPS。API 建議同源，避免 mixed content。
2. 從原本服務頁點城市生活；依序搜尋、切模式、答條件、勾選、返回、重開；測載入失敗與重試。確保其他原有服務仍能打開。
3. Debug 可透過 `chrome://inspect/#devices` 檢查 Android WebView。Console 執行 `typeof window.flutterObject`，預期 `undefined`；本入口不注入 TownPass 帳號 Bridge。release 不開啟 `isInspectable`。
4. 測外部 `target=_blank` 的官方 PDF、電話連結；應開外部 App，網頁位置與勾選保留。`javascript:`／`file:`／`intent:` 及跨來源內嵌應被取消；不可忽略 TLS 錯誤。
5. 模擬器系統返回先走 Web history，到首頁再離開原生容器。逐次檢查，不只測 HTML 的「回到搜尋」。
6. 測 HTTPS redirect、有效／無效憑證、真機網路切換、CORS 拒絕、App 前後景切換與系統文字放大。正式 HTTPS、iOS 和輔助科技仍需專機驗收。

## 尚未符合或尚無證據的項目

目前未宣告完整 AA 合規，也未取得標章。尚缺 Freego 實際結果、TalkBack／VoiceOver 語音與焦點驗收、iOS WKWebView 與正式 HTTPS 憑證測試、完整文字間距／高對比／最大系統字級人工測試。Axe 對裝飾箭頭可能回報 color-contrast incomplete（非文字），應人工確認，不能當成已通過的對比證據。

官方外連 PDF 由發布機關提供，未驗證其標籤結構／閱讀順序；如有障礙，應由內容主管機關提供可及 HTML 或修復 PDF。本機保存不支援跨裝置同步，離線只保留已載入的業務定義，不是完整可離線啟動的 PWA。未來接 iSSO 時要另外驗證無障礙驗證流程和最小權限 Bridge。

建議發布前由熟悉 TalkBack／VoiceOver 的使用者跑完整情境，逐項關閉上述待辦，將 Freego `.cat`／匯出報告、axe JSON、實機影片與操作紀錄一起留存。
