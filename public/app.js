function comma(x) {
  return Number(x).toLocaleString("en-US");
}

function miles(meters) {
  return meters / 1609.34;
}

function feet(meters) {
  return meters * 3.28084;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSpeed(avg_speed_mph, sport_type = "Ride") {
  if (!avg_speed_mph || avg_speed_mph <= 0) return null;
  if (sport_type === "Run" || sport_type === "Walk") {
    const pace = 60 / avg_speed_mph;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    return `avg ${paceMin}:${String(paceSec).padStart(2, "0")} min/mi pace`;
  }
  return `avg ${avg_speed_mph.toFixed(1)} mph`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function trendIndicator(trend) {
  if (trend === 0 || trend == null) return "";
  if (trend > 0) return `<span class="trend-up">Up ${(trend * 100).toFixed(0)}%</span>`;
  return `<span class="trend-down">Down ${(Math.abs(trend) * 100).toFixed(0)}%</span>`;
}

function iconDistance() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconElevation() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M3 20l9-16 9 16H3z" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconRides() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconSpeed() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 7v5l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function showSpinner() {
  document.getElementById("spinner").style.display = "block";
}

function hideSpinner() {
  document.getElementById("spinner").style.display = "none";
}

function getWeekStartMonday(dateStr) {
  const d = new Date(dateStr);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  local.setHours(0, 0, 0, 0);
  return local;
}

function formatShortDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatMonthLabel(monthIndex) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex];
}

const STORAGE_KEYS = {
  selectedTypes: "strava:selectedTypes",
  selectedBikes: "strava:selectedBikes",
  pinnedBikes: "strava:pinnedBikes",
  bikeSearch: "strava:bikeSearch",
  bikeSort: "strava:bikeSort",
  theme: "strava:theme",
  annualExpandedYears: "strava:annualExpandedYears",
  annualBreakdownMode: "strava:annualBreakdownMode"
};

let selectedBikes = new Map();
let allGearData = {};
let currentBikeRows = [];
let selectedTypes = new Set();
let pinnedBikes = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedBikes) || "[]"));
let annualExpandedYears = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.annualExpandedYears) || "[]"));
let annualBreakdownMode = localStorage.getItem(STORAGE_KEYS.annualBreakdownMode) || "monthly";

function saveSelectedBikes() {
  localStorage.setItem(STORAGE_KEYS.selectedBikes, JSON.stringify(Array.from(selectedBikes.keys())));
}

function savePinnedBikes() {
  localStorage.setItem(STORAGE_KEYS.pinnedBikes, JSON.stringify(Array.from(pinnedBikes.values())));
}

function saveAnnualExpandedYears() {
  localStorage.setItem(STORAGE_KEYS.annualExpandedYears, JSON.stringify(Array.from(annualExpandedYears.values())));
}

function setAnnualBreakdownMode(mode) {
  annualBreakdownMode = mode === "weekly" ? "weekly" : "monthly";
  localStorage.setItem(STORAGE_KEYS.annualBreakdownMode, annualBreakdownMode);
}

function setLastSyncLabel() {
  document.getElementById("last-sync").textContent = `Last updated: ${new Date().toLocaleString()}`;
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(STORAGE_KEYS.theme, document.body.classList.contains("dark") ? "dark" : "light");
}

function applyThemePreference() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "dark") {
    document.body.classList.add("dark");
    return;
  }
  if (saved === "light") {
    document.body.classList.remove("dark");
    return;
  }
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
}

