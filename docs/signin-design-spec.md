# Sign-In Screen — Design & Flow Specification

**App:** MobiDrag (React Native 0.82, package `com.mobidrag`)
**Screen file:** `src/screens/AuthScreen.tsx` (single 2700-line component that renders **three modes**: `login`, `signup`, `forgot` — controlled by one `mode` state variable)
**Route name:** `Auth` (registered in `App.tsx`)

---

## 1. What makes this screen unusual: it's DSL-driven, not hardcoded

This is **not** a static design. Every color, spacing value, font, label, and even visibility flag is read from a JSON layout config ("DSL") fetched at runtime from a backend (`fetchDSL()` in `src/engine/dslHandler.js`), refreshed live every 30 seconds while the screen is focused. A local fallback (`src/data/authLayoutFallback.js`) is used only if the live fetch fails.

This means:
- The merchant/tenant can reskin the entire sign-in page (colors, copy, spacing, radius, font) from a backend admin panel — no app rebuild needed.
- The component defines ~120 typed "tokens" per section (sign-in, sign-up, forgot-password) with sane defaults, then overlays whatever the DSL provides.
- If you're rebuilding this in another stack, you have two choices: (a) hardcode the *current live values* observed below, or (b) rebuild the same token/DSL-driven architecture. Decide which one you want before describing this to ChatGPT.

---

## 2. Actual rendered screenshot (current live values)

Layout top to bottom, on a white full-bleed page:

1. **Header bar** — light gray, back arrow (left), bell/notification icon + wifi icon + cart icon (right). This is the shared app header (`HeaderDefaultComponent`), not part of the auth form itself.
2. **Title:** "Sign In" — large, centered, near-black text.
3. **Email input** — white fill, thin teal/dark-cyan border, placeholder "Enter email" in gray, ~50px tall, minimal corner radius.
4. **Password input** — same style, placeholder "Enter password", with an **eye icon** on the right (teal) to toggle visibility.
5. **Continue button** — solid gold/tan fill, teal text "Continue", centered, rounded corners (~10-12px), full width.
6. **Footer, left-aligned, stacked:**
   - "Don't have an account?" (black)
   - "Create an Account" (bold, gold/tan link) — switches to signup mode
7. **"Forgot Password?"** — centered, gold/tan link, below the footer — switches to forgot-password mode.

Color palette observed: white background, near-black title/body text, teal (`~#027579`/`#0c9297` family) for input borders and the button's text/icons, gold/tan (`~#B08D57` family) for the button fill and link text.

---

## 3. Component tree / architecture

```
AuthScreen (src/screens/AuthScreen.tsx)
├── HeaderDefaultComponent            (shared header, back button only, tabs hidden)
├── KeyboardAvoidingView > ScrollView (pull-to-refresh re-fetches the DSL)
│   ├── Title (mode-dependent: authTitle / headerTitle / headlineText)
│   └── Form Card (View)
│       ├── [signup only] Profile picture circle (optional, DSL-controlled)
│       ├── [signup only] First Name field
│       ├── [signup only] Last Name field
│       ├── [forgot only] Dynamic field list (usually just Email)
│       ├── Email field           (FormField, shared component)
│       ├── Password field        (FormField, with eye-icon rightSlot)
│       ├── Inline error banner   (red, shown on validation/API failure)
│       ├── Inline success banner (green, shown after forgot-password submit)
│       ├── Submit button (TouchableOpacity, optionally LinearGradient fill)
│       ├── Footer switcher (login ↔ signup text + link, or "back to login" in forgot mode)
│       └── "Forgot Password?" link (login mode only, if enabled)
```

`FormField` is a reusable field component (`~line 1478` in AuthScreen.tsx) — not `TextInput` used directly. It renders: optional label, a bordered wrapper `View` containing a `TextInput` + optional `rightSlot` (used for the password eye icon), and an optional helper/error text below.

---

## 4. Full parameter surface (design tokens)

These are the *typed* fields the component understands (TypeScript type `SignInTokens`, ~95 properties). Grouped by concern:

### Page / card layout
`bgColor`, `pagePaddingTop/Bottom/Left/Right`, `cardBgColor`, `cardBorderColor`, `cardBorderWidth`, `cardBorderRadius`, `cardPadding(Top/Bottom/Left/Right)`, `formCardMarginBottom`, `formGap` (title→form spacing), `fieldGap` (between fields)

### Title
`titleColor`, `headlineSize`, `headlineWeight`, `headlineFontFamily`, `authTitle` (text content, e.g. "Sign In")

### Inputs (separate token set per field: `email*` / `password*`)
- Label: `*LabelText`, `*LabelVisible`, `*LabelColor`, `*LabelFontSize/Family/Weight`
- Placeholder: `*Placeholder` (text), `*PlaceholderVisible`, `*PlaceholderColor`, `*PlaceholderFontSize/Family/Weight`
- Input text itself: `*InputTextColor`, `*InputTextFontSize/Family/Weight`
- Shared across both fields: `inputBorderColor`, `inputBorderRadius`, `inputHeight`, `inputPaddingHorizontal/Vertical`

