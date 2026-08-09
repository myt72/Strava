const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");
const { client_id, client_secret, redirect_uri } = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

let access_token = null;
let refresh_token = null;

const CACHE_FILE = "./cache.json";

/* Rate limit tracking */
let rateLimitRemaining = 600;
let rateLimitLimit = 600;
let requestCount = 0;

/* ----------------- CACHE BUSTING MIDDLEWARE ----------------- */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

/* ----------------- CACHE ----------------- */

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Cache corrupted:", err);
    return null;
  }
}

function saveCache(data) {
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, CACHE_FILE);
}

/* Update rate limit from response headers */
function updateRateLimit(res) {
  const limit = res.headers.get("x-ratelimit-limit");
  const usage = res.headers.get("x-ratelimit-usage");
  
  if (limit && usage) {
    const [used, max] = usage.split(",").map(Number);
    rateLimitRemaining = max - used;
    rateLimitLimit = max;
    console.log(`[Rate Limit] ${rateLimitRemaining}/${max} remaining`);
  }
}

/* Sleep utility for rate limiting */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* AUTH */

app.get("/dashboard", (req, res, next) => {
  if (!access_token) return res.redirect("/auth");
  next();
});

app.use("/dashboard", express.static("public"));

app.get("/auth", (req, res) => {
  const url =
    `https://www.strava.com/oauth/authorize?client_id=${client_id}` +
    `&response_type=code&redirect_uri=${redirect_uri}` +
    `&scope=read,activity:read_all`;
  res.redirect(url);
});

app.get("/exchange_token", async (req, res) => {
  const code = req.query.code;

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code"
    })
  });

  const data = await tokenRes.json();
  access_token = data.access_token;
  refresh_token = data.refresh_token;

  res.redirect("/dashboard");
});

/* TOKEN REFRESH */

async function refreshToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      grant_type: "refresh_token",
      refresh_token
    })
  });

  const data = await res.json();
  access_token = data.access_token;
  refresh_token = data.refresh_token;
}

/* FETCH WRAPPER with rate limit checking */

async function stravaFetch(url) {
  requestCount++;
  
  // If we're running low on rate limit, wait
  if (rateLimitRemaining < 50) {
    console.warn(`[Rate Limit] Only ${rateLimitRemaining} calls remaining. Pausing...`);
    await sleep(2000);
  }

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  updateRateLimit(res);

  if (res.status === 401) {
    await refreshToken();
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    updateRateLimit(res);
  }

  if (res.status === 429) {
    console.error("[Rate Limit] Hit 429 - Strava rate limit exceeded");
  }

  return res;
}

/* ACTIVITY FETCH */

async function fetchAllActivitiesOnce() {
  let page = 1;
  let all = [];

  while (true) {
    const res = await stravaFetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    all = all.concat(
      data.map(a => ({
        id: a.id,
        sport_type: a.sport_type || a.type,
        distance: a.distance,
        moving_time: a.moving_time,
        total_elevation_gain: a.total_elevation_gain,
        start_date: a.start_date,
        gear_id: a.gear_id
      }))
    );
    page++;
  }

  return all;
}

