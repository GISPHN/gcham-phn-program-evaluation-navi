const categoryOrder = ["ストラクチャー", "プロセス", "アウトプット", "アウトカム"];
const categoryClass = {
  ストラクチャー: "category-structure",
  プロセス: "category-process",
  アウトプット: "category-output",
  アウトカム: "category-outcome"
};
const storageKey = "gcham-phn-evaluation-plan-v1";

const queryInput = document.querySelector("#query");
const domainFilter = document.querySelector("#domain-filter");
const categoryFilter = document.querySelector("#category-filter");
const resultCount = document.querySelector("#result-count");
const resultRows = document.querySelector("#result-rows");
const emptyState = document.querySelector("#empty-state");
const activeFilters = document.querySelector("#active-filters");
const planList = document.querySelector("#plan-list");
const planCount = document.querySelector("#plan-count");
const exportButton = document.querySelector("#export-csv");
const clearPlanButton = document.querySelector("#clear-plan");
const customForm = document.querySelector("#custom-form");
const customIndicatorInput = document.querySelector("#custom-indicator");
const customFormToggle = document.querySelector("#toggle-custom-form");
const domainGroups = [
  {
    label: "母子保健",
    domains: [
      "妊娠期・出産・産後の支援",
      "乳幼児の健康診査・発達・養育支援",
      "学童期・思春期・学校との連携"
    ]
  },
  {
    label: "成人保健",
    domains: [
      "成人の健康づくり・生活習慣改善",
      "特定健診・特定保健指導",
      "糖尿病・高血圧等の重症化予防",
      "がん予防・検診・療養支援",
      "歯・口腔の健康",
      "こころの健康・精神保健・自殺対策",
      "生活困窮・被保護者の健康支援",
      "働く世代・地域職域連携",
      "地域の健康づくり環境・健康格差"
    ]
  },
  {
    label: "高齢者保健",
    domains: [
      "高齢者の保健事業・フレイル予防",
      "介護予防・通いの場・地域づくり"
    ]
  },
  {
    label: "障害保健",
    domains: ["障害・医療的ケア・在宅療養"]
  },
  {
    label: "健康危機管理（災害）",
    domains: ["災害時の保健活動・健康危機管理"]
  },
  {
    label: "健康危機管理（感染症）",
    domains: ["感染症・予防接種・結核・性感染症"]
  }
];
const publishedDomains = new Set(evaluationExamples.map((item) => item.domain));
domainGroups.forEach((group) => {
  group.domains = group.domains.filter((domain) => publishedDomains.has(domain));
  if (!group.domains.length) return;
  const optionGroup = document.createElement("optgroup");
  optionGroup.label = group.label;
  group.domains.forEach((domain) => {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    optionGroup.append(option);

    const suggestion = document.createElement("option");
    suggestion.value = domain;
    document.querySelector("#domain-options").append(suggestion);
  });
  domainFilter.append(optionGroup);
});
const domains = domainGroups.flatMap((group) => group.domains);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function normalized(value) {
  return String(value ?? "").toLocaleLowerCase("ja").replace(/[\s　]+/g, " ").trim();
}

function sourceNumbers(sourceText) {
  const numbers = [];
  for (const block of String(sourceText ?? "").matchAll(/\[([^\]]+)\]/g)) {
    const citation = block[1];
    const first = citation.match(/^\s*(\d+)/);
    if (first) numbers.push(Number(first[1]));
    for (const additional of citation.matchAll(/[;；、]\s*(\d+)(?=[,、（(]|\s|$)/g)) {
      numbers.push(Number(additional[1]));
    }
  }
  return [...new Set(numbers)];
}

function sourcesFor(item) {
  return sourceNumbers(item.sourceText)
    .map((number) => sourceReferences.find((reference) => reference.number === number))
    .filter(Boolean);
}

function citationLinks(item) {
  const citations = sourcesFor(item);
  if (!citations.length) return '<span class="no-source">出典情報なし</span>';
  return citations.map((source) => '<a href="' + escapeHtml(source.url) + '" target="_blank" rel="noopener noreferrer" aria-label="資料' + source.number + 'を別タブで開く">[' + source.number + ']</a>').join(" ");
}

