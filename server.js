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

/* ----------------- AUTH ----------------- */

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

/* ----------------- TOKEN REFRESH ----------------- */

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

/* ----------------- FETCH WRAPPER ----------------- */

async function stravaFetch(url) {
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  if (res.status === 401) {
    await refreshToken();
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
  }

  return res;
}

/* ----------------- ACTIVITY FETCH ----------------- */

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

/* ----------------- GEAR FETCH ----------------- */

async function fetchMissingGearDetails(existingGearDetails, gearTotals) {
  const knownIds = new Set(Object.keys(existingGearDetails || {}));
  const allIds = Object.keys(gearTotals || {});
  const missingIds = allIds.filter(id => !knownIds.has(id));

  if (missingIds.length === 0) return existingGearDetails || {};

  const promises = missingIds.map(async gid => {
    const res = await stravaFetch(
      `https://www.strava.com/api/v3/gear/${gid}`
    );
    const data = await res.json();
    return { gid, data };
  });

  const results = await Promise.all(promises);
  const gearDetails = { ...(existingGearDetails || {}) };
  for (const { gid, data } of results) {
    gearDetails[gid] = data;
  }
  return gearDetails;
}

/* ----------------- ANALYTICS ----------------- */

function computeAnalytics(allActivities) {
  const activityCounts = {};
  const gearTotals = {};
  const annualStats = {};
  const bikeYearStats = {};

  for (const a of allActivities) {
    const type = a.sport_type;
    activityCounts[type] = (activityCounts[type] || 0) + 1;

    if (a.gear_id) {
      if (!gearTotals[a.gear_id]) gearTotals[a.gear_id] = { distance: 0, elevation: 0, count: 0 };
      gearTotals[a.gear_id].distance += a.distance;
      gearTotals[a.gear_id].elevation += a.total_elevation_gain;
      gearTotals[a.gear_id].count++;
    }

    const year = new Date(a.start_date).getFullYear();
    if (!annualStats[year]) annualStats[year] = { distance: 0, elevation: 0, count: 0 };
    annualStats[year].distance += a.distance;
    annualStats[year].elevation += a.total_elevation_gain;
    annualStats[year].count++;

    if (a.gear_id) {
      if (!bikeYearStats[a.gear_id]) bikeYearStats[a.gear_id] = {};
      if (!bikeYearStats[a.gear_id][year]) bikeYearStats[a.gear_id][year] = {
        distance: 0,
        elevation: 0,
        count: 0
      };
      bikeYearStats[a.gear_id][year].distance += a.distance;
      bikeYearStats[a.gear_id][year].elevation += a.total_elevation_gain;
      bikeYearStats[a.gear_id][year].count++;
    }
  }

  return { activityCounts, gearTotals, annualStats, bikeYearStats };
}

/* ----------------- AUTO LOAD CACHE ----------------- */

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

/* ----------------- FULL PULL + REFRESH ----------------- */

app.get("/api/analytics", async (req, res) => {
  if (!access_token) return res.status(401).json({ error: "Not authenticated" });

  const full = req.query.full === "1";
  const refresh = req.query.refresh === "1";
  const cache = loadCache();

  /* FULL PULL: always fetch everything fresh */
  if (full) {
    const allActivities = await fetchAllActivitiesOnce();

    if (!allActivities || allActivities.length === 0) {
      return res.json({
        error: "Strava returned no activities. Check authentication, scope, or rate limits."
      });
    }

    const { activityCounts, gearTotals, annualStats, bikeYearStats } =
      computeAnalytics(allActivities);

    const gearDetails = await fetchMissingGearDetails({}, gearTotals);

    const newCache = {
      activities: allActivities,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    };

    saveCache(newCache);

    return res.json({
      cached: false,
      ...newCache,
      message: "Full data pull complete."
    });
  }

  /* If cache exists and not refreshing, return cache */
  if (!refresh && cache) {
    return res.json({ cached: true, ...cache, message: "Loaded from cache.json" });
  }

  /* If no cache and refresh requested ? full pull */
  if (!cache) {
    const allActivities = await fetchAllActivitiesOnce();

    if (!allActivities || allActivities.length === 0) {
      return res.json({
        error: "Strava returned no activities. Check authentication, scope, or rate limits."
      });
    }

    const { activityCounts, gearTotals, annualStats, bikeYearStats } =
      computeAnalytics(allActivities);

    const gearDetails = await fetchMissingGearDetails({}, gearTotals);

    const newCache = {
      activities: allActivities,
      activityCounts,
      gearTotals,
      gearDetails,
      annualStats,
      bikeYearStats
    };

    saveCache(newCache);

    return res.json({
      cached: false,
      ...newCache,
      message: "Initial full fetch complete."
    });
  }

  /* Incremental refresh */
  const newestDate = cache.activities[0].start_date;
  const newActs = await fetchNewActivitiesSince(newestDate);

  if (!newActs || newActs.length === 0) {
    return res.json({ cached: true, ...cache, message: "No new activities." });
  }

  const allActivities = newActs.concat(cache.activities);

  const { activityCounts, gearTotals, annualStats, bikeYearStats } =
    computeAnalytics(allActivities);

  const gearDetails = await fetchMissingGearDetails(cache.gearDetails, gearTotals);

  const newCache = {
    activities: allActivities,
    activityCounts,
    gearTotals,
    gearDetails,
    annualStats,
    bikeYearStats
  };

  saveCache(newCache);

  res.json({
    cached: false,
    ...newCache,
    message: `Added ${newActs.length} new activities from page 1.`
  });
});

/* ----------------- START ----------------- */

/*--app.listen(5000, () => console.log("Server running on http://localhost:5000/dashboard"));--*/
app.listen(5000, "0.0.0.0", () => console.log("Server running on LAN"));

  

