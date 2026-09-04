function comma(x) {
  return Number(x).toLocaleString("en-US");
}

function miles(meters) {
  return (meters || 0) / 1609.34;
}

function feet(meters) {
  return (meters || 0) * 3.28084;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getStravaSegmentUrl(segmentId) {
  if (!segmentId) return "";
  return `https://www.strava.com/segments/${segmentId}?filter=my_results`;
}

function extractStravaActivityId(activityUrl) {
  if (!activityUrl) return null;
  const match = String(activityUrl).match(/strava\.com\/activities\/(\d+)/i);
  return match ? match[1] : null;
}

function findActivityById(activities, activityId) {
  if (!activityId) return null;
  return (activities || []).find(activity => String(activity.id) === String(activityId)) || null;
}

function getGearName(gearDetails, gearId) {
  if (!gearId) return "-";
  return gearDetails?.[gearId]?.name || gearId;
}

function formatActivityTitle(activity) {
  if (!activity) return "-";
  return activity.name || activity.sport_type || "Activity";
}

function formatActivitySecondaryLabel(activity, gearDetails) {
  if (!activity) return "";
  const date = formatDate(activity.start_date);
  const gearName = getGearName(gearDetails, activity.gear_id);
  return `${date} • ${gearName}`;
}

function formatActivityBikeOnly(activity, gearDetails) {
  if (!activity) return "";
  return getGearName(gearDetails, activity.gear_id);
}

function renderActivityName(activity, gearDetails) {
  if (!activity) return "-";

  const title = escapeHtml(formatActivityTitle(activity));
  const secondary = escapeHtml(formatActivitySecondaryLabel(activity, gearDetails));

  const titleHtml = isValidHttpUrl(activity.url)
    ? `<a class="highlight-activity-link" href="${activity.url}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : title;

  return `
    <div class="highlight-bike">${titleHtml}</div>
    ${secondary ? `<div class="highlight-subtext">${secondary}</div>` : ""}
  `;
}

function renderSubduedActivityName(activity, gearDetails) {
  if (!activity) return `<div class="segment-last-ride-empty">No recent ride found</div>`;

  const title = escapeHtml(formatActivityTitle(activity));
  const bikeOnly = escapeHtml(formatActivityBikeOnly(activity, gearDetails));

  const titleHtml = isValidHttpUrl(activity.url)
    ? `<a class="segment-last-ride-link" href="${activity.url}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : title;

  return `
    <div class="segment-last-ride-title">${titleHtml}</div>
    ${bikeOnly ? `<div class="segment-last-ride-subtext">${bikeOnly}</div>` : ""}
  `;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  return `${secs}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

function formatYearsBetween(startDate, endDate) {
  if (!startDate || !endDate) return "-";
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const years = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)} years`;
}

function formatDayDifference(startDate, endDate) {
  if (!startDate || !endDate) return "-";
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end - start) / 86400000);
  return `${comma(diffDays)} day${diffDays === 1 ? "" : "s"}`;
}

function getDateKey(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeMaxStreak(dateKeys) {
  if (!dateKeys.length) return 0;

  const sorted = [...new Set(dateKeys)].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const curr = new Date(`${sorted[i]}T00:00:00`);
    const diffDays = Math.round((curr - prev) / 86400000);

    if (diffDays === 1) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function getMondayForIsoWeek(year, isoWeek) {
  const simple = new Date(year, 0, 1 + (isoWeek - 1) * 7);
  const day = simple.getDay();
  const isoMonday = new Date(simple);

  if (day <= 4 && day !== 0) {
    isoMonday.setDate(simple.getDate() - day + 1);
  } else if (day === 0) {
    isoMonday.setDate(simple.getDate() - 6);
  } else {
    isoMonday.setDate(simple.getDate() + (8 - day));
  }

  isoMonday.setHours(0, 0, 0, 0);
  return isoMonday;
}

function trendIndicator(trend) {
  if (trend === 0 || trend == null) return "";
  if (trend > 0) return `<span class="trend-up">Up ${(trend * 100).toFixed(0)}%</span>`;
  return `<span class="trend-down">Down ${(Math.abs(trend) * 100).toFixed(0)}%</span>`;
}

function iconDistance() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconElevation() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 20l9-16 9 16H3z" stroke="currentColor" stroke-width="2" fill="none"></path>
    </svg>
  `;
}

function iconRides() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"></circle>
      <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"></circle>
      <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"></path>
    </svg>
  `;
}

function iconSpeed() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"></circle>
      <path d="M12 7v5l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconTime() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"></circle>
      <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconCalendar() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="2" fill="none"></rect>
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconPercent() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
      <circle cx="16.5" cy="16.5" r="2.5" stroke="currentColor" stroke-width="2" fill="none"></circle>
    </svg>
  `;
}

function iconFire() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c1 3-1 4-1 6 0 1 1 2 2 3 2-1 3-3 3-5 3 2 5 5 5 8a8 8 0 1 1-16 0c0-2 1-4 3-6 0 2 1 3 2 4 1-1 1-2 1-4 0-2 0-4 1-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconTrophy() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" fill="none" stroke="currentColor" stroke-width="2"></path>
      <path d="M6 6H4a2 2 0 0 0 2 2M18 6h2a2 2 0 0 1-2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M12 11v4M9 20h6M10 15h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function showSpinner() {
  const node = document.getElementById("spinner");
  if (node) node.style.display = "block";
}

function hideSpinner() {
  const node = document.getElementById("spinner");
  if (node) node.style.display = "none";
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

function getWeekStartMonday(dateStr) {
  const d = new Date(dateStr);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  local.setHours(0, 0, 0, 0);
  return local;
}

async function loadFeaturedActivities() {
  try {
    const res = await fetch("featured-activities.json", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Unable to load featured activities config", err);
    return [];
  }
}

function renderFeaturedActivities(items, data) {
  const container = document.getElementById("featured-activities-content");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No featured activities configured yet.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="featured-activities-grid">
      ${items.map(item => {
        const title = escapeHtml(item.title || "Untitled Activity");
        const caption = item.caption ? `<div class="featured-activity-caption">${escapeHtml(item.caption)}</div>` : "";
        const activityUrl = item.activityUrl || "";
        const activityId = extractStravaActivityId(activityUrl);
        const activity = findActivityById(data.activities, activityId);

        let metricsHtml = `<div class="featured-activity-link-disabled">Activity not found in dashboard data</div>`;

        if (activity) {
          const bikeName = getGearName(data.gearDetails, activity.gear_id);
          metricsHtml = `
            <div class="featured-activity-metrics">
              <div class="featured-activity-metric">${iconDistance()} ${comma(miles(activity.distance || 0).toFixed(1))} mi</div>
              <div class="featured-activity-metric">${iconElevation()} ${comma(feet(activity.total_elevation_gain || 0).toFixed(0))} ft</div>
              <div class="featured-activity-metric">${iconTime()} ${formatDuration(activity.moving_time || 0)}</div>
              <div class="featured-activity-metric">${iconCalendar()} ${formatDate(activity.start_date)}</div>
              <div class="featured-activity-metric">${escapeHtml(activity.sport_type || "-")}</div>
              <div class="featured-activity-metric">${iconRides()} ${escapeHtml(bikeName)}</div>
            </div>
          `;
        }

        const activityLink = isValidHttpUrl(activityUrl)
          ? `<a class="featured-activity-link" href="${activityUrl}" target="_blank" rel="noopener noreferrer">View on Strava</a>`
          : `<div class="featured-activity-link-disabled">No activity link</div>`;

        return `
          <article class="featured-activity-card">
            <div class="featured-activity-body">
              <div class="featured-activity-title">${title}</div>
              ${caption}
              ${metricsHtml}
              ${activityLink}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderPrBackfillAdmin(status) {
  const content = document.getElementById("pr-backfill-admin-content");
  const badge = document.getElementById("pr-backfill-menu-badge");
  const stopBtn = document.getElementById("stop-pr-backfill-btn");

  if (!content || !badge || !stopBtn) return;

  if (!status) {
    content.innerHTML = `<div class="dropdown-admin-empty">No PR backfill activity yet.</div>`;
    badge.style.display = "none";
    stopBtn.disabled = true;
    return;
  }

  const isActive = status.running || status.mode === "waiting" || status.mode === "starting";
  const processed = status.processed ?? Math.max(0, (status.totalEligible || 0) - (status.remaining || 0));
  const nextRetry = status.nextRetryAt ? formatDateTime(status.nextRetryAt) : "—";
  const lastRun = status.lastRunAt ? formatDateTime(status.lastRunAt) : "—";
  const stateLabel = status.completed ? "Complete" : (status.mode || "Idle");

  badge.style.display = isActive ? "inline-block" : "none";
  badge.className = `menu-status-badge ${status.completed ? "complete" : "running"}`;
  stopBtn.disabled = !isActive;

  content.innerHTML = `
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Status</span>
      <span class="dropdown-admin-value">${escapeHtml(stateLabel)}</span>
    </div>
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Progress</span>
      <span class="dropdown-admin-value">${comma(processed)} / ${comma(status.totalEligible || 0)}</span>
    </div>
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Remaining</span>
      <span class="dropdown-admin-value">${comma(status.remaining || 0)}</span>
    </div>
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Fetched this run</span>
      <span class="dropdown-admin-value">${comma(status.fetchedThisRun || 0)}</span>
    </div>
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Last run</span>
      <span class="dropdown-admin-value">${escapeHtml(lastRun)}</span>
    </div>
    <div class="dropdown-admin-status-row">
      <span class="dropdown-admin-label">Next retry</span>
      <span class="dropdown-admin-value">${escapeHtml(nextRetry)}</span>
    </div>
    <div class="dropdown-admin-note">${escapeHtml(status.message || "Idle")}</div>
  `;
}

let prBackfillPollTimer = null;

function clearPrBackfillPolling() {
  if (prBackfillPollTimer) {
    clearTimeout(prBackfillPollTimer);
    prBackfillPollTimer = null;
  }
}

async function pollPrBackfillStatus() {
  clearPrBackfillPolling();

  try {
    const res = await fetch("http://192.168.0.115:5000/api/pr-backfill/status");
    const data = await res.json();
    const status = data.prBackfill;

    window.__lastPrBackfill = status;
    renderPrBackfillAdmin(status);

    if (status && (status.running || status.mode === "waiting" || status.mode === "starting")) {
      prBackfillPollTimer = setTimeout(pollPrBackfillStatus, 15000);
    }
  } catch (err) {
    console.error(err);
  }
}

async function startPrBackfill() {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = "Starting PR backfill background job…";

  try {
    const res = await fetch("http://192.168.0.115:5000/api/pr-backfill/start", {
      method: "POST"
    });
    const data = await res.json();

    if (data.error) {
      statusDiv.innerHTML = data.error;
      renderPrBackfillAdmin(window.__lastPrBackfill || null);
      return;
    }

    window.__lastPrBackfill = data.prBackfill;
    renderPrBackfillAdmin(data.prBackfill);
    statusDiv.innerHTML = data.message || "PR backfill started.";

    await pollPrBackfillStatus();
  } catch (err) {
    console.error(err);
    statusDiv.innerHTML = "Failed to start PR backfill.";
  }
}

async function stopPrBackfill() {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = "Stopping PR backfill…";

  try {
    const res = await fetch("http://192.168.0.115:5000/api/pr-backfill/stop", {
      method: "POST"
    });
    const data = await res.json();

    window.__lastPrBackfill = data.prBackfill;
    renderPrBackfillAdmin(data.prBackfill);
    statusDiv.innerHTML = data.message || "PR backfill stop requested.";
    clearPrBackfillPolling();
  } catch (err) {
    console.error(err);
    statusDiv.innerHTML = "Failed to stop PR backfill.";
  }
}

const STORAGE_KEYS = {
  selectedTypes: "strava:selectedTypes",
  selectedBikes: "strava:selectedBikes",
  pinnedBikes: "strava:pinnedBikes",
  bikeSearch: "strava:bikeSearch",
  bikeSort: "strava:bikeSort",
  theme: "strava:theme",
  annualExpandedYears: "strava:annualExpandedYears",
  annualBreakdownMode: "strava:annualBreakdownMode",
  expandedBikeYears: "strava:expandedBikeYears",
  bikeHistoryExpanded: "strava:bikeHistoryExpanded",
  globalDateRange: "strava:globalDateRange",
  globalActivityType: "strava:globalActivityType",
  globalBike: "strava:globalBike",
  heroMetricMode: "strava:heroMetricMode",
  patternMetric: "strava:patternMetric",
  monthlyTrendMetric: "strava:monthlyTrendMetric",
  excludedSegmentIds: "strava:excludedSegmentIds"
};

const EXCLUDED_HIGHEST_ELEVATION_ACTIVITY_ID = "1380665549";

let selectedBikes = new Map();
let allGearData = {};
let currentBikeRows = [];
let selectedTypes = new Set();
let pinnedBikes = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedBikes) || "[]"));
let annualExpandedYears = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.annualExpandedYears) || "[]"));
let annualBreakdownMode = localStorage.getItem(STORAGE_KEYS.annualBreakdownMode) || "monthly";
let expandedBikeYears = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.expandedBikeYears) || "[]"));
let bikeHistoryExpanded = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.bikeHistoryExpanded) || "[]"));
let patternMetric = localStorage.getItem(STORAGE_KEYS.patternMetric) || "distance";
let monthlyTrendMetric = localStorage.getItem(STORAGE_KEYS.monthlyTrendMetric) || "distance";
let excludedSegmentIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.excludedSegmentIds) || "[]"));

