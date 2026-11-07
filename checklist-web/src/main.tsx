import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  resolve,
  type Answers,
  type ServiceSnapshot,
  type ResolvedItem,
  type ResolvedGroup,
} from "@townpass/checklist-shared";
import { readSaved, readStored, writeStored } from "./storage";
import "./style.css";

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
if (
  apiBase &&
  (!/^https?:\/\//.test(apiBase) ||
    (location.protocol === "https:" && !apiBase.startsWith("https://")))
)
  throw new Error("API URL 必須使用 HTTPS（本機 HTTP 開發除外）");
async function api<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    signal,
    credentials: "omit",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok)
    throw new Error(
      response.status === 410
        ? "此業務已下架，請洽承辦機關。"
        : `資料暫時無法取得（${response.status}），請稍後重試。`,
    );
  return response.json() as Promise<T>;
}
type Summary = Pick<
  ServiceSnapshot,
  "slug" | "title" | "agency" | "summary" | "category"
>;
// shortcut: Hours cover the current agencies; update from official announcements when agencies or schedules change.
const agencyHours: Record<string, { hours: string; url: string }> = {
  臺北市各區戶政事務所: {
    hours: "週一至週五 08:30–17:30，中午持續服務；夜間、週末及國定假日不提供服務。",
    url: "https://xyhr.gov.taipei/",
  },
  中華郵政股份有限公司: {
    hours: "各郵局儲匯窗口營業時間不同，請依欲前往的據點查詢；部分儲匯業務假日不提供服務。",
    url: "https://www.post.gov.tw/post/internet/I_location/index.jsp?ID=1901",
  },
  "交通部公路局各區監理所（站）": {
    hours: "臺北市區監理所：週一至週五 08:30–17:30。",
    url: "https://tpcmv.thb.gov.tw/cp.aspx?n=9319",
  },
};
function App() {
  const [path, setPath] = useState(location.pathname);
  const [routeError, setRouteError] = useState("");
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(path);
  const navigate = (href: string) => {
    history.pushState({}, "", href);
    setPath(location.pathname);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    if (path === "/") document.getElementById("home-title")?.focus();
    else mainHeading.current?.focus();
  }, [path]);
  const slug = /^\/services\/([a-z0-9-]+)\/?$/.exec(path)?.[1];
  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <header className="site-header">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            北
          </span>
          <span>
            台北通{" "}
            <span lang="en" className="brand-en">
              Town Pass
            </span>
          </span>
        </a>
        <span className="service-label">城市生活</span>
      </header>
      <main id="main" tabIndex={-1}>
        {path === "/" ? (
          <Home navigate={navigate} />
        ) : slug ? (
          <ServicePage
            key={slug}
            slug={slug}
            navigate={navigate}
            headingRef={mainHeading}
            reportError={setRouteError}
          />
        ) : (
          <>
            <h1>找不到這個頁面</h1>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              回到首頁
            </a>
          </>
        )}
        {routeError && <p role="alert">{routeError}</p>}
      </main>
      <footer className="site-footer">
        <p>文件以承辦機關規定為準；條件與勾選僅存於此裝置。</p>
        <a href="tel:1999">需要協助？撥打 1999</a>
      </footer>
    </>
  );
}
function Home({ navigate }: { navigate: (href: string) => void }) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    document.title = "辦事帶什麼｜台北通";
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 150);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!term && !showAll) {
      setItems([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    const request = term
      ? api<{ items: Summary[] }>("/v1/search", controller.signal, { q: term })
      : api<{ items: Summary[] }>("/v1/services", controller.signal);
    request
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems(data.items);
        if (!term) writeStored("services", data.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError("目前無法連線，請重新載入，或撥打 1999 詢問。");
          setItems(!term ? readStored<Summary[]>("services", []) : []);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [term, showAll, retry]);
  const open = (event: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      navigate(`/services/${slug}`);
    }
  };
  const showResults = Boolean(query.trim()) || showAll;
  const pending = loading || query.trim() !== term;
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <h1 id="home-title" tabIndex={-1}>
          辦事帶什麼?
        </h1>
        <div role="search">
          <label className="sr-only" htmlFor="search">想辦什麼業務？</label>
          <input
            id="search"
            type="search"
            maxLength={30}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAll(false);
            }}
            placeholder="例如：印鑑、郵局、駕照"
            aria-describedby="search-help"
            autoComplete="off"
          />
          <p id="search-help" className="hint">
            {/* 輸入業務名稱，即時查看清單。請勿填寫個人資料。 */}
          </p>
        </div>
      </section>
      <p className={showResults ? "hint" : "sr-only"} role="status" aria-live="polite" aria-atomic="true">
        {showResults
          ? pending
            ? "正在搜尋…"
            : error
              ? ""
              : term
                ? `找到 ${items.length} 項業務`
                : `目前提供 ${items.length} 項業務`
          : ""}
      </p>
      {showResults && (
        <section aria-labelledby="results-heading" aria-busy={pending}>
          <h2 className="sr-only" id="results-heading" tabIndex={-1}>
            {showAll ? "所有業務" : "搜尋結果"}
          </h2>
          {!pending && error && (
            <div role="alert" className="notice">
              <p>{error}</p>
              <button onClick={() => setRetry((n) => n + 1)}>重新載入</button>
            </div>
          )}
          {!pending && !error && term && items.length === 0 && (
            <div className="notice">
              <h3>還沒找到想辦的業務？</h3>
              <p>試試「印鑑」、「郵局」或「駕照」，也可向相關承辦機關詢問。</p>
              <button
                onClick={() => {
                  setQuery("");
                  setTerm("");
                  setShowAll(true);
                  document.getElementById("results-heading")?.focus();
                }}
              >
                查看所有業務
              </button>
            </div>
          )}
          {!pending && (
            <ul className="service-cards">
              {items.map((item) => (
                <li key={item.slug}>
                  <a
                    className="service-link"
                    href={`/services/${item.slug}`}
                    onClick={(e) => open(e, item.slug)}
                  >
                    <div>
                      <h3>{item.title}</h3>
                      <p className="hint">{item.summary}</p>
                    </div>
                    <span className="chevron" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
function ServicePage({
  slug,
  navigate,
  headingRef,
  reportError,
}: {
  slug: string;
  navigate: (href: string) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  reportError: (message: string) => void;
}) {
  const [service, setService] = useState<ServiceSnapshot>();
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setOffline(false);
    reportError("");
    api<{ service: ServiceSnapshot }>(`/v1/services/${slug}`, controller.signal)
      .then((data) => {
        setService(data.service);
        writeStored(`cache:${slug}`, data.service);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          const cached = readStored<ServiceSnapshot | null>(
            `cache:${slug}`,
            null,
          );
          if (cached && !String(e.message).includes("下架")) {
            setService(cached);
            setOffline(true);
          } else setError(e.message);
        }
      });
    return () => controller.abort();
  }, [slug, retry, reportError]);
  useEffect(() => {
    if (service) {
      document.title = `${service.title}準備清單｜辦事帶什麼`;
      headingRef.current?.focus();
    }
  }, [service, headingRef]);
  return (
    <>
      <nav aria-label="頁面導覽">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          ← 回到業務搜尋
        </a>
      </nav>
      {!service && !error && (
        <>
          <h1>辦事準備清單</h1>
          <p role="status">正在載入準備清單…</p>
        </>
      )}
      {error && (
        <div role="alert" className="notice">
          <h1>無法載入業務</h1>
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>重試</button>
        </div>
      )}
      {service && (
        <>
          <div className="detail-header">
            <p className="eyebrow">{service.category}服務 · 行前準備</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {service.title}
            </h1>
            {/* <p>{service.summary}</p> */}
            <dl className="service-meta">
              <div>
                <dt>承辦機關</dt>
                <dd>{service.agency}</dd>
              </div>
              <div>
                <dt>營業時間</dt>
                <dd>
                  {agencyHours[service.agency]?.hours ?? "請洽承辦機關確認服務時間。"}
                  {/* {agencyHours[service.agency] && (
                    <a
                      className="hours-link"
                      href={agencyHours[service.agency].url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查詢官方服務時間（另開視窗）
                    </a>
                  )} */}
                </dd>
              </div>
            </dl>
          </div>
          {offline && (
            <div role="status" className="notice warning">
              <p>
                目前無法連線，顯示本機保留版本（查證 {service.verifiedAt}
                ）。勾選仍可使用；出發前請重新連線確認規定。
              </p>
              <button onClick={() => setRetry((n) => n + 1)}>重新連線</button>
            </div>
          )}
          <ChecklistView
            key={`${service.slug}:${service.revisionId}`}
            service={service}
          />
          <section
            id="sources"
            aria-labelledby="sources-title"
            className="sources"
          >
            <h2 id="sources-title">官方來源與日期</h2>
            {service.sources.map((source) => (
              <div key={source.id}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}（另開視窗）
                </a>
                <p>{source.clause}</p>
                <p>
                  官方修訂：
                  <time dateTime={source.updatedAt}>{source.updatedAt}</time> ·
                  最後查證：
                  <time dateTime={source.verifiedAt}>{source.verifiedAt}</time>
                </p>
              </div>
            ))}
            <p>
              實際應備文件以承辦機關現場規定為準。資料有疑問，請聯絡{service.agency}，並參閱上述官方說明。
            </p>
          </section>
        </>
      )}
    </>
  );
}
function ChecklistView({ service }: { service: ServiceSnapshot }) {
  const [announcement, announce] = useState("");
  const [mode, setMode] = useState(() => {
    const stored = readStored<string>(`mode:${service.slug}`, "SELF");
    return service.modes.some((m) => m.code === stored) ? stored : "SELF";
  });
  return (
    <>
      <section className="panel" aria-labelledby="mode-title">
        <h2 id="mode-title">1. 選擇辦理方式</h2>
        <fieldset>
          <legend>誰要到現場辦理？</legend>
          <div className="choices">
            {service.modes.map((m) => (
              <label className="choice" key={m.code}>
                <input
                  type="radio"
                  name="mode"
                  value={m.code}
                  checked={mode === m.code}
                  onChange={() => {
                    setMode(m.code);
                    announce(
                      `已切換為${m.label}，請查看更新後的條件與準備清單。`,
                    );
                    writeStored(`mode:${service.slug}`, m.code);
                  }}
                />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <p role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <ChecklistPanel
        key={mode}
        service={service}
        mode={mode}
        announce={announce}
      />
    </>
  );
}
const forms = {
  ORIGINAL: "正本",
  COPY: "影本",
  ORIGINAL_AND_COPY: "正本及影本",
  ELECTRONIC: "電子檔",
  NA: "",
};
function ChecklistPanel({
  service,
  mode,
  announce,
}: {
  service: ServiceSnapshot;
  mode: string;
  announce: (message: string) => void;
}) {
  const [saved] = useState(() => readSaved(service, mode));
  const [answers, setAnswers] = useState<Answers>(saved.answers);
  const [checked, setChecked] = useState(saved.checkedKeys);
  const [storageOk, setStorageOk] = useState(true);
  const [shareMessage, setShareMessage] = useState("");
  const result = resolve(service, mode, answers);
  const updated = saved.revisionNo !== service.revisionNo;
  const changed = service.items.filter(
    (i) => !saved.itemKeys.includes(i.key),
  ).length;
  const removed = saved.itemKeys.filter(
    (key) => !service.items.some((i) => i.key === key),
  ).length;
  const entries = result.sections.flatMap((s) => s.entries);
  const allItems = entries.flatMap((entry) =>
    "items" in entry ? entry.items : [entry],
  );
  const completed = entries.filter((entry) =>
    "items" in entry
      ? entry.items.filter((i) => checked.includes(i.key)).length >=
        (entry.rule === "ONE_OF"
          ? 1
          : entry.rule === "AT_LEAST_N"
            ? entry.minCount!
            : entry.items.length)
      : checked.includes(entry.key),
  ).length;
  const conditional = allItems.filter((i) => i.status === "CONDITIONAL").length;
  const allChecked = entries.length > 0 && completed === entries.length;
  const ready =
    allChecked &&
    result.eligibility === "TRUE" &&
    result.pendingQuestions.length === 0;
  const progressSummary =
    result.eligibility === "FALSE"
      ? `此方式不可辦理：${result.mode.disallowedReason ?? "請改選其他辦理方式"}`
      : `清單已更新：共 ${entries.length} 項，已備妥 ${completed} 項${conditional ? `；${conditional} 份文件或程序視情況需要` : ""}。${storageOk ? "" : "目前無法保存。"}`;
  useEffect(() => {
    setStorageOk(
      writeStored(`${service.slug}:${mode}`, {
        revisionNo: service.revisionNo,
        answers: result.answers,
        checkedKeys: checked,
        itemKeys: service.items.map((i) => i.key),
      }),
    );
  }, [service, mode, answers, checked]);
  const setAnswer = (code: string, value: string) => {
    const next = { ...result.answers };
    next[code] = value === "true" ? true : value === "false" ? false : value;
    const updatedResult = resolve(service, mode, next);
    const after = updatedResult.sections.flatMap((s) =>
      s.entries.flatMap((e) => ("items" in e ? e.items : [e])),
    );
    const added = after
      .filter((i) => !allItems.some((before) => before.key === i.key))
      .map((i) => i.title);
    const removed = allItems
      .filter((i) => !after.some((now) => now.key === i.key))
      .map((i) => i.title);
    const confirmed = after
      .filter(
        (i) =>
          i.status === "REQUIRED" &&
          allItems.some(
            (before) => before.key === i.key && before.status === "CONDITIONAL",
          ),
      )
      .map((i) => i.title);
    announce(
      [
        "已依所選條件更新清單。",
        added.length ? `新增：${added.join("、")}。` : "",
        removed.length ? `不再需要：${removed.join("、")}。` : "",
        confirmed.length ? `已確認必備：${confirmed.join("、")}。` : "",
        `仍有 ${after.filter((i) => i.status === "CONDITIONAL").length} 份文件或程序視情況需要。`,
      ].join(""),
    );
    setAnswers(updatedResult.answers);
  };
  const toggle = (key: string) => {
    announce(
      `${checked.includes(key) ? "取消備妥" : "已備妥"}：${service.items.find((i) => i.key === key)?.title}。準備進度已更新。`,
    );
    setChecked((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
  };
  const share = async () => {
    const url = new URL(`/services/${service.slug}`, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("已複製業務連結。連結不包含條件答案或勾選狀態。");
    } catch {
      setShareMessage(`請複製此業務連結：${url}`);
    }
  };
  const renderItem = (item: ResolvedItem) => (
    <li
      key={item.key}
      className={`check-item ${checked.includes(item.key) ? "is-checked" : ""}`}
    >
      <label htmlFor={`item-${item.key}`} className="check-label">
        <input
          id={`item-${item.key}`}
          type="checkbox"
          checked={checked.includes(item.key)}
          onChange={() => toggle(item.key)}
          aria-describedby={`note-${item.key}`}
        />
        <span>
          <span className="item-title">{item.title}</span>
          <span className="item-meta">
            {forms[item.form]}
            {forms[item.form] ? " · " : ""}
            {item.kind === "FEE"
              ? `新臺幣 ${item.amountTwd} 元／${item.unit}`
              : `${item.quantity} ${item.kind === "DOCUMENT" ? "份" : "項"}`}
          </span>
          {item.status === "CONDITIONAL" && (
            <span className="conditional">視情況需要</span>
          )}
        </span>
      </label>
      <div id={`note-${item.key}`} className="item-note">
        {item.note && <p>{item.note}</p>}
        {item.status === "CONDITIONAL" && (
          <p>條件尚未確定，請先保留此項並向承辦機關確認。</p>
        )}
        <a
          href={`${service.sources.find((s) => item.sourceIds.includes(s.id))!.url}${service.slug === "seal-certificate" ? "#page=41" : service.slug === "marriage-divorce-certificate" ? "#page=43" : ""}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          官方依據（另開視窗）
        </a>
        {item.templateUrl && (
          <a href={item.templateUrl} target="_blank" rel="noopener noreferrer">
            下載{item.title}書表（另開視窗）
          </a>
        )}
      </div>
    </li>
  );
  const renderEntry = (entry: ResolvedItem | ResolvedGroup) =>
    "items" in entry ? (
      <li key={entry.id} className="requirement-group">
        <fieldset>
          <legend>
            {entry.label}（
            {entry.rule === "ONE_OF"
              ? "擇一"
              : entry.rule === "ALL_OF"
                ? "全部備妥"
                : `至少 ${entry.minCount} 項`}
            ）
          </legend>
          <ul>{entry.items.map(renderItem)}</ul>
        </fieldset>
      </li>
    ) : (
      renderItem(entry)
    );
  return (
    <>
      {updated && (
        <p role="status" className="notice warning">
          規定已更新至第 {service.revisionNo} 版，新增 {changed} 項、移除{" "}
          {removed} 項；已保留仍存在項目的勾選，請重新核對。
        </p>
      )}
      {!storageOk && (
        <p role="alert" className="notice warning">
          瀏覽器無法保存資料。此頁仍可勾選，關閉後可能遺失，請檢查儲存空間或隱私模式設定。
        </p>
      )}
      <section className="panel" aria-labelledby="questions-title">
        <h2 id="questions-title">2. 確認你的條件</h2>
        {result.questions.length ? (
          result.questions.map((q) => (
            <fieldset key={q.code} className="question">
              <legend>{q.prompt}</legend>
              {q.helpText && (
                <p id={`help-${q.code}`} className="hint">
                  {q.helpText}
                </p>
              )}
              <div
                className="choices"
                aria-describedby={q.helpText ? `help-${q.code}` : undefined}
              >
                {(q.type === "BOOLEAN"
                  ? [
                      { value: "true", label: "是" },
                      { value: "false", label: "否" },
                    ]
                  : q.options!
                ).map((option) => (
                  <label className="choice" key={option.value}>
                    <input
                      type="radio"
                      name={q.code}
                      checked={
                        result.answers[q.code] !== undefined &&
                        String(result.answers[q.code]) === option.value
                      }
                      onChange={() => setAnswer(q.code, option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))
        ) : (
          <p>此辦理方式無需額外條件。</p>
        )}
      </section>
      <section className="panel checklist" aria-labelledby="checklist-title">
        <div className="section-heading">
          <h2 id="checklist-title">3. 準備清單</h2>
          <span className="pill">{result.mode.label}</span>
        </div>
        <p className="progress-text">{progressSummary}</p>
        <progress
          max={Math.max(1, entries.length)}
          value={completed}
          aria-label={`準備進度：已備妥 ${completed} 項，共 ${entries.length} 項`}
        />
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={ready ? "notice completion-notice" : undefined}
        >
          {ready ? (
            <>
              <h3>
                <span aria-hidden="true">✓ </span>材料已準備完成！
              </h3>
              <p>清單所需項目已全部備妥，出發前請再確認承辦機關的營業時間。</p>
            </>
          ) : allChecked && result.eligibility !== "FALSE" ? (
            <p className="notice warning">勾選已完成，請先確認尚未確定的條件，才能確認材料已備妥。</p>
          ) : null}
        </div>
        {result.eligibility === "UNKNOWN" && (
          <p className="notice warning">
            請先回答相關條件，以確認能否由此方式辦理。下列清單仍保留可確定的項目。
          </p>
        )}
        {result.sections.map((section) => (
          <section
            key={section.party}
            className="party-section"
            aria-labelledby={`party-${section.party}`}
          >
            <h3 id={`party-${section.party}`}>{section.label}</h3>
            <ul className="checklist-items">
              {section.entries.map(renderEntry)}
            </ul>
          </section>
        ))}
        {entries.length > 0 && (
          <div className={`checklist-progress-bottom${ready ? " notice completion-notice" : ""}`}>
            <p className="progress-text">{progressSummary}</p>
            <progress
              max={Math.max(1, entries.length)}
              value={completed}
              aria-label={`準備進度：已備妥 ${completed} 項，共 ${entries.length} 項`}
            />
            {ready && <p><strong>✓ 材料已準備完成！</strong></p>}
          </div>
        )}
        <div className="actions">
          <button className="secondary" onClick={share}>
            複製業務連結
          </button>
          <button className="secondary" onClick={() => window.print()}>
            列印清單
          </button>
          <button
            className="secondary"
            onClick={() => {
              setChecked([]);
              setAnswers({});
              announce(
                "已清除此辦理方式的勾選與條件，尚未確定的文件已保留在清單。",
              );
            }}
          >
            清除本辦理方式的勾選與條件
          </button>
        </div>
        <p role="status" aria-live="polite">
          {shareMessage}
        </p>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
