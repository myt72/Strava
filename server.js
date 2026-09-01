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
let rateLimitShortRemaining = 600;
let rateLimitShortLimit = 600;
let requestCount = 0;

/* Background PR backfill job state */
let prBackfillJob = {
  running: false,
  stopRequested: false,
  startedAt: null,
  lastRunAt: null,
  nextRetryAt: null,
  mode: "idle",
  message: "Idle",
  totalEligible: 0,
  remaining: 0,
  nextIndex: 0,
  fetchedThisRun: 0,
  processed: 0,
  completed: false,
  batchSize: 25,
  reserve: 25,
  idlePasses: 0
};

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

function ensureCacheShape(cache) {
  const base = cache || {};
  if (!Array.isArray(base.activities)) base.activities = [];
  if (!base.segmentData || typeof base.segmentData !== "object") base.segmentData = {};
  if (!base.activityCounts || typeof base.activityCounts !== "object") base.activityCounts = {};
  if (!base.gearTotals || typeof base.gearTotals !== "object") base.gearTotals = {};
  if (!base.gearDetails || typeof base.gearDetails !== "object") base.gearDetails = {};
  if (!base.annualStats || typeof base.annualStats !== "object") base.annualStats = {};
  if (!base.bikeYearStats || typeof base.bikeYearStats !== "object") base.bikeYearStats = {};
  if (!base.segmentBackfill || typeof base.segmentBackfill !== "object") {
    base.segmentBackfill = {
      enabled: false,
      nextIndex: 0,
      completed: false,
      lastRunAt: null,
      totalEligible: 0,
      fetchedThisRun: 0,
      remaining: 0
    };
  }
  return base;
}

function setSegmentBackfillMeta(cache, meta = {}) {
  const shaped = ensureCacheShape(cache);
  shaped.segmentBackfill = {
    enabled: meta.enabled ?? true,
    nextIndex: meta.nextIndex ?? 0,
    completed: meta.completed ?? false,
    lastRunAt: meta.lastRunAt ?? new Date().toISOString(),
    totalEligible: meta.totalEligible ?? 0,
    fetchedThisRun: meta.fetchedThisRun ?? 0,
    remaining: meta.remaining ?? 0
  };
  return shaped;
}

/* Update rate limit from response headers */
function updateRateLimit(res) {
  const limit = res.headers.get("x-ratelimit-limit");
  const usage = res.headers.get("x-ratelimit-usage");

  if (limit && usage) {
    const [shortLimit, longLimit] = limit.split(",").map(Number);
    const [shortUsed, longUsed] = usage.split(",").map(Number);

    if (!Number.isNaN(shortLimit) && !Number.isNaN(shortUsed)) {
      rateLimitShortLimit = shortLimit;
      rateLimitShortRemaining = shortLimit - shortUsed;
    }

    if (!Number.isNaN(longLimit) && !Number.isNaN(longUsed)) {
      rateLimitLimit = longLimit;
      rateLimitRemaining = longLimit - longUsed;
    }

    console.log(`[Rate Limit] ${rateLimitShortRemaining}/${rateLimitShortLimit} short, ${rateLimitRemaining}/${rateLimitLimit} daily remaining`);
  }
}

/* Sleep utility */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNextQuarterHourUtc(now = new Date()) {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  const minutes = d.getUTCMinutes();
  const nextQuarter = Math.ceil((minutes + 1) / 15) * 15;
  if (nextQuarter >= 60) {
    d.setUTCHours(d.getUTCHours() + 1);
    d.setUTCMinutes(0);
  } else {
    d.setUTCMinutes(nextQuarter);
  }
  return d;
}

function getNextDailyResetUtc(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 5, 0);
  return d;
}

