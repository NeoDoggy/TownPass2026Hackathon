export type Answer = boolean | string;
export type Answers = Record<string, Answer>;
export type Rule =
  boolean | string | number | null | Rule[] | { [operator: string]: Rule };
export type ModeCode = "SELF" | "DELEGATE" | "LEGAL_REP";
export interface SourceRef {
  id: string;
  url: string;
  title: string;
  clause: string;
  verifiedAt: string;
  updatedAt: string;
  sha256: string;
}
export interface Question {
  code: string;
  prompt: string;
  type: "BOOLEAN" | "ENUM";
  options?: { value: string; label: string }[];
  modes?: ModeCode[];
  visibleWhen?: Rule;
  helpText?: string;
}
export interface Mode {
  code: ModeCode;
  label: string;
  allowed: boolean;
  allowedWhen?: Rule;
  disallowedReason?: string;
}
export interface Item {
  key: string;
  kind: "DOCUMENT" | "ACTION" | "PERSON" | "FEE";
  title: string;
  documentCode?: string;
  party: string;
  modes: ModeCode[];
  form: "ORIGINAL" | "COPY" | "ORIGINAL_AND_COPY" | "ELECTRONIC" | "NA";
  quantity: number;
  condition?: Rule;
  groupId?: string;
  note?: string;
  amountTwd?: number;
  unit?: string;
  sourceIds: string[];
  templateUrl?: string;
}
export interface Group {
  id: string;
  label: string;
  rule: "ALL_OF" | "ONE_OF" | "AT_LEAST_N";
  minCount?: number;
}
export interface ServiceSnapshot {
  slug: string;
  title: string;
  summary: string;
  agency: string;
  category: string;
  keywords: string[];
  revisionNo: number;
  revisionId: string;
  verifiedAt: string;
  processingTime: string;
  handlingUnit: string;
  modes: Mode[];
  parties: { code: string; label: string }[];
  questions: Question[];
  items: Item[];
  groups: Group[];
  sources: SourceRef[];
  retired?: boolean;
}
export interface Snapshot {
  schemaVersion: 1;
  version: string;
  createdAt: string;
  services: ServiceSnapshot[];
}
export interface ResolvedItem extends Item {
  status: "REQUIRED" | "CONDITIONAL";
  dependsOn: string[];
}
export interface ResolvedGroup extends Group {
  items: ResolvedItem[];
}
export interface Checklist {
  mode: Mode;
  eligibility: "TRUE" | "FALSE" | "UNKNOWN";
  answers: Answers;
  questions: Question[];
  pendingQuestions: string[];
  sections: {
    party: string;
    label: string;
    entries: (ResolvedItem | ResolvedGroup)[];
  }[];
}

const own = (o: object, key: string) =>
  Object.prototype.hasOwnProperty.call(o, key);
const operators = new Set(["var", "==", "!=", "!", "and", "or", "in"]);
export function refs(rule: Rule | undefined): string[] {
  if (rule == null || typeof rule !== "object") return [];
  if (Array.isArray(rule)) return [...new Set(rule.flatMap(refs))];
  return [
    ...new Set(
      Object.entries(rule).flatMap(([op, args]) =>
        op === "var"
          ? [String(args)]
          : (Array.isArray(args) ? args : [args]).flatMap(refs),
      ),
    ),
  ];
}
function apply(rule: Rule, answers: Answers): unknown {
  if (rule === null || typeof rule !== "object") return rule;
  if (Array.isArray(rule)) return rule.map((r) => apply(r, answers));
  const [op, raw] = Object.entries(rule)[0];
  if (op === "var") return answers[String(raw)];
  const args = (Array.isArray(raw) ? raw : [raw]).map((r) => apply(r, answers));
  switch (op) {
    case "==":
      return args[0] === args[1];
    case "!=":
      return args[0] !== args[1];
    case "!":
      return !args[0];
    case "and":
      return args.every(Boolean);
    case "or":
      return args.some(Boolean);
    case "in":
      return Array.isArray(args[1])
        ? args[1].includes(args[0])
        : typeof args[1] === "string" && args[1].includes(String(args[0]));
    default:
      throw new Error(`不支援的規則運算子：${op}`);
  }
}
const domain = (q: Question): Answer[] =>
  q.type === "BOOLEAN" ? [true, false] : q.options!.map((o) => o.value);
