/**
 * A full-page WebView of the data source used to sit here as a "hidden" fetch
 * bridge. On Android that WebView still painted over the app, so users saw the
 * source site and tapping other tabs closed the app. Matches now load with a
 * direct request, the same way Predict2u does. Do not mount a source page again.
 */
export function SofaBridgeHost() {
  return null;
}