function sourceDetails(item) {
  const citations = sourcesFor(item);
  if (!citations.length) return "";
  const sources = citations.map((source) =>
    '<div class="source-item"><strong>[' + source.number + '] ' + escapeHtml(source.title) + '</strong><div>' +
    escapeHtml(source.locator) + '</div><a href="' + escapeHtml(source.url) +
    '" target="_blank" rel="noopener noreferrer">公的資料を開く</a></div>'
  ).join("");
  return '<details class="matrix-source-details"><summary>資料名・該当箇所</summary><div class="source-list">' + sources + '</div></details>';
}

function currentFilters() {
  return {
    query: normalized(queryInput.value),
    domain: domainFilter.value,
    category: categoryFilter.value
  };
}

function renderFilters(filters) {
  const chips = [];
  if (filters.query) chips.push("キーワード：" + filters.query);
  if (filters.domain) chips.push(filters.domain);
  if (filters.category) chips.push(filters.category);
  activeFilters.innerHTML = chips.map((chip) => '<span class="filter-chip">' + escapeHtml(chip) + '</span>').join("");
}

function exampleCell(item, category) {
  if (!item) {
    return '<td class="example-cell is-empty" data-label="' + escapeHtml(category) + '"><span>該当する例はありません</span></td>';
  }
  const categoryCss = categoryClass[item.category] || "category-structure";
  const added = planItems.some((planItem) => planItem.sourceId === item.id || (!planItem.sourceId && planItem.id === item.id));
  const buttonText = added ? "評価案から外す" : "評価案に追加";
  const buttonClass = added ? "button-secondary" : "button-primary";
  return '<td class="example-cell" data-label="' + escapeHtml(category) + '">' +
    '<div class="cell-category"><span class="category-badge ' + categoryCss + '">' + escapeHtml(category) + '</span></div>' +
    '<p class="indicator-text">' + escapeHtml(item.indicator) + '</p>' +
    '<div class="cell-sources"><span>出典</span> ' + citationLinks(item) + '</div>' +
    '<div class="cell-actions"><button class="button ' + buttonClass + ' add-to-plan" data-id="' + escapeHtml(item.id) +
    '" type="button" aria-pressed="' + String(added) + '">' + buttonText + '</button>' + sourceDetails(item) + '</div></td>';
}

function renderMatrix() {
  const filters = currentFilters();
  const filtered = evaluationExamples.filter((item) => {
    if (filters.domain && item.domain !== filters.domain) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.query) {
      const sourceTitles = sourcesFor(item).map((source) => source.title).join(" ");
      const searchable = normalized(item.domain + " " + item.category + " " + item.indicator + " " + item.sourceText + " " + sourceTitles);
      if (!searchable.includes(filters.query)) return false;
    }
    return true;
  });

  const visibleGroups = domainGroups.map((group) => ({
    label: group.label,
    domains: group.domains.filter((domain) => filtered.some((item) => item.domain === domain))
  })).filter((group) => group.domains.length > 0);
  const orderedDomains = visibleGroups.flatMap((group) => group.domains);
  const rows = visibleGroups.map((group) => {
    const heading = '<tr class="domain-group-row"><th scope="row" colspan="5">' + escapeHtml(group.label) + '</th></tr>';
    const domainRows = group.domains.map((domain) => {
      const examples = new Map(filtered.filter((item) => item.domain === domain).map((item) => [item.category, item]));
      return '<tr><th scope="row" class="domain-cell">' + escapeHtml(domain) + '</th>' +
        categoryOrder.map((category) => exampleCell(examples.get(category), category)).join("") + '</tr>';
    }).join("");
    return heading + domainRows;
  }).join("");

  resultCount.textContent = filtered.length + "件の評価例（" + orderedDomains.length + "領域）";
  resultRows.innerHTML = rows;
  emptyState.hidden = filtered.length > 0;
  renderFilters(filters);
}

function loadPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.map((item) => ({
      ...item,
      kind: item.kind || "example",
      sourceId: item.sourceId || item.id,
      indicatorName: item.indicatorName ?? item.indicator ?? "",
      targetValue: item.targetValue || "",
      actualValue: item.actualValue || "",
      interpretation: item.interpretation || "",
      nextAction: item.nextAction || ""
    }));
  } catch {
    return [];
  }
}

let planItems = loadPlan();

function savePlan() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(planItems));
    return true;
  } catch {
    planCount.textContent = "ブラウザーに保存できませんでした。不要な保存データを削除してから再度お試しください。";
    return false;
  }
}

function originalExample(planItem) {
  if (!planItem.sourceId) return null;
  return evaluationExamples.find((item) => item.id === planItem.sourceId) || null;
}

