# SignIn / SignUp / ForgotPassword — Builder ↔ APK Parity Audit &amp; Fixes

Date: 2026-07-17
Scope: `app/mobie/src/screens/AuthScreen.tsx` only (the Builder repo at `appmobidrag/builder` was read for audit purposes but not modified — this is the RN app repo's responsibility).

## Root architecture

`AuthScreen.tsx` renders three modes (`login`, `signup`, `forgot`) from one component. Each mode has a `buildXTokens(rawProps)` function that maps the DSL's flat `props.raw.value` object into a typed token object the JSX consumes. A new centralized alias resolver, `pick(rawProps, keys)`, was added and is now the standard way to register a new accepted key name for a property — this is what "future Builder properties should require little or no APK changes" means in practice: add the key to the `pick([...])` list, not a new one-off `??` chain.

## Bugs fixed (Builder writes X, APK silently used a default instead)

| # | Where | Builder writes | APK was reading | Fix |
|---|---|---|---|---|
| 1 | SignIn email input text | `emailInputColor`, `emailInputFontSize/FontFamily/FontWeight` | `emailInputText*` (never matched) | Both spellings accepted |
| 2 | SignIn password input text | `passInputColor`, `passInputFontSize/FontFamily/FontWeight` | `passwordInputText*` | Both spellings accepted |
| 3 | SignIn/SignUp title bold | `authTitleBold` (boolean) | nothing — `headlineWeight`/`headerTitleFontWeight` only read a key Builder never writes | `authTitleBold` now overrides weight when no explicit `headlineWeight` is set |
| 4 | SignIn/SignUp title italic/underline/strike | `authTitleItalic/Underline/Strikethrough` | nothing — no token existed | New `headlineFontStyle`/`headlineTextDecoration` (SignIn), `headerTitleFontStyle`/`headerTitleTextDecoration` (SignUp) |
| 5 | Email/password placeholder italic/underline/strike/bold | `{field}PlaceholderItalic/Underline/Strikethrough/Bold` | nothing | New tokens + `FormField` extended to apply them via its existing "use placeholder typography while empty" mechanism |
| 6 | SignUp per-field Input Text size/weight | `{field}InputTextfontSize`, `{field}InputTextfontWeight` (lowercase "font") | `{field}InputTextFontSize/FontWeight` (never matched) | Both spellings accepted |
| 7 | SignUp per-field placeholder weight | `{field}PlaceholderfontWeight` (lowercase) | `{field}PlaceholderFontWeight` | Both spellings accepted |
| 8 | SignUp per-field alignment | `{field}AlignmenT` (typo, trailing capital T) | `{field}Alignment` (dead — never matched, and separately the JSX only ever read `*InputTextAlignment`, which Builder never wrote at all) | `{field}AlignmenT` now feeds both the alignment token and the actually-rendered `*InputTextAlignment` token |
| 9 | SignUp button size | `buttonwidth`, `buttonheightt` (typos) | `buttonWidth`/`buttonHeight` | Both spellings accepted |
| 10 | SignUp button icon alignment | `buttonIconAlignmenT` (typo) | `buttonIconAlignment` | Both spellings accepted |
| 11 | SignUp card corner radius | `borderRadiusBox` | `borderRadius` (SignUp never writes this) | Both spellings accepted |
| 12 | SignUp Logo/Image | `logoImgVisible`, `logoImage`, `logoBgColor`, `logoBorderColor` | `showProfilePicture`/`profilePictureUrl`/`profilePictureBgColor`/`profilePictureBorderColor` (Builder never writes these names) | Aliased; the existing profile-picture-styled render now actually receives real data |
| 13 | SignUp footer strikethrough | `accountStrikethrough` | nothing (SignIn's differently-named `footerTextAccountStrikethrough` doesn't apply to SignUp) | Read correctly per-block now |

Note: the original `SIGNIN_DSL_TO_APK_FLOW.md` audit doc only found bugs #1/#2 and the navigation gap (#15 below). This pass found the rest by directly diffing the Builder's `InspectorLive.tsx` source against `buildSignInTokens`/`buildSignUpTokens`.

## New features (properties Builder exposes that the APK didn't render at all)

| # | Feature | Builder keys | Notes |
|---|---|---|---|
| 14 | Logo/Image block | `logoVisible`/`logoImgVisible`, `logoImage`, `imageRatio`, `imageScale`, `imageBgColor`/`logoBgColor`, `imageBorderColor`/`logoBorderColor`, `imageCorners` | New shared `AuthLogo` component, used by both SignIn and SignUp |
| 15 | Post-auth navigation | `navigateTo` (`screen`\|`url`), `selectScreen` | Wired through the existing `navigationTarget.js` resolver (already used by 12 other components, just never imported here). Precedence: explicit caller `postLoginTarget` route param &gt; DSL `navigateTo`/`selectScreen` &gt; hardcoded `LayoutScreen` fallback |
| 16 | Button icon | `buttonIcon` (9-icon set), `buttonIconSize`, `buttonIconColor`, `buttonIconAlignment` | Mapped to FontAwesome6 names, rendered left/right of the button label |
| 17 | Button text italic/underline/strike | `buttonTextItalic/Underline/Strikethrough` | Bonus — not in the original spec but cheap given the same mechanism |
| 18 | Footer text/link italic/underline/strike | `footerTextItalic/Underline/...`, `footerLinkTextItalic/Underline/...` | Bonus, same reasoning |

## Verified — already worked correctly (no change needed)

`bgColor`, `titleColor`, `cardBgColor`, `borderLine`/`borderRadius`/`borderColor`, `pt/pb/pl/pr` and `bgpt/bgpb/bgpl/bgpr` (page padding), `authTitle`, `buttonText`, `footerText`, `footerLinkText`, `emailPlaceholder`/`passwordPlaceholder` + their Font/Color variants, all four `buttonbgColor`/`buttonBgColor`/`buttonBackgroundColor`/`buttonFillColor` aliases (including `linear-gradient(...)` parsing), `buttonborderColor`/`buttonBorderColor`, `buttonfontSize`/`buttonFontSize` (already aliased via `buildButtonStyleTokens`), `buttonHeight`/`buttonWidth` (SignIn), `buttonAutoUppercase`, `footerVisible`, `forgotPasswordVisible`, `footerLinkAlignment`, ForgotPassword's headline bold/italic/underline/strike/uppercase (already fully implemented pre-existing).

## Confirmed out of scope — cannot be fixed from this repo

These are Builder-side gaps (no Inspector control exists to set them, or the control itself is a no-op in Builder's own code) — the APK reads them correctly already; there's simply nothing for a designer to set today:

- SignIn `cardBorderColor`, `inputBorderColor` — no Inspector control at all.
- SignUp `{field}Label*` styling — no Label sub-section exists in the Inspector UI (dead `labelVisible` state, never rendered).
- SignUp's placeholder "Bold" toggle — Builder's own `onFormatChange` handler writes `fontWeight: fmt.bold ? 500 : 500` (both branches identical — a no-op in Builder itself, independent of anything in this repo).
- SignIn's "Forgot Password" sub-block (`forgotPasswordText/Color/Pt/Pb` etc.) — entirely commented-out JSX in the Inspector; the separate `forgot_password` block/page is what's actually used.
- `navigateTo`/`selectScreen` "url" destination type — Builder has a `screen`/`url` toggle but no visible URL text-input field was found backing the "url" option, so it's unclear what value would populate it. The `screen` case is fully wired; `url` is passed through to the resolver's `navigateType: 'url'` path best-effort.

## Verification performed

- Manual full-diff review of the ~430-line change for JSX/brace balance.
- Metro bundled the change with zero compile errors (TypeScript itself isn't installed as a project dependency, so no `tsc` typecheck exists in this repo — Babel-only bundling was the available signal).
- Live-tested on the Android emulator against the real published DSL for `appId 132`: SignIn, SignUp, and ForgotPassword modes all render correctly with their distinct live-configured themes, zero crashes, zero JS errors in logcat.
- None of the new features (logo, button icon, rich-text formatting) are exercised by the current live layout since no published section sets those specific properties yet — verified via code review that each new code path safely no-ops when the corresponding token is unset/default (matches pre-existing behavior).

## Recommendation for full closed-loop verification

To visually confirm the new Logo/Icon/Navigation/rich-text features render pixel-correct, a designer needs to actually set them in the Builder Inspector and publish — that's outside this repo. Recommend as a follow-up: author `DSL/components/.../signin.schema.json` (and signup/forgot_password) documenting the real prop contract found in this audit, so Builder and RN stop drifting apart silently in the future (the original audit doc's suggestion #4).
