const DESKOS_THEMES = {
  sharp: {
    id: "sharp",
    name: "Sharp",
    file: "index.html",
    description: "High-contrast glass with bold typography",
  },
  modern: {
    id: "modern",
    name: "Modern",
    file: "modern.html",
    description: "Rounded cards with horizontal info layout",
  },
  one: {
    id: "one",
    name: "1.0",
    file: "win1.html",
    description: "Windows 1.0-inspired retro UI",
  },
  macintosh: {
    id: "macintosh",
    name: "Macintosh",
    file: "macintosh.html",
    description: "Classic Mac popups with dock controls",
  },
  terminal: {
    id: "terminal",
    name: "Terminal",
    file: "terminal.html",
    description: "Pure TUI feel with boxed text",
  },
  terminalcrt: {
    id: "terminalcrt",
    name: "Terminal-CRT",
    file: "terminal-crt.html",
    description: "CRT scanlines and glow on a terminal skin",
  },
  lyrics: {
    id: "lyrics",
    name: "Lyrics",
    file: "lyrics.html",
    description: "Lyric-focused layout with side cards",
  },
  bezels: {
    id: "bezels",
    name: "Bezels",
    file: "bezels.html",
    description: "Retro bezel styling",
  }
};

const DESKOS_THEME_LIST = Object.values(DESKOS_THEMES);
const DESKOS_DEFAULT_SETTINGS = { accent: "#1ffb8d", radius: 16, crtNoise: true };

function deskosGetThemeMeta(id) {
  return DESKOS_THEMES[id] || DESKOS_THEMES.sharp;
}

function deskosSavedThemeId() {
  return localStorage.getItem("deskos.theme") || "sharp";
}

function deskosCurrentThemeId() {
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const match = DESKOS_THEME_LIST.find(t => t.file.toLowerCase() === file);
  return match ? match.id : "sharp";
}

function deskosSaveTheme(id) {
  const meta = deskosGetThemeMeta(id);
  localStorage.setItem("deskos.theme", meta.id);
  return meta;
}

function deskosLoadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("deskos.themeSettings") || "null");
    return parsed ? { ...DESKOS_DEFAULT_SETTINGS, ...parsed } : { ...DESKOS_DEFAULT_SETTINGS };
  } catch (e) {
    return { ...DESKOS_DEFAULT_SETTINGS };
  }
}

function deskosApplySettings() {
  const settings = deskosLoadSettings();
  if (settings.accent) document.documentElement.style.setProperty("--accent", settings.accent);
  if (typeof settings.radius === "number") document.documentElement.style.setProperty("--radius", `${settings.radius}px`);
  document.documentElement.classList.toggle("crt-noise", !!settings.crtNoise);
  return settings;
}

function deskosGoToTheme(id) {
  const meta = deskosSaveTheme(id);
  if (!meta) return;
  const target = meta.file;
  if ((location.pathname || "").toLowerCase().endsWith(target.toLowerCase())) return;
  window.location.href = target;
}

window.deskThemes = {
  list: DESKOS_THEME_LIST,
  map: DESKOS_THEMES,
  getMeta: deskosGetThemeMeta,
  getSaved: deskosSavedThemeId,
  getCurrent: deskosCurrentThemeId,
  save: deskosSaveTheme,
  go: deskosGoToTheme,
  settings: {
    defaults: DESKOS_DEFAULT_SETTINGS,
    load: deskosLoadSettings,
    apply: deskosApplySettings,
  },
};

// Apply saved accent/radius on load for all themes.
deskosApplySettings();