async function fetchNewActivitiesSince(lastDate) {
  if (!lastDate) return [];

  const lastTs = new Date(lastDate).getTime();

  const res = await stravaFetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1`
  );
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];

  const newActs = [];

  for (const a of data) {
    const ts = new Date(a.start_date).getTime();
    if (ts > lastTs) {
      newActs.push({
        id: a.id,
        sport_type: a.sport_type || a.type,
        distance: a.distance,
        moving_time: a.moving_time,
        total_elevation_gain: a.total_elevation_gain,
        start_date: a.start_date,
        gear_id: a.gear_id
      });
    } else {
      break;
    }
  }

  return newActs;
}

/* RESUME: fetch activities older than the oldest cached activity */

async function fetchActivitiesBefore(beforeDate) {
  if (!beforeDate) return [];

  const beforeTs = new Date(beforeDate).getTime();
  let page = 1;
  let all = [];
  let foundBefore = false;

  console.log(`[Resume] Fetching activities before ${beforeDate}...`);

  while (true) {
    const res = await stravaFetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const a of data) {
      const ts = new Date(a.start_date).getTime();
      if (ts < beforeTs) {
        // This activity is older than our oldest cached one
        all.push({
          id: a.id,
          sport_type: a.sport_type || a.type,
          distance: a.distance,
          moving_time: a.moving_time,
          total_elevation_gain: a.total_elevation_gain,
          start_date: a.start_date,
          gear_id: a.gear_id
        });
        foundBefore = true;
      }
    }

    // If we found activities before our date, keep going
    if (foundBefore && data[data.length - 1]) {
      const lastTs = new Date(data[data.length - 1].start_date).getTime();
      if (lastTs >= beforeTs) {
        // Last activity on this page is still after our before date, continue
        page++;
        continue;
      } else {
        // Last activity is before our date, we've found the gap
        break;
      }
    }

    page++;
  }

  console.log(`[Resume] Found ${all.length} activities before ${beforeDate}`);
  return all;
}

/* GEAR FETCH - batched to avoid rate limiting */

async function fetchMissingGearDetails(existingGearDetails, gearTotals) {
  const knownIds = new Set(Object.keys(existingGearDetails || {}));
  const allIds = Object.keys(gearTotals || {});
  const missingIds = allIds.filter(id => !knownIds.has(id));

  if (missingIds.length === 0) return existingGearDetails || {};

  console.log(`[Gear Fetch] Fetching ${missingIds.length} gear details...`);

  const gearDetails = { ...(existingGearDetails || {}) };
  
  // Batch requests: do 3 at a time to avoid rate limit spikes
  const BATCH_SIZE = 3;
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async gid => {
      const res = await stravaFetch(`https://www.strava.com/api/v3/gear/${gid}`);
      const data = await res.json();
      return { gid, data };
    });

    const results = await Promise.all(promises);
    for (const { gid, data } of results) {
      gearDetails[gid] = data;
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < missingIds.length) {
      await sleep(500);
    }
  }

  return gearDetails;
}

/* SEGMENT FETCH - OPTIONAL and efficient */

async function fetchSegmentEffortsForActivities(activities, existingSegmentData, fetchSegments = false) {
  if (!fetchSegments) {
    console.log("[Segment Fetch] Skipped (disabled to save rate limit)");
    return existingSegmentData || {};
  }

  const existing = existingSegmentData || {};
  const toFetch = activities.filter(a => !(a.id in existing));

  if (toFetch.length === 0) {
    console.log("[Segment Fetch] No new segments to fetch");
    return existing;
  }

  console.warn(`[Segment Fetch] WARNING: About to fetch ${toFetch.length} activities for segment data. This uses many API calls!`);
  
  // Only fetch if we have rate limit headroom
  if (rateLimitRemaining < toFetch.length + 50) {
    console.error(`[Segment Fetch] Insufficient rate limit (${rateLimitRemaining} remaining). Skipping.`);
    return existing;
  }

  const result = { ...existing };
  let fetched = 0;

  // Fetch sequentially with delays to respect rate limits
  for (const a of toFetch) {
    if (rateLimitRemaining < 30) {
      console.warn(`[Segment Fetch] Rate limit running low. Fetched ${fetched}/${toFetch.length} segments.`);
      break;
    }

    try {
      const res = await stravaFetch(`https://www.strava.com/api/v3/activities/${a.id}`);
      
      if (res.status === 429) {
        console.warn("[Segment Fetch] Hit 429. Stopping segment fetch.");
        break;
      }

      const detail = await res.json();
      const efforts = Array.isArray(detail.segment_efforts)
        ? detail.segment_efforts.map(e => ({
            segment_id: e.segment && e.segment.id,
            segment_name: e.segment && e.segment.name,
            pr_rank: e.pr_rank || null
          }))
        : [];
      result[a.id] = efforts;
      fetched++;

      // Respect rate limits with delay
      if (fetched % 10 === 0) {
        await sleep(1000);
      }
    } catch (err) {
      console.warn(`[Segment Fetch] Failed for activity ${a.id}:`, err.message);
      result[a.id] = [];
    }
  }

  console.log(`[Segment Fetch] Completed: ${fetched}/${toFetch.length} activities`);
  return result;
}

/* ISO WEEK HELPER */

function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return { year: thursday.getUTCFullYear(), week };
}

/* ANALYTICS */

