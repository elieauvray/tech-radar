// Look and feel switcher for the radar page. Pure logic, shared by the browser
// (window.ThemeSwitcher) and the tests. The radar colours are set inline by d3,
// so a theme is mostly a set of options for radar_visualization(); the HTML
// around the radar is styled by theme-upsun.css through html[data-theme].
(function (root, factory) {
  var themeSwitcher = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = themeSwitcher;
  } else {
    root.ThemeSwitcher = themeSwitcher;
  }
}(typeof self !== "undefined" ? self : this, function (root) {
  var THEMES = ["societe-generale", "upsun"];
  var DEFAULT_THEME = "societe-generale";
  var STORAGE_KEY = "radar-theme";

  // Options merged into the radar_visualization() config, per theme.
  // "societe-generale" holds the values the radar always had.
  // "upsun" is an approximation of the upsun.com look: dark, rounded, purple accent.
  var RADAR_OPTIONS = {
    "societe-generale": {
      colors: { background: "#fff", grid: "#dddde0", inactive: "#ddd" },
      font_family: "Arial, Helvetica",
      ring_colors: ["#5ba300", "#009eb0", "#c7ba00", "#e09b96"],
      title_banner: { height: 51, from: "#000000", to: "#e9041e", text_color: "#fff" },
      title_logo: { url: "images/societe-generale-logo.svg", width: 198, height: 39 },
      title_suffix: "Tech Radar"
    },
    "upsun": {
      colors: {
        background: "#0b0b1e",
        grid: "#2d2d4a",
        inactive: "#3a3a5c",
        text: "#e6e6f2",
        date: "#9a9ab8",
        tooltip: "#6046ff"
      },
      font_family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      ring_colors: ["#1f9d55", "#7c66ff", "#d98e04", "#e5484d"],
      title_banner: { height: 51, from: "#6046ff", to: "#6046ff", text_color: "#fff" },
      title_logo: null,
      title_suffix: ""
    }
  };

  // Unknown, empty or non-string values become the default theme.
  function normalizeTheme(value) {
    return typeof value === "string" && THEMES.indexOf(value) !== -1
      ? value
      : DEFAULT_THEME;
  }

  // The theme that follows `current`, wrapping around.
  function nextTheme(current) {
    var index = THEMES.indexOf(normalizeTheme(current));
    return THEMES[(index + 1) % THEMES.length];
  }

  // A fresh copy of the radar options of a theme: radar_visualization() mutates its config.
  function radarOptions(theme) {
    return JSON.parse(JSON.stringify(RADAR_OPTIONS[normalizeTheme(theme)]));
  }

  // The browser storage, or null when it is not available (it can throw in private mode).
  function defaultStorage() {
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  // The saved theme, or the default one when nothing valid can be read.
  function loadTheme(storage) {
    try {
      storage = storage || defaultStorage();
      return normalizeTheme(storage ? storage.getItem(STORAGE_KEY) : null);
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  // Saves the theme; returns false when the storage refuses it.
  function saveTheme(theme, storage) {
    try {
      storage = storage || defaultStorage();
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, normalizeTheme(theme));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    THEMES: THEMES,
    DEFAULT_THEME: DEFAULT_THEME,
    STORAGE_KEY: STORAGE_KEY,
    normalizeTheme: normalizeTheme,
    nextTheme: nextTheme,
    radarOptions: radarOptions,
    loadTheme: loadTheme,
    saveTheme: saveTheme
  };
}));
