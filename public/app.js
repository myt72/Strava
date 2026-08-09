function comma(x) {
  return Number(x).toLocaleString("en-US");
}

function miles(meters) {
  return meters / 1609.34;
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

/* ----------------- AUTO LOAD CACHE ----------------- */

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

/* ----------------- MANUAL REFRESH ----------------- */

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

/* ----------------- FULL DATA PULL ----------------- */

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

/* ----------------- RENDER EVERYTHING ----------------- */

function renderAll(data) {
  renderActivityCounts(data.activityCounts);
  renderAnnualStats(data);
  renderBikeStats(data.bikeYearStats, data.gearTotals, data.gearDetails);
}

/* ----------------- Activity Counts ----------------- */

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

/* ----------------- Annual Stats ----------------- */

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
    <div class="metric-row">
      <div class="metric">${iconDistance()} ${comma(miles(totalDistance).toFixed(1))} mi</div>
      <div class="metric">${iconElevation()} ${comma(totalElevation.toFixed(0))} ft</div>
      <div class="metric">${iconRides()} ${comma(totalCount)} rides</div>
    </div>
  `;

  years.forEach(year => {
    const y = annual[year];
    html += `
      <div class="year-card">
        <div class="year-title">${year}</div>
        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(y.elevation.toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(y.count)} rides</div>
        </div>
      </div>
    `;
  });

  document.getElementById("annual-stats-table").innerHTML = html;
}

/* ----------------- Bike Stats ----------------- */

function renderBikeStats(bikeYearStats, gearTotals, gearDetails) {
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
          <svg class="icon-lg" viewBox="0 0 24 24">
            <circle cx="5" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
            <circle cx="19" cy="17" r="3" stroke="#4a90e2" stroke-width="2" fill="none"/>
            <path d="M5 17l6-10 4 6h4" stroke="#4a90e2" stroke-width="2" fill="none"/>
          </svg>
          ${gearNames[gid]}
        </div>

        <div class="metric-row">
          <div class="metric">${iconDistance()} ${comma(miles(total.distance).toFixed(1))} mi</div>
          <div class="metric">${iconElevation()} ${comma(total.elevation.toFixed(0))} ft</div>
          <div class="metric">${iconRides()} ${comma(total.count)} rides</div>
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
            <div class="metric">${iconElevation()} ${comma(y.elevation.toFixed(0))} ft</div>
            <div class="metric">${iconRides()} ${comma(y.count)} rides</div>
          </div>
        </div>
      `;
    });

    card += `</div>`;
    html += card;
  }

  document.getElementById("bike-grid").innerHTML = html;
}