function saveSelectedBikes() {
  localStorage.setItem(STORAGE_KEYS.selectedBikes, JSON.stringify(Array.from(selectedBikes.keys())));
}

function savePinnedBikes() {
  localStorage.setItem(STORAGE_KEYS.pinnedBikes, JSON.stringify(Array.from(pinnedBikes.values())));
}

function saveAnnualExpandedYears() {
  localStorage.setItem(STORAGE_KEYS.annualExpandedYears, JSON.stringify(Array.from(annualExpandedYears.values())));
}

function saveExpandedBikeYears() {
  localStorage.setItem(STORAGE_KEYS.expandedBikeYears, JSON.stringify(Array.from(expandedBikeYears.values())));
}

function saveBikeHistoryExpanded() {
  localStorage.setItem(STORAGE_KEYS.bikeHistoryExpanded, JSON.stringify(Array.from(bikeHistoryExpanded.values())));
}

function saveExcludedSegmentIds() {
  localStorage.setItem(STORAGE_KEYS.excludedSegmentIds, JSON.stringify(Array.from(excludedSegmentIds.values())));
}

function excludeSegment(segmentId) {
  if (!segmentId) return;
  excludedSegmentIds.add(String(segmentId));
  saveExcludedSegmentIds();
  if (window.__rawDashboardData) renderAll(window.__rawDashboardData);
}

function includeSegment(segmentId) {
  if (!segmentId) return;
  excludedSegmentIds.delete(String(segmentId));
  saveExcludedSegmentIds();
  if (window.__rawDashboardData) renderAll(window.__rawDashboardData);
}

function clearExcludedSegments() {
  excludedSegmentIds.clear();
  saveExcludedSegmentIds();
  if (window.__rawDashboardData) renderAll(window.__rawDashboardData);
}

function setAnnualBreakdownMode(mode) {
  annualBreakdownMode = mode === "weekly" ? "weekly" : "monthly";
  localStorage.setItem(STORAGE_KEYS.annualBreakdownMode, annualBreakdownMode);
}

function setPatternMetric(mode) {
  patternMetric = mode;
  localStorage.setItem(STORAGE_KEYS.patternMetric, patternMetric);
  syncPatternMetricButtons();
  if (window.__rawDashboardData) {
    renderAll(window.__rawDashboardData);
  }
}

function setMonthlyTrendMetric(mode) {
  monthlyTrendMetric = mode;
  localStorage.setItem(STORAGE_KEYS.monthlyTrendMetric, monthlyTrendMetric);
  syncMonthlyMetricButtons();
  if (window.__rawDashboardData) {
    renderAll(window.__rawDashboardData);
  }
}

function syncPatternMetricButtons() {
  document.querySelectorAll("[data-pattern-metric]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.patternMetric === patternMetric);
  });
}

function syncMonthlyMetricButtons() {
  document.querySelectorAll("[data-monthly-metric]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.monthlyMetric === monthlyTrendMetric);
  });
}