export function evalTri(
  rule: Rule | undefined,
  answers: Answers,
  questions: Question[],
): { v: "TRUE" | "FALSE" | "UNKNOWN"; dependsOn: string[] } {
  if (rule == null) return { v: "TRUE", dependsOn: [] };
  const unknown = refs(rule).filter((key) => !own(answers, key));
  if (unknown.length > 6) throw new Error("規則最多引用六個未回答問題");
  let combinations: Answers[] = [{ ...answers }];
  for (const key of unknown) {
    const question = questions.find((q) => q.code === key);
    if (!question) throw new Error(`不存在的問題：${key}`);
    combinations = combinations.flatMap((a) =>
      domain(question).map((value) => ({ ...a, [key]: value })),
    );
  }
  const results = combinations.map((a) => Boolean(apply(rule, a)));
  if (results.every(Boolean)) return { v: "TRUE", dependsOn: [] };
  if (results.every((r) => !r)) return { v: "FALSE", dependsOn: [] };
  const dependsOn = unknown.filter((key) =>
    combinations.some((a, index) =>
      domain(questions.find((q) => q.code === key)!).some(
        (value) =>
          Boolean(apply(rule, { ...a, [key]: value })) !== results[index],
      ),
    ),
  );
  return { v: "UNKNOWN", dependsOn };
}
export function resolve(
  service: ServiceSnapshot,
  modeCode: string,
  input: Answers = {},
): Checklist {
  const mode = service.modes.find((m) => m.code === modeCode);
  if (!mode) throw new Error("未提供此辦理方式");
  const answers: Answers = {};
  const questions: Question[] = [];
  const visited = new Set<string>();
  const visit = (q: Question) => {
    if (visited.has(q.code)) return;
    visited.add(q.code);
    refs(q.visibleWhen).forEach((code) =>
      visit(service.questions.find((p) => p.code === code)!),
    );
    if (q.modes && !q.modes.includes(mode.code)) return;
    if (evalTri(q.visibleWhen, answers, service.questions).v !== "TRUE") return;
    questions.push(q);
    if (own(input, q.code) && domain(q).includes(input[q.code]))
      answers[q.code] = input[q.code];
  };
  service.questions.forEach(visit);
  const eligibility = mode.allowed
    ? evalTri(mode.allowedWhen, answers, service.questions)
    : { v: "FALSE" as const, dependsOn: [] };
  const pending = new Set(eligibility.dependsOn);
  const items: ResolvedItem[] = [];
  if (eligibility.v !== "FALSE")
    for (const item of service.items) {
      if (!item.modes.includes(mode.code)) continue;
      const result = evalTri(item.condition, answers, service.questions);
      if (result.v === "FALSE") continue;
      const existing = items.find(
        (i) =>
          !i.groupId &&
          !item.groupId &&
          item.documentCode &&
          i.documentCode === item.documentCode &&
          i.party === item.party &&
          i.form === item.form,
      );
      const status = result.v === "TRUE" ? "REQUIRED" : "CONDITIONAL";
      if (existing) {
        existing.quantity = Math.max(existing.quantity, item.quantity);
        existing.note = [
          ...new Set([existing.note, item.note].filter(Boolean)),
        ].join("；");
        existing.sourceIds = [
          ...new Set([...existing.sourceIds, ...item.sourceIds]),
        ];
        if (status === "REQUIRED") {
          existing.status = status;
          existing.dependsOn = [];
        } else if (existing.status === "CONDITIONAL") {
          existing.dependsOn = [
            ...new Set([...existing.dependsOn, ...result.dependsOn]),
          ];
        }
      } else items.push({ ...item, status, dependsOn: result.dependsOn });
    }
  items
    .filter((i) => i.status === "CONDITIONAL")
    .forEach((i) => i.dependsOn.forEach((q) => pending.add(q)));
  const parties =
    mode.code === "SELF"
      ? service.parties
      : [...service.parties].sort(
          (a, b) => Number(b.code === mode.code) - Number(a.code === mode.code),
        );
  const rank = { PERSON: 0, DOCUMENT: 1, ACTION: 2, FEE: 3 };
  const sections = parties
    .map((party) => {
      const entries: (ResolvedItem | ResolvedGroup)[] = [];
      const seen = new Set<string>();
      for (const item of items
        .filter((i) => i.party === party.code)
        .sort((a, b) => rank[a.kind] - rank[b.kind])) {
        if (!item.groupId) {
          entries.push(item);
          continue;
        }
        if (seen.has(item.groupId)) continue;
        seen.add(item.groupId);
        const group = service.groups.find((g) => g.id === item.groupId)!;
        const members = items.filter(
          (i) => i.groupId === item.groupId && i.party === item.party,
        );
        if (members.length === 1) entries.push(members[0]);
        else
          entries.push({
            ...group,
            ...(group.rule === "AT_LEAST_N"
              ? { minCount: Math.min(group.minCount!, members.length) }
              : {}),
            items: members,
          });
      }
      const label =
        party.code === "APPLICANT" && mode.code !== "SELF"
          ? "請當事人交給你"
          : party.label;
      return { party: party.code, label, entries };
    })
    .filter((s) => s.entries.length);
  return {
    mode: { ...mode, allowed: eligibility.v !== "FALSE" },
    eligibility: eligibility.v,
    answers,
    questions,
    pendingQuestions: [...pending],
    sections,
  };
}
export function isOfficialSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (/(^|\.)gov\.taipei$/.test(url.hostname) ||
        ["www.post.gov.tw", "www.thb.gov.tw"].includes(url.hostname));
  } catch {
    return false;
  }
}
export function validateService(service: ServiceSnapshot): void {
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(`${service.slug}: ${message}`);
  };
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service.slug), "slug 格式錯誤");
  assert(service.title && service.sources.length, "標題或來源缺漏");
  const codes = new Set(service.questions.map((q) => q.code));
  assert(codes.size === service.questions.length, "問題代碼重複");
  const checkRule = (rule: Rule | undefined): void => {
    if (rule == null || typeof rule !== "object") return;
    if (Array.isArray(rule)) {
      rule.forEach(checkRule);
      return;
    }
    assert(Object.keys(rule).length === 1, "每個規則節點只能有一個運算子");
    for (const [op, args] of Object.entries(rule)) {
      assert(operators.has(op), "規則運算子未在白名單");
      if (op === "var")
        assert(typeof args === "string" && codes.has(args), "規則引用未知問題");
      else {
        const values = Array.isArray(args) ? args : [args];
        assert(
          op === "!"
            ? values.length === 1
            : op === "and" || op === "or"
              ? values.length > 0
              : values.length === 2,
          "規則參數數量錯誤",
        );
        values.forEach(checkRule);
      }
    }
    assert(refs(rule).length <= 6, "規則最多六個問題");
  };
  service.questions.forEach((q) => {
    assert(/^[a-z][a-z0-9_]*$/.test(q.code), "問題代碼格式錯誤");
    assert(domain(q).length > 0 && domain(q).length <= 8, "選項需 1 至 8 個");
    checkRule(q.visibleWhen);
  });
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (code: string) => {
    assert(!visiting.has(code), "問題循環依賴");
    if (done.has(code)) return;
    visiting.add(code);
    refs(service.questions.find((q) => q.code === code)!.visibleWhen).forEach(
      visit,
    );
    visiting.delete(code);
    done.add(code);
  };
  service.questions.forEach((q) => visit(q.code));
  service.sources.forEach((s) =>
    assert(
      isOfficialSourceUrl(s.url) &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.verifiedAt) &&
        /^[a-f0-9]{64}$/.test(s.sha256),
      "來源必須是允許的機關官方 HTTPS，且附查證日期與雜湊",
    ),
  );
  assert(
    new Set(service.items.map((i) => i.key)).size === service.items.length,
    "項目鍵重複",
  );
  service.items.forEach((item) => {
    assert(item.quantity > 0 && Number.isInteger(item.quantity), "數量錯誤");
    assert(
      service.parties.some((p) => p.code === item.party),
      "當事方缺漏",
    );
    assert(
      item.modes.length &&
        item.modes.every((m) => service.modes.some((p) => p.code === m)),
      "辦理方式缺漏",
    );
    assert(
      item.sourceIds.length &&
        item.sourceIds.every((id) => service.sources.some((s) => s.id === id)),
      "項目來源缺漏",
    );
    assert(
      item.kind !== "FEE" ||
        (Number.isInteger(item.amountTwd) && item.amountTwd! >= 0),
      "規費缺漏",
    );
    assert(
      !item.groupId || service.groups.some((g) => g.id === item.groupId),
      "群組缺漏",
    );
    checkRule(item.condition);
    if (item.templateUrl)
      assert(
        new URL(item.templateUrl).protocol === "https:",
        "書表須使用 HTTPS",
      );
  });
  service.groups.forEach((g) => {
    const members = service.items.filter((i) => i.groupId === g.id);
    assert(
      members.length >= 2 && new Set(members.map((i) => i.party)).size === 1,
      "群組需有相同當事方的至少兩個項目",
    );
    assert(
      g.rule !== "AT_LEAST_N" ||
        (Number.isInteger(g.minCount) &&
          g.minCount! > 0 &&
          g.minCount! <= members.length),
      "群組數量錯誤",
    );
  });
  service.modes.forEach((m) => {
    checkRule(m.allowedWhen);
    assert(
      !m.allowed ||
        service.items.some(
          (i) => i.modes.includes(m.code) && i.condition === undefined,
        ),
      "允許方式需有無條件項目",
    );
  });
}
export const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[\s\p{P}]/gu, "");
const near = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next[j + 1] = Math.min(
        next[j] + 1,
        row[j + 1] + 1,
        row[j] + Number(a[i] !== b[j]),
      );
    row = next;
  }
  return row[b.length] <= 1;
};
export function search(services: ServiceSnapshot[], query: string) {
  const q = normalize(query);
  return services
    .filter((s) => !s.retired)
    .map((s) => {
      const terms = [s.title, ...s.keywords, s.agency, s.category];
      const ranked = terms
        .map((term) => {
          const n = normalize(term);
          return {
            term,
            score: !q
              ? 1
              : n === q
                ? 100
                : n.startsWith(q)
                  ? 60
                  : n.includes(q)
                    ? 40
                    : q.length >= 3 && near(q, n)
                      ? 20
                      : 0,
          };
        })
        .sort((a, b) => b.score - a.score);
      return {
        slug: s.slug,
        title: s.title,
        agency: s.agency,
        category: s.category,
        summary: s.summary,
        matched: ranked[0].term,
        score: ranked[0].score,
      };
    })
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.title.length - b.title.length ||
        a.slug.localeCompare(b.slug),
    );
}
