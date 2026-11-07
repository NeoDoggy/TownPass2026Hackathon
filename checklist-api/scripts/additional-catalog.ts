import type { Item, ModeCode, Rule, ServiceSnapshot, SourceRef } from "@townpass/checklist-shared";
import sources from "../data/reviewed-sources.json";

const self: ModeCode[] = ["SELF"];
const both: ModeCode[] = ["SELF", "DELEGATE"];
const eq = (code: string, value: string | boolean): Rule => ({ "==": [{ var: code }, value] });
const source = (id: string): SourceRef => {
  const ref = sources.find((s) => s.id === id);
  if (!ref) throw new Error(`缺少已核對來源：${id}`);
  return ref;
};
const makeItem = (sourceId: string, modes: ModeCode[] = self) =>
  (key: string, title: string, extra: Partial<Item> = {}): Item => ({
    key, title, kind: "DOCUMENT", party: "APPLICANT", modes,
    form: "ORIGINAL", quantity: 1, sourceIds: [sourceId], ...extra,
  });
const base = (sourceId: string) => ({
  revisionNo: 1, revisionId: "", verifiedAt: source(sourceId).verifiedAt,
  sources: [source(sourceId)],
  parties: [
    { code: "APPLICANT", label: "當事人要帶" },
    { code: "DELEGATE", label: "你（受委託人）要帶" },
    { code: "FEE", label: "請備妥費用" },
  ],
  modes: [{ code: "SELF" as const, label: "本人親辦", allowed: true }],
  questions: [], groups: [],
  processingTime: "官方頁面未載明處理時限，請洽承辦窗口。",
});

