import { Platform } from 'react-native';

/**
 * typographyService.js
 *
 * Caches the global font-family settings that come from the DSL so that
 * every Text component can pick up the app-wide typography without needing
 * a React context.
 *
 * Three font roles:
 *   headlineFontFamily  – Headline / title text  (e.g. "Montserrat")
 *   subtextFontFamily   – Sub-headline / caption  (e.g. "Lato")
 *   bodyFontFamily      – Body / paragraph text   (e.g. "Open Sans")
 *
 * The DSL may supply these at the top level of the page DSL, inside a
 * "typography" sub-object, or under headerdefault.  setTypography() accepts
 * all three locations and picks whichever value is found first.
 *
 * Supported fonts (TTF files must exist in the configured app fonts asset path):
 *   Inter, Manrope, Merriweather, Poppins, Roboto, Montserrat, OpenSans, Lato, PlayfairDisplay
 *
 * Font name normalisation:
 *   "Open Sans"        → "OpenSans"
 *   "Playfair Display" → "PlayfairDisplay"
 *   Everything else is used as-is.
 */

// ── Font name normaliser ───────────────────────────────────────────────────────
// Maps the display name the builder sends to the exact TTF filename stem so
// that fontFamily resolves correctly on Android.
const FONT_NAME_MAP = {
  'inter':           'Inter',
  'manrope':         'Manrope',
  'poppins':         'Poppins',
  'roboto':          'Roboto',
  'montserrat':      'Montserrat',
  'merriweather':    'Merriweather',
  'merriweather light': 'Merriweather',
  'open sans':       'OpenSans',
  'opensans':        'OpenSans',
  'lato':            'Lato',
  'playfair display':'PlayfairDisplay',
  'playfairdisplay': 'PlayfairDisplay',
};

const IOS_FONT_NAME_MAP = {
  'inter':           'Inter28pt-Regular',
  'manrope':         'Manrope-ExtraLight',
  'poppins':         'Poppins-Regular',
  'roboto':          'Roboto-Regular',
  'montserrat':      'Montserrat-Regular',
  'merriweather':    'Merriweather',
  'merriweather light': 'Merriweather',
  'open sans':       'OpenSans-Regular',
  'opensans':        'OpenSans-Regular',
  'lato':            'Lato-Regular',
  // Playfair is bundled as a variable font. Use the iOS family name so
  // React Native can apply the Builder's requested fontWeight dynamically.
  'playfair display':'Playfair Display',
  'playfairdisplay': 'Playfair Display',
};

const GENERIC_FONT_NAMES = new Set([
  'inherit',
  'initial',
  'unset',
  'system',
  'system-ui',
  'sans',
  'sans-serif',
  'serif',
  'monospace',
  'arial',
  'helvetica',
]);