function renderPlan() {
  planCount.textContent = planItems.length ? planItems.length + "件を事業評価案に追加しています。" : "評価案はまだありません。";
  exportButton.disabled = planItems.length === 0;
  clearPlanButton.disabled = planItems.length === 0;

  if (!planItems.length) {
    planList.innerHTML = '<p class="plan-empty">一覧の例を追加するか、「自分の指標を追加」から指標名を入力してください。</p>';
    return;
  }

  planList.innerHTML = planItems.map((planItem, index) => {
    const source = originalExample(planItem);
    const domain = planItem.domain || (source && source.domain) || "領域未設定";
    const category = planItem.category || (source && source.category) || "プロセス";
    const indicatorName = planItem.indicatorName || (source && source.indicator) || "指標名未入力";
    const citation = source ? source.sourceText : (planItem.kind === "custom" ? "自作指標（公的資料の直接出典なし）" : planItem.sourceText || "出典情報なし");
    const badge = planItem.kind === "custom" ? '<span class="origin-badge">自作</span>' : '<span class="origin-badge origin-example">公的資料の例</span>';
    const itemId = escapeHtml(planItem.id);
    const original = source ? '<p class="source-original">参考にした掲載例：' + escapeHtml(source.indicator) + '</p>' : "";
    const pdca = '<details class="pdca-details"><summary>結果と次の改善を記録する（任意）</summary>' +
      '<div class="plan-fields pdca-fields">' +
      '<label>目標値<input type="text" data-field="targetValue" value="' + escapeHtml(planItem.targetValue) + '" placeholder="例：対象者の80％"></label>' +
      '<label>実績<input type="text" data-field="actualValue" value="' + escapeHtml(planItem.actualValue) + '" placeholder="例：対象者の62％"></label>' +
      '<label>結果から分かったこと<textarea data-field="interpretation" rows="3" placeholder="目標との差や、その背景として考えられること">' + escapeHtml(planItem.interpretation) + '</textarea></label>' +
      '<label>次に行う改善<textarea data-field="nextAction" rows="3" placeholder="続けること、見直すこと、次に確認すること">' + escapeHtml(planItem.nextAction) + '</textarea></label>' +
      '</div></details>';

    return '<article class="plan-item" data-plan-id="' + itemId + '">' +
      '<div class="plan-item-header"><div class="plan-item-heading"><div class="plan-badges">' +
      '<span class="category-badge ' + (categoryClass[category] || "category-process") + '">' + escapeHtml(category) + '</span>' + badge +
      '</div><p class="plan-domain">' + escapeHtml(domain) + '</p>' + original + '</div>' +
      '<button class="remove-item" type="button" data-remove-id="' + itemId + '" aria-label="' + (index + 1) + '件目の評価案を削除">削除</button></div>' +
      '<div class="plan-fields">' +
      '<label class="wide-field">自分の指標名<input type="text" data-field="indicatorName" value="' + escapeHtml(indicatorName) + '" maxlength="200"></label>' +
      '<label>対象・期間<input type="text" data-field="targetPeriod" value="' + escapeHtml(planItem.targetPeriod) + '" placeholder="例：今年度の産後訪問対象家庭"></label>' +
      '<label>指標の定義<input type="text" data-field="definition" value="' + escapeHtml(planItem.definition) + '" placeholder="何を、どのように数えるか"></label>' +
      '<label>分子・分母／数え方<input type="text" data-field="numeratorDenominator" value="' + escapeHtml(planItem.numeratorDenominator) + '" placeholder="割合の場合は分子と分母"></label>' +
      '<label>データ源・評価時期<input type="text" data-field="dataAndTiming" value="' + escapeHtml(planItem.dataAndTiming) + '" placeholder="記録、アンケート、評価時期"></label>' +
      '</div>' + pdca + '<p class="plan-source">出典：' + escapeHtml(citation) + '</p></article>';
  }).join("");
}

