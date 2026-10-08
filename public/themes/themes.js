const THEME_STORAGE_KEY = "strava:theme";
const COLOR_MODE_STORAGE_KEY = "strava:colorMode";

const THEME_GROUPS = ["Sci-Fi / Retro-Tech", "Editorial / Minimal", "Print / Vintage", "Playful / Bold"];

const THEMES = {
  default: { label: "Default", css: null, modes: ["light", "dark"] },
  // Sci-Fi / Retro-Tech
  lcars: { label: "LCARS", css: "themes/lcars.css", modes: ["dark"], group: 0 },
  cyberpunk: { label: "Neon Cyberpunk", css: "themes/neon-cyberpunk.css", modes: ["dark"], group: 0 },
  synthwave: { label: "Synthwave", css: "themes/synthwave.css", modes: ["dark"], group: 0 },
  "aero-instrumentation": { label: "Aero-Instrumentation (Cold War Modern)", css: "themes/aero-instrumentation.css", modes: ["dark"], group: 0 },
  "green-terminal": { label: "Green-Screen Terminal", css: "themes/green-terminal.css", modes: ["dark"], group: 0 },
  blueprint: { label: "Blueprint Technical", css: "themes/blueprint.css", modes: ["dark"], group: 0 },
  hud: { label: "HUD (Heads-Up Display)", css: "themes/hud.css", modes: ["dark"], group: 0 },
  "anime-hud": { label: "Anime HUD (Evangelion Style)", css: "themes/anime-hud.css", modes: ["dark"], group: 0 },
  "sharper-image": { label: "The Sharper Image (80s/90s High-Tech)", css: "themes/sharper-image.css", modes: ["dark"], group: 0 },
  "retro-os": { label: "Retro OS (Windows 95 / Classic Mac)", css: "themes/retro-os.css", modes: ["light"], group: 0 },
  // Editorial / Minimal
  "ft-salmon": { label: "Financial Times (Salmon & Ink)", css: "themes/ft-salmon.css", modes: ["light"], group: 1 },
  "swiss-minimal": { label: "Monochrome Swiss Minimalist", css: "themes/swiss-minimal.css", modes: ["light"], group: 1 },
  "nyt-data": { label: "NYT Data Journalism", css: "themes/nyt-data.css", modes: ["light"], group: 1 },
  nord: { label: "Solarized Dark / Nord Atmosphere", css: "themes/nord.css", modes: ["dark"], group: 1 },
  // Print / Vintage
  googie: { label: "Googie", css: "themes/googie.css", modes: ["light"], group: 2 },
  "vintage-cartoon": { label: "Vintage Cartoon (1930s Rubber Hose)", css: "themes/vintage-cartoon.css", modes: ["light"], group: 2 },
  "ledger-1920s": { label: "1920s Ledger / Account Book", css: "themes/ledger-1920s.css", modes: ["light"], group: 2 },
  "pulp-tabloid": { label: "Vintage Tabloid / Pulp Magazine", css: "themes/pulp-tabloid.css", modes: ["light"], group: 2 },
  "yellow-pages": { label: "Yellow Pages / Classifieds", css: "themes/yellow-pages.css", modes: ["light"], group: 2 },
  "catalog-midcentury": { label: "Sears / Montgomery Ward Catalog", css: "themes/catalog-midcentury.css", modes: ["light"], group: 2 },
  // Playful / Bold
  "neo-brutalist": { label: "Neo-Brutalist Comic", css: "themes/neo-brutalist.css", modes: ["light"], group: 3 },
  "dark-pop": { label: "Spotify Wrapped Dark-Pop", css: "themes/dark-pop.css", modes: ["dark"], group: 3 },
  "comic-letters": { label: "Retro Comic Book (Ben-Day)", css: "themes/comic-letters.css", modes: ["light"], group: 3 },
};

// Legacy builds stored "dark"/"light" under strava:theme; move that to strava:colorMode.
function migrateLegacyColorMode() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, saved);
    localStorage.removeItem(THEME_STORAGE_KEY);
  }
}

function getSavedThemeId() {
  migrateLegacyColorMode();
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return Object.prototype.hasOwnProperty.call(THEMES, saved) ? saved : "default";
}

function applyDefaultColorMode() {
  const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  const dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
}

function applyTheme(id) {
  migrateLegacyColorMode();
  const themeId = Object.prototype.hasOwnProperty.call(THEMES, id) ? id : "default";
  const theme = THEMES[themeId];

  document.getElementById("theme-stylesheet")?.remove();
  document.querySelectorAll("[data-theme-decor]").forEach(el => el.remove());

  document.body.dataset.theme = themeId;
  document.body.classList.remove("dark");

  if (theme.css) {
    const link = document.createElement("link");
    link.id = "theme-stylesheet";
    link.rel = "stylesheet";
    link.href = theme.css;
    document.head.appendChild(link);
  } else {
    applyDefaultColorMode();
  }

  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.hidden = themeId !== "default";
  const picker = document.getElementById("theme-picker");
  if (picker) picker.value = themeId;

  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}

function initThemePicker() {
  const picker = document.getElementById("theme-picker");
  if (!picker) return;
  picker.style.maxWidth = "200px";
  const option = ([id, t]) => `<option value="${id}">${t.label.replace(/&/g, "&amp;")}</option>`;
  const entries = Object.entries(THEMES);
  picker.innerHTML =
    entries.filter(([, t]) => t.group === undefined).map(option).join("") +
    THEME_GROUPS.map((name, i) =>
      `<optgroup label="${name}">${entries.filter(([, t]) => t.group === i).map(option).join("")}</optgroup>`
    ).join("");
  picker.addEventListener("change", () => applyTheme(picker.value));
}