function getNextRetryTime() {
  const now = new Date();
  if (rateLimitRemaining <= 5) {
    return getNextDailyResetUtc(now);
  }
  return getNextQuarterHourUtc(now);
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

/* FETCH WRAPPER */

async function stravaFetch(url) {
  requestCount++;

  if (rateLimitShortRemaining < 10 || rateLimitRemaining < 25) {
    console.warn(`[Rate Limit] Low headroom before request. short=${rateLimitShortRemaining}, daily=${rateLimitRemaining}`);
    await sleep(1000);
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

function mapActivity(a) {
  return {
    id: a.id,
    name: a.name,
    url: `https://www.strava.com/activities/${a.id}`,
    sport_type: a.sport_type || a.type,
    distance: a.distance,
    moving_time: a.moving_time,
    total_elevation_gain: a.total_elevation_gain,
    start_date: a.start_date,
    gear_id: a.gear_id
  };
}

async function fetchAllActivitiesOnce() {
  let page = 1;
  let all = [];

  while (true) {
    const res = await stravaFetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    all = all.concat(data.map(mapActivity));
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
    if (ts > lastTs) newActs.push(mapActivity(a));
    else break;
  }

  return newActs;
}

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
        all.push(mapActivity(a));
        foundBefore = true;
      }
    }

    if (foundBefore && data[data.length - 1]) {
      const lastTs = new Date(data[data.length - 1].start_date).getTime();
      if (lastTs >= beforeTs) {
        page++;
        continue;
      } else {
        break;
      }
    }

    page++;
  }

  console.log(`[Resume] Found ${all.length} activities before ${beforeDate}`);
  return all;
}

/* GEAR FETCH */

async function fetchMissingGearDetails(existingGearDetails, gearTotals) {
  const knownIds = new Set(Object.keys(existingGearDetails || {}));
  const allIds = Object.keys(gearTotals || {});
  const missingIds = allIds.filter(id => !knownIds.has(id));

  if (missingIds.length === 0) return existingGearDetails || {};

  console.log(`[Gear Fetch] Fetching ${missingIds.length} gear details...`);

  const gearDetails = { ...(existingGearDetails || {}) };
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

    if (i + BATCH_SIZE < missingIds.length) {
      await sleep(500);
    }
  }

  return gearDetails;
}

/* SEGMENT FETCH */

async function fetchSegmentEffortsForActivities(activities, existingSegmentData, fetchSegments = false) {
  if (!fetchSegments) {
    console.log("[Segment Fetch] Skipped (disabled to save rate limit)");
    return existingSegmentData || {};
  }

  const existing = existingSegmentData || {};
  const toFetch = activities.filter(a => a.sport_type === "Ride" && !(a.id in existing));

  if (toFetch.length === 0) {
    console.log("[Segment Fetch] No new ride segments to fetch");
    return existing;
  }

  console.warn(`[Segment Fetch] About to fetch ${toFetch.length} ride activities for segment data.`);

  if (rateLimitShortRemaining < toFetch.length + 10 || rateLimitRemaining < toFetch.length + 25) {
    console.error(`[Segment Fetch] Insufficient rate limit. short=${rateLimitShortRemaining}, daily=${rateLimitRemaining}. Skipping.`);
    return existing;
  }

  const result = { ...existing };
  let fetched = 0;

  for (const a of toFetch) {
    if (rateLimitShortRemaining < 5 || rateLimitRemaining < 15) {
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

      if (fetched % 5 === 0) {
        await sleep(750);
      }
    } catch (err) {
      console.warn(`[Segment Fetch] Failed for activity ${a.id}:`, err.message);
      result[a.id] = [];
    }
  }

  console.log(`[Segment Fetch] Completed: ${fetched}/${toFetch.length} activities`);
  return result;
}

/* RESUMABLE BACKFILL */

