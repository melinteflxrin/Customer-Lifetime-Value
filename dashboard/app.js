const rawData = Array.isArray(window.CLV_DATA) ? window.CLV_DATA : [];

const numericFields = [
  "PredictedValue", "PredictionConfidencePercentage", "Survival_Probability",
  "CREDIT_SCORE", "AGE", "BALANCE", "HAS_ZERO_BALANCE", "PRODUCTS_NUMBER",
  "ACTIVE_MEMBER", "AGE_SQ", "TENURE", "TENURE_SQ", "BALANCE_SALARY_RATIO",
  "CREDIT_CARD", "HEALTH_SCORE", "AGE_TENURE_INTERACTION", "ESTIMATED_SALARY",
  "CHURN", "Base_Revenue", "FTP_Cost", "Allocated_Cost", "PD_Risk",
  "Risk_Adjusted_Margin", "Risk_Adjusted_CLV"
];

const data = rawData.map((row) => {
  const normalized = { ...row };
  numericFields.forEach((key) => {
    if (key in normalized) normalized[key] = Number(normalized[key]);
  });
  const pv   = Number(normalized.PredictedValue || 0);
  const conf = Number(normalized.PredictionConfidencePercentage || 0);
  normalized.Survival_Probability = Number(
    normalized.Survival_Probability ?? (pv === 1 ? 1 - conf : conf)
  );
  normalized.Churn_Probability = pv === 1 ? conf : 1 - conf;
  normalized.Net_Operating_Margin =
    (normalized.Base_Revenue || 0) - (normalized.FTP_Cost || 0) - (normalized.Allocated_Cost || 0);
  normalized.Risk_Adjusted_Margin =
    Number(normalized.Risk_Adjusted_Margin) ||
    normalized.Net_Operating_Margin * (1 - (normalized.PD_Risk || 0));
  return normalized;
});

// ── Global state ──────────────────────────────────────────────────────────────
const state = {
  filtered: data,
  charts:   {},
  sort:     { col: null, dir: 1 },
  search:   "",
  quadrant: { avgClv: 0, avgChurn: 0 }   // mutable refs used by canvas plugins
};

const selectors = {
  gender:  document.getElementById("filter-gender"),
  credit:  document.getElementById("filter-credit-tier"),
  product: document.getElementById("filter-product-segment"),
  age:     document.getElementById("filter-age-group"),
  tenure:  document.getElementById("filter-tenure-group"),
  active:  document.getElementById("filter-active")
};

// ── Formatters ────────────────────────────────────────────────────────────────
function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  });
}
function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function uniqueValues(key) {
  const vals = new Set(data.map((r) => r[key]).filter((v) => v != null));
  return ["ALL", ...Array.from(vals).sort()];
}
function populateSelect(sel, values) {
  sel.innerHTML = "";
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v === "ALL" ? "All" : v;
    sel.appendChild(o);
  });
}
function groupAverage(rows, key, metric) {
  const g = {};
  rows.forEach((r) => {
    const label = r[key];
    if (!g[label]) g[label] = { sum: 0, count: 0 };
    g[label].sum += Number(r[metric] || 0); g[label].count += 1;
  });
  const labels = Object.keys(g);
  return { labels, values: labels.map((l) => g[l].sum / g[l].count) };
}
function histogram(rows, metric, bins) {
  const vals = rows.map((r) => Number(r[metric] || 0));
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const step = (mx - mn) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  vals.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - mn) / step))] += 1; });
  const labels = counts.map((_, i) => {
    const s = mn + i * step;
    return `${s.toFixed(0)}\u2013${(s + step).toFixed(0)}`;
  });
  return { labels, values: counts };
}
function correlation(rows, xKey, yKey) {
  const x = rows.map((r) => Number(r[xKey] || 0));
  const y = rows.map((r) => Number(r[yKey] || 0));
  const n = x.length; if (!n) return 0;
  const xm = x.reduce((a, b) => a + b, 0) / n;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, xd = 0, yd = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xm, dy = y[i] - ym;
    num += dx * dy; xd += dx * dx; yd += dy * dy;
  }
  return num / (Math.sqrt(xd * yd) || 1);
}
function sampleRows(rows, maxN) {
  if (rows.length <= maxN) return rows;
  const step = rows.length / maxN;
  return Array.from({ length: maxN }, (_, i) => rows[Math.floor(i * step)]);
}

