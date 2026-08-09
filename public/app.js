function comma(x) {
  return Number(x).toLocaleString("en-US");
}

function miles(meters) {
  return meters / 1609.34;
}

function feet(meters) {
  return meters * 3.28084;
}

function formatSpeed(avg_speed_mph, sport_type) {
  if (!avg_speed_mph || avg_speed_mph <= 0) return null;
  if (sport_type === "Run" || sport_type === "Walk") {
    const pace = 60 / avg_speed_mph;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    return `avg ${paceMin}:${String(paceSec).padStart(2, "0")} min/mi pace`;
  }
  return `avg ${avg_speed_mph.toFixed(1)} mph`;
}

function trendIndicator(trend) {
  if (trend === 0 || trend == null) return "";
  if (trend > 0) return `<span class="trend-up">↑ ${(trend * 100).toFixed(0)}%</span>`;
  return `<span class="trend-down">↓ ${(Math.abs(trend) * 100).toFixed(0)}%</span>`;
}

function iconDistance() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="#4a90e2" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconElevation() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <path d="M3 20l9-16 9 16H3z" stroke="#4a90e2" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconRides() {
  return `
    <svg class="icon" viewBox="0 0 24 24">
      <circle cx="5" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
      <circle cx="19" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
      <path d="M5 17l6-10 4 6h4" stroke="#4a90e2" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function showSpinner() {
  document.getElementById("spinner").style.display = "block";
}

function hideSpinner() {
  document.getElementById("spinner").style.display = "none";
}

/* ========== BIKE COMPARISON ========== */

let selectedBikes = new Map(); // gid -> { name, data }
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
  
  let html = `
    <div class="comparison-header">
      <h3>🔍 Compare Bikes</h3>
      <button class="clear-comparison" onclick="clearBikeComparison()">Clear Comparison</button>
    </div>
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
  `;
  
  bikeArray.forEach(bike => {
    html += `<th>${bike.name}</th>`;
  });
  
  html += `</tr></thead><tbody>`;
  
  // Distance row
  html += `<tr><td><strong>${iconDistance()} Distance</strong></td>`;
  bikeArray.forEach(bike => {
    const dist = miles(bike.data.distance).toFixed(1);
    html += `<td>${comma(dist)} mi</td>`;
  });
  html += `</tr>`;
  
  // Elevation row
  html += `<tr><td><strong>${iconElevation()} Elevation</strong></td>`;
  bikeArray.forEach(bike => {
    const elev = feet(bike.data.elevation).toFixed(0);
    html += `<td>${comma(elev)} ft</td>`;
  });
  html += `</tr>`;
  
  // Activities row
  html += `<tr><td><strong>${iconRides()} Activities</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${comma(bike.data.count)}</td>`;
  });
  html += `</tr>`;
  
  html += `</tbody></table>`;
  
  document.getElementById("comparison-content").innerHTML = html;
}

function clearBikeComparison() {
  selectedBikes.clear();
  document.querySelectorAll("input[type='checkbox'][id^='checkbox-']").forEach(cb => {
    cb.checked = false;
  });
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

  if (data.error) {
    statusDiv.innerHTML = data.error;
    return;
  }

  statusDiv.innerHTML = data.message;

  renderAll(data);
}

/* ========== RENDER EVERYTHING ========== */

function renderAll(data) {
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

  document.getElementById("activity-counts").innerHTML += html;
}

/* ========== ANNUAL STATS ========== */

let selectedTypes = new Set();

function renderAnnualStats(data) {
  const container = document.getElementById("activity-type-checkboxes");
  container.innerHTML = "";

  const types = Object.keys(data.activityCounts);

  // ALL checkbox
  const allDiv = document.createElement("div");
  allDiv.innerHTML = `
    <label>
      <input type="checkbox" id="chk-all" checked>
      <strong>ALL</strong>
    </label>
  `;
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

  // Individual checkboxes
  types.forEach(type => {
    const id = `chk-${type}`;
    const div = document.createElement("div");
    div.innerHTML = `
      <label>
        <input type="checkbox" id="${id}" checked>
        ${type}
      </label>
    `;
    container.appendChild(div);

    document.getElementById(id).addEventListener("change", () => {
      const checked = document.getElementById(id).checked;
      if (checked) selectedTypes.add(type);
      else selectedTypes.delete(type);

      document.getElementById("chk-all").checked =
        selectedTypes.size === types.length;

      updateAnnualStatsTable(data);
    });
  });

  updateAnnualStatsTable(data);
}

function updateAnnualStatsTable(data) {
  const annual = {};
  let totalDistance = 0;
  let totalElevation = 0;
  let totalCount = 0;

  for (const a of data.activities) {
    if (!selectedTypes.has(a.sport_type)) continue;

    const year = new Date(a.start_date).getFullYear();
    if (!annual[year]) annual[year] = { distance: 0, elevation: 0, count: 0 };

    annual[year].distance += a.distance;
    annual[year].elevation += a.total_elevation_gain;
    annual[year].count++;

    totalDistance += a.distance;
    totalElevation += a.total_elevation_gain;
    totalCount++;
  }

  const years = Object.keys(annual).sort((a, b) => b - a);

  let html = `
    <div class="year-card">
      <div class="year-title">Total</div>
      <div class="metric-row">
        <div class="metric">${iconDistance()} ${comma(miles(totalDistance).toFixed(1))} mi</div>
        <div class="metric">${iconElevation()} ${comma(feet(totalElevation).toFixed(0))} ft</div>
        <div class="metric">${iconRides()} ${comma(totalCount)} Activities</div>
      </div>
    </div>
  `;

  years.forEach(year => {
    const y = annual[year];
    html += `
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

  document.getElementById("annual-stats-table").innerHTML = html;
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

    // Determine dominant sport type for speed/pace formatting
    const years = Object.keys(bikeYearStats[gid]);
    const sport_type = "Ride"; // bikes are rides

    const speedLabel = formatSpeed(total.avg_speed_mph, sport_type);
    const prLabel = total.pr_count > 0 ? `🏆 ${comma(total.pr_count)} PRs` : "";

    let card = `
      <div class="card">
        <div class="accent-bar"></div>
        <div class="card-header">
          <div class="bike-header-content">
            <svg class="icon-lg" viewBox="0 0 24 24">
              <circle cx="5" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
              <circle cx="19" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
              <path d="M5 17l6-10 4 6h4" stroke="#4a90e2" stroke-width="2" fill="none"/>
            </svg>
            <span>${gearNames[gid]}</span>
          </div>
          <input type="checkbox" id="checkbox-${gid}" class="bike-checkbox" onchange="toggleBikeSelection('${gid}', '${gearNames[gid]}')">
        </div>

        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(total.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(feet(total.elevation).toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(total.count)} Activities</div>
          ${speedLabel ? `<div class="metric speed-metric">⚡ ${speedLabel}</div>` : ""}
          ${prLabel ? `<div class="metric">${prLabel}</div>` : ""}
        </div>
    `;

    const sortedYears = Object.keys(bikeYearStats[gid]).sort((a, b) => b - a);
    sortedYears.forEach(year => {
      const y = bikeYearStats[gid][year];
      const yearSpeedLabel = formatSpeed(y.avg_speed_mph, sport_type);
      const yearPrLabel = y.pr_count > 0 ? `🏆 ${comma(y.pr_count)} PRs` : "";
      const weeklyId = `weeks-${gid}-${year}`;

      // Build weekly rows sorted descending
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
            <button class="week-toggle-btn" id="btn-${weeklyId}" aria-label="Toggle weekly breakdown">▶</button>
          </div>
          <div class="metric-row">
            <div class="metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
            <div class="metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
            <div class="metric">${iconRides()} ${comma(y.count)} Activities</div>
            ${yearSpeedLabel ? `<div class="metric speed-metric">⚡ ${yearSpeedLabel}</div>` : ""}
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
  }

  document.getElementById("bike-grid").innerHTML = html;
}

function toggleWeeks(id) {
  const container = document.getElementById(id);
  const btn = document.getElementById(`btn-${id}`);
  if (!container) return;
  const isOpen = container.style.display !== "none";
  container.style.display = isOpen ? "none" : "block";
  if (btn) btn.textContent = isOpen ? "▶" : "▼";
}