async function backfillSegmentEffortsResumable(cache, options = {}) {
  const workingCache = ensureCacheShape(cache);
  const rides = (workingCache.activities || []).filter(a => a && a.sport_type === "Ride");

  const sortedRides = [...rides].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  const batchSize = Math.max(1, Number(options.batchSize || 25));
  const reserve = Math.max(5, Number(options.reserve || 25));
  const startIndex = Number.isInteger(workingCache.segmentBackfill.nextIndex)
    ? workingCache.segmentBackfill.nextIndex
    : 0;

  let currentIndex = startIndex;
  let fetchedThisRun = 0;
  let processedThisRun = 0;
  let stoppedForRateLimit = false;

  console.log(`[Segment Backfill] Starting at index ${startIndex} of ${sortedRides.length}. Batch size ${batchSize}. Reserve ${reserve}.`);

  while (currentIndex < sortedRides.length && fetchedThisRun < batchSize) {
    if (prBackfillJob.stopRequested) {
      console.warn("[Segment Backfill] Stop requested.");
      break;
    }

    const activity = sortedRides[currentIndex];
    currentIndex++;

    if (activity.id in workingCache.segmentData) {
      processedThisRun++;
      continue;
    }

    if (rateLimitShortRemaining <= reserve || rateLimitRemaining <= reserve) {
      stoppedForRateLimit = true;
      currentIndex--;
      console.warn(`[Segment Backfill] Stopping for rate limit safety at short=${rateLimitShortRemaining}, daily=${rateLimitRemaining}.`);
      break;
    }

    try {
      const res = await stravaFetch(`https://www.strava.com/api/v3/activities/${activity.id}`);

      if (res.status === 429) {
        stoppedForRateLimit = true;
        currentIndex--;
        console.warn("[Segment Backfill] Hit 429. Saving progress and stopping.");
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

      workingCache.segmentData[activity.id] = efforts;
      fetchedThisRun++;
      processedThisRun++;

      if (fetchedThisRun % 5 === 0) {
        saveCache(workingCache);
        await sleep(750);
      }
    } catch (err) {
      console.warn(`[Segment Backfill] Failed for activity ${activity.id}:`, err.message);
      workingCache.segmentData[activity.id] = [];
      fetchedThisRun++;
      processedThisRun++;
    }
  }

  const remaining = sortedRides.filter(a => !(a.id in workingCache.segmentData)).length;
  const completed = remaining === 0;

  setSegmentBackfillMeta(workingCache, {
    enabled: true,
    nextIndex: completed ? 0 : currentIndex,
    completed,
    lastRunAt: new Date().toISOString(),
    totalEligible: sortedRides.length,
    fetchedThisRun,
    remaining
  });

  const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(
    workingCache.activities,
    workingCache.segmentData
  );

  const gearDetails = await fetchMissingGearDetails(workingCache.gearDetails, gearTotals);

  workingCache.activityCounts = activityCounts;
  workingCache.gearTotals = gearTotals;
  workingCache.gearDetails = gearDetails;
  workingCache.annualStats = annualStats;
  workingCache.bikeYearStats = bikeYearStats;

  saveCache(workingCache);

  return {
    cache: workingCache,
    meta: {
      fetchedThisRun,
      processedThisRun,
      stoppedForRateLimit,
      completed,
      nextIndex: workingCache.segmentBackfill.nextIndex,
      remaining,
      totalEligible: sortedRides.length,
      lastRunAt: workingCache.segmentBackfill.lastRunAt
    }
  };
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

      const weekNums = Object.keys(ys.weeks).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < weekNums.length; i++) {
        const wk = String(weekNums[i]);
        const prevWk = i > 0 ? String(weekNums[i - 1]) : null;
        ys.weeks[wk].trend = prevWk && ys.weeks[prevWk].distance > 0
          ? (ys.weeks[wk].distance - ys.weeks[prevWk].distance) / ys.weeks[prevWk].distance
          : 0;
      }
    }
  }

  return { activityCounts, gearTotals, annualStats, bikeYearStats };
}

/* BACKGROUND JOB DRIVER */

