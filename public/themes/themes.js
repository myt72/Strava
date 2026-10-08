const THEME_STORAGE_KEY = "strava:theme";
const COLOR_MODE_STORAGE_KEY = "strava:colorMode";

const THEMES = {
  default: { label: "Default", css: null, modes: ["light", "dark"] },
  lcars: { label: "LCARS", css: "themes/lcars.css", modes: ["dark"] },
  cyberpunk: { label: "Neon Cyberpunk", css: "themes/neon-cyberpunk.css", modes: ["dark"] },
  synthwave: { label: "Synthwave", css: "themes/synthwave.css", modes: ["dark"] },
  googie: { label: "Googie", css: "themes/googie.css", modes: ["light"] },
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
  picker.innerHTML = Object.entries(THEMES)
    .map(([id, t]) => `<option value="${id}">${t.label}</option>`)
    .join("");
  picker.addEventListener("change", () => applyTheme(picker.value));
}