function csvEscape(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function exportPlan() {
  const headers = ["登録区分", "事業領域・担当場面", "評価区分", "自分の指標名", "参考にした掲載例", "対象・期間", "指標の定義", "分子・分母／数え方", "データ源・評価時期", "目標値", "実績", "結果から分かったこと", "次に行う改善", "出典"];
  const rows = planItems.map((planItem) => {
    const source = originalExample(planItem);
    return [
      planItem.kind === "custom" ? "自作" : "公的資料の例を参考",
      planItem.domain || (source && source.domain) || "",
      planItem.category || (source && source.category) || "",
      planItem.indicatorName || (source && source.indicator) || "",
      (source && source.indicator) || "",
      planItem.targetPeriod,
      planItem.definition,
      planItem.numeratorDenominator,
      planItem.dataAndTiming,
      planItem.targetValue,
      planItem.actualValue,
      planItem.interpretation,
      planItem.nextAction,
      source ? source.sourceText : (planItem.kind === "custom" ? "自作指標（公的資料の直接出典なし）" : planItem.sourceText || "")
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "保健師事業評価案.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toggleExampleInPlan(example) {
  const existingIndex = planItems.findIndex((planItem) => planItem.sourceId === example.id || (!planItem.sourceId && planItem.id === example.id));
  if (existingIndex >= 0) {
    planItems.splice(existingIndex, 1);
  } else {
    planItems.push({
    id: example.id,
    sourceId: example.id,
    kind: "example",
    domain: example.domain,
    category: example.category,
    indicatorName: example.indicator,
    targetPeriod: "",
    definition: "",
    numeratorDenominator: "",
    dataAndTiming: "",
    targetValue: "",
    actualValue: "",
    interpretation: "",
    nextAction: ""
    });
  }
  savePlan();
  renderPlan();
  renderMatrix();
}

function openCustomForm() {
  customForm.hidden = false;
  customFormToggle.setAttribute("aria-expanded", "true");
  customFormToggle.textContent = "入力欄を閉じる";
  customIndicatorInput.focus();
}

function closeCustomForm() {
  customForm.hidden = true;
  customFormToggle.setAttribute("aria-expanded", "false");
  customFormToggle.textContent = "指標名を入力する";
}

queryInput.addEventListener("input", renderMatrix);
domainFilter.addEventListener("change", renderMatrix);
categoryFilter.addEventListener("change", renderMatrix);

document.querySelector("#clear-filters").addEventListener("click", () => {
  queryInput.value = "";
  domainFilter.value = "";
  categoryFilter.value = "";
  renderMatrix();
  queryInput.focus();
});

resultRows.addEventListener("click", (event) => {
  const button = event.target.closest(".add-to-plan");
  if (!button) return;
  const item = evaluationExamples.find((example) => example.id === button.dataset.id);
  if (item) toggleExampleInPlan(item);
});

customFormToggle.addEventListener("click", () => {
  if (customForm.hidden) openCustomForm();
  else closeCustomForm();
});

document.querySelector("#cancel-custom-form").addEventListener("click", closeCustomForm);

customForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!customForm.reportValidity()) return;
  const formData = new FormData(customForm);
  const domain = String(formData.get("domain") || "").trim() || "自由記載";
  const category = String(formData.get("category") || "プロセス");
  const generatedId = globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(16).slice(2));

  planItems.push({
    id: "custom-" + generatedId,
    kind: "custom",
    sourceId: null,
    domain,
    category,
    indicatorName: String(formData.get("indicatorName") || "").trim(),
    targetPeriod: String(formData.get("targetPeriod") || "").trim(),
    definition: String(formData.get("definition") || "").trim(),
    numeratorDenominator: String(formData.get("numeratorDenominator") || "").trim(),
    dataAndTiming: String(formData.get("dataAndTiming") || "").trim(),
    targetValue: String(formData.get("targetValue") || "").trim(),
    actualValue: String(formData.get("actualValue") || "").trim(),
    interpretation: String(formData.get("interpretation") || "").trim(),
    nextAction: String(formData.get("nextAction") || "").trim()
  });

  customForm.reset();
  closeCustomForm();
  savePlan();
  renderPlan();
  planList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});

planList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-field]");
  if (!input) return;
  const itemId = input.closest("[data-plan-id]")?.dataset.planId;
  const item = planItems.find((planItem) => planItem.id === itemId);
  if (!item) return;
  item[input.dataset.field] = input.value;
  savePlan();
});

planList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-id]");
  if (!button) return;
  planItems = planItems.filter((item) => item.id !== button.dataset.removeId);
  savePlan();
  renderPlan();
  renderMatrix();
});

exportButton.addEventListener("click", exportPlan);
clearPlanButton.addEventListener("click", () => {
  planItems = [];
  savePlan();
  renderPlan();
  renderMatrix();
});

renderMatrix();
renderPlan();