function computeAnalytics(allActivities, segmentData) {
  const activityCounts = {};
  const gearTotals = {};
  const annualStats = {};
  const bikeYearStats = {};

  for (const a of allActivities) {
    const type = a.sport_type;
    activityCounts[type] = (activityCounts[type] || 0) + 1;

    const prCount = segmentData && a.id in segmentData
      ? (segmentData[a.id] || []).filter(e => e.pr_rank === 1).length
      : 0;

    if (a.gear_id) {
      if (!gearTotals[a.gear_id]) {
        gearTotals[a.gear_id] = { distance: 0, elevation: 0, count: 0, moving_time: 0, pr_count: 0 };
      }
      gearTotals[a.gear_id].distance += a.distance;
      gearTotals[a.gear_id].elevation += a.total_elevation_gain;
      gearTotals[a.gear_id].count++;
      gearTotals[a.gear_id].moving_time += a.moving_time || 0;
      gearTotals[a.gear_id].pr_count += prCount;
    }

    const year = new Date(a.start_date).getFullYear();
    if (!annualStats[year]) annualStats[year] = { distance: 0, elevation: 0, count: 0 };
    annualStats[year].distance += a.distance;
    annualStats[year].elevation += a.total_elevation_gain;
    annualStats[year].count++;

    if (a.gear_id) {
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
      bikeYearStats[a.gear_id][year].distance += a.distance;
      bikeYearStats[a.gear_id][year].elevation += a.total_elevation_gain;
      bikeYearStats[a.gear_id][year].count++;
      bikeYearStats[a.gear_id][year].moving_time += a.moving_time || 0;
      bikeYearStats[a.gear_id][year].pr_count += prCount;

      // Weekly breakdown
      const isoWeek = getISOWeek(a.start_date);
      const wk = String(isoWeek.week);
      if (!bikeYearStats[a.gear_id][year].weeks[wk]) {
        bikeYearStats[a.gear_id][year].weeks[wk] = { distance: 0, elevation: 0, count: 0, moving_time: 0 };
      }
      bikeYearStats[a.gear_id][year].weeks[wk].distance += a.distance;
      bikeYearStats[a.gear_id][year].weeks[wk].elevation += a.total_elevation_gain;
      bikeYearStats[a.gear_id][year].weeks[wk].count++;
      bikeYearStats[a.gear_id][year].weeks[wk].moving_time += a.moving_time || 0;
    }
  }

  // Calculate avg speed/pace and week trends
  for (const gid of Object.keys(gearTotals)) {
    const gt = gearTotals[gid];
    if (gt.moving_time > 0 && gt.distance > 0) {
      const distMiles = gt.distance / 1609.34;
      const timeHours = gt.moving_time / 3600;
      gt.avg_speed_mph = distMiles / timeHours;
      gt.avg_pace_min_per_mi = (gt.moving_time / 60) / distMiles;
    }
  }

  for (const gid of Object.keys(bikeYearStats)) {
    for (const year of Object.keys(bikeYearStats[gid])) {
      const ys = bikeYearStats[gid][year];
      if (ys.moving_time > 0 && ys.distance > 0) {
        const distMiles = ys.distance / 1609.34;
        const timeHours = ys.moving_time / 3600;
        ys.avg_speed_mph = distMiles / timeHours;
        ys.avg_pace_min_per_mi = (ys.moving_time / 60) / distMiles;
      }

      // Compute week trends
      const weekNums = Object.keys(ys.weeks).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < weekNums.length; i++) {
        const wk = String(weekNums[i]);
        const prevWk = i > 0 ? String(weekNums[i - 1]) : null;
        if (prevWk) {
          const curr = ys.weeks[wk].distance;
          const prev = ys.weeks[prevWk].distance;
          ys.weeks[wk].trend = prev > 0 ? (curr - prev) / prev : 0;
        } else {
          ys.weeks[wk].trend = 0;
        }
      }
    }
  }

  return { activityCounts, gearTotals, annualStats, bikeYearStats };
}

/* AUTO LOAD CACHE */

