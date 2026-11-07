import type {
  Item,
  ModeCode,
  ServiceSnapshot,
  SourceRef,
  Rule,
} from "@townpass/checklist-shared";
const all: ModeCode[] = ["SELF", "DELEGATE", "LEGAL_REP"];
const proxy: ModeCode[] = ["DELEGATE", "LEGAL_REP"];
const eq = (code: string, value: string | boolean): Rule => ({
  "==": [{ var: code }, value],
});
export function catalog(source: SourceRef): ServiceSnapshot[] {
  const makeItem = (
    key: string,
    title: string,
    party: string,
    modes: ModeCode[],
    extra: Partial<Item> = {},
  ): Item => ({
    key,
    title,
    kind: "DOCUMENT",
    party,
    modes,
    form: "ORIGINAL",
    quantity: 1,
    sourceIds: [source.id],
    ...extra,
  });
  const parties = [
    { code: "APPLICANT", label: "當事人要帶" },
    { code: "DELEGATE", label: "你（受委託人）要帶" },
    { code: "LEGAL_REP", label: "你（法定代理人）要帶" },
    { code: "FEE", label: "請備妥規費" },
  ];
  const regionQuestion = {
    code: "q_document_region",
    prompt: "委任書、授權書或同意書在哪裡作成？",
    type: "ENUM" as const,
    modes: proxy,
    options: [
      { value: "TW", label: "臺灣" },
      { value: "OVERSEAS", label: "國外" },
      { value: "CHINA_HK_MO", label: "大陸地區、香港或澳門" },
    ],
    helpText: "不確定時，清單會保留可能需要的驗證程序。",
  };
  const base = {
    agency: "臺北市各區戶政事務所",
    category: "戶政",
    revisionNo: 1,
    revisionId: "",
    verifiedAt: source.verifiedAt,
    processingTime: "臨櫃 1 小時；網路預約 2 日（仍須臨櫃）",
    parties,
    groups: [],
    sources: [source],
  };
  const verifications = (modes: ModeCode[]) => [
    makeItem("poa-overseas", "先完成駐外館處驗證", "APPLICANT", modes, {
      kind: "ACTION",
      form: "NA",
      condition: eq("q_document_region", "OVERSEAS"),
      note: "在國外作成的委任書、授權書或同意書，應經我國駐外館處驗證。",
    }),
    makeItem("poa-mainland", "先完成指定機構驗證", "APPLICANT", modes, {
      kind: "ACTION",
      form: "NA",
      condition: eq("q_document_region", "CHINA_HK_MO"),
      note: "在大陸地區、香港或澳門作成者，應經行政院設立或指定之機構或委託之民間團體（海基會）驗證。",
    }),
  ];
  const seal: ServiceSnapshot = {
    ...base,
    slug: "seal-certificate",
    title: "印鑑證明",
    summary: "依親辦、委任或法定代理人身分，確認身分證明、印鑑章及委任文件。",
    keywords: ["印鑑", "印章證明", "印監證明", "印鉴证明", "印章", "委託印鑑"],
    handlingUnit:
      "設籍臺北市者可至本市任一戶政事務所資料課；戶籍遷出國外且委任辦理者至最後戶籍地戶所；設籍外縣市者至戶籍地戶所。",
    modes: [
      { code: "SELF", label: "本人親辦", allowed: true },
      { code: "DELEGATE", label: "委託他人", allowed: true },
      { code: "LEGAL_REP", label: "法定代理人", allowed: true },
    ],
    questions: [
      {
        code: "q_no_current_id",
        type: "BOOLEAN",
        prompt:
          "是否曾在國內設籍、現旅居國外／陸港澳，且未請領現行國民身分證？",
        modes: ["SELF"],
        helpText:
          "此情況可改驗有效中華民國護照、入國證明文件或其他身分證明文件。",
      },
      regionQuestion,
      {
        code: "q_multiple_reps",
        type: "BOOLEAN",
        prompt: "是否有數位法定代理人，而由其中一人代為申請？",
        modes: ["LEGAL_REP"],
      },
    ],
    groups: [
      {
        id: "self-identity",
        label: "依身分情況備妥下列一種身分證明",
        rule: "ONE_OF",
      },
      {
        id: "applicant-copy",
        label: "當事人身分證明影本（擇一）",
        rule: "ONE_OF",
      },
    ],
    items: [
      makeItem("self-id", "國民身分證", "APPLICANT", ["SELF"], {
        documentCode: "national-id",
        groupId: "self-identity",
        condition: eq("q_no_current_id", false),
      }),
      ...[
        ["passport", "有效中華民國護照"],
        ["entry", "入國證明文件"],
        ["other", "其他身分證明文件"],
      ].map(([key, title]) =>
        makeItem(`self-${key}`, title, "APPLICANT", ["SELF"], {
          groupId: "self-identity",
          condition: eq("q_no_current_id", true),
        }),
      ),
      makeItem("seal", "原登記之印鑑章", "APPLICANT", all, {
        form: "NA",
        documentCode: "registered-seal",
      }),
      makeItem("delegate-id", "受委任人身分證明文件", "DELEGATE", ["DELEGATE"]),
      makeItem("representative-id", "法定代理人身分證明文件", "LEGAL_REP", [
        "LEGAL_REP",
      ]),
      ...[
        ["id", "國民身分證"],
        ["passport", "有效中華民國護照"],
        ["entry", "入國證明文件"],
        ["other", "其他身分證明文件"],
      ].map(([key, title]) =>
        makeItem(`applicant-copy-${key}`, title, "APPLICANT", proxy, {
          groupId: "applicant-copy",
          form: "COPY",
        }),
      ),
      makeItem("poa", "委任書或授權書", "APPLICANT", ["DELEGATE"], {
        note: "須由委任人親自簽名或蓋章，註明辦理事項、請領份數及使用目的。如需同時辦理印鑑登記或變更，請另洽戶所確認。",
      }),
      makeItem(
        "other-reps-id",
        "其他法定代理人身分證明文件",
        "APPLICANT",
        ["LEGAL_REP"],
        { form: "COPY", condition: eq("q_multiple_reps", true) },
      ),
      makeItem(
        "other-reps-poa",
        "其他法定代理人委任書、同意書",
        "APPLICANT",
        ["LEGAL_REP"],
        {
          condition: eq("q_multiple_reps", true),
          note: "依來源第 3(4) 點附繳委任書及同意書；註明辦理事項、請領份數及使用目的，登記或變更需求亦須註明。",
        },
      ),
      ...verifications(proxy),
      makeItem("fee", "印鑑證明規費", "FEE", all, {
        kind: "FEE",
        form: "NA",
        amountTwd: 20,
        unit: "張",
        note: "每張新臺幣 20 元；實際總額依請領張數計算。",
      }),
    ],
    sources: [
      { ...source, clause: "項目 67；PDF 第 41–42 頁（印刷頁 40–41）" },
    ],
  };
  const certificate: ServiceSnapshot = {
    ...base,
    slug: "marriage-divorce-certificate",
    title: "中、英文結離婚證明書",
    summary: "申請結婚或離婚證明書，確認委託文件、英文姓名證明及境外文件驗證。",
    keywords: [
      "結婚證明",
      "離婚證明",
      "英文結婚證明",
      "結離婚證明書",
      "婚姻證明",
      "结婚证明",
    ],
    handlingUnit: "任一戶政事務所登記課。",
    modes: [
      { code: "SELF", label: "本人親辦", allowed: true },
      { code: "DELEGATE", label: "委託他人", allowed: true },
    ],
    questions: [
      { code: "q_english", prompt: "是否申請英文證明書？", type: "BOOLEAN" },
      {
        ...regionQuestion,
        modes: ["SELF", "DELEGATE"],
        prompt: "應備證件在哪裡作成？",
      },
      {
        code: "q_foreign_language",
        prompt: "應備證件是否為外文？",
        type: "BOOLEAN",
      },
    ],
    groups: [
      { id: "english-name", label: "英文姓名證明（擇一）", rule: "ONE_OF" },
    ],
    items: [
      makeItem(
        "applicant-id",
        "當事人國民身分證",
        "APPLICANT",
        ["SELF", "DELEGATE"],
        { documentCode: "national-id" },
      ),
      makeItem(
        "applicant-sign",
        "當事人印章或簽名",
        "APPLICANT",
        ["SELF", "DELEGATE"],
        { form: "NA", note: "可於現場簽名，不必為此另備印章。" },
      ),
      makeItem("delegate-id", "受委託人國民身分證", "DELEGATE", ["DELEGATE"], {
        documentCode: "national-id",
      }),
      makeItem(
        "delegate-sign",
        "受委託人印章或簽名",
        "DELEGATE",
        ["DELEGATE"],
        { form: "NA" },
      ),
      makeItem("poa", "委託書", "APPLICANT", ["DELEGATE"]),
      makeItem(
        "passport",
        "當事人中華民國護照",
        "APPLICANT",
        ["SELF", "DELEGATE"],
        { condition: eq("q_english", true), groupId: "english-name" },
      ),
      makeItem(
        "english-name-proof",
        "載有英文姓名的證明文件",
        "APPLICANT",
        ["SELF", "DELEGATE"],
        { condition: eq("q_english", true), groupId: "english-name" },
      ),
      ...verifications(["SELF", "DELEGATE"]).map((item) => ({
        ...item,
        note: item.note?.replace("委任書、授權書或同意書", "應備證件"),
      })),
      makeItem(
        "translation",
        "經驗證或認證的中文譯本",
        "APPLICANT",
        ["SELF", "DELEGATE"],
        {
          condition: eq("q_foreign_language", true),
          note: "應備證件為外文者，另檢附經駐外館處驗證或國內公證人認證之中文譯本。",
        },
      ),
      makeItem("fee", "結離婚證明書規費", "FEE", ["SELF", "DELEGATE"], {
        kind: "FEE",
        form: "NA",
        amountTwd: 100,
        unit: "份",
        note: "每份新臺幣 100 元。",
      }),
    ],
    sources: [{ ...source, clause: "項目 73；PDF 第 43 頁（印刷頁 42）" }],
  };
  return [seal, certificate];
}