function renderKpiSummary(data) {
  const kpi = document.getElementById("kpi-summary");
  const totalActivities = data.activities.length;
  const totalDistanceMeters = data.activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalElevationMeters = data.activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
  const activeBikes = Object.values(data.gearDetails || {}).filter(gear => gear && !gear.retired).length;

  kpi.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Activities</div>
      <div class="kpi-value">${comma(totalActivities)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Distance</div>
      <div class="kpi-value">${comma(miles(totalDistanceMeters).toFixed(1))} mi</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Elevation</div>
      <div class="kpi-value">${comma(feet(totalElevationMeters).toFixed(0))} ft</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Bikes</div>
      <div class="kpi-value">${comma(activeBikes)}</div>
    </div>
  `;
}

/* ========== BIKE COMPARISON ========== */

function toggleBikeSelection(gid, bikeName) {
  if (selectedBikes.has(gid)) {
    selectedBikes.delete(gid);
  } else {
    selectedBikes.set(gid, { name: bikeName, data: allGearData[gid] });
  }

  const checkbox = document.getElementById(`checkbox-${gid}`);
  if (checkbox) checkbox.checked = selectedBikes.has(gid);

  saveSelectedBikes();
  updateComparisonDisplay();
}

function updateComparisonDisplay() {
  const comparisonSection = document.getElementById("bike-comparison-section");

  if (selectedBikes.size === 0) {
    comparisonSection.style.display = "none";
    return;
  }

  comparisonSection.style.display = "block";
  renderBikeComparison();
}

function renderBikeComparison() {
  const bikeArray = Array.from(selectedBikes.values());

  let html = `
    <div class="comparison-header">
      <h3>Compare Bikes</h3>
      <button class="clear-comparison" onclick="clearBikeComparison()">Clear Comparison</button>
    </div>
    <div class="comparison-table-wrap">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
  `;

  bikeArray.forEach(bike => {
    html += `<th>${escapeHtml(bike.name)}</th>`;
  });

  html += `</tr></thead><tbody>`;

  html += `<tr><td><strong>${iconDistance()} Distance</strong></td>`;
  bikeArray.forEach(bike => {
    const dist = miles(bike.data.distance).toFixed(1);
    html += `<td>${comma(dist)} mi</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconElevation()} Elevation</strong></td>`;
  bikeArray.forEach(bike => {
    const elev = feet(bike.data.elevation).toFixed(0);
    html += `<td>${comma(elev)} ft</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconRides()} Activities</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${comma(bike.data.count)}</td>`;
  });
  html += `</tr>`;

  html += `</tbody></table></div>`;

  html += `<div class="comparison-mobile">`;
  bikeArray.forEach(bike => {
    html += `
      <div class="comparison-mobile-card">
        <div class="comparison-mobile-title">${escapeHtml(bike.name)}</div>
        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(bike.data.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(feet(bike.data.elevation).toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(bike.data.count)} Activities</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  document.getElementById("comparison-content").innerHTML = html;
}

function clearBikeComparison() {
  selectedBikes.clear();
  document.querySelectorAll("input[type='checkbox'][id^='checkbox-']").forEach(cb => {
    cb.checked = false;
  });
  saveSelectedBikes();
  updateComparisonDisplay();
}

function pinBike(gid) {
  if (pinnedBikes.has(gid)) pinnedBikes.delete(gid);
  else pinnedBikes.add(gid);

  currentBikeRows.forEach(row => {
    if (row.gid === gid) row.isPinned = pinnedBikes.has(gid);
  });

  savePinnedBikes();
  updateBikeFilters();
}

function sortBikeRows(rows, sortValue) {
  const [field, direction] = sortValue.split("-");
  const dir = direction === "asc" ? 1 : -1;

  return rows.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

    if (field === "name") {
      return a.name.localeCompare(b.name) * dir;
    }

    if (field === "rides") {
      return (a.total.count - b.total.count) * dir;
    }

    return (a.total.distance - b.total.distance) * dir;
  });
}

function updateBikeFilters() {
  if (!currentBikeRows.length) return;

  const searchInput = document.getElementById("bike-search");
  const sortInput = document.getElementById("bike-sort");
  const search = (searchInput?.value || "").toLowerCase().trim();
  const sort = sortInput?.value || "distance-desc";

  localStorage.setItem(STORAGE_KEYS.bikeSearch, searchInput.value);
  localStorage.setItem(STORAGE_KEYS.bikeSort, sort);

  const filtered = currentBikeRows.filter(row => row.name.toLowerCase().includes(search));
  const sorted = sortBikeRows(filtered, sort);
  renderBikeRows(sorted);
}

function restoreBikeFilterInputs() {
  const bikeSearch = localStorage.getItem(STORAGE_KEYS.bikeSearch);
  const bikeSort = localStorage.getItem(STORAGE_KEYS.bikeSort);

  if (bikeSearch !== null) document.getElementById("bike-search").value = bikeSearch;
  if (bikeSort) document.getElementById("bike-sort").value = bikeSort;
}

