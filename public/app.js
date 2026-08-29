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

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
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
      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconElevation() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 20l9-16 9 16H3z" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconRides() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconSpeed() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 7v5l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconTime() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconCalendar() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconPercent() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="16.5" cy="16.5" r="2.5" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
  `;
}

function iconFire() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c1 3-1 4-1 6 0 1 1 2 2 3 2-1 3-3 3-5 3 2 5 5 5 8a8 8 0 1 1-16 0c0-2 1-4 3-6 0 2 1 3 2 4 1-1 1-2 1-4 0-2 0-4 1-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
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
  annualBreakdownMode: "strava:annualBreakdownMode",
  expandedBikeYears: "strava:expandedBikeYears",
  bikeHistoryExpanded: "strava:bikeHistoryExpanded"
};

let selectedBikes = new Map();
let allGearData = {};
let currentBikeRows = [];
let selectedTypes = new Set();
let pinnedBikes = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedBikes) || "[]"));
let annualExpandedYears = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.annualExpandedYears) || "[]"));
let annualBreakdownMode = localStorage.getItem(STORAGE_KEYS.annualBreakdownMode) || "monthly";
let expandedBikeYears = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.expandedBikeYears) || "[]"));
let bikeHistoryExpanded = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.bikeHistoryExpanded) || "[]"));

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

  const highestElevationActivity = allActivities.reduce(
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

  const steepestRide = rideActivities
    .filter(a => (a.distance || 0) > 0 && (a.total_elevation_gain || 0) > 0)
    .reduce((best, a) => {
      const elevationPerMile = feet(a.total_elevation_gain) / miles(a.distance);
      if (!best || elevationPerMile > best.elevation_per_mile) {
        return { ...a, elevation_per_mile: elevationPerMile };
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
      fastestRide,
      steepestRide
    }
  };
}

function renderKpiSummary(data) {
  const kpi = document.getElementById("kpi-summary");
  const totalActivities = data.activities.length;
  const totalDistanceMeters = data.activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalElevationMeters = data.activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
  const totalMovingTime = data.activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
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
      <div class="kpi-label">Total Activity Time</div>
      <div class="kpi-value">${formatDuration(totalMovingTime)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Bikes</div>
      <div class="kpi-value">${comma(activeBikes)}</div>
    </div>
  `;
}