function setLastSyncLabel() {
  const text = `Last updated: ${new Date().toLocaleString()}`;
  const top = document.getElementById("last-sync");
  const side = document.getElementById("last-sync-side");
  if (top) top.textContent = text;
  if (side) side.textContent = text;
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

function buildSegmentSummaryHighlights(data) {
  const segmentData = data.segmentData || {};
  const activities = data.activities || [];
  const activityById = Object.fromEntries(activities.map(activity => [String(activity.id), activity]));

  let totalSegmentEfforts = 0;
  let totalSegmentPrs = 0;
  let activitiesWithSegments = 0;
  let activitiesWithPrs = 0;

  let mostPrRichActivity = null;
  let mostSegmentEffortsActivity = null;
  let latestActivityWithPr = null;
  let bestNamedPrSegment = null;

  Object.entries(segmentData).forEach(([activityId, efforts]) => {
    const activity = activityById[String(activityId)];
    if (!activity || !Array.isArray(efforts) || !efforts.length) return;

    const effortCount = efforts.length;
    const prEfforts = efforts.filter(e => e?.pr_rank === 1);
    const prCount = prEfforts.length;

    totalSegmentEfforts += effortCount;
    totalSegmentPrs += prCount;
    activitiesWithSegments += 1;
    if (prCount > 0) activitiesWithPrs += 1;

    const base = { activity, effortCount, prCount };

    if (!mostPrRichActivity || prCount > mostPrRichActivity.prCount) {
      mostPrRichActivity = base;
    }

    if (!mostSegmentEffortsActivity || effortCount > mostSegmentEffortsActivity.effortCount) {
      mostSegmentEffortsActivity = base;
    }

    if (prCount > 0) {
      if (!latestActivityWithPr || new Date(activity.start_date).getTime() > new Date(latestActivityWithPr.activity.start_date).getTime()) {
        latestActivityWithPr = base;
      }
    }

    prEfforts.forEach((effort, index) => {
      const segmentName = effort?.segment_name || effort?.name || effort?.segment?.name || null;
      if (!segmentName) return;
      if (!bestNamedPrSegment) {
        bestNamedPrSegment = {
          activity,
          segmentName,
          prRank: effort?.pr_rank || 1,
          ordinal: index
        };
      }
    });
  });

  const cards = [];

  cards.push({
    label: "Total segment efforts",
    activity: null,
    value: `${comma(totalSegmentEfforts)} efforts`,
    subtext: activitiesWithSegments > 0
      ? `Across ${comma(activitiesWithSegments)} activities in the current view`
      : "No activities in the current view have segment data"
  });

  cards.push({
    label: "Total segment PRs",
    activity: null,
    value: `${comma(totalSegmentPrs)} PRs`,
    subtext: activitiesWithPrs > 0
      ? `Across ${comma(activitiesWithPrs)} activities with at least one segment PR`
      : "No segment PRs in the current filtered view"
  });

  if (mostPrRichActivity) {
    cards.push({
      label: "Most segment PRs in one activity",
      activity: mostPrRichActivity.activity,
      value: `${comma(mostPrRichActivity.prCount)} PR${mostPrRichActivity.prCount === 1 ? "" : "s"}`,
      subtext: `${comma(mostPrRichActivity.effortCount)} total segment effort${mostPrRichActivity.effortCount === 1 ? "" : "s"} recorded`
    });
  }

  if (mostSegmentEffortsActivity) {
    cards.push({
      label: "Most segment efforts in one activity",
      activity: mostSegmentEffortsActivity.activity,
      value: `${comma(mostSegmentEffortsActivity.effortCount)} efforts`,
      subtext: `${comma(mostSegmentEffortsActivity.prCount)} segment PR${mostSegmentEffortsActivity.prCount === 1 ? "" : "s"} on that activity`
    });
  }

  if (latestActivityWithPr) {
    cards.push({
      label: "Latest activity with a segment PR",
      activity: latestActivityWithPr.activity,
      value: `${comma(latestActivityWithPr.prCount)} PR${latestActivityWithPr.prCount === 1 ? "" : "s"}`,
      subtext: `${formatDate(latestActivityWithPr.activity.start_date)} • ${comma(latestActivityWithPr.effortCount)} segment effort${latestActivityWithPr.effortCount === 1 ? "" : "s"}`
    });
  }

  if (bestNamedPrSegment) {
    cards.push({
      label: "Named segment PR spotted",
      activity: bestNamedPrSegment.activity,
      value: bestNamedPrSegment.segmentName,
      subtext: `Found in the current filtered data`
    });
  }

  return cards.filter(Boolean);
}

function buildSegmentDistanceHighlights(data) {
  const segmentData = data.segmentData || {};
  const activities = data.activities || [];
  const activityById = Object.fromEntries(activities.map(activity => [String(activity.id), activity]));

  const bucketDefs = [
    { key: "under-0-5", label: "Under 0.5 mi", min: 0, max: 0.5 },
    { key: "0-5-to-1", label: "0.5–1.0 mi", min: 0.5, max: 1.0 },
    { key: "1-to-1-5", label: "1.0–1.5 mi", min: 1.0, max: 1.5 },
    { key: "1-5-to-2", label: "1.5–2.0 mi", min: 1.5, max: 2.0 },
    { key: "2-to-3", label: "2.0–3.0 mi", min: 2.0, max: 3.0 },
    { key: "3-to-4", label: "3.0–4.0 mi", min: 3.0, max: 4.0 },
    { key: "4-to-5", label: "4.0–5.0 mi", min: 4.0, max: 5.0 },
    { key: "5-plus", label: "5.0+ mi", min: 5.0, max: Infinity }
  ];

  function getBucketForMiles(distanceMiles) {
    return bucketDefs.find(bucket => distanceMiles >= bucket.min && distanceMiles < bucket.max) || null;
  }

  const perSegment = new Map();

  Object.entries(segmentData).forEach(([activityId, efforts]) => {
    const activity = activityById[String(activityId)];
    if (!activity || !Array.isArray(efforts)) return;

    efforts.forEach((effort, index) => {
      const segmentId = effort?.segment_id ? String(effort.segment_id) : null;
      const distanceMeters = Number(effort?.distance || 0);
      const distanceMiles = miles(distanceMeters);

      if (!segmentId || !distanceMeters || distanceMeters <= 0) return;
      if (excludedSegmentIds.has(segmentId)) return;

      if (!perSegment.has(segmentId)) {
        perSegment.set(segmentId, {
          segmentId,
          segmentName: effort?.segment_name || effort?.name || `Segment ${index + 1}`,
          distanceMiles,
          attempts: 0,
          prCount: 0,
          fastestElapsedTime: null,
          averageGrade: typeof effort?.average_grade === "number" ? effort.average_grade : null,
          elevationGainFeet: effort?.elevation_gain != null ? feet(Number(effort.elevation_gain || 0)) : null,
          latestActivity: activity,
          firstRidden: activity.start_date,
          lastRidden: activity.start_date
        });
      }

      const row = perSegment.get(segmentId);
      row.attempts += 1;
      if (effort?.pr_rank === 1) row.prCount += 1;

      const elapsed = Number(effort?.elapsed_time || 0);
      if (elapsed > 0 && (!row.fastestElapsedTime || elapsed < row.fastestElapsedTime)) {
        row.fastestElapsedTime = elapsed;
      }

      const activityTs = new Date(activity.start_date).getTime();
      if (!row.latestActivity || activityTs > new Date(row.latestActivity.start_date).getTime()) {
        row.latestActivity = activity;
      }

      if (!row.firstRidden || activityTs < new Date(row.firstRidden).getTime()) {
        row.firstRidden = activity.start_date;
      }

      if (!row.lastRidden || activityTs > new Date(row.lastRidden).getTime()) {
        row.lastRidden = activity.start_date;
      }
    });
  });

  const bucketWinners = bucketDefs.map(bucket => {
    const candidates = Array.from(perSegment.values())
      .filter(segment => {
        const segBucket = getBucketForMiles(segment.distanceMiles);
        return segBucket && segBucket.key === bucket.key;
      })
      .sort((a, b) => {
        if (b.attempts !== a.attempts) return b.attempts - a.attempts;
        if ((b.prCount || 0) !== (a.prCount || 0)) return (b.prCount || 0) - (a.prCount || 0);
        return a.distanceMiles - b.distanceMiles;
      });

    const winner = candidates[0];
    if (!winner) return null;

    const statParts = [
      `${comma(winner.attempts)} effort${winner.attempts === 1 ? "" : "s"}`,
      `${comma(winner.prCount)} PR${winner.prCount === 1 ? "" : "s"}`,
      `${winner.distanceMiles.toFixed(1)} mi`
    ];

    if (winner.fastestElapsedTime) statParts.push(`fastest ${formatDuration(winner.fastestElapsedTime)}`);
    if (winner.averageGrade != null) statParts.push(`${winner.averageGrade.toFixed(1)}% avg`);
    if (winner.elevationGainFeet != null) statParts.push(`${comma(winner.elevationGainFeet.toFixed(0))} ft`);

    return {
      label: bucket.label,
      segmentId: winner.segmentId,
      segmentName: winner.segmentName,
      statsText: statParts.join(" • "),
      latestActivity: winner.latestActivity || null,
      lastRidden: winner.lastRidden || null
    };
  });

  return bucketWinners.filter(Boolean);
}

function deriveRideInsights(data) {
  const rides = (data.activities || []).filter(a => a && a.gear_id && a.sport_type === "Ride");
  const allActivities = (data.activities || []).filter(Boolean);
  const rideActivities = allActivities.filter(a => a.sport_type === "Ride");
  const perBike = {};
  let totalRideDistance = 0;
  let totalRideCount = 0;
  let topMileageWeek = null;
  let topClimbingWeek = null;

  rides.forEach(a => {
    const gid = a.gear_id;
    if (!perBike[gid]) {
      perBike[gid] = {
        firstRide: null,
        lastRide: null,
        biggestMileageWeek: null,
        biggestClimbingWeek: null,
        mostActiveWeek: null,
        weeks: {}
      };
    }

    totalRideDistance += a.distance || 0;
    totalRideCount += 1;

    const ts = new Date(a.start_date).getTime();
    if (!perBike[gid].firstRide || ts < new Date(perBike[gid].firstRide).getTime()) {
      perBike[gid].firstRide = a.start_date;
    }
    if (!perBike[gid].lastRide || ts > new Date(perBike[gid].lastRide).getTime()) {
      perBike[gid].lastRide = a.start_date;
    }

    const weekStart = formatShortDate(getWeekStartMonday(a.start_date));
    if (!perBike[gid].weeks[weekStart]) {
      perBike[gid].weeks[weekStart] = {
        label: weekStart,
        distance: 0,
        elevation: 0,
        count: 0
      };
    }

    perBike[gid].weeks[weekStart].distance += a.distance || 0;
    perBike[gid].weeks[weekStart].elevation += a.total_elevation_gain || 0;
    perBike[gid].weeks[weekStart].count += 1;
  });

  Object.keys(perBike).forEach(gid => {
    const bike = perBike[gid];
    const weeks = Object.values(bike.weeks);

    bike.biggestMileageWeek = weeks.reduce((best, w) => (!best || w.distance > best.distance ? w : best), null);
    bike.biggestClimbingWeek = weeks.reduce((best, w) => (!best || w.elevation > best.elevation ? w : best), null);
    bike.mostActiveWeek = weeks.reduce((best, w) => (!best || w.count > best.count ? w : best), null);

    const total = data.gearTotals && data.gearTotals[gid] ? data.gearTotals[gid] : null;
    bike.distanceShare = totalRideDistance > 0 && total ? total.distance / totalRideDistance : 0;
    bike.countShare = totalRideCount > 0 && total ? total.count / totalRideCount : 0;

    if (bike.biggestMileageWeek && (!topMileageWeek || bike.biggestMileageWeek.distance > topMileageWeek.distance)) {
      topMileageWeek = { ...bike.biggestMileageWeek, gid };
    }
    if (bike.biggestClimbingWeek && (!topClimbingWeek || bike.biggestClimbingWeek.elevation > topClimbingWeek.elevation)) {
      topClimbingWeek = { ...bike.biggestClimbingWeek, gid };
    }
  });

  const highlightCandidates = Object.keys(data.gearTotals || {}).map(gid => {
    const total = data.gearTotals[gid];
    const detail = (data.gearDetails || {})[gid] || {};
    if (!total) return null;

    return {
      gid,
      name: detail.name || gid,
      distance: total.distance || 0,
      elevation: total.elevation || 0,
      count: total.count || 0,
      moving_time: total.moving_time || 0,
      pr_count: total.pr_count || 0,
      avg_speed_mph: total.avg_speed_mph || 0,
      avg_distance_per_ride: total.count > 0 ? total.distance / total.count : 0,
      avg_elevation_per_ride: total.count > 0 ? total.elevation / total.count : 0
    };
  }).filter(Boolean);

  const bikeById = Object.fromEntries(highlightCandidates.map(b => [b.gid, b]));

  const mostRecentBike = Object.keys(perBike).reduce((best, gid) => {
    const candidate = perBike[gid];
    if (!candidate?.lastRide) return best;
    if (!best || new Date(candidate.lastRide).getTime() > new Date(best.lastRide).getTime()) {
      return { gid, ...candidate };
    }
    return best;
  }, null);

  const longestUsedBike = Object.keys(perBike).reduce((best, gid) => {
    const candidate = perBike[gid];
    if (!candidate?.firstRide || !candidate?.lastRide) return best;
    const span = new Date(candidate.lastRide).getTime() - new Date(candidate.firstRide).getTime();
    if (!best || span > best.span) {
      return { gid, ...candidate, span };
    }
    return best;
  }, null);

  const longestActivity = allActivities.reduce(
    (best, a) => (!best || (a.distance || 0) > (best.distance || 0) ? a : best),
    null
  );

  const highestElevationActivity = allActivities
    .filter(a => String(a.id) !== EXCLUDED_HIGHEST_ELEVATION_ACTIVITY_ID)
    .reduce(
      (best, a) => (!best || (a.total_elevation_gain || 0) > (best.total_elevation_gain || 0) ? a : best),
      null
    );

  const longestMovingTimeActivity = allActivities.reduce(
    (best, a) => (!best || (a.moving_time || 0) > (best.moving_time || 0) ? a : best),
    null
  );

  const fastestRide = rideActivities
    .filter(a => (a.distance || 0) > 0 && (a.moving_time || 0) > 0)
    .reduce((best, a) => {
      const avgSpeedMph = miles(a.distance) / (a.moving_time / 3600);
      if (!best || avgSpeedMph > best.avg_speed_mph) {
        return { ...a, avg_speed_mph: avgSpeedMph };
      }
      return best;
    }, null);

  return {
    perBike,
    highlights: {
      mostUsedByMiles: highlightCandidates.reduce((best, b) => (!best || b.distance > best.distance ? b : best), null),
      mostUsedByCount: highlightCandidates.reduce((best, b) => (!best || b.count > best.count ? b : best), null),
      fastestBike: highlightCandidates.reduce((best, b) => (!best || b.avg_speed_mph > best.avg_speed_mph ? b : best), null),
      climbingBike: highlightCandidates.reduce((best, b) => (!best || b.avg_elevation_per_ride > best.avg_elevation_per_ride ? b : best), null),
      longestAverageRideBike: highlightCandidates.reduce((best, b) => (!best || b.avg_distance_per_ride > best.avg_distance_per_ride ? b : best), null),
      mostTotalTimeBike: highlightCandidates.reduce((best, b) => (!best || b.moving_time > best.moving_time ? b : best), null),
      mostRecentBike: mostRecentBike ? { ...bikeById[mostRecentBike.gid], ...mostRecentBike } : null,
      biggestMileageWeekBike: topMileageWeek ? { ...bikeById[topMileageWeek.gid], ...topMileageWeek } : null,
      biggestClimbingWeekBike: topClimbingWeek ? { ...bikeById[topClimbingWeek.gid], ...topClimbingWeek } : null,
      longestUsedBike: longestUsedBike ? { ...bikeById[longestUsedBike.gid], ...longestUsedBike } : null,
      longestActivity,
      highestElevationActivity,
      longestMovingTimeActivity,
      fastestRide
    }
  };
}

function restoreGlobalFilters() {
  const dateRange = localStorage.getItem(STORAGE_KEYS.globalDateRange) || "all";
  const activityType = localStorage.getItem(STORAGE_KEYS.globalActivityType) || "all";
  const bike = localStorage.getItem(STORAGE_KEYS.globalBike) || "all";
  const heroMetric = localStorage.getItem(STORAGE_KEYS.heroMetricMode) || "distance";

  const dateRangeNode = document.getElementById("global-date-range");
  const activityTypeNode = document.getElementById("global-activity-type");
  const bikeNode = document.getElementById("global-bike");
  const heroMetricNode = document.getElementById("hero-metric-mode");

  if (dateRangeNode) dateRangeNode.value = dateRange;
  if (activityTypeNode) activityTypeNode.value = activityType;
  if (bikeNode) bikeNode.value = bike;
  if (heroMetricNode) heroMetricNode.value = heroMetric;
}

function populateGlobalFilters(rawData) {
  const typeNode = document.getElementById("global-activity-type");
  const bikeNode = document.getElementById("global-bike");
  if (!typeNode || !bikeNode) return;

  const currentType = localStorage.getItem(STORAGE_KEYS.globalActivityType) || "all";
  const currentBike = localStorage.getItem(STORAGE_KEYS.globalBike) || "all";

  const types = Array.from(new Set((rawData.activities || []).map(a => a.sport_type).filter(Boolean))).sort();
  const bikes = Object.keys(rawData.gearTotals || {}).map(gid => ({
    gid,
    name: getGearName(rawData.gearDetails || {}, gid)
  })).sort((a, b) => a.name.localeCompare(b.name));

  typeNode.innerHTML = `<option value="all">All activity types</option>` +
    types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");

  bikeNode.innerHTML = `<option value="all">All bikes</option>` +
    bikes.map(b => `<option value="${escapeHtml(b.gid)}">${escapeHtml(b.name)}</option>`).join("");

  typeNode.value = types.includes(currentType) ? currentType : "all";
  bikeNode.value = bikes.some(b => b.gid === currentBike) ? currentBike : "all";
}

function handleGlobalFilterChange() {
  const dateRange = document.getElementById("global-date-range")?.value || "all";
  const activityType = document.getElementById("global-activity-type")?.value || "all";
  const bike = document.getElementById("global-bike")?.value || "all";
  const heroMetric = document.getElementById("hero-metric-mode")?.value || "distance";

  localStorage.setItem(STORAGE_KEYS.globalDateRange, dateRange);
  localStorage.setItem(STORAGE_KEYS.globalActivityType, activityType);
  localStorage.setItem(STORAGE_KEYS.globalBike, bike);
  localStorage.setItem(STORAGE_KEYS.heroMetricMode, heroMetric);

  if (window.__rawDashboardData) {
    renderAll(window.__rawDashboardData);
  }
}

function applyGlobalFilters(rawData) {
  const dateRange = localStorage.getItem(STORAGE_KEYS.globalDateRange) || "all";
  const activityType = localStorage.getItem(STORAGE_KEYS.globalActivityType) || "all";
  const bike = localStorage.getItem(STORAGE_KEYS.globalBike) || "all";

  let activities = [...(rawData.activities || [])];

  if (dateRange !== "all") {
    const days = Number(dateRange);
    const cutoff = Date.now() - (days * 86400000);
    activities = activities.filter(a => new Date(a.start_date).getTime() >= cutoff);
  }

  if (activityType !== "all") {
    activities = activities.filter(a => a.sport_type === activityType);
  }

  if (bike !== "all") {
    activities = activities.filter(a => a.gear_id === bike);
  }

  const allowedIds = new Set(activities.map(a => String(a.id)));
  const filteredSegmentData = Object.fromEntries(
    Object.entries(rawData.segmentData || {}).filter(([activityId]) => allowedIds.has(String(activityId)))
  );

  const cloned = {
    ...rawData,
    activities,
    segmentData: filteredSegmentData
  };

  cloned.activityCounts = buildActivityCountsFromActivities(activities);
  cloned.gearTotals = buildGearTotalsFromActivities(activities, filteredSegmentData);
  cloned.bikeYearStats = buildBikeYearStatsFromActivities(activities, filteredSegmentData);
  cloned.gearDetails = rawData.gearDetails || {};
  cloned.annualStats = buildAnnualStatsSimple(activities);

  return cloned;
}

function buildActivityCountsFromActivities(activities) {
  const counts = {};
  (activities || []).forEach(a => {
    if (!a?.sport_type) return;
    counts[a.sport_type] = (counts[a.sport_type] || 0) + 1;
  });
  return counts;
}

function buildGearTotalsFromActivities(activities, segmentData) {
  const gearTotals = {};
  (activities || []).forEach(a => {
    if (!a?.gear_id) return;
    const prCount = segmentData && a.id in segmentData
      ? (segmentData[a.id] || []).filter(e => e.pr_rank === 1).length
      : 0;

    if (!gearTotals[a.gear_id]) {
      gearTotals[a.gear_id] = { distance: 0, elevation: 0, count: 0, moving_time: 0, pr_count: 0 };
    }

    gearTotals[a.gear_id].distance += a.distance || 0;
    gearTotals[a.gear_id].elevation += a.total_elevation_gain || 0;
    gearTotals[a.gear_id].count += 1;
    gearTotals[a.gear_id].moving_time += a.moving_time || 0;
    gearTotals[a.gear_id].pr_count += prCount;
  });

  Object.keys(gearTotals).forEach(gid => {
    const gt = gearTotals[gid];
    if (gt.moving_time > 0 && gt.distance > 0) {
      const distMiles = gt.distance / 1609.34;
      const timeHours = gt.moving_time / 3600;
      gt.avg_speed_mph = distMiles / timeHours;
      gt.avg_pace_min_per_mi = (gt.moving_time / 60) / distMiles;
    }
  });

  return gearTotals;
}

function buildBikeYearStatsFromActivities(activities, segmentData) {
  const bikeYearStats = {};

  (activities || []).forEach(a => {
    if (!a?.gear_id) return;
    const year = new Date(a.start_date).getFullYear();
    const prCount = segmentData && a.id in segmentData
      ? (segmentData[a.id] || []).filter(e => e.pr_rank === 1).length
      : 0;
    const weekStart = getWeekStartMonday(a.start_date);
    const weekKey = String(getWeekNumber(weekStart));

    if (!bikeYearStats[a.gear_id]) bikeYearStats[a.gear_id] = {};
    if (!bikeYearStats[a.gear_id][year]) {
      bikeYearStats[a.gear_id][year] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        pr_count: 0,
        weeks: {}
      };
    }

    const y = bikeYearStats[a.gear_id][year];
    y.distance += a.distance || 0;
    y.elevation += a.total_elevation_gain || 0;
    y.count += 1;
    y.moving_time += a.moving_time || 0;
    y.pr_count += prCount;

    if (!y.weeks[weekKey]) {
      y.weeks[weekKey] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        trend: 0,
        week_start: weekStart.toISOString()
      };
    }

    y.weeks[weekKey].distance += a.distance || 0;
    y.weeks[weekKey].elevation += a.total_elevation_gain || 0;
    y.weeks[weekKey].count += 1;
    y.weeks[weekKey].moving_time += a.moving_time || 0;
  });

  Object.keys(bikeYearStats).forEach(gid => {
    Object.keys(bikeYearStats[gid]).forEach(year => {
      const y = bikeYearStats[gid][year];
      if (y.moving_time > 0 && y.distance > 0) {
        const distMiles = y.distance / 1609.34;
        const timeHours = y.moving_time / 3600;
        y.avg_speed_mph = distMiles / timeHours;
      }

      const weekNums = Object.keys(y.weeks).map(Number).sort((a, b) => a - b);
      weekNums.forEach((wk, idx) => {
        const curr = y.weeks[String(wk)];
        const prev = idx > 0 ? y.weeks[String(weekNums[idx - 1])] : null;
        curr.trend = prev && prev.distance > 0 ? (curr.distance - prev.distance) / prev.distance : 0;
      });
    });
  });

  return bikeYearStats;
}