/* ========== AUTO LOAD CACHE ========== */

window.onload = async () => {
  applyThemePreference();
  restoreBikeFilterInputs();

  const statusDiv = document.getElementById("status");

  statusDiv.innerHTML = "Loading dashboard…";
  showSpinner();

  const res = await fetch("http://192.168.0.115:5000/api/analytics/auto");
  const data = await res.json();

  hideSpinner();
  setLastSyncLabel();

  if (!data.cached) {
    statusDiv.innerHTML = data.message;
    return;
  }

  statusDiv.innerHTML = data.message;
  renderAll(data);
};

/* ========== MANUAL REFRESH ========== */

async function refreshData() {
  const statusDiv = document.getElementById("status");

  statusDiv.innerHTML = "Refreshing (only new activities)…";
  showSpinner();

  const res = await fetch("http://192.168.0.115:5000/api/analytics?refresh=1");
  const data = await res.json();

  hideSpinner();
  setLastSyncLabel();

  if (data.error) {
    statusDiv.innerHTML = data.error;
    return;
  }

  statusDiv.innerHTML = data.message;
  renderAll(data);
}

/* ========== FULL DATA PULL ========== */

async function fullPull() {
  const statusDiv = document.getElementById("status");

  statusDiv.innerHTML = "Performing full data pull…";
  showSpinner();

  const res = await fetch("http://192.168.0.115:5000/api/analytics?full=1");
  const data = await res.json();

  hideSpinner();
  setLastSyncLabel();

  if (data.error) {
    statusDiv.innerHTML = data.error;
    return;
  }

  statusDiv.innerHTML = data.message;
  renderAll(data);
}

/* ========== RENDER EVERYTHING ========== */

function renderAll(data) {
  renderKpiSummary(data);
  renderActivityCounts(data.activityCounts);
  renderAnnualStats(data);
  renderBikeStats(data.bikeYearStats, data.gearTotals, data.gearDetails);
}

/* ========== ACTIVITY COUNTS ========== */

function renderActivityCounts(counts) {
  let html = `<div class="metric-row">`;

  for (const type of Object.keys(counts)) {
    html += `
      <div class="metric">
        ${type}: ${comma(counts[type])}
      </div>
    `;
  }

  html += `</div>`;

  document.getElementById("activity-counts-content").innerHTML = html;
}

/* ========== ANNUAL STATS ========== */

function toggleAnnualYear(year) {
  if (annualExpandedYears.has(String(year))) annualExpandedYears.delete(String(year));
  else annualExpandedYears.add(String(year));
  saveAnnualExpandedYears();
}

function buildAnnualBreakdowns(data) {
  const annual = {};
  let totalDistance = 0;
  let totalElevation = 0;
  let totalCount = 0;
  let totalMovingTime = 0;

  for (const a of data.activities) {
    if (!selectedTypes.has(a.sport_type)) continue;

    const date = new Date(a.start_date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const movingTime = a.moving_time || 0;

    const weekStart = getWeekStartMonday(a.start_date);
    const weekKey = formatShortDate(weekStart);

    if (!annual[year]) {
      annual[year] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        months: {},
        weeks: {}
      };
    }

    annual[year].distance += a.distance;
    annual[year].elevation += a.total_elevation_gain;
    annual[year].count++;
    annual[year].moving_time += movingTime;

    if (!annual[year].months[month]) {
      annual[year].months[month] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        label: formatMonthLabel(month)
      };
    }
    annual[year].months[month].distance += a.distance;
    annual[year].months[month].elevation += a.total_elevation_gain;
    annual[year].months[month].count++;
    annual[year].months[month].moving_time += movingTime;

    if (!annual[year].weeks[weekKey]) {
      annual[year].weeks[weekKey] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        label: weekKey
      };
    }
    annual[year].weeks[weekKey].distance += a.distance;
    annual[year].weeks[weekKey].elevation += a.total_elevation_gain;
    annual[year].weeks[weekKey].count++;
    annual[year].weeks[weekKey].moving_time += movingTime;

    totalDistance += a.distance;
    totalElevation += a.total_elevation_gain;
    totalCount++;
    totalMovingTime += movingTime;
  }

  return { annual, totalDistance, totalElevation, totalCount, totalMovingTime };
}