### Submit button
`buttonText`, `buttonTextColor`, `buttonFillColor` (or `buttonGradient` — parsed from a CSS `linear-gradient(...)` string into `{colors[], angle}` and rendered via `react-native-linear-gradient`), `buttonBorderColor`, `buttonBorderWidth`, `buttonRadius`, `buttonHeight`, `buttonWidth` (percentage — if <100 the button shrinks and centers instead of stretching), `buttonPaddingTop/Bottom`, `buttonFontSize/Family/Weight`, `buttonAutoUppercase`

### Footer
`footerText`, `footerLinkText`, `footerTextColor`, `footerLinkColor`, `footerTextFontSize/Family/Weight`, `footerLinkFontSize/Family/Weight`, `footerLinkAlignment` (Left/Center/Right), `footerInline` (footer text + link on same line vs stacked), `footerVisible`, `footerMarginTop`, `footerLinkMarginTop`

### Forgot password
`forgotPasswordVisible` (toggle whether the link even shows), plus an entirely separate `ForgotPasswordTokens` type reused for the forgot-password *mode* screen (headline, reset button, success/error message styling, and a dynamic `fields[]` array so the backend can add/remove input fields).

### Sign-up-specific additions (on top of all sign-in tokens)
First/last name field tokens (mirroring the email/password token pattern), `headerTitle*`, per-field text alignment overrides, `showProfilePicture` + `profilePictureUrl/Size/BgColor/BorderColor`, `signInLinkVisible`, `buttonVisible`.

**Naming/aliasing note:** the token builder functions (`buildSignInTokens`, `buildForgotPasswordTokens`, `buildSignUpTokens`) accept many alternate key names from the raw DSL payload for the same concept (e.g. button background can arrive as `buttonbgColor`, `buttonBgColor`, `buttonBackgroundColor`, `buttonFillColor`, or `buttonColor` — first non-empty wins). If you're describing this to ChatGPT for a rebuild, you likely only need the *canonical* token names above, not every alias.

---

## 5. State & validation logic

Local component state: `email`, `password`, `firstName`, `lastName`, `passwordVisible` (bool), `mode` (`login | signup | forgot`), `loading`, `error`, `successMessage`, plus DSL-loading state.

**`validateForm()`** (login/signup):
- Email + password both required.
- Email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Password ≥ 6 chars (login) or ≥ 8 chars **with at least one uppercase letter and one digit** (signup).
- Signup also requires first/last name if those fields are visible per DSL.

**Forgot-password validation:** each DSL-declared field is checked for `required` and, if `type === 'email'`, validated against the same email regex — with per-field custom error message overrides from the DSL.

---

## 6. Submit flow / backend integration

- **Login** → `AuthContext.login(email, password)` → `authService.login()`:
  1. Fetches store config (`fetchStoreConfig()`).
  2. Tries a GraphQL `LOGIN_USER_MUTATION` against the app's own backend.
  3. On success, additionally resolves a **Shopify customer access token** (`createShopifyCustomerAccessToken`) so the session can also act as a Shopify storefront customer.
  4. If the primary mutation fails, falls back to a secondary `loginCustomer` REST-ish call keyed by `store_id` (multi-tenant fallback path).
  5. Session (`{ token, user }`) is persisted to `AsyncStorage` under `@auth_jwt_token` / `@auth_user_profile`.
- **Signup** → registers a Shopify customer *and* creates an app-level user via `CREATE_USER_MUTATION`, then same session-persist + Shopify token resolution.
- **Forgot password** → `recoverShopifyCustomerPassword({ email })` (Shopify-native password recovery), shows an inline success/error banner instead of navigating away.
- On successful login/signup: updates Redux (`wishlistSlice`), fires analytics events (`login` / `sign_up`), and associates the device's push-notification token with the newly authenticated user (`tokenLogger`).

---

## 7. Mode-switching behavior

- `login → signup` and back: "Create an Account" / "Sign in" footer link (`toggleMode`).
- `login → forgot`: "Forgot Password?" link, only rendered if the DSL marks a forgot-password section as enabled (`hasForgotPasswordSection`).
- `forgot → login`: "Sign in" link under the reset-password card.
- The screen also supports deep-linking directly into a mode via a navigation param (`initialAuthMode`).

---

## 8. Known rough edge (unrelated to design, worth flagging separately)

The current running build shows a dev-only toast: *"Encountered two children with the same key, `it...`"* — a React key-collision warning, likely from a list render elsewhere on this screen or a nearby screen. Not a design issue, but worth fixing before shipping; not covered in this document since it's outside the sign-in visual/parameter scope.

---

## 9. Suggested prompt to hand to ChatGPT

> "I'm rebuilding a mobile app's sign-in screen. It's a card-based form on a white page: centered/left title, email + password inputs with teal borders and a password-visibility eye icon, a solid gold/tan 'Continue' button with teal text, and a footer with a 'Create an Account' link plus a separate centered 'Forgot Password?' link. [Paste section 4's token list to specify exactly what should be configurable, and section 6 for the auth flow / backend behavior.]"
