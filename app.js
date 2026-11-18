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
const sortOrder = document.querySelector("#sort-order");
const resultCount = document.querySelector("#result-count");
const resultList = document.querySelector("#results");
const emptyState = document.querySelector("#empty-state");
const activeFilters = document.querySelector("#active-filters");
const planList = document.querySelector("#plan-list");
const planCount = document.querySelector("#plan-count");
const exportButton = document.querySelector("#export-csv");
const clearPlanButton = document.querySelector("#clear-plan");

const domains = [...new Set(evaluationExamples.map((item) => item.domain))];
domains.forEach((domain) => {
  const option = document.createElement("option");
  option.value = domain;
  option.textContent = domain;
  domainFilter.append(option);
});

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
  for (const block of sourceText.matchAll(/\[([^\]]+)\]/g)) {
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
  if (!citations.length) return `<span>${escapeHtml(item.sourceText)}</span>`;
  return citations.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">[${source.number}]</a>`).join(" ");
}

function renderSourceDetails(item) {
  const citations = sourcesFor(item);
  if (!citations.length) return "";
  return citations.map((source) => `
    <div class="source-item">
      <strong>[${source.number}] ${escapeHtml(source.title)}</strong>
      <div>${escapeHtml(source.locator)}</div>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">公的資料を開く</a>
    </div>`).join("");
}

function resultCard(item) {
  const className = categoryClass[item.category] || "category-structure";
  const planHasItem = planItems.some((planItem) => planItem.id === item.id);
  return `
    <article class="result-card">
      <div class="card-top">
        <span class="domain-label">${escapeHtml(item.domain)}</span>
        <span class="category-badge ${className}">${escapeHtml(item.category)}</span>
      </div>
      <h3>${escapeHtml(item.category)}の評価例</h3>
      <p>${escapeHtml(item.indicator)}</p>
      <div class="card-actions">
        <span class="source-line">参照資料 ${citationLinks(item)}</span>
        <button class="button ${planHasItem ? "button-secondary" : "button-primary"} add-to-plan" data-id="${escapeHtml(item.id)}" type="button" ${planHasItem ? "disabled" : ""}>${planHasItem ? "追加済み" : "評価案に追加"}</button>
      </div>
      <details>
        <summary>出典と事業に当てはめるときの確認点</summary>
        <div class="details-body">
          <h4>出典の該当箇所</h4>
          <p class="source-line">${escapeHtml(item.sourceText)}</p>
          <div class="source-list">${renderSourceDetails(item)}</div>
          <h4>自分の事業で決めること</h4>
          <ul>
            <li>対象者と評価する期間を決める。</li>
            <li>割合を使う場合は、分子・分母と除外条件を決める。</li>
            <li>データを取る記録・担当・時期を決める。</li>
            <li>結果が目標に届かないときは、体制・実施過程・対象への到達を分けて確認する。</li>
          </ul>
          <p class="mapping-note">掲載例は研修・実務の検討用です。原典にない区分への整理や、自治体事業用に具体化した指標は、出典の原文と区別して扱ってください。</p>
        </div>
      </details>
    </article>`;
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
  if (filters.query) chips.push(`キーワード：${filters.query}`);
  if (filters.domain) chips.push(filters.domain);
  if (filters.category) chips.push(filters.category);
  activeFilters.innerHTML = chips.map((chip) => `<span class="filter-chip">${escapeHtml(chip)}</span>`).join("");
}

function renderResults() {
  const filters = currentFilters();
  const filtered = evaluationExamples.filter((item) => {
    if (filters.domain && item.domain !== filters.domain) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.query) {
      const searchable = normalized(`${item.domain} ${item.category} ${item.indicator} ${item.sourceText} ${sourcesFor(item).map((source) => source.title).join(" ")}`);
      if (!searchable.includes(filters.query)) return false;
    }
    return true;
  });
  filtered.sort((a, b) => {
    const domainDifference = domains.indexOf(a.domain) - domains.indexOf(b.domain);
    const categoryDifference = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return sortOrder.value === "category" ? categoryDifference || domainDifference : domainDifference || categoryDifference;
  });
  resultCount.textContent = `${filtered.length}件の評価例`;
  resultList.innerHTML = filtered.map(resultCard).join("");
  emptyState.hidden = filtered.length > 0;
  renderFilters(filters);
}

function loadPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let planItems = loadPlan();

function savePlan() {
  localStorage.setItem(storageKey, JSON.stringify(planItems));
}

function renderPlan() {
  planCount.textContent = planItems.length ? `${planItems.length}件を事業評価案に追加しています。` : "まだ評価例が選ばれていません。";
  exportButton.disabled = planItems.length === 0;
  clearPlanButton.disabled = planItems.length === 0;
  if (!planItems.length) {
    planList.innerHTML = `<p class="plan-empty">検索結果の「評価案に追加」から、使いたい指標例を選んでください。</p>`;
    return;
  }
  planList.innerHTML = planItems.map((planItem) => {
    const source = evaluationExamples.find((item) => item.id === planItem.id);
    if (!source) return "";
    return `
      <article class="plan-item" data-plan-id="${escapeHtml(planItem.id)}">
        <div class="plan-item-header">
          <div><span class="category-badge ${categoryClass[source.category]}">${escapeHtml(source.category)}</span><h3>${escapeHtml(source.domain)}：${escapeHtml(source.indicator)}</h3></div>
          <button class="remove-item" type="button" data-remove-id="${escapeHtml(planItem.id)}">削除</button>
        </div>
        <div class="plan-fields">
          <label>対象・期間<input type="text" data-field="targetPeriod" value="${escapeHtml(planItem.targetPeriod)}" placeholder="例：今年度の産後訪問対象家庭"></label>
          <label>指標の定義<input type="text" data-field="definition" value="${escapeHtml(planItem.definition)}" placeholder="例：相談先を1つ説明できる人の割合"></label>
          <label>分子・分母／数え方<input type="text" data-field="numeratorDenominator" value="${escapeHtml(planItem.numeratorDenominator)}" placeholder="割合の場合は分子と分母"></label>
          <label>データ源・時期<input type="text" data-field="dataAndTiming" value="${escapeHtml(planItem.dataAndTiming)}" placeholder="記録、アンケート、評価時期"></label>
        </div>
        <p class="plan-source">出典：${escapeHtml(source.sourceText)}</p>
      </article>`;
  }).join("");
}

function csvEscape(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportPlan() {
  const headers = ["事業領域", "評価区分", "指標例", "対象・期間", "指標の定義", "分子・分母／数え方", "データ源・時期", "出典"];
  const rows = planItems.map((planItem) => {
    const item = evaluationExamples.find((example) => example.id === planItem.id);
    if (!item) return [];
    return [item.domain, item.category, item.indicator, planItem.targetPeriod, planItem.definition, planItem.numeratorDenominator, planItem.dataAndTiming, item.sourceText];
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

queryInput.addEventListener("input", renderResults);
domainFilter.addEventListener("change", renderResults);
categoryFilter.addEventListener("change", renderResults);
sortOrder.addEventListener("change", renderResults);

document.querySelector("#clear-filters").addEventListener("click", () => {
  queryInput.value = "";
  domainFilter.value = "";
  categoryFilter.value = "";
  sortOrder.value = "domain";
  renderResults();
  queryInput.focus();
});

resultList.addEventListener("click", (event) => {
  const button = event.target.closest(".add-to-plan");
  if (!button) return;
  const item = evaluationExamples.find((example) => example.id === button.dataset.id);
  if (!item || planItems.some((planItem) => planItem.id === item.id)) return;
  planItems.push({ id: item.id, targetPeriod: "", definition: "", numeratorDenominator: "", dataAndTiming: "" });
  savePlan();
  renderPlan();
  renderResults();
});

planList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-field]");
  if (!input) return;
  const item = planItems.find((planItem) => planItem.id === input.closest("[data-plan-id]").dataset.planId);
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
  renderResults();
});

exportButton.addEventListener("click", exportPlan);
clearPlanButton.addEventListener("click", () => {
  planItems = [];
  savePlan();
  renderPlan();
  renderResults();
});

renderResults();
renderPlan();
