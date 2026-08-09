function comma(x) {
  return Number(x).toLocaleString("en-US");
}

function miles(meters) {
  return meters / 1609.34;
}

function feet(meters) {
  return meters * 3.28084;
}

function iconDistance() {
  return `<svg class="icon" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" stroke="var(--clr-accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function iconElevation() {
  return `<svg class="icon" viewBox="0 0 24 24"><path d="M3 20l9-16 9 16H3z" stroke="var(--clr-accent)" stroke-width="2" fill="none"/></svg>`;
}

function iconRides() {
  return `<svg class="icon" viewBox="0 0 24 24"><circle cx="5" cy="17" r="3" stroke="var(--clr-accent)" stroke-width="2" fill="none"/><circle cx="19" cy="17" r="3" stroke="var(--clr-accent)" stroke-width="2" fill="none"/><path d="M5 17l6-10 4 6h4" stroke="var(--clr-accent)" stroke-width="2" fill="none"/></svg>`;
}

function showSpinner() { document.getElementById("spinner").style.display = "block"; }
function hideSpinner() { document.getElementById("spinner").style.display = "none"; }

/* ========== BIKE COMPARISON ========== */

let selectedBikes = new Map();
let allGearData = {};

function toggleBikeSelection(gid, bikeName) {
  if (selectedBikes.has(gid)) {
    selectedBikes.delete(gid);
    document.getElementById(`checkbox-${gid}`).checked = false;
  } else {
    selectedBikes.set(gid, { name: bikeName, data: allGearData[gid] });
    document.getElementById(`checkbox-${gid}`).checked = true;
  }
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

  // Desktop table
  let tableHtml = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
  `;
  bikeArray.forEach(bike => { tableHtml += `<th>${bike.name}</th>`; });
  tableHtml += `</tr></thead><tbody>`;

  tableHtml += `<tr><td>${iconDistance()} Distance</td>`;
  bikeArray.forEach(bike => { tableHtml += `<td>${comma(miles(bike.data.distance).toFixed(1))} mi</td>`; });
  tableHtml += `</tr>`;

  tableHtml += `<tr><td>${iconElevation()} Elevation</td>`;
  bikeArray.forEach(bike => { tableHtml += `<td>${comma(feet(bike.data.elevation).toFixed(0))} ft</td>`; });
  tableHtml += `</tr>`;

  tableHtml += `<tr><td>${iconRides()} Activities</td>`;
  bikeArray.forEach(bike => { tableHtml += `<td>${comma(bike.data.count)}</td>`; });
  tableHtml += `</tr></tbody></table>`;

  // Mobile card stacks
  let cardsHtml = `<div class="comparison-cards">`;
  bikeArray.forEach(bike => {
    cardsHtml += `
      <div class="comparison-card-item">
        <h4>${bike.name}</h4>
        <div class="cmp-row"><span class="cmp-label">${iconDistance()} Distance</span><span>${comma(miles(bike.data.distance).toFixed(1))} mi</span></div>
        <div class="cmp-row"><span class="cmp-label">${iconElevation()} Elevation</span><span>${comma(feet(bike.data.elevation).toFixed(0))} ft</span></div>
        <div class="cmp-row"><span class="cmp-label">${iconRides()} Activities</span><span>${comma(bike.data.count)}</span></div>
      </div>
    `;
  });
  cardsHtml += `</div>`;

  document.getElementById("comparison-content").innerHTML = `
    <div class="comparison-header">
      <h3>🔍 Compare Bikes</h3>
      <button class="clear-comparison" onclick="clearBikeComparison()">Clear Comparison</button>
    </div>
    ${tableHtml}
    ${cardsHtml}
  `;
}

function clearBikeComparison() {
  selectedBikes.clear();
  document.querySelectorAll("input[type='checkbox'][id^='checkbox-']").forEach(cb => { cb.checked = false; });
  updateComparisonDisplay();
}

/* ========== AUTO LOAD CACHE ========== */

window.onload = async () => {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = "Loading dashboard…";
  showSpinner();

  const res = await fetch("http://192.168.0.115:5000/api/analytics/auto");
  const data = await res.json();

  hideSpinner();

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

  if (data.error) { statusDiv.innerHTML = data.error; return; }
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

  if (data.error) { statusDiv.innerHTML = data.error; return; }
  statusDiv.innerHTML = data.message;
  renderAll(data);
}

/* ========== RENDER EVERYTHING ========== */

function renderAll(data) {
  renderKpiBar(data);
  renderActivityCounts(data.activityCounts);
  renderAnnualStats(data);
  renderBikeStats(data.bikeYearStats, data.gearTotals, data.gearDetails);
}

/* ========== KPI BAR ========== */

function renderKpiBar(data) {
  let totalDist = 0, totalElev = 0, totalActs = 0;
  for (const a of data.activities) {
    totalDist += a.distance;
    totalElev += a.total_elevation_gain;
    totalActs++;
  }

  const years = new Set(data.activities.map(a => new Date(a.start_date).getFullYear()));

  const kpiBar = document.getElementById("kpi-bar");
  kpiBar.style.display = "";
  kpiBar.innerHTML = `
    <div class="kpi-tile">
      <div class="kpi-value">${comma(miles(totalDist).toFixed(0))}</div>
      <div class="kpi-label">Total Miles</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-value">${comma((feet(totalElev) / 1000).toFixed(0))}k</div>
      <div class="kpi-label">Total Feet Climbed</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-value">${comma(totalActs)}</div>
      <div class="kpi-label">Total Activities</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-value">${years.size}</div>
      <div class="kpi-label">Years Active</div>
    </div>
  `;
}