async function runPrBackfillJobLoop() {
  if (prBackfillJob.running) return;

  prBackfillJob.running = true;
  prBackfillJob.stopRequested = false;
  prBackfillJob.startedAt = prBackfillJob.startedAt || new Date().toISOString();
  prBackfillJob.mode = "running";
  prBackfillJob.message = "PR backfill running";

  while (!prBackfillJob.stopRequested) {
    if (prBackfillJob.nextRetryAt) {
      const now = Date.now();
      const retryAt = new Date(prBackfillJob.nextRetryAt).getTime();
      if (retryAt > now) {
        prBackfillJob.mode = "waiting";
        prBackfillJob.message = `Waiting until ${new Date(prBackfillJob.nextRetryAt).toLocaleString()} to retry`;
        await sleep(Math.min(retryAt - now, 60000));
        continue;
      }
      prBackfillJob.nextRetryAt = null;
    }

    if (!access_token) {
      prBackfillJob.mode = "error";
      prBackfillJob.message = "Not authenticated";
      break;
    }

    const cache = ensureCacheShape(loadCache());
    if (!cache || !cache.activities || cache.activities.length === 0) {
      prBackfillJob.mode = "error";
      prBackfillJob.message = "No cache available. Run a full data pull first.";
      break;
    }

    requestCount = 0;

    try {
      const result = await backfillSegmentEffortsResumable(cache, {
        batchSize: prBackfillJob.batchSize,
        reserve: prBackfillJob.reserve
      });

      const meta = result.meta;
      prBackfillJob.lastRunAt = meta.lastRunAt;
      prBackfillJob.totalEligible = meta.totalEligible;
      prBackfillJob.remaining = meta.remaining;
      prBackfillJob.nextIndex = meta.nextIndex;
      prBackfillJob.fetchedThisRun = meta.fetchedThisRun;
      prBackfillJob.processed = meta.totalEligible - meta.remaining;
      prBackfillJob.completed = meta.completed;

      if (meta.completed) {
        prBackfillJob.mode = "complete";
        prBackfillJob.message = "PR backfill complete";
        prBackfillJob.running = false;
        prBackfillJob.nextRetryAt = null;
        return;
      }

      if (meta.fetchedThisRun > 0) {
        prBackfillJob.idlePasses = 0;
        prBackfillJob.mode = "running";
        prBackfillJob.message = `Fetched ${meta.fetchedThisRun} rides this pass`;
        await sleep(1000);
        continue;
      }

      prBackfillJob.idlePasses += 1;
      const nextRetry = getNextRetryTime();
      prBackfillJob.nextRetryAt = nextRetry.toISOString();
      prBackfillJob.mode = "waiting";
      prBackfillJob.message = `No progress due to rate limits. Waiting until ${nextRetry.toLocaleString()}`;
    } catch (err) {
      console.error("[PR Backfill Job] Error:", err);
      const nextRetry = getNextQuarterHourUtc();
      prBackfillJob.nextRetryAt = nextRetry.toISOString();
      prBackfillJob.mode = "error";
      prBackfillJob.message = `Error encountered. Retrying at ${nextRetry.toLocaleString()}`;
    }
  }

  prBackfillJob.running = false;
  if (prBackfillJob.stopRequested) {
    prBackfillJob.mode = "stopped";
    prBackfillJob.message = "PR backfill stopped";
  }
}

function getPrBackfillStatus() {
  const cache = ensureCacheShape(loadCache());
  const meta = cache && cache.segmentBackfill ? cache.segmentBackfill : {};

  return {
    running: prBackfillJob.running,
    stopRequested: prBackfillJob.stopRequested,
    startedAt: prBackfillJob.startedAt,
    lastRunAt: prBackfillJob.lastRunAt || meta.lastRunAt || null,
    nextRetryAt: prBackfillJob.nextRetryAt,
    mode: prBackfillJob.mode,
    message: prBackfillJob.message,
    totalEligible: prBackfillJob.totalEligible || meta.totalEligible || 0,
    remaining: prBackfillJob.remaining || meta.remaining || 0,
    nextIndex: prBackfillJob.nextIndex || meta.nextIndex || 0,
    fetchedThisRun: prBackfillJob.fetchedThisRun || meta.fetchedThisRun || 0,
    processed: prBackfillJob.processed || Math.max(0, (meta.totalEligible || 0) - (meta.remaining || 0)),
    completed: prBackfillJob.completed || meta.completed || false,
    batchSize: prBackfillJob.batchSize,
    reserve: prBackfillJob.reserve
  };
}

/* API */