// ── Analytics helpers ─────────────────────────────────────────────────────────
function paretoCurve(rows) {
  const positive = [...rows]
    .filter((r) => (r.Risk_Adjusted_CLV || 0) > 0)
    .sort((a, b) => (b.Risk_Adjusted_CLV || 0) - (a.Risk_Adjusted_CLV || 0));
  const total = positive.reduce((s, r) => s + (r.Risk_Adjusted_CLV || 0), 0);
  const n = positive.length;
  if (!n || !total) return { xs: [], ys: [], top20pct: 0 };
  const stride = Math.max(1, Math.floor(n / 100));
  const xs = [], ys = [];
  let cum = 0, top20pct = 0;
  positive.forEach((r, i) => {
    cum += r.Risk_Adjusted_CLV || 0;
    if (i % stride === 0 || i === n - 1) {
      const xp = ((i + 1) / n) * 100;
      const yp = (cum / total) * 100;
      xs.push(xp.toFixed(1)); ys.push(yp);
      if (xp <= 20) top20pct = yp;
    }
  });
  return { xs, ys, top20pct };
}

function clvTiers(rows) {
  const defs = [
    { label: "Premium  > $4k",   min: 4000,      max: Infinity,  color: "#0e6f66" },
    { label: "Standard $1k\u2013$4k", min: 1000, max: 4000,      color: "#4a9d90" },
    { label: "Basic  $0\u2013$1k",    min: 0,    max: 1000,      color: "#c15d2f" },
    { label: "Negative  < $0",   min: -Infinity, max: 0,         color: "#7e7b77" }
  ];
  const posTotal = rows.reduce((s, r) => s + Math.max(0, r.Risk_Adjusted_CLV || 0), 0);
  return defs.map((d) => {
    const bucket = rows.filter((r) => (r.Risk_Adjusted_CLV || 0) >= d.min && (r.Risk_Adjusted_CLV || 0) < d.max);
    const bclv   = bucket.reduce((s, r) => s + Math.max(0, r.Risk_Adjusted_CLV || 0), 0);
    return { label: d.label, count: bucket.length, clvShare: posTotal ? (bclv / posTotal) * 100 : 0, color: d.color };
  });
}

function yearlyProjection(rows) {
  const d = 0.10;
  return [1, 2, 3, 4, 5].map((t) =>
    rows.reduce((sum, r) =>
      sum + (r.Risk_Adjusted_Margin || 0) * Math.pow(r.Survival_Probability || 0, t) / Math.pow(1 + d, t),
    0) / (rows.length || 1)
  );
}

// ── Inline chart plugins (defined once at module level) ───────────────────────
const quadrantLinePlugin = {
  id: "quadrantLines",
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    const xPx = chart.scales.x.getPixelForValue(state.quadrant.avgChurn);
    const yPx = chart.scales.y.getPixelForValue(state.quadrant.avgClv);
    ctx.save();
    ctx.strokeStyle = "rgba(28,27,26,0.2)"; ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(xPx, chartArea.top);    ctx.lineTo(xPx, chartArea.bottom);
    ctx.moveTo(chartArea.left, yPx);   ctx.lineTo(chartArea.right, yPx);
    ctx.stroke(); ctx.restore();
  }
};
const quadrantLabelPlugin = {
  id: "quadrantLabels",
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xPx = scales.x.getPixelForValue(state.quadrant.avgChurn);
    const yPx = scales.y.getPixelForValue(state.quadrant.avgClv);
    const qs = [
      { x: (xPx + chartArea.left) / 2,  y: (chartArea.top + yPx) / 2,    text: "Protect & Grow",  col: "#0e6f66" },
      { x: (xPx + chartArea.right) / 2, y: (chartArea.top + yPx) / 2,    text: "Intervene Now",   col: "#c15d2f" },
      { x: (xPx + chartArea.left) / 2,  y: (yPx + chartArea.bottom) / 2, text: "Monitor",         col: "#7e7b77" },
      { x: (xPx + chartArea.right) / 2, y: (yPx + chartArea.bottom) / 2, text: "Deprioritise",    col: "#7e7b77" }
    ];
    ctx.save();
    ctx.font = "600 11px 'IBM Plex Sans', sans-serif";
    qs.forEach(({ x, y, text, col }) => {
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillRect(x - w / 2 - 7, y - 10, w + 14, 20);
      ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    });
    ctx.restore();
  }
};