/* ========== ACTIVITY COUNTS ========== */

function renderActivityCounts(counts) {
  let html = `<div class="metric-row">`;
  for (const type of Object.keys(counts)) {
    html += `<div class="metric">${type}: ${comma(counts[type])}</div>`;
  }
  html += `</div>`;

  // FIX: use = not += to avoid duplicates on refresh
  document.getElementById("activity-counts-content").innerHTML = html;
}

/* ========== ANNUAL STATS ========== */

let selectedTypes = new Set();

function renderAnnualStats(data) {
  const container = document.getElementById("activity-type-checkboxes");
  container.innerHTML = "";

  const types = Object.keys(data.activityCounts);

  const allDiv = document.createElement("div");
  allDiv.innerHTML = `<label><input type="checkbox" id="chk-all" checked><strong>ALL</strong></label>`;
  container.appendChild(allDiv);

  selectedTypes = new Set(types);

  document.getElementById("chk-all").addEventListener("change", () => {
    const allChecked = document.getElementById("chk-all").checked;
    types.forEach(t => {
      document.getElementById(`chk-${t}`).checked = allChecked;
      if (allChecked) selectedTypes.add(t);
      else selectedTypes.delete(t);
    });
    updateAnnualStatsTable(data);
  });

  types.forEach(type => {
    const id = `chk-${type}`;
    const div = document.createElement("div");
    div.innerHTML = `<label><input type="checkbox" id="${id}" checked>${type}</label>`;
    container.appendChild(div);

    document.getElementById(id).addEventListener("change", () => {
      const checked = document.getElementById(id).checked;
      if (checked) selectedTypes.add(type);
      else selectedTypes.delete(type);
      document.getElementById("chk-all").checked = selectedTypes.size === types.length;
      updateAnnualStatsTable(data);
    });
  });

  updateAnnualStatsTable(data);
}

function updateAnnualStatsTable(data) {
  const annual = {};
  let totalDistance = 0, totalElevation = 0, totalCount = 0;

  for (const a of data.activities) {
    if (!selectedTypes.has(a.sport_type)) continue;
    const year = new Date(a.start_date).getFullYear();
    if (!annual[year]) annual[year] = { distance: 0, elevation: 0, count: 0 };
    annual[year].distance  += a.distance;
    annual[year].elevation += a.total_elevation_gain;
    annual[year].count++;
    totalDistance  += a.distance;
    totalElevation += a.total_elevation_gain;
    totalCount++;
  }

  const years = Object.keys(annual).sort((a, b) => b - a);

  // Build mini-card HTML
  let cardsHtml = `
    <div class="year-mini-cards-wrap">
      <div class="year-mini-cards">
        <!-- TOTAL card -->
        <div class="year-mini-card year-total">
          <div class="ym-year">Total</div>
          <div class="ym-metric">${iconDistance()} ${comma(miles(totalDistance).toFixed(0))} mi</div>
          <div class="ym-metric">${iconElevation()} ${comma(feet(totalElevation).toFixed(0))} ft</div>
          <div class="ym-metric">${iconRides()} ${comma(totalCount)}</div>
        </div>
  `;

  years.forEach(year => {
    const y = annual[year];
    cardsHtml += `
        <div class="year-mini-card">
          <div class="ym-year">${year}</div>
          <div class="ym-metric">${iconDistance()} ${comma(miles(y.distance).toFixed(0))} mi</div>
          <div class="ym-metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
          <div class="ym-metric">${iconRides()} ${comma(y.count)}</div>
        </div>
    `;
  });

  cardsHtml += `</div></div>`;

  document.getElementById("annual-stats-table").innerHTML = cardsHtml;
}

/* ========== BIKE STATS ========== */

function renderBikeStats(bikeYearStats, gearTotals, gearDetails) {
  allGearData = gearTotals;

  const gearNames = {};
  for (const gid of Object.keys(gearDetails)) {
    gearNames[gid] = gearDetails[gid].name || gid;
  }

  let html = "";

  for (const gid of Object.keys(bikeYearStats)) {
    const total = gearTotals[gid];

    let card = `
      <div class="card">
        <div class="accent-bar"></div>
        <div class="card-header">
          <div class="bike-header-content">
            <svg class="icon-lg" viewBox="0 0 24 24">
              <circle cx="5" cy="17" r="3" stroke="var(--clr-accent)" stroke-width="2" fill="none"/>
              <circle cx="19" cy="17" r="3" stroke="var(--clr-accent)" stroke-width="2" fill="none"/>
              <path d="M5 17l6-10 4 6h4" stroke="var(--clr-accent)" stroke-width="2" fill="none"/>
            </svg>
            <span>${gearNames[gid]}</span>
          </div>
          <input type="checkbox" id="checkbox-${gid}" class="bike-checkbox" onchange="toggleBikeSelection('${gid}', '${gearNames[gid]}')">
        </div>

        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(total.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(feet(total.elevation).toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(total.count)} Activities</div>
        </div>
    `;

    const years = Object.keys(bikeYearStats[gid]).sort((a, b) => b - a);
    years.forEach(year => {
      const y = bikeYearStats[gid][year];
      card += `
        <div class="year-card">
          <div class="year-title">${year}</div>
          <div class="metric-row">
            <div class="metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
            <div class="metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
            <div class="metric">${iconRides()} ${comma(y.count)} Activities</div>
          </div>
        </div>
      `;
    });

    card += `</div>`;
    html += card;
  }

  document.getElementById("bike-grid").innerHTML = html;
}
