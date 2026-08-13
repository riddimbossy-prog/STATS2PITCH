STATS2PITCH v3 — GITHUB PAGES + SUPABASE REPAIR

WHY THE FRESH SITE STAYED ON "LOADING..."
The fresh UI called /api/board, but GitHub Pages is static and has no local Node API.
The correct architecture is:
  GitHub Pages -> runtime-config.js -> Supabase Edge Function -> prediction_snapshots

REPLACE THESE FILES:
  public/index.html
  public/app.js
  supabase/functions/stats2pitch-api/index.ts
  .github/workflows/pages.yml

WHAT THIS FIX DOES
- Loads the GitHub Pages runtime config before app.js.
- Sends board requests to the Supabase Edge Function.
- Makes board/read status public for the fresh public UI.
- Keeps /me authenticated for the existing auth smoke test.
- Rejects every Supabase snapshot that is not engineVersion stats2pitch-consensus-v3.
- Shows a real error instead of staying on Loading forever.
- Normalizes SUPABASE_URL in the Pages build.
- Keeps GitHub Actions as the prediction-generation worker.

AFTER PUSHING
1. Wait for "Deploy GitHub Pages" to complete.
2. Wait for "Deploy Supabase Functions" to complete.
3. Run "Refresh Boards" manually once so Supabase gets fresh v3 snapshots.
4. Hard refresh Stats2Pitch.

Do not restore any old engine snapshot or old /api/board frontend code.