// ── KPIs ──────────────────────────────────────────────────────────────────────
function updateKPIs(rows) {
  const totalClv   = rows.reduce((s, r) => s + (r.Risk_Adjusted_CLV || 0), 0);
  const avgClv     = totalClv / (rows.length || 1);
  const churnRate  = rows.length ? rows.filter((r) => r.PredictedValue === 1).length / rows.length : 0;
  const negativeClv = rows.filter((r) => r.Risk_Adjusted_CLV < 0).length;
  const valueAtRisk = rows.reduce((s, r) => {
    const clv = r.Risk_Adjusted_CLV || 0;
    return s + (clv > 0 ? clv * (r.Churn_Probability || 0) : 0);
  }, 0);

  document.getElementById("kpi-total-clv").textContent     = formatCurrency(totalClv);
  document.getElementById("kpi-total-clv-sub").textContent = `${rows.length.toLocaleString()} customers`;
  document.getElementById("kpi-avg-clv").textContent       = formatCurrency(avgClv);
  document.getElementById("kpi-churn-rate").textContent    = formatPercent(churnRate);
  document.getElementById("kpi-negative-clv").textContent  = negativeClv.toLocaleString();
  document.getElementById("kpi-negative-clv-sub").textContent = `${formatPercent(negativeClv / (rows.length || 1))} of segment`;
  document.getElementById("kpi-var").textContent     = formatCurrency(valueAtRisk);
  document.getElementById("kpi-var-sub").textContent = `${formatPercent(valueAtRisk / (Math.max(totalClv, 1)))} of total CLV`;
}

// ── Tables ────────────────────────────────────────────────────────────────────
function clvCellClass(clv) {
  if (clv >= 2000) return "clv-premium";
  if (clv >= 0)    return "clv-positive";
  return "clv-negative";
}