app.get("/api/analytics/auto", async (req, res) => {
  if (!access_token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const cache = ensureCacheShape(loadCache());

  if (cache) {
    return res.json({
      cached: true,
      ...cache,
      prBackfill: getPrBackfillStatus(),
      message: "Loaded from local cache.json"
    });
  }

  return res.json({
    cached: false,
    message: "No local data available — populate from the API."
  });
});

app.post("/api/pr-backfill/start", async (req, res) => {
  if (!access_token) return res.status(401).json({ error: "Not authenticated" });

  const cache = ensureCacheShape(loadCache());
  if (!cache || !cache.activities || cache.activities.length === 0) {
    return res.status(400).json({ error: "No cache available. Run a full data pull first." });
  }

  if (prBackfillJob.running) {
    return res.json({
      ok: true,
      alreadyRunning: true,
      prBackfill: getPrBackfillStatus(),
      message: "PR backfill already running"
    });
  }

  prBackfillJob = {
    ...prBackfillJob,
    running: false,
    stopRequested: false,
    startedAt: new Date().toISOString(),
    lastRunAt: null,
    nextRetryAt: null,
    mode: "starting",
    message: "PR backfill starting",
    totalEligible: cache.segmentBackfill.totalEligible || 0,
    remaining: cache.segmentBackfill.remaining || 0,
    nextIndex: cache.segmentBackfill.nextIndex || 0,
    fetchedThisRun: 0,
    processed: 0,
    completed: false,
    batchSize: Number(req.query.batchSize || req.body?.batchSize || 25),
    reserve: Number(req.query.reserve || req.body?.reserve || 25),
    idlePasses: 0
  };

  runPrBackfillJobLoop();

  return res.json({
    ok: true,
    prBackfill: getPrBackfillStatus(),
    message: "PR backfill started"
  });
});

app.post("/api/pr-backfill/stop", async (req, res) => {
  prBackfillJob.stopRequested = true;
  return res.json({
    ok: true,
    prBackfill: getPrBackfillStatus(),
    message: "PR backfill stop requested"
  });
});

app.get("/api/pr-backfill/status", async (req, res) => {
  return res.json({
    ok: true,
    prBackfill: getPrBackfillStatus()
  });
});

app.get("/api/analytics", async (req, res) => {
  if (!access_token) return res.status(401).json({ error: "Not authenticated" });

  const full = req.query.full === "1";
  const refresh = req.query.refresh === "1";
  const resume = req.query.resume === "1";
  const cache = ensureCacheShape(loadCache());
  const fetchSegments = req.query.segments === "1";

  requestCount = 0;
  const mode = full ? "FULL" : refresh ? "REFRESH" : resume ? "RESUME" : "AUTO";
  console.log(`\n[API Call] Starting ${mode} pull. fetchSegments=${fetchSegments}`);

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

    const newCache = setSegmentBackfillMeta({
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    }, {
      enabled: false,
      nextIndex: 0,
      completed: false,
      lastRunAt: null,
      totalEligible: allActivities.filter(a => a.sport_type === "Ride").length,
      fetchedThisRun: 0,
      remaining: allActivities.filter(a => a.sport_type === "Ride").length
    });

    saveCache(newCache);

    return res.json({
      cached: false,
      ...newCache,
      prBackfill: getPrBackfillStatus(),
      message: `Full data pull complete. (${requestCount} API calls, ${allActivities.length} activities)`
    });
  }

  if (resume) {
    if (!cache || !cache.activities || cache.activities.length === 0) {
      return res.json({ error: "No cache to resume from. Run a full pull first." });
    }

    const oldestCached = cache.activities[cache.activities.length - 1];
    const olderActivities = await fetchActivitiesBefore(oldestCached.start_date);

    if (!olderActivities || olderActivities.length === 0) {
      return res.json({
        cached: true,
        ...cache,
        prBackfill: getPrBackfillStatus(),
        message: "Resume: No older activities found. Cache appears complete."
      });
    }

    const allActivities = cache.activities.concat(olderActivities);
    const segmentData = await fetchSegmentEffortsForActivities(olderActivities, cache.segmentData || {}, fetchSegments);
    const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
    const gearDetails = await fetchMissingGearDetails(cache.gearDetails, gearTotals);

    const rideCount = allActivities.filter(a => a.sport_type === "Ride").length;
    const remaining = allActivities.filter(a => a.sport_type === "Ride" && !(a.id in segmentData)).length;

    const newCache = setSegmentBackfillMeta({
      ...cache,
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    }, {
      enabled: true,
      nextIndex: cache.segmentBackfill?.nextIndex || 0,
      completed: remaining === 0,
      lastRunAt: cache.segmentBackfill?.lastRunAt || null,
      totalEligible: rideCount,
      fetchedThisRun: 0,
      remaining
    });

    saveCache(newCache);

    return res.json({
      cached: false,
      ...newCache,
      prBackfill: getPrBackfillStatus(),
      message: `Resume complete. Added ${olderActivities.length} older activities. (${requestCount} API calls, ${allActivities.length} total activities)`
    });
  }

  if (!refresh && cache && cache.activities.length) {
    return res.json({
      cached: true,
      ...cache,
      prBackfill: getPrBackfillStatus(),
      message: `Loaded from cache.json (${cache.activities.length} activities)`
    });
  }

  if (!cache || !cache.activities || cache.activities.length === 0) {
    const allActivities = await fetchAllActivitiesOnce();

    if (!allActivities || allActivities.length === 0) {
      return res.json({
        error: "Strava returned no activities. Check authentication, scope, or rate limits."
      });
    }

    const segmentData = await fetchSegmentEffortsForActivities(allActivities, {}, fetchSegments);
    const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
    const gearDetails = await fetchMissingGearDetails({}, gearTotals);

    const rideCount = allActivities.filter(a => a.sport_type === "Ride").length;

    const newCache = setSegmentBackfillMeta({
      activities: allActivities,
      segmentData,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    }, {
      enabled: false,
      nextIndex: 0,
      completed: false,
      lastRunAt: null,
      totalEligible: rideCount,
      fetchedThisRun: 0,
      remaining: rideCount
    });

    saveCache(newCache);

    return res.json({
      cached: false,
      ...newCache,
      prBackfill: getPrBackfillStatus(),
      message: `Initial full fetch complete. (${requestCount} API calls, ${allActivities.length} activities)`
    });
  }

  const newestDate = cache.activities[0].start_date;
  const newActs = await fetchNewActivitiesSince(newestDate);

  if (!newActs || newActs.length === 0) {
    return res.json({
      cached: true,
      ...cache,
      prBackfill: getPrBackfillStatus(),
      message: `No new activities. (${cache.activities.length} activities in cache)`
    });
  }

  const allActivities = newActs.concat(cache.activities);
  const segmentData = await fetchSegmentEffortsForActivities(newActs, cache.segmentData || {}, fetchSegments);
  const { activityCounts, gearTotals, annualStats, bikeYearStats } = computeAnalytics(allActivities, segmentData);
  const gearDetails = await fetchMissingGearDetails(cache.gearDetails, gearTotals);

  const rideCount = allActivities.filter(a => a.sport_type === "Ride").length;
  const remaining = allActivities.filter(a => a.sport_type === "Ride" && !(a.id in segmentData)).length;

  const newCache = setSegmentBackfillMeta({
    ...cache,
    activities: allActivities,
    segmentData,
    activityCounts,
    gearTotals,
    gearDetails,
    annualStats,
    bikeYearStats
  }, {
    enabled: true,
    nextIndex: cache.segmentBackfill?.nextIndex || 0,
    completed: remaining === 0,
    lastRunAt: cache.segmentBackfill?.lastRunAt || null,
    totalEligible: rideCount,
    fetchedThisRun: 0,
    remaining
  });

  saveCache(newCache);

  res.json({
    cached: false,
    ...newCache,
    prBackfill: getPrBackfillStatus(),
    message: `Added ${newActs.length} new activities. (${requestCount} API calls, ${allActivities.length} total)`
  });
});

/* START */

app.listen(5000, "0.0.0.0", () => console.log("Server running on LAN"));