function renderAnnualBreakdownItems(items, mode) {
  const sorted = items.sort((a, b) => {
    if (mode === "monthly") return b.sortDate - a.sortDate;
    return b.sortDate - a.sortDate;
  });

  if (!sorted.length) {
    return `<div class="annual-breakdown-empty">No ${mode} data</div>`;
  }

  let html = `<div class="annual-breakdown-list">`;
  sorted.forEach(item => {
    html += `
      <div class="annual-breakdown-item">
        <div class="annual-breakdown-label">${escapeHtml(item.label)}</div>
        <div class="annual-breakdown-metrics">
          <div class="annual-breakdown-metric">${iconDistance()} ${comma(miles(item.distance).toFixed(1))} mi</div>
          <div class="annual-breakdown-metric">${iconElevation()} ${comma(feet(item.elevation).toFixed(0))} ft</div>
          <div class="annual-breakdown-metric">${iconRides()} ${comma(item.count)} Activities</div>
          <div class="annual-breakdown-metric">Time ${formatDuration(item.moving_time)}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function updateAnnualStatsTable(data) {
  const { annual, totalDistance, totalElevation, totalCount, totalMovingTime } = buildAnnualBreakdowns(data);
  const years = Object.keys(annual).sort((a, b) => b - a);

  let html = `
    <div class="annual-breakdown-toolbar">
      <span class="annual-breakdown-toolbar-label">Expanded view</span>
      <div class="annual-breakdown-mode-toggle" role="tablist" aria-label="Annual breakdown mode">
        <button
          type="button"
          class="annual-breakdown-mode-btn ${annualBreakdownMode === "monthly" ? "active" : ""}"
          onclick="setAnnualBreakdownMode('monthly'); updateAnnualStatsTable(window.__annualStatsData)"
        >
          Monthly
        </button>
        <button
          type="button"
          class="annual-breakdown-mode-btn ${annualBreakdownMode === "weekly" ? "active" : ""}"
          onclick="setAnnualBreakdownMode('weekly'); updateAnnualStatsTable(window.__annualStatsData)"
        >
          Weekly
        </button>
      </div>
    </div>

    <div class="annual-stats-rows">
      <div class="annual-stats-row annual-stats-row-header">
        <div class="annual-col annual-col-year">Year</div>
        <div class="annual-col annual-col-metric">Distance</div>
        <div class="annual-col annual-col-metric">Elevation</div>
        <div class="annual-col annual-col-metric">Activities</div>
        <div class="annual-col annual-col-metric">Time</div>
        <div class="annual-col annual-col-toggle">Details</div>
      </div>

      <div class="annual-stats-row annual-stats-row-total">
        <div class="annual-col annual-col-year"><strong>Total</strong></div>
        <div class="annual-col annual-col-metric">${iconDistance()} ${comma(miles(totalDistance).toFixed(1))} mi</div>
        <div class="annual-col annual-col-metric">${iconElevation()} ${comma(feet(totalElevation).toFixed(0))} ft</div>
        <div class="annual-col annual-col-metric">${iconRides()} ${comma(totalCount)} Activities</div>
        <div class="annual-col annual-col-metric">Time ${formatDuration(totalMovingTime)}</div>
        <div class="annual-col annual-col-toggle"></div>
      </div>
  `;

  years.forEach(year => {
    const y = annual[year];
    const isExpanded = annualExpandedYears.has(String(year));
    const breakdownSource = annualBreakdownMode === "monthly" ? y.months : y.weeks;
    const breakdownItems = Object.entries(breakdownSource).map(([key, value]) => ({
      ...value,
      sortDate: annualBreakdownMode === "monthly"
        ? new Date(Number(year), Number(key), 1).getTime()
        : new Date(key).getTime()
    }));

    html += `
      <div class="annual-year-block">
        <div class="annual-stats-row annual-year-row ${isExpanded ? "expanded" : ""}">
          <div class="annual-col annual-col-year">${year}</div>
          <div class="annual-col annual-col-metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
          <div class="annual-col annual-col-metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
          <div class="annual-col annual-col-metric">${iconRides()} ${comma(y.count)} Activities</div>
          <div class="annual-col annual-col-metric">Time ${formatDuration(y.moving_time)}</div>
          <div class="annual-col annual-col-toggle">
            <button
              type="button"
              class="week-toggle-btn ${isExpanded ? "open" : ""}"
              aria-expanded="${isExpanded}"
              aria-label="Toggle ${year} ${annualBreakdownMode} breakdown"
              onclick="toggleAnnualYear('${year}'); updateAnnualStatsTable(window.__annualStatsData)"
            >
              <span class="chevron-icon" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        ${isExpanded ? `
          <div class="annual-year-breakdown">
            ${renderAnnualBreakdownItems(breakdownItems, annualBreakdownMode)}
          </div>
        ` : ""}
      </div>
    `;
  });

  html += `</div>`;

  document.getElementById("annual-stats-table").innerHTML = html;
}

function renderAnnualStats(data) {
  window.__annualStatsData = data;

  const container = document.getElementById("activity-type-checkboxes");
  container.innerHTML = "";

  const types = Object.keys(data.activityCounts);
  const storedTypes = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedTypes) || "null");

  const allDiv = document.createElement("div");
  allDiv.className = "filter-chip";
  allDiv.innerHTML = `
    <label>
      <input type="checkbox" id="chk-all">
      <span>All</span>
    </label>
  `;
  container.appendChild(allDiv);

  selectedTypes = new Set(storedTypes && storedTypes.length ? storedTypes.filter(t => types.includes(t)) : types);

  types.forEach(type => {
    const id = `chk-${type}`;
    const div = document.createElement("div");
    div.className = "filter-chip";
    div.innerHTML = `
      <label>
        <input type="checkbox" id="${id}" ${selectedTypes.has(type) ? "checked" : ""}>
        <span>${type}</span>
      </label>
    `;
    container.appendChild(div);

    document.getElementById(id).addEventListener("change", () => {
      const checked = document.getElementById(id).checked;
      if (checked) selectedTypes.add(type);
      else selectedTypes.delete(type);

      document.getElementById("chk-all").checked = selectedTypes.size === types.length;
      localStorage.setItem(STORAGE_KEYS.selectedTypes, JSON.stringify(Array.from(selectedTypes)));
      updateAnnualStatsTable(data);
    });
  });

  document.getElementById("chk-all").checked = selectedTypes.size === types.length;
  document.getElementById("chk-all").addEventListener("change", () => {
    const allChecked = document.getElementById("chk-all").checked;
    types.forEach(t => {
      document.getElementById(`chk-${t}`).checked = allChecked;
      if (allChecked) selectedTypes.add(t);
      else selectedTypes.delete(t);
    });
    localStorage.setItem(STORAGE_KEYS.selectedTypes, JSON.stringify(Array.from(selectedTypes)));
    updateAnnualStatsTable(data);
  });

  updateAnnualStatsTable(data);
}

/* ========== BIKE STATS ========== */

function renderBikeRows(rows) {
  let html = "";

  rows.forEach(row => {
    const total = row.total;
    const isSelected = selectedBikes.has(row.gid);
    const sport_type = "Ride";
    const speedLabel = formatSpeed(total.avg_speed_mph, sport_type);
    const prLabel = total.pr_count > 0 ? `${comma(total.pr_count)} PRs` : "";

    let card = `
      <div class="card">
        <div class="accent-bar"></div>
        <div class="card-header">
          <div class="bike-header-content">
            <svg class="icon-lg" viewBox="0 0 24 24">
              <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
              <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
            <span>${escapeHtml(row.name)}</span>
          </div>
          <div>
            <button class="pin-button ${row.isPinned ? "pinned" : ""}" onclick="pinBike('${row.gid}')">${row.isPinned ? "Pinned" : "Pin"}</button>
            <input type="checkbox" id="checkbox-${row.gid}" class="bike-checkbox" data-gid="${row.gid}" data-name="${escapeHtml(row.name)}" ${isSelected ? "checked" : ""}>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(total.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(feet(total.elevation).toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(total.count)} Activities</div>
          ${speedLabel ? `<div class="metric speed-metric">${iconSpeed()} ${speedLabel}</div>` : ""}
          ${prLabel ? `<div class="metric">${prLabel}</div>` : ""}
        </div>
    `;

    row.years.forEach(year => {
      const y = row.bikeYearStats[year];
      const yearSpeedLabel = formatSpeed(y.avg_speed_mph, sport_type);
      const yearPrLabel = y.pr_count > 0 ? `${comma(y.pr_count)} PRs` : "";
      const weeklyId = `weeks-${row.gid}-${year}`;

      const weekNums = Object.keys(y.weeks || {}).map(Number).sort((a, b) => b - a);
      let weeksHtml = "";
      weekNums.forEach(wk => {
        const w = y.weeks[wk];
        const wDist = miles(w.distance).toFixed(1);
        const wElev = feet(w.elevation).toFixed(0);
        const trend = trendIndicator(w.trend);
        weeksHtml += `
          <div class="week-row">
            <span class="week-label">Wk ${wk}</span>
            <span>${iconDistance()} ${comma(wDist)} mi</span>
            <span>${iconElevation()} ${comma(wElev)} ft</span>
            <span>${iconRides()} ${w.count}</span>
            ${trend ? `<span>${trend}</span>` : ""}
          </div>
        `;
      });

      card += `
        <div class="year-card">
          <div class="year-card-header" onclick="toggleWeeks('${weeklyId}')">
            <div class="year-title">${year}</div>
            <button class="week-toggle-btn" id="btn-${weeklyId}" aria-label="Toggle weekly breakdown" aria-expanded="false" type="button">
              <span class="chevron-icon" aria-hidden="true"></span>
            </button>
          </div>
          <div class="metric-row">
            <div class="metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
            <div class="metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
            <div class="metric">${iconRides()} ${comma(y.count)} Activities</div>
            ${yearSpeedLabel ? `<div class="metric speed-metric">${iconSpeed()} ${yearSpeedLabel}</div>` : ""}
            ${yearPrLabel ? `<div class="metric">${yearPrLabel}</div>` : ""}
          </div>
          <div class="weeks-container" id="${weeklyId}" style="display:none;">
            ${weeksHtml || "<div class='week-row'>No weekly data</div>"}
          </div>
        </div>
      `;
    });

    card += `</div>`;
    html += card;
  });

  document.getElementById("bike-grid").innerHTML = html;

  document.querySelectorAll(".bike-checkbox").forEach(cb => {
    cb.addEventListener("change", event => {
      const gid = event.target.dataset.gid;
      const name = event.target.dataset.name;
      toggleBikeSelection(gid, name);
    });
  });
}

function toggleWeeks(id) {
  const container = document.getElementById(id);
  const btn = document.getElementById(`btn-${id}`);
  if (!container) return;
  const isOpen = container.style.display !== "none";
  container.style.display = isOpen ? "none" : "block";
  if (btn) {
    btn.setAttribute("aria-expanded", String(!isOpen));
    btn.classList.toggle("open", !isOpen);
  }
}

function renderBikeStats(bikeYearStats, gearTotals, gearDetails) {
  allGearData = gearTotals;

  const gearNames = {};
  for (const gid of Object.keys(gearDetails)) {
    const detail = gearDetails[gid];
    gearNames[gid] = (detail && detail.name) || gid;
  }

  const rememberedBikes = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedBikes) || "[]");
  selectedBikes = new Map();
  rememberedBikes.forEach(gid => {
    if (gearTotals[gid]) {
      selectedBikes.set(gid, { name: gearNames[gid] || gid, data: gearTotals[gid] });
    }
  });

  currentBikeRows = Object.keys(bikeYearStats).map(gid => ({
    gid,
    name: gearNames[gid] || gid,
    total: gearTotals[gid],
    bikeYearStats: bikeYearStats[gid],
    years: Object.keys(bikeYearStats[gid]).sort((a, b) => b - a),
    isPinned: pinnedBikes.has(gid)
  }));

  updateBikeFilters();
  updateComparisonDisplay();
}