function renderHighlights(rideInsights, gearDetails = {}) {
  const container = document.getElementById("highlights-content");
  if (!container) return;

  const h = rideInsights.highlights;

  const bikeCard = (label, bike, value, subtext = "") => `
    <div class="highlight-card">
      <div class="highlight-label">${label}</div>
      <div class="highlight-bike">${bike ? escapeHtml(bike.name) : "-"}</div>
      <div class="highlight-value">${value || "-"}</div>
      ${subtext ? `<div class="highlight-subtext">${escapeHtml(subtext)}</div>` : ""}
    </div>
  `;

  const activityCard = (label, activity, value, extraSubtext = "") => `
    <div class="highlight-card">
      <div class="highlight-label">${label}</div>
      ${activity ? renderActivityName(activity, gearDetails) : `<div class="highlight-bike">-</div>`}
      <div class="highlight-value">${value || "-"}</div>
      ${extraSubtext ? `<div class="highlight-subtext">${escapeHtml(extraSubtext)}</div>` : ""}
    </div>
  `;

  container.innerHTML = `
    <div class="highlights-grid">
      ${bikeCard("Most-used bike by miles", h.mostUsedByMiles, h.mostUsedByMiles ? `${comma(miles(h.mostUsedByMiles.distance).toFixed(1))} mi` : "-")}
      ${bikeCard("Most-used bike by ride count", h.mostUsedByCount, h.mostUsedByCount ? `${comma(h.mostUsedByCount.count)} rides` : "-")}
      ${bikeCard("Fastest bike", h.fastestBike, h.fastestBike && h.fastestBike.avg_speed_mph ? `${h.fastestBike.avg_speed_mph.toFixed(1)} mph` : "-")}
      ${bikeCard("Highest elevation per ride", h.climbingBike, h.climbingBike ? `${comma(feet(h.climbingBike.avg_elevation_per_ride).toFixed(0))} ft/ride` : "-")}
      ${bikeCard("Longest average ride", h.longestAverageRideBike, h.longestAverageRideBike ? `${comma(miles(h.longestAverageRideBike.avg_distance_per_ride).toFixed(1))} mi/ride` : "-")}
      ${bikeCard("Most total activity time", h.mostTotalTimeBike, h.mostTotalTimeBike ? formatDuration(h.mostTotalTimeBike.moving_time) : "-")}
      ${bikeCard("Most recently ridden", h.mostRecentBike, h.mostRecentBike ? formatDate(h.mostRecentBike.lastRide) : "-")}
      ${bikeCard("Biggest mileage week", h.biggestMileageWeekBike, h.biggestMileageWeekBike ? `${comma(miles(h.biggestMileageWeekBike.distance).toFixed(1))} mi` : "-", h.biggestMileageWeekBike ? `Week of ${h.biggestMileageWeekBike.label}` : "")}
      ${bikeCard("Biggest climbing week", h.biggestClimbingWeekBike, h.biggestClimbingWeekBike ? `${comma(feet(h.biggestClimbingWeekBike.elevation).toFixed(0))} ft` : "-", h.biggestClimbingWeekBike ? `Week of ${h.biggestClimbingWeekBike.label}` : "")}
      ${bikeCard("Longest-used bike", h.longestUsedBike, h.longestUsedBike ? formatYearsBetween(h.longestUsedBike.firstRide, h.longestUsedBike.lastRide) : "-", h.longestUsedBike ? `${formatDate(h.longestUsedBike.firstRide)} to ${formatDate(h.longestUsedBike.lastRide)}` : "")}

      ${activityCard("Longest single activity", h.longestActivity, h.longestActivity ? `${comma(miles(h.longestActivity.distance || 0).toFixed(1))} mi` : "-")}
      ${activityCard("Most elevation in a single activity", h.highestElevationActivity, h.highestElevationActivity ? `${comma(feet(h.highestElevationActivity.total_elevation_gain || 0).toFixed(0))} ft` : "-")}
      ${activityCard("Longest activity time", h.longestMovingTimeActivity, h.longestMovingTimeActivity ? formatDuration(h.longestMovingTimeActivity.moving_time || 0) : "-")}
      ${activityCard("Fastest ride by avg speed", h.fastestRide, h.fastestRide ? `${h.fastestRide.avg_speed_mph.toFixed(1)} mph` : "-")}
      ${activityCard("Most elevation per mile", h.steepestRide, h.steepestRide ? `${comma((h.steepestRide.elevation_per_mile || 0).toFixed(0))} ft/mi` : "-")}
    </div>
  `;
}

function renderActivityCounts(counts) {
  let html = `<div class="metric-row">`;
  for (const type of Object.keys(counts)) {
    html += `<div class="metric">${type}: ${comma(counts[type])}</div>`;
  }
  html += `</div>`;
  document.getElementById("activity-counts-content").innerHTML = html;
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

  if (bikeSearch !== null) document.getElementById("bike-search").value = bikeSearch;
  if (bikeSort) document.getElementById("bike-sort").value = bikeSort;
}

function renderBikeRows(rows, rideInsights) {
  let html = "";

  rows.forEach(row => {
    const total = row.total;
    const isSelected = selectedBikes.has(row.gid);
    const speedLabel = formatSpeed(total.avg_speed_mph, "Ride");
    const prLabel = total.pr_count > 0 ? `${comma(total.pr_count)} PRs` : "";
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
      <div class="card bike-card-summary">
        <div class="accent-bar"></div>
        <div class="card-header bike-card-header">
          <div class="bike-header-content">
            <svg class="icon-lg" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
              <circle cx="19" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M5 17l6-10 4 6h4" stroke="currentColor" stroke-width="2" fill="none"/>
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
          ${speedLabel ? `<div class="bike-summary-metric speed-metric">${iconSpeed()} ${speedLabel}</div>` : ""}
          ${prLabel ? `<div class="bike-summary-metric">${prLabel}</div>` : ""}
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

async function renderAll(data) {
  const rideInsights = deriveRideInsights(data);
  renderKpiSummary(data);
  renderActivityCounts(data.activityCounts || {});
  renderAnnualStats(data);
  renderHighlights(rideInsights, data.gearDetails || {});
  renderBikeStats(data.bikeYearStats || {}, data.gearTotals || {}, data.gearDetails || {}, rideInsights);
  const featuredActivities = await loadFeaturedActivities();
  renderFeaturedActivities(featuredActivities, data);
}

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
  await renderAll(data);
};

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