const normalizeFontKey = (name) =>
  String(name || '').trim().replace(/[\'"]/g, '').toLowerCase();

const normalizeFontWeight = (weight) => {
  if (weight === undefined || weight === null || weight === '') return '400';
  const normalized = String(weight).trim().toLowerCase();
  if (normalized === 'bold' || normalized === 'semibold' || normalized === 'semi bold') {
    return '700';
  }
  if (normalized === 'normal' || normalized === 'regular') return '400';
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return '400';
  return parsed >= 600 ? '700' : '400';
};

const ANDROID_FONT_FACE_VARIANTS = {
  lato: {
    normal: {
      '400': 'Lato',
      '700': 'Lato-Bold',
    },
    italic: {
      '400': 'Lato-Italic',
      '700': 'Lato-BoldItalic',
    },
  },
};

export function resolveFont(name) {
  if (!name || typeof name !== 'string') return null;
  const candidates = name
    .split(',')
    .map((part) => part.trim().replace(/[\'"]/g, ''))
    .filter(Boolean);

  for (const fontName of candidates) {
    const key = fontName.toLowerCase();
    if (GENERIC_FONT_NAMES.has(key)) continue;
    const platformMap = Platform.OS === 'ios' ? IOS_FONT_NAME_MAP : FONT_NAME_MAP;
    return platformMap[key] ?? FONT_NAME_MAP[key] ?? fontName;
  }

  return null;
}

export function resolveFontFace(name, options = {}) {
  const resolved = resolveFont(name);
  if (!resolved) return null;

  if (Platform.OS !== 'android') {
    return {
      fontFamily: resolved,
      preserveWeightStyle: true,
    };
  }

  const variants =
    ANDROID_FONT_FACE_VARIANTS[normalizeFontKey(resolved)] ||
    ANDROID_FONT_FACE_VARIANTS[normalizeFontKey(name)];

  if (!variants) {
    return {
      fontFamily: resolved,
      preserveWeightStyle: true,
    };
  }

  const styleKey = String(options.fontStyle || '').toLowerCase() === 'italic'
    ? 'italic'
    : 'normal';
  const weightKey = normalizeFontWeight(options.fontWeight);
  const fontFamily =
    variants?.[styleKey]?.[weightKey] ||
    variants?.[styleKey]?.['400'] ||
    variants?.normal?.[weightKey] ||
    resolved;

  return {
    fontFamily,
    preserveWeightStyle: false,
  };
}

export function resolveFirstFont(...names) {
  for (const name of names) {
    const resolved = resolveFont(name);
    if (resolved) return resolved;
  }
  return null;
}

// ── Module-level cache ─────────────────────────────────────────────────────────
let _typography = {
  headlineFontFamily: null,
  subtextFontFamily:  null,
  bodyFontFamily:     null,
};

/**
 * Called by dslHandler after every successful DSL fetch.
 * Accepts the top-level DSL object; reads font keys from multiple possible
 * locations with the following priority:
 *   1. dsl.typography.*
 *   2. dsl.* (top-level keys)
 *   3. dsl.headerdefault.*
 */
export function setTypography(dsl) {
  if (!dsl || typeof dsl !== 'object') return;

  const typo      = dsl.typography     || {};
  const hDefault  = dsl.headerdefault  || {};
  const brandTypo = dsl.brandKit?.typography || {};

  const read = (value) => {
    if (value && typeof value === 'object') {
      if (value.value !== undefined) return value.value;
      if (value.const !== undefined) return value.const;
    }
    return value;
  };

  const headerTextItem = Array.isArray(hDefault.center)
    ? hDefault.center
        .map(read)
        .find((item) => {
          if (!item || typeof item !== 'object') return false;
          const type = String(read(item.type) || '').toLowerCase();
          return type === 'text' || read(item.title) || read(item.text);
        })
    : null;

  const pick = (...candidates) => {
    for (const v of candidates) {
      if (v && typeof v === 'string' && v.trim()) return resolveFont(v.trim());
    }
    return null;
  };

  _typography = {
    headlineFontFamily: pick(
      typo.headlineFontFamily,
      dsl.headlineFontFamily,
      read(headerTextItem?.textFontFamily),
      read(headerTextItem?.fontFamily),
      read(headerTextItem?.titleFontFamily),
      read(hDefault.textFontFamily),
      read(hDefault.titleFontFamily),
      read(hDefault.headerFontFamily),
      read(hDefault.headlineFontFamily),
      read(brandTypo.headline?.fontFamily),
    ),
    subtextFontFamily: pick(
      typo.subtextFontFamily,
      typo.subHeadlineFontFamily,
      dsl.subtextFontFamily,
      dsl.subHeadlineFontFamily,
      read(hDefault.subtextFontFamily),
      read(brandTypo.subHeadline?.fontFamily),
    ),
    bodyFontFamily: pick(
      typo.bodyFontFamily,
      typo.bodyTextFontFamily,
      dsl.bodyFontFamily,
      dsl.bodyTextFontFamily,
      read(hDefault.bodyFontFamily),
      read(brandTypo.body?.fontFamily),
    ),
  };
}

/** Returns the current cached typography config. */
export function getTypography() {
  return _typography;
}