function updateTables(rows) {
  // High-risk table
  const topRisk = [...rows]
    .sort((a, b) => (b.Risk_Adjusted_CLV || 0) - (a.Risk_Adjusted_CLV || 0))
    .filter((r) => r.Churn_Probability >= 0.5)
    .slice(0, 10);

  const riskBody = document.querySelector("#table-top-risk tbody");
  riskBody.innerHTML = "";
  topRisk.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.CUSTOMER_ID}</td>
      <td class="${clvCellClass(row.Risk_Adjusted_CLV)}">${formatCurrency(row.Risk_Adjusted_CLV)}</td>
      <td class="churn-high">${formatPercent(row.Churn_Probability)}</td>
      <td>${row.CREDIT_TIER}</td>
      <td>${row.PRODUCTS_NUMBER}</td>
      <td>${row.ACTIVE_MEMBER === 1 ? "Yes" : "No"}</td>
    `;
    riskBody.appendChild(tr);
  });

  // Customer Explorer
  const search = (state.search || "").toLowerCase();
  let pRows = [...rows];
  if (search) pRows = pRows.filter((r) => String(r.CUSTOMER_ID || "").toLowerCase().includes(search));
  if (state.sort.col) {
    const col = state.sort.col, dir = state.sort.dir;
    pRows.sort((a, b) => {
      const av = a[col], bv = b[col];
      return (typeof av === "number" && typeof bv === "number"
        ? av - bv : String(av).localeCompare(String(bv))) * dir;
    });
  }

  const countEl = document.getElementById("portfolio-count");
  if (countEl) countEl.textContent = `${Math.min(100, pRows.length).toLocaleString()} of ${pRows.length.toLocaleString()} customers`;

  const portBody = document.querySelector("#table-portfolio tbody");
  portBody.innerHTML = "";
  pRows.slice(0, 100).forEach((row) => {
    const tr = document.createElement("tr");
    const churnCls = row.Churn_Probability >= 0.5 ? "churn-high" : "";
    tr.innerHTML = `
      <td>${row.CUSTOMER_ID}</td>
      <td class="${clvCellClass(row.Risk_Adjusted_CLV)}">${formatCurrency(row.Risk_Adjusted_CLV)}</td>
      <td class="${churnCls}">${formatPercent(row.Churn_Probability)}</td>
      <td>${formatCurrency(row.BALANCE)}</td>
      <td>${row.CREDIT_TIER}</td>
      <td>${row.TENURE}</td>
      <td>${row.PRODUCTS_NUMBER}</td>
      <td>${row.ACTIVE_MEMBER === 1 ? "Yes" : "No"}</td>
    `;
    portBody.appendChild(tr);
  });
}

// ── Charts ────────────────────────────────────────────────────────────────────
function createOrUpdateChart(id, config) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (state.charts[id]) {
    state.charts[id].data = config.data;
    state.charts[id].options = config.options;
    state.charts[id].update();
    return state.charts[id];
  }
  state.charts[id] = new Chart(ctx, config);
  return state.charts[id];
}

function updateCharts(rows) {
  // Update pivot refs for quadrant plugins
  state.quadrant.avgClv   = rows.reduce((s, r) => s + (r.Risk_Adjusted_CLV || 0), 0) / (rows.length || 1);
  state.quadrant.avgChurn = rows.reduce((s, r) => s + (r.Churn_Probability || 0), 0) / (rows.length || 1);

  // ── Churn donut ──
  createOrUpdateChart("chart-churn", {
    type: "doughnut",
    data: {
      labels: ["Predicted Loyal", "Predicted Churn"],
      datasets: [{ data: [rows.filter((r) => r.PredictedValue === 0).length, rows.filter((r) => r.PredictedValue === 1).length], backgroundColor: ["#0e6f66", "#c15d2f"] }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  // ── Quadrant scatter (downsampled to 2000, with quadrant label plugins) ──
  createOrUpdateChart("chart-quadrant", {
    type: "scatter",
    data: {
      datasets: [{
        label: "Customers",
        data: sampleRows(rows, 2000).map((r) => ({ x: r.Churn_Probability, y: r.Risk_Adjusted_CLV })),
        backgroundColor: "rgba(14,111,102,0.4)",
        pointRadius: 2.5
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Churn Probability" }, min: 0, max: 1 },
        y: { title: { display: true, text: "Risk-Adjusted CLV ($)" } }
      }
    },
    plugins: [quadrantLinePlugin, quadrantLabelPlugin]
  });

  // ── CLV Tier breakdown (bar + line combo) ──
  const tiers = clvTiers(rows);
  createOrUpdateChart("chart-tiers", {
    type: "bar",
    data: {
      labels: tiers.map((t) => t.label),
      datasets: [
        { label: "Customers", data: tiers.map((t) => t.count), backgroundColor: tiers.map((t) => t.color), yAxisID: "y" },
        { label: "% of CLV", data: tiers.map((t) => parseFloat(t.clvShare.toFixed(1))), type: "line", borderColor: "#1c1b1a", backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 5, yAxisID: "y2" }
      ]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: {
        y:  { title: { display: true, text: "Customer Count" }, position: "left" },
        y2: { title: { display: true, text: "% of Total CLV" }, position: "right", grid: { drawOnChartArea: false }, min: 0, max: 100 }
      }
    }
  });

  // ── Segmentation: Age, Tenure, Credit, Product ──
  const segDefs = [
    { id: "chart-age",     key: "AGE_GROUP",       color: "#0e6f66" },
    { id: "chart-tenure",  key: "TENURE_GROUP",    color: "#c15d2f" },
    { id: "chart-credit",  key: "CREDIT_TIER",     color: "#1c1b1a" },
    { id: "chart-product", key: "PRODUCT_SEGMENT", color: "#7e7b77" }
  ];
  segDefs.forEach(({ id, key, color }) => {
    const g = groupAverage(rows, key, "Risk_Adjusted_CLV");
    createOrUpdateChart(id, {
      type: "bar",
      data: { labels: g.labels, datasets: [{ data: g.values, backgroundColor: color }] },
      options: { plugins: { legend: { display: false } } }
    });
  });

  // ── Active vs Inactive ──
  function segmentComparison(labels, segments) {
    const avgs   = segments.map((s) => s.reduce((t, r) => t + (r.Risk_Adjusted_CLV || 0), 0) / (s.length || 1));
    const churns = segments.map((s) => s.filter((r) => r.PredictedValue === 1).length / (s.length || 1) * 100);
    return {
      labels,
      datasets: [
        { label: "Avg CLV ($)", data: avgs.map((v) => +v.toFixed(0)), backgroundColor: ["#0e6f66", "#c15d2f"], yAxisID: "y" },
        { label: "Churn Rate (%)", data: churns.map((v) => +v.toFixed(1)), type: "line", borderColor: "#1c1b1a", backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 6, yAxisID: "y2" }
      ]
    };
  }

  const comboOpts = {
    plugins: { legend: { position: "bottom" } },
    scales: {
      y:  { title: { display: true, text: "Avg CLV ($)" }, position: "left" },
      y2: { title: { display: true, text: "Churn Rate (%)" }, position: "right", grid: { drawOnChartArea: false } }
    }
  };

  createOrUpdateChart("chart-active-comparison", {
    type: "bar",
    data: segmentComparison(["Active", "Inactive"], [rows.filter((r) => r.ACTIVE_MEMBER === 1), rows.filter((r) => r.ACTIVE_MEMBER === 0)]),
    options: comboOpts
  });
  createOrUpdateChart("chart-gender-comparison", {
    type: "bar",
    data: segmentComparison(["Male", "Female"], [rows.filter((r) => r.GENDER === "Male"), rows.filter((r) => r.GENDER === "Female")]),
    options: comboOpts
  });

  // ── Value Bridge ──
  const avgBase   = rows.reduce((s, r) => s + (r.Base_Revenue || 0), 0) / (rows.length || 1);
  const avgFtp    = rows.reduce((s, r) => s + (r.FTP_Cost || 0), 0) / (rows.length || 1);
  const avgAlloc  = rows.reduce((s, r) => s + (r.Allocated_Cost || 0), 0) / (rows.length || 1);
  const avgPdImpact  = rows.reduce((s, r) => s + ((r.Risk_Adjusted_Margin || 0) - (r.Net_Operating_Margin || 0)), 0) / (rows.length || 1);
  const avgRetImpact = rows.reduce((s, r) => s + ((r.Risk_Adjusted_CLV || 0) - (r.Risk_Adjusted_Margin || 0)), 0) / (rows.length || 1);
  createOrUpdateChart("chart-waterfall", {
    type: "bar",
    data: {
      labels: ["Base Rev", "FTP", "Allocated", "PD Impact", "Retention (5yr)", "Final CLV"],
      datasets: [{ data: [avgBase, -avgFtp, -avgAlloc, avgPdImpact, avgRetImpact, avgBase - avgFtp - avgAlloc + avgPdImpact + avgRetImpact], backgroundColor: ["#0e6f66", "#7e7b77", "#7e7b77", "#c15d2f", "#c15d2f", "#1c1b1a"] }]
    },
    options: { plugins: { legend: { display: false } } }
  });

  // ── Health histogram ──
  const hh = histogram(rows, "HEALTH_SCORE", 8);
  createOrUpdateChart("chart-health", {
    type: "bar",
    data: { labels: hh.labels, datasets: [{ data: hh.values, backgroundColor: "#0e6f66" }] },
    options: { plugins: { legend: { display: false } } }
  });

  // ── Key drivers correlation ──
  const drivers = [
    { key: "BALANCE", label: "Balance" }, { key: "PRODUCTS_NUMBER", label: "Products" },
    { key: "HEALTH_SCORE", label: "Health" }, { key: "CREDIT_SCORE", label: "Credit" }, { key: "TENURE", label: "Tenure" }
  ];
  createOrUpdateChart("chart-drivers", {
    type: "bar",
    data: { labels: drivers.map((d) => d.label), datasets: [{ data: drivers.map((d) => correlation(rows, d.key, "Risk_Adjusted_CLV")), backgroundColor: "#c15d2f" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { min: -1, max: 1 } } }
  });

  // ── Year-by-year CLV projection ──
  const yearly = yearlyProjection(rows);
  createOrUpdateChart("chart-yearly", {
    type: "bar",
    data: {
      labels: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
      datasets: [{ label: "Expected CLV Contribution", data: yearly, backgroundColor: ["#0e6f66", "#3d8c83", "#7bbbb4", "#a9d4d0", "#d0ebe9"] }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { title: { display: true, text: "Avg CLV per Customer ($)" } } }
    }
  });

  // ── Portfolio: CLV distribution ──
  const dist = histogram(rows, "Risk_Adjusted_CLV", 8);
  createOrUpdateChart("chart-distribution", {
    type: "bar",
    data: { labels: dist.labels, datasets: [{ data: dist.values, backgroundColor: "#0e6f66" }] },
    options: { plugins: { legend: { display: false } } }
  });

  // ── Segment mix donut ──
  const sm = groupAverage(rows, "PRODUCT_SEGMENT", "Risk_Adjusted_CLV");
  createOrUpdateChart("chart-segment-mix", {
    type: "doughnut",
    data: { labels: sm.labels, datasets: [{ data: sm.values.map((v) => Math.abs(v)), backgroundColor: ["#0e6f66", "#c15d2f", "#1c1b1a", "#7e7b77"] }] },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  // ── Revenue Concentration (Pareto) ──
  const { xs, ys, top20pct } = paretoCurve(rows);
  createOrUpdateChart("chart-pareto", {
    type: "line",
    data: {
      labels: xs,
      datasets: [
        { label: "Cumulative CLV %", data: ys, borderColor: "#0e6f66", backgroundColor: "rgba(14,111,102,0.12)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2.5 },
        { label: "Perfect equality", data: xs.map((x) => parseFloat(x)), borderColor: "rgba(28,27,26,0.25)", borderDash: [6, 4], pointRadius: 0, fill: false, borderWidth: 1.5 }
      ]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            title: (items) => `Top ${items[0].label}% of customers`,
            label: (item) => item.datasetIndex === 0 ? `${Number(item.raw).toFixed(1)}% of total CLV` : null
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "Customer Percentile (ranked by CLV, high \u2192 low)" }, ticks: { maxTicksLimit: 11 } },
        y: { title: { display: true, text: "Cumulative % of Portfolio CLV" }, min: 0, max: 100 }
      }
    }
  });
}

// ── Dashboard orchestrator ────────────────────────────────────────────────────
function updateDashboard() {
  const rows = state.filtered;
  updateKPIs(rows);
  updateCharts(rows);
  updateTables(rows);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels  = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      panels.forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    });
  });
}

// ── Filters, search & sorting ─────────────────────────────────────────────────
function applyFilters() {
  const filters = {
    GENDER: selectors.gender.value, CREDIT_TIER: selectors.credit.value,
    PRODUCT_SEGMENT: selectors.product.value, AGE_GROUP: selectors.age.value,
    TENURE_GROUP: selectors.tenure.value, ACTIVE_MEMBER: selectors.active.value
  };
  state.filtered = data.filter((row) =>
    Object.entries(filters).every(([k, v]) => v === "ALL" || String(row[k]) === v)
  );
  updateDashboard();
}

function initFilters() {
  populateSelect(selectors.gender,  uniqueValues("GENDER"));
  populateSelect(selectors.credit,  uniqueValues("CREDIT_TIER"));
  populateSelect(selectors.product, uniqueValues("PRODUCT_SEGMENT"));
  populateSelect(selectors.age,     uniqueValues("AGE_GROUP"));
  populateSelect(selectors.tenure,  uniqueValues("TENURE_GROUP"));
  Object.values(selectors).forEach((sel) => sel.addEventListener("change", applyFilters));

  const searchEl = document.getElementById("search-portfolio");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      state.search = e.target.value;
      updateTables(state.filtered);
    });
  }

  document.querySelectorAll("#table-portfolio thead th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      state.sort.dir = (state.sort.col === col) ? state.sort.dir * -1 : -1;
      state.sort.col = col;
      document.querySelectorAll("#table-portfolio thead th").forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(state.sort.dir === 1 ? "sort-asc" : "sort-desc");
      updateTables(state.filtered);
    });
  });
}

initTabs();
initFilters();
applyFilters();