function buildAnnualStatsSimple(activities) {
  const annualStats = {};
  (activities || []).forEach(a => {
    const year = new Date(a.start_date).getFullYear();
    if (!annualStats[year]) annualStats[year] = { distance: 0, elevation: 0, count: 0 };
    annualStats[year].distance += a.distance || 0;
    annualStats[year].elevation += a.total_elevation_gain || 0;
    annualStats[year].count += 1;
  });
  return annualStats;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function renderHero(data, rideInsights) {
  const heroTitle = document.getElementById("hero-title");
  const heroInsight = document.getElementById("hero-insight");
  const heroPeriodStats = document.getElementById("hero-period-stats");
  if (!heroTitle || !heroInsight || !heroPeriodStats) return;

  const now = new Date();
  const last30Cutoff = now.getTime() - (30 * 86400000);
  const prev30Cutoff = now.getTime() - (60 * 86400000);

  const last30 = data.activities.filter(a => new Date(a.start_date).getTime() >= last30Cutoff);
  const prev30 = data.activities.filter(a => {
    const ts = new Date(a.start_date).getTime();
    return ts >= prev30Cutoff && ts < last30Cutoff;
  });

  const currentDistance = last30.reduce((sum, a) => sum + (a.distance || 0), 0);
  const previousDistance = prev30.reduce((sum, a) => sum + (a.distance || 0), 0);
  const currentTime = last30.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const previousTime = prev30.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const currentElevation = last30.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
  const previousElevation = prev30.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

  const distanceDelta = previousDistance > 0 ? ((currentDistance - previousDistance) / previousDistance) * 100 : 0;
  const timeDelta = previousTime > 0 ? ((currentTime - previousTime) / previousTime) * 100 : 0;
  const elevationDelta = previousElevation > 0 ? ((currentElevation - previousElevation) / previousElevation) * 100 : 0;

  const weekdayStats = buildWeekdayBreakdown(data.activities, "distance");
  const topWeekday = weekdayStats.reduce((best, item) => (!best || item.value > best.value ? item : best), null);

  const topBike = rideInsights?.highlights?.mostUsedByMiles;
  const heroMetricMode = localStorage.getItem(STORAGE_KEYS.heroMetricMode) || "distance";

  heroTitle.textContent = `${comma(data.activities.length)} filtered activities across ${Object.keys(data.gearTotals || {}).length} bike profiles`;

  let insightSentence = "Training data is ready to explore.";
  if (heroMetricMode === "distance" && topWeekday && topBike) {
    insightSentence = `${topWeekday.label} is your biggest mileage day, and ${topBike.name} leads your ride volume with ${comma(miles(topBike.distance).toFixed(1))} mi.`;
  } else if (heroMetricMode === "moving_time" && rideInsights?.highlights?.mostTotalTimeBike) {
    const bike = rideInsights.highlights.mostTotalTimeBike;
    insightSentence = `${bike.name} has the highest total activity time at ${formatDuration(bike.moving_time)} in the current view.`;
  } else if (heroMetricMode === "elevation" && rideInsights?.highlights?.climbingBike) {
    const bike = rideInsights.highlights.climbingBike;
    insightSentence = `${bike.name} leads climbing intensity at ${comma(feet(bike.avg_elevation_per_ride).toFixed(0))} ft per ride on average.`;
  } else if (heroMetricMode === "count" && rideInsights?.highlights?.mostUsedByCount) {
    const bike = rideInsights.highlights.mostUsedByCount;
    insightSentence = `${bike.name} has the highest ride count with ${comma(bike.count)} activities in the current view.`;
  }

  heroInsight.textContent = insightSentence;

  heroPeriodStats.innerHTML = `
    <div class="hero-stat">
      <div class="hero-stat-label">Last 30 days</div>
      <div class="hero-stat-value">${comma(miles(currentDistance).toFixed(1))} mi</div>
      <div class="hero-stat-delta ${distanceDelta >= 0 ? "positive" : "negative"}">${distanceDelta >= 0 ? "+" : ""}${distanceDelta.toFixed(0)}% vs prior 30d</div>
    </div>
    <div class="hero-stat">
      <div class="hero-stat-label">Moving time</div>
      <div class="hero-stat-value">${formatDuration(currentTime)}</div>
      <div class="hero-stat-delta ${timeDelta >= 0 ? "positive" : "negative"}">${timeDelta >= 0 ? "+" : ""}${timeDelta.toFixed(0)}%</div>
    </div>
    <div class="hero-stat">
      <div class="hero-stat-label">Elevation</div>
      <div class="hero-stat-value">${comma(feet(currentElevation).toFixed(0))} ft</div>
      <div class="hero-stat-delta ${elevationDelta >= 0 ? "positive" : "negative"}">${elevationDelta >= 0 ? "+" : ""}${elevationDelta.toFixed(0)}%</div>
    </div>
  `;
}

function renderKpiSummary(data) {
  const kpi = document.getElementById("kpi-summary");
  if (!kpi) return;

  const totalActivities = data.activities.length;
  const totalDistanceMeters = data.activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalElevationMeters = data.activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
  const totalMovingTime = data.activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const activeBikes = Object.keys(data.gearTotals || {}).length;

  kpi.innerHTML = `
    <div class="kpi-card neon-distance">
      <div class="kpi-label">Filtered Activities</div>
      <div class="kpi-value">${comma(totalActivities)}</div>
    </div>
    <div class="kpi-card neon-distance">
      <div class="kpi-label">Distance</div>
      <div class="kpi-value">${comma(miles(totalDistanceMeters).toFixed(1))} mi</div>
    </div>
    <div class="kpi-card neon-time">
      <div class="kpi-label">Moving Time</div>
      <div class="kpi-value">${formatDuration(totalMovingTime)}</div>
    </div>
    <div class="kpi-card neon-elevation">
      <div class="kpi-label">Elevation</div>
      <div class="kpi-value">${comma(feet(totalElevationMeters).toFixed(0))} ft</div>
    </div>
    <div class="kpi-card neon-accent">
      <div class="kpi-label">Bikes in View</div>
      <div class="kpi-value">${comma(activeBikes)}</div>
    </div>
  `;
}

function renderHighlights(rideInsights, gearDetails = {}) {
  const container = document.getElementById("records-grid");
  if (!container) return;

  const h = rideInsights.highlights;

  const bikeCard = (label, bike, value, subtext = "") => `
    <div class="record-card">
      <div class="record-label">${label}</div>
      <div class="record-title">${bike ? escapeHtml(bike.name) : "-"}</div>
      <div class="record-value">${value || "-"}</div>
      ${subtext ? `<div class="record-subtext">${escapeHtml(subtext)}</div>` : ""}
    </div>
  `;

  const activityCard = (label, activity, value, extraSubtext = "") => `
    <div class="record-card">
      <div class="record-label">${label}</div>
      ${activity ? renderActivityName(activity, gearDetails) : `<div class="record-title">-</div>`}
      <div class="record-value">${value || "-"}</div>
      ${extraSubtext ? `<div class="record-subtext">${escapeHtml(extraSubtext)}</div>` : ""}
    </div>
  `;

  container.innerHTML = `
    ${bikeCard("Most-used bike by miles", h.mostUsedByMiles, h.mostUsedByMiles ? `${comma(miles(h.mostUsedByMiles.distance).toFixed(1))} mi` : "-")}
    ${bikeCard("Biggest mileage week", h.biggestMileageWeekBike, h.biggestMileageWeekBike ? `${comma(miles(h.biggestMileageWeekBike.distance).toFixed(1))} mi` : "-", h.biggestMileageWeekBike ? h.biggestMileageWeekBike.label : "")}
    ${bikeCard("Most total activity time", h.mostTotalTimeBike, h.mostTotalTimeBike ? formatDuration(h.mostTotalTimeBike.moving_time) : "-")}
    ${bikeCard("Longest-used bike", h.longestUsedBike, h.longestUsedBike ? formatYearsBetween(h.longestUsedBike.firstRide, h.longestUsedBike.lastRide) : "-", h.longestUsedBike ? `${formatDate(h.longestUsedBike.firstRide)} • ${formatDate(h.longestUsedBike.lastRide)}` : "")}
    ${activityCard("Longest single activity", h.longestActivity, h.longestActivity ? `${comma(miles(h.longestActivity.distance || 0).toFixed(1))} mi` : "-")}
    ${activityCard("Most elevation in a single activity", h.highestElevationActivity, h.highestElevationActivity ? `${comma(feet(h.highestElevationActivity.total_elevation_gain || 0).toFixed(0))} ft` : "-")}
    ${activityCard("Longest activity time", h.longestMovingTimeActivity, h.longestMovingTimeActivity ? formatDuration(h.longestMovingTimeActivity.moving_time || 0) : "-")}
    ${activityCard("Fastest ride by avg speed", h.fastestRide, h.fastestRide ? `${h.fastestRide.avg_speed_mph.toFixed(1)} mph` : "-")}
  `;
}

function renderSegmentSummaryHighlights(items, gearDetails = {}) {
  const container = document.getElementById("segment-summary-grid");
  if (!container) return;

  if (!items.length) {
    const totalSegmentActivities = Object.keys(window.__rawDashboardData?.segmentData || {}).length;
    container.innerHTML = `
      <div class="empty-state">
        No segment summary data available in the current filtered view.
        ${totalSegmentActivities === 0
          ? " The dashboard response does not currently include any segment data."
          : " Try broadening the filters or refreshing the data."}
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="record-card">
      <div class="record-label">${escapeHtml(item.label)}</div>
      ${item.activity ? renderActivityName(item.activity, gearDetails) : `<div class="record-title">${escapeHtml(item.value || "-")}</div>`}
      ${item.activity ? `<div class="record-value">${escapeHtml(item.value || "-")}</div>` : ""}
      ${item.subtext ? `<div class="record-subtext">${escapeHtml(item.subtext)}</div>` : ""}
    </div>
  `).join("");
}

function renderExcludedSegmentLinks() {
  if (!excludedSegmentIds.size) return "";

  const items = Array.from(excludedSegmentIds.values())
    .sort((a, b) => Number(a) - Number(b))
    .map(segmentId => {
      const url = getStravaSegmentUrl(segmentId);
      return `
        <span class="excluded-segment-chip">
          <a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(segmentId)}</a>
          <button type="button" class="excluded-segment-remove" onclick="includeSegment('${escapeHtml(segmentId)}')" aria-label="Restore segment ${escapeHtml(segmentId)}">×</button>
        </span>
      `;
    })
    .join("");

  return `
    <div class="excluded-segment-wrap">
      <div class="segment-controls-note">Excluded Segments</div>
      <div class="excluded-segment-list">${items}</div>
      <div class="segment-controls-row">
        <button class="segment-inline-action" type="button" onclick="clearExcludedSegments()">Clear excluded segments</button>
      </div>
    </div>
  `;
}

function renderSegmentDistanceHighlights(items, gearDetails = {}) {
  const container = document.getElementById("segment-distance-grid");
  if (!container) return;

  const excludedLinks = renderExcludedSegmentLinks();

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No segment distance-bucket data available in the current filtered view.
      </div>
      ${excludedLinks}
    `;
    return;
  }

  container.innerHTML = `
    ${excludedLinks}
    ${items.map(item => {
      const segmentUrl = getStravaSegmentUrl(item.segmentId);
      return `
        <div class="record-card">
          <div class="record-label">${escapeHtml(item.label)}</div>
          <div class="record-title">
            <a class="highlight-activity-link" href="${segmentUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.segmentName)}</a>
          </div>
          <div class="record-subtext">${escapeHtml(item.statsText)}</div>

          <div class="segment-controls-row">
            ${item.segmentId ? `<button class="segment-inline-action" type="button" onclick="excludeSegment('${escapeHtml(item.segmentId)}')">Exclude this segment</button>` : ""}
          </div>

          <div class="segment-last-ride-block">
            <div class="segment-controls-note">Last ridden: ${escapeHtml(formatDate(item.lastRidden))}</div>
            ${renderSubduedActivityName(item.latestActivity, gearDetails)}
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function buildWeekdayBreakdown(activities, metric) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const map = labels.map(label => ({ label, value: 0 }));

  (activities || []).forEach(a => {
    const date = new Date(a.start_date);
    const weekday = date.getDay();
    const index = weekday === 0 ? 6 : weekday - 1;
    if (metric === "distance") map[index].value += miles(a.distance || 0);
    else if (metric === "moving_time") map[index].value += (a.moving_time || 0) / 3600;
    else map[index].value += 1;
  });

  return map;
}

function buildTimeOfDayBreakdown(activities, metric) {
  const groups = [
    { label: "Early AM", start: 0, end: 6, value: 0 },
    { label: "Morning", start: 6, end: 12, value: 0 },
    { label: "Afternoon", start: 12, end: 17, value: 0 },
    { label: "Evening", start: 17, end: 21, value: 0 },
    { label: "Night", start: 21, end: 24, value: 0 }
  ];

  (activities || []).forEach(a => {
    const hour = new Date(a.start_date).getHours();
    const bucket = groups.find(g => hour >= g.start && hour < g.end);
    if (!bucket) return;
    if (metric === "distance") bucket.value += miles(a.distance || 0);
    else if (metric === "moving_time") bucket.value += (a.moving_time || 0) / 3600;
    else bucket.value += 1;
  });

  return groups;
}

function buildMonthlyTrend(activities, metric) {
  const months = {};
  (activities || []).forEach(a => {
    const d = new Date(a.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!months[key]) {
      months[key] = {
        label: `${formatMonthLabel(d.getMonth())} ${d.getFullYear()}`,
        sortKey: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        value: 0
      };
    }

    if (metric === "distance") months[key].value += miles(a.distance || 0);
    else if (metric === "moving_time") months[key].value += (a.moving_time || 0) / 3600;
    else if (metric === "elevation") months[key].value += feet(a.total_elevation_gain || 0);
    else months[key].value += 1;
  });

  return Object.values(months)
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 12);
}

function renderBarChart(containerId, items, formatter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No data available.</div>`;
    return;
  }

  const max = Math.max(...items.map(i => i.value), 1);

  container.innerHTML = items.map(item => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(item.label)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(item.value / max) * 100}%"></div>
      </div>
      <div class="bar-value">${formatter(item.value)}</div>
    </div>
  `).join("");
}

function renderTimelineBars(containerId, items, formatter, toneClass = "") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No timeline data available.</div>`;
    return;
  }

  const max = Math.max(...items.map(i => i.value), 1);

  container.innerHTML = `
    <div class="timeline-bars-wrap ${toneClass}">
      ${items.map(item => `
        <div class="timeline-bar-col">
          <div class="timeline-bar-value">${formatter(item.value)}</div>
          <div class="timeline-bar-track">
            <div class="timeline-bar-fill" style="height:${(item.value / max) * 100}%"></div>
          </div>
          <div class="timeline-bar-label">${escapeHtml(item.label)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderActivityTypeShare(counts) {
  const container = document.getElementById("activity-type-share");
  if (!container) return;
  const entries = Object.entries(counts || {});
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">No activity breakdown available.</div>`;
    return;
  }

  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  container.innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const pct = total > 0 ? (count / total) * 100 : 0;
      return `
        <div class="stack-list-row">
          <div class="stack-list-header">
            <span>${escapeHtml(type)}</span>
            <span>${comma(count)} • ${pct.toFixed(1)}%</span>
          </div>
          <div class="stack-list-track">
            <div class="stack-list-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join("");
}

function renderTrainingPatterns(data) {
  const weekday = buildWeekdayBreakdown(data.activities, patternMetric);
  const timeOfDay = buildTimeOfDayBreakdown(data.activities, patternMetric);
  const monthly = buildMonthlyTrend(data.activities, monthlyTrendMetric);

  const patternFormatter = value => {
    if (patternMetric === "distance") return `${value.toFixed(1)} mi`;
    if (patternMetric === "moving_time") return `${value.toFixed(1)} h`;
    return comma(value);
  };

  const monthlyFormatter = value => {
    if (monthlyTrendMetric === "distance") return `${value.toFixed(1)} mi`;
    if (monthlyTrendMetric === "moving_time") return `${value.toFixed(1)} h`;
    if (monthlyTrendMetric === "elevation") return `${comma(value.toFixed(0))} ft`;
    return comma(value);
  };

  const toneClass = monthlyTrendMetric === "elevation"
    ? "tone-elevation"
    : monthlyTrendMetric === "moving_time"
      ? "tone-time"
      : "tone-distance";

  renderBarChart("weekday-chart", weekday, patternFormatter);
  renderBarChart("timeofday-chart", timeOfDay, patternFormatter);
  renderTimelineBars("monthly-trend-chart", monthly, monthlyFormatter, toneClass);
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
    const dayKey = getDateKey(a.start_date);

    if (!annual[year]) {
      annual[year] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        activeDays: new Set(),
        dayKeys: [],
        maxRideDistance: 0,
        maxRideElevation: 0,
        months: {},
        weeks: {}
      };
    }

    annual[year].distance += a.distance || 0;
    annual[year].elevation += a.total_elevation_gain || 0;
    annual[year].count += 1;
    annual[year].moving_time += movingTime;
    annual[year].activeDays.add(dayKey);
    annual[year].dayKeys.push(dayKey);
    annual[year].maxRideDistance = Math.max(annual[year].maxRideDistance, a.distance || 0);
    annual[year].maxRideElevation = Math.max(annual[year].maxRideElevation, a.total_elevation_gain || 0);

    if (!annual[year].months[month]) {
      annual[year].months[month] = {
        distance: 0,
        elevation: 0,
        count: 0,
        moving_time: 0,
        label: formatMonthLabel(month)
      };
    }
    annual[year].months[month].distance += a.distance || 0;
    annual[year].months[month].elevation += a.total_elevation_gain || 0;
    annual[year].months[month].count += 1;
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
    annual[year].weeks[weekKey].distance += a.distance || 0;
    annual[year].weeks[weekKey].elevation += a.total_elevation_gain || 0;
    annual[year].weeks[weekKey].count += 1;
    annual[year].weeks[weekKey].moving_time += movingTime;

    totalDistance += a.distance || 0;
    totalElevation += a.total_elevation_gain || 0;
    totalCount += 1;
    totalMovingTime += movingTime;
  }

  Object.keys(annual).forEach(year => {
    annual[year].activeDaysCount = annual[year].activeDays.size;
    annual[year].maxStreak = computeMaxStreak(annual[year].dayKeys);
  });

  return { annual, totalDistance, totalElevation, totalCount, totalMovingTime };
}

function renderAnnualSummaryStrip(annual) {
  const container = document.getElementById("annual-summary-strip");
  if (!container) return;

  const rows = Object.keys(annual).sort((a, b) => b - a).map(year => ({
    year,
    miles: miles(annual[year].distance),
    activities: annual[year].count
  }));

  if (!rows.length) {
    container.innerHTML = "";
    return;
  }

  const maxMiles = Math.max(...rows.map(r => r.miles), 1);

  container.innerHTML = `
    <div class="annual-strip-chart">
      ${rows.map(row => `
        <div class="annual-strip-col">
          <div class="annual-strip-top">${row.miles.toFixed(0)} mi</div>
          <div class="annual-strip-track">
            <div class="annual-strip-fill" style="height:${(row.miles / maxMiles) * 100}%"></div>
          </div>
          <div class="annual-strip-label">${row.year}</div>
          <div class="annual-strip-sub">${comma(row.activities)} acts</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAnnualBreakdownItems(items) {
  const sorted = items.sort((a, b) => b.sortDate - a.sortDate);
  if (!sorted.length) return `<div class="annual-breakdown-empty">No data</div>`;

  let html = `<div class="annual-breakdown-list">`;
  sorted.forEach(item => {
    html += `
      <div class="annual-breakdown-item">
        <div class="annual-breakdown-label">${escapeHtml(item.label)}</div>
        <div class="annual-breakdown-metrics">
          <div class="annual-breakdown-metric">${iconDistance()} ${comma(miles(item.distance).toFixed(1))} mi</div>
          <div class="annual-breakdown-metric">${iconElevation()} ${comma(feet(item.elevation).toFixed(0))} ft</div>
          <div class="annual-breakdown-metric">${iconRides()} ${comma(item.count)} Activities</div>
          <div class="annual-breakdown-metric">${iconTime()} ${formatDuration(item.moving_time)}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function toggleAnnualYear(year) {
  if (annualExpandedYears.has(String(year))) annualExpandedYears.delete(String(year));
  else annualExpandedYears.add(String(year));
  saveAnnualExpandedYears();
  updateAnnualStatsTable(window.__annualStatsData);
}

function updateAnnualStatsTable(data) {
  const { annual, totalDistance, totalElevation, totalCount, totalMovingTime } = buildAnnualBreakdowns(data);
  const years = Object.keys(annual).sort((a, b) => b - a);

  renderAnnualSummaryStrip(annual);

  let html = `
    <div class="annual-breakdown-toolbar">
      <span class="annual-breakdown-toolbar-label">Expanded view</span>
      <div class="annual-breakdown-mode-toggle" role="tablist" aria-label="Annual breakdown mode">
        <button type="button" class="annual-breakdown-mode-btn ${annualBreakdownMode === "monthly" ? "active" : ""}" onclick="setAnnualBreakdownMode('monthly'); updateAnnualStatsTable(window.__annualStatsData)">Monthly</button>
        <button type="button" class="annual-breakdown-mode-btn ${annualBreakdownMode === "weekly" ? "active" : ""}" onclick="setAnnualBreakdownMode('weekly'); updateAnnualStatsTable(window.__annualStatsData)">Weekly</button>
      </div>
    </div>

    <div class="annual-stats-rows">
      <div class="annual-stats-row annual-stats-row-header">
        <div class="annual-col annual-col-year">Year</div>
        <div class="annual-col annual-col-metric">Distance</div>
        <div class="annual-col annual-col-metric">Elevation</div>
        <div class="annual-col annual-col-metric">Activities</div>
        <div class="annual-col annual-col-metric">Time</div>
        <div class="annual-col annual-col-metric">Active Days</div>
        <div class="annual-col annual-col-metric">Max Streak</div>
        <div class="annual-col annual-col-metric">Max Ride</div>
        <div class="annual-col annual-col-metric">Max Climb</div>
        <div class="annual-col annual-col-toggle">Details</div>
      </div>

      <div class="annual-stats-row annual-stats-row-total">
        <div class="annual-col annual-col-year"><strong>Total</strong></div>
        <div class="annual-col annual-col-metric">${iconDistance()} ${comma(miles(totalDistance).toFixed(1))} mi</div>
        <div class="annual-col annual-col-metric">${iconElevation()} ${comma(feet(totalElevation).toFixed(0))} ft</div>
        <div class="annual-col annual-col-metric">${iconRides()} ${comma(totalCount)} Activities</div>
        <div class="annual-col annual-col-metric">${iconTime()} ${formatDuration(totalMovingTime)}</div>
        <div class="annual-col annual-col-metric">-</div>
        <div class="annual-col annual-col-metric">-</div>
        <div class="annual-col annual-col-metric">-</div>
        <div class="annual-col annual-col-metric">-</div>
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
          <div class="annual-col annual-col-metric">${iconTime()} ${formatDuration(y.moving_time)}</div>
          <div class="annual-col annual-col-metric">${iconCalendar()} ${comma(y.activeDaysCount)}</div>
          <div class="annual-col annual-col-metric">${iconFire()} ${comma(y.maxStreak)} days</div>
          <div class="annual-col annual-col-metric">${iconDistance()} ${comma(miles(y.maxRideDistance).toFixed(1))} mi</div>
          <div class="annual-col annual-col-metric">${iconElevation()} ${comma(feet(y.maxRideElevation).toFixed(0))} ft</div>
          <div class="annual-col annual-col-toggle">
            <button type="button" class="week-toggle-btn ${isExpanded ? "open" : ""}" aria-expanded="${isExpanded}" aria-label="Toggle ${year} ${annualBreakdownMode} breakdown" onclick="toggleAnnualYear('${year}')">
              <span class="chevron-icon" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        ${isExpanded ? `<div class="annual-year-breakdown">${renderAnnualBreakdownItems(breakdownItems)}</div>` : ""}
      </div>
    `;
  });

  html += `</div>`;
  document.getElementById("annual-stats-table").innerHTML = html;
}

function renderAnnualStats(data) {
  window.__annualStatsData = data;
  const container = document.getElementById("activity-type-checkboxes");
  if (!container) return;
  container.innerHTML = "";

  const types = Object.keys(data.activityCounts || {});
  const storedTypes = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedTypes) || "null");

  const allDiv = document.createElement("div");
  allDiv.className = "filter-chip";
  allDiv.innerHTML = `<label><input type="checkbox" id="chk-all"><span>All</span></label>`;
  container.appendChild(allDiv);

  selectedTypes = new Set(
    storedTypes && storedTypes.length ? storedTypes.filter(t => types.includes(t)) : types
  );

  types.forEach(type => {
    const id = `chk-${type}`;
    const div = document.createElement("div");
    div.className = "filter-chip";
    div.innerHTML = `<label><input type="checkbox" id="${id}" ${selectedTypes.has(type) ? "checked" : ""}><span>${type}</span></label>`;
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

function toggleBikeSelection(gid, bikeName) {
  if (selectedBikes.has(gid)) selectedBikes.delete(gid);
  else selectedBikes.set(gid, { name: bikeName, data: allGearData[gid] });

  const checkbox = document.getElementById(`checkbox-${gid}`);
  if (checkbox) checkbox.checked = selectedBikes.has(gid);

  saveSelectedBikes();
  updateComparisonDisplay();
}

function clearBikeComparison() {
  selectedBikes.clear();
  document.querySelectorAll("input[type='checkbox'][id^='checkbox-']").forEach(cb => {
    cb.checked = false;
  });
  saveSelectedBikes();
  updateComparisonDisplay();
}

function updateComparisonDisplay() {
  const comparisonSection = document.getElementById("bike-comparison-section");
  if (!comparisonSection) return;
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
    html += `<td>${comma(miles(bike.data.distance).toFixed(1))} mi</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconElevation()} Elevation</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${comma(feet(bike.data.elevation).toFixed(0))} ft</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconRides()} Activities</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${comma(bike.data.count)}</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconTime()} Time</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${formatDuration(bike.data.moving_time || 0)}</td>`;
  });
  html += `</tr>`;

  html += `<tr><td><strong>${iconTrophy()} PRs</strong></td>`;
  bikeArray.forEach(bike => {
    html += `<td>${comma(bike.data.pr_count || 0)}</td>`;
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
          <div class="metric">${iconTime()} ${formatDuration(bike.data.moving_time || 0)}</div>
          <div class="metric">${iconTrophy()} ${comma(bike.data.pr_count || 0)} PRs</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  document.getElementById("comparison-content").innerHTML = html;
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

function toggleBikeHistory(gid) {
  if (bikeHistoryExpanded.has(gid)) bikeHistoryExpanded.delete(gid);
  else bikeHistoryExpanded.add(gid);
  saveBikeHistoryExpanded();
  updateBikeFilters();
}

function toggleBikeYear(id) {
  if (expandedBikeYears.has(id)) expandedBikeYears.delete(id);
  else expandedBikeYears.add(id);
  saveExpandedBikeYears();
  updateBikeFilters();
}

function formatSpeed(avgSpeedMph, sportType = "Ride") {
  if (!avgSpeedMph || avgSpeedMph <= 0) return null;
  if (sportType === "Run" || sportType === "Walk") {
    const pace = 60 / avgSpeedMph;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    return `avg ${paceMin}:${String(paceSec).padStart(2, "0")} min/mi pace`;
  }
  return `avg ${avgSpeedMph.toFixed(1)} mph`;
}

function sortBikeRows(rows, sortValue) {
  const [field, direction] = sortValue.split("-");
  const dir = direction === "asc" ? 1 : -1;

  return rows.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (field === "name") return a.name.localeCompare(b.name) * dir;
    if (field === "rides") return (a.total.count - b.total.count) * dir;
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
  renderBikeRows(sorted, window.__rideInsights);
}

function restoreBikeFilterInputs() {
  const bikeSearch = localStorage.getItem(STORAGE_KEYS.bikeSearch);
  const bikeSort = localStorage.getItem(STORAGE_KEYS.bikeSort);

  if (bikeSearch !== null && document.getElementById("bike-search")) document.getElementById("bike-search").value = bikeSearch;
  if (bikeSort && document.getElementById("bike-sort")) document.getElementById("bike-sort").value = bikeSort;
}

function renderBikeRows(rows, rideInsights) {
  let html = "";

  rows.forEach(row => {
    const total = row.total;
    const isSelected = selectedBikes.has(row.gid);
    const speedLabel = formatSpeed(total.avg_speed_mph, "Ride");
    const prLabel = `${comma(total.pr_count || 0)} PR${(total.pr_count || 0) === 1 ? "" : "s"}`;
    const historyOpen = bikeHistoryExpanded.has(row.gid);
    const yearCount = row.years.length;
    const bikeHistoryLabel = historyOpen
      ? "Hide yearly history"
      : `Show yearly history (${yearCount} year${yearCount === 1 ? "" : "s"})`;

    const insights = (rideInsights && rideInsights.perBike[row.gid]) || {};
    const biggestMileageWeek = insights.biggestMileageWeek;
    const biggestClimbingWeek = insights.biggestClimbingWeek;
    const mostActiveWeek = insights.mostActiveWeek;

    let card = `
      <div class="card bike-card-summary glass-card">
        <div class="accent-bar"></div>
        <div class="card-header bike-card-header">
          <div class="bike-header-content">
            <svg class="icon-lg" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"></circle>
              <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"></circle>
              <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"></path>
            </svg>
            <span>${escapeHtml(row.name)}</span>
          </div>
          <div class="bike-card-actions">
            <button class="pin-button ${row.isPinned ? "pinned" : ""}" onclick="pinBike('${row.gid}')">${row.isPinned ? "Pinned" : "Pin"}</button>
            <label class="compare-checkbox-wrap">
              <input type="checkbox" id="checkbox-${row.gid}" class="bike-checkbox" data-gid="${row.gid}" data-name="${escapeHtml(row.name)}" ${isSelected ? "checked" : ""}>
              <span>Compare</span>
            </label>
          </div>
        </div>

        <div class="bike-summary-metrics">
          <div class="bike-summary-metric">${iconDistance()} ${comma(miles(total.distance).toFixed(1))} mi</div>
          <div class="bike-summary-metric">${iconElevation()} ${comma(feet(total.elevation).toFixed(0))} ft</div>
          <div class="bike-summary-metric">${iconRides()} ${comma(total.count)} Activities</div>
          <div class="bike-summary-metric">${iconTime()} ${formatDuration(total.moving_time)}</div>
          <div class="bike-summary-metric">${iconTrophy()} ${prLabel}</div>
          ${speedLabel ? `<div class="bike-summary-metric speed-metric">${iconSpeed()} ${speedLabel}</div>` : ""}
        </div>

        <div class="bike-insights-grid">
          <div class="bike-insight-card">
            <div class="bike-insight-label">Biggest mileage week</div>
            <div class="bike-insight-value">${biggestMileageWeek ? `${comma(miles(biggestMileageWeek.distance).toFixed(1))} mi` : "-"}</div>
            <div class="bike-insight-sub">${biggestMileageWeek ? biggestMileageWeek.label : ""}</div>
          </div>
          <div class="bike-insight-card">
            <div class="bike-insight-label">Biggest climbing week</div>
            <div class="bike-insight-value">${biggestClimbingWeek ? `${comma(feet(biggestClimbingWeek.elevation).toFixed(0))} ft` : "-"}</div>
            <div class="bike-insight-sub">${biggestClimbingWeek ? biggestClimbingWeek.label : ""}</div>
          </div>
          <div class="bike-insight-card">
            <div class="bike-insight-label">Most active week</div>
            <div class="bike-insight-value">${mostActiveWeek ? `${comma(mostActiveWeek.count)} rides` : "-"}</div>
            <div class="bike-insight-sub">${mostActiveWeek ? mostActiveWeek.label : ""}</div>
          </div>
          <div class="bike-insight-card">
            <div class="bike-insight-label">Share of ride mileage</div>
            <div class="bike-insight-value">${iconPercent()} ${((insights.distanceShare || 0) * 100).toFixed(1)}%</div>
            <div class="bike-insight-sub">Of all Ride miles</div>
          </div>
          <div class="bike-insight-card">
            <div class="bike-insight-label">Share of ride count</div>
            <div class="bike-insight-value">${iconPercent()} ${((insights.countShare || 0) * 100).toFixed(1)}%</div>
            <div class="bike-insight-sub">Of all Ride activities</div>
          </div>
          <div class="bike-insight-card">
            <div class="bike-insight-label">First / last ride</div>
            <div class="bike-insight-value">${iconCalendar()} ${formatDate(insights.firstRide)}</div>
            <div class="bike-insight-sub">${formatDate(insights.lastRide)}</div>
            <div class="bike-insight-sub">${formatDayDifference(insights.firstRide, insights.lastRide)}</div>
          </div>
        </div>

        <div class="bike-history-summary">
          <div class="bike-history-meta">${yearCount} year${yearCount === 1 ? "" : "s"} of history</div>
          <button type="button" class="history-toggle-btn ${historyOpen ? "open" : ""}" onclick="toggleBikeHistory('${row.gid}')">
            <span>${bikeHistoryLabel}</span>
            <span class="chevron-icon" aria-hidden="true"></span>
          </button>
        </div>
    `;

    if (historyOpen) {
      card += `<div class="bike-history-panel"><div class="bike-history-rows">`;

      row.years.forEach(year => {
        const y = row.bikeYearStats[year];
        const yearSpeedLabel = formatSpeed(y.avg_speed_mph, "Ride");
        const yearId = `${row.gid}-${year}`;
        const weeksOpen = expandedBikeYears.has(yearId);
        const yearPrLabel = `${comma(y.pr_count || 0)} PR${(y.pr_count || 0) === 1 ? "" : "s"}`;

        const weekEntries = Object.entries(y.weeks || {}).map(([key, value]) => {
          const numericWeek = Number(key);
          const hasIsoWeek = !Number.isNaN(numericWeek) && numericWeek > 0;
          const isoMonday = hasIsoWeek ? getMondayForIsoWeek(Number(year), numericWeek) : null;

          const weekLabel = value.week_start
            ? formatDate(value.week_start)
            : isoMonday
              ? formatShortDate(isoMonday)
              : (value.label && /^\d{2}\/\d{2}\/\d{4}$/.test(value.label) ? value.label : value.label || key);

          const sortDate = value.week_start
            ? new Date(value.week_start).getTime()
            : isoMonday
              ? isoMonday.getTime()
              : (!Number.isNaN(new Date(weekLabel).getTime()) ? new Date(weekLabel).getTime() : numericWeek || 0);

          return {
            ...value,
            label: weekLabel,
            sortDate
          };
        }).sort((a, b) => b.sortDate - a.sortDate);

        let weeksHtml = "";
        weekEntries.forEach(w => {
          const trend = trendIndicator(w.trend);
          weeksHtml += `
            <div class="week-row">
              <span class="week-label">${escapeHtml(w.label)}</span>
              <span>${iconDistance()} ${comma(miles(w.distance).toFixed(1))} mi</span>
              <span>${iconElevation()} ${comma(feet(w.elevation).toFixed(0))} ft</span>
              <span>${iconRides()} ${comma(w.count)}</span>
              <span>${iconTime()} ${formatDuration(w.moving_time)}</span>
              ${trend ? `<span>${trend}</span>` : ""}
            </div>
          `;
        });

        card += `
          <div class="bike-history-year-block">
            <div class="bike-history-row ${weeksOpen ? "expanded" : ""}">
              <div class="bike-history-col-year">${year}</div>
              <div class="bike-history-col-metrics">
                <div class="bike-history-metric">${iconDistance()} ${comma(miles(y.distance).toFixed(1))} mi</div>
                <div class="bike-history-metric">${iconElevation()} ${comma(feet(y.elevation).toFixed(0))} ft</div>
                <div class="bike-history-metric">${iconRides()} ${comma(y.count)} Activities</div>
                <div class="bike-history-metric">${iconTime()} ${formatDuration(y.moving_time)}</div>
                <div class="bike-history-metric">${iconTrophy()} ${yearPrLabel}</div>
                ${yearSpeedLabel ? `<div class="bike-history-metric">${iconSpeed()} ${yearSpeedLabel}</div>` : ""}
              </div>
              <div class="bike-history-col-toggle">
                <button class="week-toggle-btn ${weeksOpen ? "open" : ""}" aria-label="Toggle weekly breakdown" aria-expanded="${weeksOpen}" type="button" onclick="toggleBikeYear('${yearId}')">
                  <span class="chevron-icon" aria-hidden="true"></span>
                </button>
              </div>
            </div>
            ${weeksOpen ? `<div class="bike-weeks-container">${weeksHtml || "<div class='week-row'>No weekly data</div>"}</div>` : ""}
          </div>
        `;
      });

      card += `</div></div>`;
    }

    card += `</div>`;
    html += card;
  });

  document.getElementById("bike-grid").innerHTML = html;

  document.querySelectorAll(".bike-checkbox").forEach(cb => {
    cb.addEventListener("change", event => {
      toggleBikeSelection(event.target.dataset.gid, event.target.dataset.name);
    });
  });
}

function renderBikeStats(bikeYearStats, gearTotals, gearDetails, rideInsights) {
  allGearData = gearTotals;

  const gearNames = {};
  for (const gid of Object.keys(gearDetails || {})) {
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

  currentBikeRows = Object.keys(bikeYearStats || {}).map(gid => ({
    gid,
    name: gearNames[gid] || gid,
    total: gearTotals[gid],
    bikeYearStats: bikeYearStats[gid],
    years: Object.keys(bikeYearStats[gid]).sort((a, b) => b - a),
    isPinned: pinnedBikes.has(gid)
  }));

  window.__rideInsights = rideInsights;
  updateBikeFilters();
  updateComparisonDisplay();
}

async function renderAll(rawData) {
  window.__rawDashboardData = rawData;
  populateGlobalFilters(rawData);
  restoreGlobalFilters();
  syncPatternMetricButtons();
  syncMonthlyMetricButtons();

  const data = applyGlobalFilters(rawData);
  const rideInsights = deriveRideInsights(data);
  const segmentSummaryHighlights = buildSegmentSummaryHighlights(data);
  const segmentDistanceHighlights = buildSegmentDistanceHighlights(data);

  renderHero(data, rideInsights);
  renderKpiSummary(data);
  renderTrainingPatterns(data);
  renderActivityTypeShare(data.activityCounts || {});
  renderAnnualStats(data);
  renderHighlights(rideInsights, data.gearDetails || {});
  renderSegmentSummaryHighlights(segmentSummaryHighlights, data.gearDetails || {});
  renderSegmentDistanceHighlights(segmentDistanceHighlights, data.gearDetails || {});
  renderBikeStats(data.bikeYearStats || {}, data.gearTotals || {}, data.gearDetails || {}, rideInsights);

  if (data.prBackfill) {
    window.__lastPrBackfill = data.prBackfill;
    renderPrBackfillAdmin(data.prBackfill);
  } else {
    renderPrBackfillAdmin(window.__lastPrBackfill || null);
  }

  const featuredActivities = await loadFeaturedActivities();
  renderFeaturedActivities(featuredActivities, rawData);
}

window.onload = async () => {
  applyThemePreference();
  restoreBikeFilterInputs();
  restoreGlobalFilters();
  syncPatternMetricButtons();
  syncMonthlyMetricButtons();

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
  await renderAll(data);

  if (data.prBackfill && (data.prBackfill.running || data.prBackfill.mode === "waiting" || data.prBackfill.mode === "starting")) {
    pollPrBackfillStatus();
  }
};

async function refreshData() {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = "Refreshing (only new activities + PR data)…";
  showSpinner();

  const res = await fetch("http://192.168.0.115:5000/api/analytics?refresh=1&segments=1");
  const data = await res.json();

  hideSpinner();
  setLastSyncLabel();

  if (data.error) {
    statusDiv.innerHTML = data.error;
    return;
  }

  statusDiv.innerHTML = data.message;
  await renderAll(data);
}

async function resumePull() {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = "Resuming pull (fill gaps)…";
  showSpinner();

  try {
    const res = await fetch("http://192.168.0.115:5000/api/analytics?resume=1");
    const data = await res.json();

    hideSpinner();
    setLastSyncLabel();

    if (data.error) {
      statusDiv.innerHTML = data.error;
      return;
    }

    statusDiv.innerHTML = data.message || "Resume pull complete.";
    await renderAll(data);
  } catch (err) {
    hideSpinner();
    statusDiv.innerHTML = "Resume pull failed.";
    console.error(err);
  }
}

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
  await renderAll(data);
}

async function pullPrData() {
  return startPrBackfill();
}
