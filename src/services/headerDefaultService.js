/**
 * headerDefaultService.js
 *
 * Caches the `headerdefault` config from the DSL so that screens
 * which render <Header /> without a DSL section can still respect
 * the enabled flag and styling from the app builder.
 */

let _config = null;

export function setHeaderDefault(config) {
  _config = config ?? null;
}

export function getHeaderDefault() {
  return _config;
}
