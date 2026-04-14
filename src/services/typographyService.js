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
 * Supported fonts (TTF files must exist in android/app/src/main/assets/fonts/):
 *   Inter, Poppins, Roboto, Montserrat, OpenSans, Lato, PlayfairDisplay
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
  'poppins':         'Poppins',
  'roboto':          'Roboto',
  'montserrat':      'Montserrat',
  'open sans':       'OpenSans',
  'opensans':        'OpenSans',
  'lato':            'Lato',
  'playfair display':'PlayfairDisplay',
  'playfairdisplay': 'PlayfairDisplay',
};

export function resolveFont(name) {
  if (!name || typeof name !== 'string') return null;
  const key = name.trim().toLowerCase();
  return FONT_NAME_MAP[key] ?? name.trim();
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
      hDefault.headlineFontFamily,
    ),
    subtextFontFamily: pick(
      typo.subtextFontFamily,
      typo.subHeadlineFontFamily,
      dsl.subtextFontFamily,
      dsl.subHeadlineFontFamily,
      hDefault.subtextFontFamily,
    ),
    bodyFontFamily: pick(
      typo.bodyFontFamily,
      typo.bodyTextFontFamily,
      dsl.bodyFontFamily,
      dsl.bodyTextFontFamily,
      hDefault.bodyFontFamily,
    ),
  };
}

/** Returns the current cached typography config. */
export function getTypography() {
  return _typography;
}