app.get("/api/analytics/auto", async (req, res) => {
  if (!access_token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const cache = loadCache();

  if (cache) {
    return res.json({
      cached: true,
      ...cache,
      message: "Loaded from local cache.json"
    });
  }

  return res.json({
    cached: false,
    message: "No local data available — populate from the API."
  });
});

/* FULL PULL + REFRESH + RESUME */

app.get("/api/analytics", async (req, res) => {
  if (!access_token) return res.status(401).json({ error: "Not authenticated" });

  const full = req.query.full === "1";
  const refresh = req.query.refresh === "1";
  const resume = req.query.resume === "1";
  const cache = loadCache();
  
  // Only fetch segments if explicitly requested via ?segments=1
  const fetchSegments = req.query.segments === "1";
  
  requestCount = 0;
  const mode = full ? "FULL" : refresh ? "REFRESH" : resume ? "RESUME" : "AUTO";
  console.log(`\n[API Call] Starting ${mode} pull. fetchSegments=${fetchSegments}`);

  /* FULL PULL: always fetch everything fresh */
  if (full) {
    const allActivities = await fetchAllActivitiesOnce();

    if (!allActivities || allActivities.length === 0) {
      return res.json({
        error: "Strava returned no activities. Check authentication, scope, or rate limits."
      });
    }

    const segmentData = await fetchSegmentEffortsForActivities(allActivities, {}, fetchSegments);
    const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
    const gearDetails = await fetchMissingGearDetails({}, gearTotals);

    const newCache = {
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    };

    saveCache(newCache);

    console.log(`[API Call] Complete. Total: ${allActivities.length} activities, ${requestCount} API calls used`);
    return res.json({
      cached: false,
      ...newCache,
      message: `Full data pull complete. (${requestCount} API calls, ${allActivities.length} activities)`
    });
  }

  /* RESUME: fetch activities older than the oldest cached */
  if (resume) {
    if (!cache || !cache.activities || cache.activities.length === 0) {
      return res.json({
        error: "No cache to resume from. Run a full pull first."
      });
    }

    // Get the oldest cached activity
    const oldestCached = cache.activities[cache.activities.length - 1];
    const resumeFromDate = oldestCached.start_date;

    console.log(`[Resume] Oldest cached activity: ${resumeFromDate}`);

    // Fetch activities before this date
    const olderActivities = await fetchActivitiesBefore(resumeFromDate);

    if (!olderActivities || olderActivities.length === 0) {
      console.log(`[Resume] No older activities found. Cache is complete.`);
      return res.json({ 
        cached: true, 
        ...cache, 
        message: "Resume: No older activities found. Cache appears complete." 
      });
    }

    // Combine: newer activities first, then older ones
    const allActivities = cache.activities.concat(olderActivities);

    const segmentData = await fetchSegmentEffortsForActivities(olderActivities, cache.segmentData || {}, fetchSegments);
    const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
    const gearDetails = await fetchMissingGearDetails(cache.gearDetails, gearTotals);

    const newCache = {
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    };

    saveCache(newCache);

    console.log(`[API Call] Resume complete. Added ${olderActivities.length} older activities. Total: ${allActivities.length} activities, ${requestCount} API calls used`);
    return res.json({
      cached: false,
      ...newCache,
      message: `Resume complete. Added ${olderActivities.length} older activities. (${requestCount} API calls, ${allActivities.length} total activities)`
    });
  }

  /* If cache exists and not refreshing, return cache */
  if (!refresh && cache) {
    console.log(`[API Call] Cache hit, returning without API calls. (${cache.activities.length} activities in cache)`);
    return res.json({ 
      cached: true, 
      ...cache, 
      message: `Loaded from cache.json (${cache.activities.length} activities)` 
    });
  }

  /* If no cache and refresh requested → full pull */
  if (!cache) {
    const allActivities = await fetchAllActivitiesOnce();

    if (!allActivities || allActivities.length === 0) {
      return res.json({
        error: "Strava returned no activities. Check authentication, scope, or rate limits."
      });
    }

    const segmentData = await fetchSegmentEffortsForActivities(allActivities, {}, fetchSegments);
    const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
    const gearDetails = await fetchMissingGearDetails({}, gearTotals);

    const newCache = {
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    };

    saveCache(newCache);

    console.log(`[API Call] Complete. Total: ${allActivities.length} activities, ${requestCount} API calls used`);
    return res.json({
      cached: false,
      ...newCache,
      message: `Initial full fetch complete. (${requestCount} API calls, ${allActivities.length} activities)`
    });
  }

  /* Incremental refresh (default) */
  const newestDate = cache.activities[0].start_date;
  const newActs = await fetchNewActivitiesSince(newestDate);

  if (!newActs || newActs.length === 0) {
    console.log(`[API Call] No new activities. Total: ${cache.activities.length} activities cached.`);
    return res.json({ 
      cached: true, 
      ...cache, 
      message: `No new activities. (${cache.activities.length} activities in cache)` 
    });
  }

  const allActivities = newActs.concat(cache.activities);
  const segmentData = await fetchSegmentEffortsForActivities(newActs, cache.segmentData || {}, fetchSegments);
  const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
  const gearDetails = await fetchMissingGearDetails(cache.gearDetails, gearTotals);

  const newCache = {
    activities: allActivities,
    segmentData,
    activityCounts,
    gearTotals,
    gearDetails,
    annualStats,
    bikeYearStats
  };

  saveCache(newCache);

  console.log(`[API Call] Complete. Added ${newActs.length} new activities. Total: ${allActivities.length}, ${requestCount} API calls used`);
  res.json({
    cached: false,
    ...newCache,
    message: `Added ${newActs.length} new activities. (${requestCount} API calls, ${allActivities.length} total)`
  });
});

/* START */

app.listen(5000, "0.0.0.0", () => console.log("Server running on LAN"));