export function additionalCatalog(): ServiceSnapshot[] {
  const accountItem = makeItem("postal-account");
  const postalItem = makeItem("postal-passbook");
  const drivingItem = makeItem("driving-license", both);
  const internationalItem = makeItem("international-license", both);
  const vehicleItem = makeItem("vehicle-registration");
  const postal = {
    ...base("postal-passbook"), agency: "中華郵政股份有限公司", category: "郵局儲匯",
    handlingUnit: "本人至任一提供儲匯服務的郵局辦理；非通儲戶須至立帳郵局。本清單適用持國民身分證的一般成年個人戶；其他身分請先洽郵局。",
  };
  const motor = {
    agency: "交通部公路局各區監理所（站）", category: "監理",
    handlingUnit: "各區監理所（站）；部分站、分站未提供全部服務，出發前請電洽確認。",
    modes: [
      { code: "SELF" as const, label: "本人親辦", allowed: true },
      { code: "DELEGATE" as const, label: "委託他人", allowed: true },
    ],
  };
  return [
    {
      ...postal, ...base("postal-account"),
      slug: "postal-savings-account", title: "郵局存簿儲金開戶（成年人）",
      summary: "一般成年國民親自開戶，準備雙證件、印鑑與開戶存款；更名者另備詳細記事文件。",
      keywords: ["郵局開戶", "郵局开户", "郵政開戶", "存摺開戶", "儲蓄帳戶", "存簿儲金"],
      handlingUnit: "洽提供儲匯服務的郵局辦理。本清單適用持國民身分證的一般成年個人戶親辦；未成年、受監護或輔助宣告、歸化改號、外籍及團體戶，請先洽郵局確認專用文件。",
      questions: [{ code: "q_name_changed", prompt: "是否曾更改姓名？", type: "BOOLEAN" }],
      groups: [
        { id: "second-id", label: "第二身分證明文件", rule: "ONE_OF" },
        { id: "name-change", label: "載有詳細記事的更名證明", rule: "ONE_OF" },
      ],
      items: [
        accountItem("applicant-id", "國民身分證", { documentCode: "national-id" }),
        ...[["health", "健保卡"], ["license", "駕照"], ["passport", "護照"], ["household", "戶口名簿"], ["transcript", "戶籍謄本"]].map(([key, title]) =>
          accountItem(`second-${key}`, title, { groupId: "second-id", note: "須載有開戶人姓名，足以證明為本人。" })),
        accountItem("seal", "開戶印鑑（印章或本人親簽）", { form: "NA", note: "以戶名留存印鑑；採簽名者須當面親自簽名。印章不可使用易變質或磨損的橡皮章、原子章。" }),
        ...[["household", "具詳細記事的新式戶口名簿"], ["transcript", "具詳細記事的戶籍謄本"]].map(([key, title]) =>
          accountItem(`name-${key}`, title, { groupId: "name-change", condition: eq("q_name_changed", true) })),
        accountItem("opening-deposit", "準備至少新臺幣 10 元開戶存款", { kind: "ACTION", form: "NA", note: "這是存入帳戶的款項。" }),
      ],
    },
    {
      ...postal, slug: "postal-passbook-replacement", title: "郵局存摺掛失補發",
      summary: "一般成年個人戶本人辦理儲金簿掛失補副，準備身分證、原留印鑑與工本費。",
      keywords: ["存摺遺失", "存折丢失", "郵局存摺補發", "儲金簿掛失", "掛失補副"],
      items: [
        postalItem("applicant-id", "國民身分證", { documentCode: "national-id" }),
        postalItem("seal", "原留印鑑", { form: "NA" }),
        postalItem("stop-payment", "遺失後儘速向郵局要求暫予止付", { kind: "ACTION", form: "NA", note: "可先向郵局口頭或電話通知，再由本人臨櫃掛失補副。顧客服務專線 0800-700-365。" }),
        postalItem("fee", "儲金簿掛失補副工本費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 50, unit: "件" }),
      ],
    },
    {
      ...postal, slug: "postal-seal-change", title: "郵局存簿更換印鑑",
      summary: "一般成年個人戶本人變更存簿印鑑，準備身分證、儲金簿及新印鑑。",
      keywords: ["郵局印章遺失", "郵局換印章", "郵局更印", "變更印鑑", "更換印鑑"],
      items: [
        postalItem("applicant-id", "國民身分證", { documentCode: "national-id" }),
        postalItem("passbook", "儲金簿（存摺）"),
        postalItem("new-seal", "新印鑑", { form: "NA", note: "樣式不得與原留印鑑雷同，且不得使用易變質或磨損的橡皮章等印材。" }),
        postalItem("fee", "更換印鑑工本費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 50, unit: "件" }),
      ],
    },
    {
      ...postal, slug: "postal-passbook-password-reset", title: "郵局儲金簿密碼重設",
      summary: "一般成年個人戶忘記儲金簿密碼時，由本人攜帶身分證、原留印鑑及儲金簿辦理。",
      keywords: ["郵局密碼忘記", "存摺密碼", "儲金簿密碼", "郵局密碼重設", "存簿密碼"],
      items: [
        postalItem("applicant-id", "國民身分證", { documentCode: "national-id" }),
        postalItem("seal", "原留印鑑", { form: "NA" }),
        postalItem("passbook", "儲金簿（存摺）", { note: "本項為儲金簿密碼；金融卡、網路郵局及行動郵局密碼請另洽郵局。" }),
      ],
    },
    {
      ...base("driving-license"), ...motor,
      slug: "driving-license-replacement", title: "汽機車駕照遺失／毀損補發",
      summary: "依親辦或代辦確認身分證件、近兩年照片、毀損駕照與職業駕照審驗需求。",
      keywords: ["駕照補發", "驾照补办", "駕照遺失", "駕照換發", "駕照毀損", "機車駕照", "汽車駕照"],
      questions: [
        { code: "q_damaged", prompt: "是否因駕照毀損而換發（仍持有舊駕照）？", type: "BOOLEAN" },
        { code: "q_professional_review", prompt: "是否為已屆審驗日期的職業駕照？", type: "BOOLEAN" },
      ],
      groups: [{ id: "identity", label: "申請人身分證明", rule: "ONE_OF" }],
      items: [
        ...[["id", "國民身分證"], ["military", "軍人身分證"], ["residence", "僑民居留證明"]].map(([key, title]) =>
          drivingItem(`self-${key}`, title, { modes: self, groupId: "identity" })),
        drivingItem("applicant-id", "申請人國民身分證", { modes: ["DELEGATE"], documentCode: "national-id" }),
        drivingItem("delegate-id", "代辦人國民身分證", { modes: ["DELEGATE"], party: "DELEGATE", documentCode: "national-id" }),
        drivingItem("photos", "近兩年 1 吋彩色照片", { quantity: 2, note: "光面、素色背景、脫帽、五官清晰且露耳的正面半身照片，不得使用合成照片。" }),
        drivingItem("damaged-license", "毀損的駕駛執照", { condition: eq("q_damaged", true), note: "遺失者免附。" }),
        drivingItem("review-form", "汽（機）車駕駛人審驗暨各項異動登記書", { condition: eq("q_professional_review", true), note: "僅針對職業駕照審驗用。" }),
        drivingItem("review", "同時辦理職業駕照審驗", { kind: "ACTION", form: "NA", condition: eq("q_professional_review", true), note: "審驗所需額外文件請先洽監理所（站）確認。" }),
        drivingItem("violations", "確認違規案件已結清或完成分期首期繳款", { kind: "ACTION", form: "NA", note: "有未結清違規案件者，須先結清，或辦理分期並繳納第一期罰鍰後才能補照。" }),
        drivingItem("fee", "駕照補發規費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 200, unit: "張" }),
      ],
    },
    {
      ...base("international-license"), ...motor,
      slug: "international-driving-permit", title: "申領國際駕照",
      summary: "持有效本國駕照申領國際駕照，準備身分證件、護照影本及兩張 2 吋照片；可委託代辦。",
      keywords: ["國際駕照", "国际驾照", "國際駕駛執照", "國外自駕", "出國開車"],
      questions: [{ code: "q_address_differs", prompt: "駕照地址是否與身分證不同？", type: "BOOLEAN" }],
      groups: [{ id: "identity", label: "身分證或居留證（正本、影本擇一）", rule: "ONE_OF" }],
      items: [
        internationalItem("identity-original", "身分證或居留證正本", { groupId: "identity" }),
        internationalItem("identity-copy", "身分證或居留證影本", { groupId: "identity", form: "COPY" }),
        internationalItem("license", "有效的本國駕照", { note: "須在有效期內；職業駕照不得逾期審驗，否則先換照或補審。" }),
        internationalItem("passport", "護照影本", { form: "COPY", note: "供核對英文姓名。" }),
        internationalItem("photos", "近兩年同樣式 2 吋彩色照片", { quantity: 2, note: "光面、素色背景、脫帽、五官清晰且露耳的正面半身照片，不得使用合成照片。" }),
        internationalItem("delegate-id", "代辦人國民身分證", { modes: ["DELEGATE"], party: "DELEGATE", documentCode: "national-id" }),
        internationalItem("address-change", "同時辦理駕照地址變更", { kind: "ACTION", form: "NA", condition: eq("q_address_differs", true) }),
        internationalItem("violations", "先清理未結違規案件", { kind: "ACTION", form: "NA" }),
        internationalItem("destination", "確認目的地承認及使用規定", { kind: "ACTION", form: "NA", note: "出國前查閱公路局主要國家（地區）駕照態度一覽表；國際駕照須搭配本國駕照使用。" }),
        internationalItem("fee", "國際駕照規費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 250, unit: "份" }),
      ],
    },
    {
      ...base("vehicle-registration"), ...motor,
      slug: "vehicle-registration-replacement", title: "行照遺失／損壞補發（個人車主）",
      summary: "個人車主補換發汽機車行照，確認強制險有效天數、車種規費與到期檢驗。",
      keywords: ["行照補發", "行照遺失", "行照换发", "汽車行照", "機車行照", "行照損壞"],
      handlingUnit: `${motor.handlingUnit} 本清單涵蓋個人車主親辦；公司、行號或代辦所需文件請先洽監理所（站）。`,
      modes: [{ code: "SELF", label: "本人親辦", allowed: true, allowedWhen: eq("q_insurance_valid", true), disallowedReason: "強制險有效期間不足 30 日，不得補發行照；請先續保。" }],
      questions: [
        { code: "q_vehicle_type", prompt: "要補發哪一種車輛的行照？", type: "ENUM", options: [{ value: "CAR", label: "汽車" }, { value: "MOTORCYCLE", label: "機車（含大型重型機車）" }] },
        { code: "q_insurance_valid", prompt: "強制汽車責任保險證有效期間是否至少還有 30 日？", type: "BOOLEAN" },
        { code: "q_inspection_due", prompt: "汽車或大型重型機車是否已屆指定檢驗日期？", type: "BOOLEAN", helpText: "一般機車沒有此項檢驗需求時選「否」。" },
      ],
      groups: [{ id: "identity", label: "車主身分證明", rule: "ONE_OF" }],
      items: [
        ...[["id", "車主國民身分證"], ["military", "車主軍人身分證"], ["residence", "車主僑民居留證"]].map(([key, title]) => vehicleItem(`owner-${key}`, title, { groupId: "identity" })),
        vehicleItem("seal", "車主印章", { form: "NA" }),
        vehicleItem("insurance", "有效期間至少 30 日的強制汽車責任保險證"),
        vehicleItem("inspection", "先完成到期的車輛檢驗並合格", { kind: "ACTION", form: "NA", condition: eq("q_inspection_due", true) }),
        vehicleItem("arrears", "先結清未結違規、牌照稅及公路養管費", { kind: "ACTION", form: "NA" }),
        vehicleItem("car-fee", "汽車行照規費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 200, unit: "張", condition: eq("q_vehicle_type", "CAR") }),
        vehicleItem("motorcycle-fee", "機車行照規費", { kind: "FEE", form: "NA", party: "FEE", amountTwd: 150, unit: "張", condition: eq("q_vehicle_type", "MOTORCYCLE") }),
      ],
    },
  ];
}
