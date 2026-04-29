// react-native-vector-icons v10 no longer exposes glyphMap on the component.
// Import the JSON directly so we can validate names without the component.
import FA4GlyphMap from "react-native-vector-icons/glyphmaps/FontAwesome.json";

/**
 * FA5 / FA6 icon names → FontAwesome 4 equivalents.
 * react-native-vector-icons ships FA4 (786 glyphs).
 * The builder sends modern FA5/FA6 names — this map bridges them.
 */
const FA5_TO_FA4 = {
  // Navigation / home
  "house":                  "home",
  "shop":                   "home",

  // Editing
  "pen":                    "pencil",
  "pen-to-square":          "edit",
  "pen-nib":                "pencil",
  "pencil":                 "pencil",

  // Trash
  "trash-can":              "trash",
  "trash-arrow-up":         "trash",

  // Search / magnify
  "magnifying-glass":       "search",
  "magnifying-glass-plus":  "search-plus",
  "magnifying-glass-minus": "search-minus",

  // Close / X
  "xmark":                  "times",
  "x":                      "times",
  "close":                  "times",

  // Menu / hamburger
  "burger":                 "bars",
  "navicon":                "bars",

  // Cart / bag / store
  "cart-shopping":          "shopping-cart",
  "bag-shopping":           "shopping-bag",
  "store":                  "shopping-bag",
  "cart-plus":              "cart-plus",

  // Gear / cog
  "gear":                   "cog",
  "gears":                  "cogs",

  // Circle variants
  "circle-check":           "check-circle",
  "circle-xmark":           "times-circle",
  "circle-user":            "user-circle",
  "circle-exclamation":     "exclamation-circle",
  "circle-info":            "info-circle",
  "circle-question":        "question-circle",
  "circle-minus":           "minus-circle",
  "circle-plus":            "plus-circle",
  "circle-arrow-right":     "arrow-circle-right",
  "circle-arrow-left":      "arrow-circle-left",
  "circle-arrow-up":        "arrow-circle-up",
  "circle-arrow-down":      "arrow-circle-down",
  "circle-notch":           "circle-o-notch",
  "circle-half-stroke":     "adjust",

  // Location / map
  "location-dot":           "map-marker",
  "map-location":           "map-marker",
  "map-location-dot":       "map-marker",
  "location-pin":           "map-pin",

  // Arrows / angles
  "right-long":             "long-arrow-right",
  "left-long":              "long-arrow-left",
  "up-long":                "long-arrow-up",
  "down-long":              "long-arrow-down",
  "angles-right":           "angle-double-right",
  "angles-left":            "angle-double-left",
  "angles-up":              "angle-double-up",
  "angles-down":            "angle-double-down",
  "arrows-up-down":         "arrows-v",
  "arrows-left-right":      "arrows-h",
  "up-down":                "arrows-v",
  "left-right":             "arrows-h",
  "maximize":               "arrows-alt",
  "up-right-from-square":   "external-link",
  "arrow-up-right-from-square": "external-link",

  // Auth / door
  "right-from-bracket":     "sign-out",
  "right-to-bracket":       "sign-in",

  // Warnings / alerts
  "triangle-exclamation":   "exclamation-triangle",

  // Rotate / undo
  "rotate":                 "refresh",
  "rotate-right":           "repeat",
  "rotate-left":            "undo",

  // Share
  "share-nodes":            "share-alt",
  "share-from-square":      "share-square",

  // File
  "file-lines":             "file-text",
  "file-pen":               "file-text",
  "floppy-disk":            "floppy-o",
  "box-archive":            "archive",

  // Users / people
  "user-xmark":             "user-times",
  "user-minus":             "user-times",
  "people-group":           "users",
  "person":                 "male",
  "person-running":         "male",
  "person-walking":         "male",
  "child":                  "child",

  // Calendar / time
  "calendar-days":          "calendar",
  "calendar-check":         "calendar-check-o",
  "calendar-plus":          "calendar-plus-o",
  "calendar-minus":         "calendar-minus-o",
  "clock":                  "clock-o",

  // Media / video
  "video":                  "video-camera",
  "volume-high":            "volume-up",
  "volume-low":             "volume-down",
  "volume-xmark":           "volume-off",

  // Emoji / face
  "face-smile":             "smile-o",
  "face-laugh":             "smile-o",
  "face-grin":              "smile-o",
  "face-meh":               "meh-o",
  "face-frown":             "frown-o",

  // Finance / currency
  "dollar-sign":            "dollar",
  "euro-sign":              "euro",
  "indian-rupee-sign":      "inr",
  "sterling-sign":          "gbp",
  "yen-sign":               "jpy",

  // Charts
  "chart-bar":              "bar-chart",
  "chart-line":             "line-chart",
  "chart-pie":              "pie-chart",
  "chart-area":             "area-chart",
  "gauge":                  "tachometer",
  "gauge-high":             "tachometer",

  // Nature / weather
  "sun":                    "sun-o",
  "moon":                   "moon-o",
  "snow":                   "snowflake-o",
  "droplet":                "tint",
  "seedling":               "leaf",

  // Misc
  "sliders":                "sliders-h",
  "thumbtack":              "thumb-tack",
  "handshake":              "handshake-o",
  "award":                  "trophy",
  "medal":                  "trophy",
  "school":                 "university",
  "landmark":               "university",
  "hospital":               "hospital-o",
  "gradient":               "adjust",
  "print":                  "print",
  "paintbrush":             "paint-brush",
  "screwdriver-wrench":     "wrench",
  "hammer":                 "gavel",
  "code-branch":            "code-fork",
  "book-open":              "book",
  "star-half-stroke":       "star-half",
  "hand-point-right":       "hand-o-right",
  "hand-point-left":        "hand-o-left",
  "hand-point-up":          "hand-o-up",
  "hand-point-down":        "hand-o-down",
  "hand-pointer":           "hand-pointer-o",
  "heart-crack":            "heart-o",
  "earth-americas":         "globe",
  "earth-europe":           "globe",
  "earth-asia":             "globe",
  "shield-halved":          "shield",
  "shield-check":           "shield",
  "shield-heart":           "shield",
  "lock-open":              "unlock",
  "mobile-screen":          "mobile",
  "tablet-screen":          "tablet",
  "truck-fast":             "truck",
  "boxes-stacked":          "cubes",
  "box":                    "cube",
  "translate":              "language",
  "photo-film":             "film",
  "minimize":               "minus-square",
  "suitcase-rolling":       "suitcase",
  "city":                   "building",
  "jet-plane":              "plane",
};

/**
 * Resolve any FontAwesome icon name (FA4, FA5, or FA6, with or without "fa-" prefix)
 * to a valid FA4 name that react-native-vector-icons can render.
 * Returns "" if the name cannot be resolved to a known FA4 glyph.
 */
export function resolveFA4IconName(raw) {
  if (!raw) return "";

  // Strip fa- / fas- / far- / fab- / fa4- / fa5- / fa6- prefixes and lowercase
  const normalised = String(raw)
    .trim()
    .replace(/^(fa[srldb]|fa[0-9]+)[-_]/i, "")
    .replace(/^fa[-_]/i, "")
    .toLowerCase();

  if (!normalised) return "";

  // 1. Already a valid FA4 name — return as-is
  if (Object.prototype.hasOwnProperty.call(FA4GlyphMap, normalised)) return normalised;

  // 2. FA5/FA6 name → look up FA4 equivalent and validate it
  const aliased = FA5_TO_FA4[normalised];
  if (aliased && Object.prototype.hasOwnProperty.call(FA4GlyphMap, aliased)) return aliased;

  return "";
}
