# Stats2Pitch

Android-first football live scores and betting insight. The app reads Sofascore through one adapter, tips every trend or form line at 80% or above, and settles the picks you track.

Web can be run from the same Expo project. A Play Store build is configured as an AAB; the preview profile builds an APK.

## Brand

The only logo is the pitch mark.

| File | Used for |
| --- | --- |
| `assets/brand/s2p-pitch-mark.png` | App icon, adaptive icon, splash, header, notification icon, web favicon |
| `assets/brand/s2p-pitch-mark.svg` | Vector of the same mark |
| `assets/brand/stadium-user-bg*.webp` | Glass background |
| `assets/brand/s2p-boot.jpg`, `s2p-boot.mp4`, `football-real.svg`, `fox-kicking-ball.mp4` | Kept on disk, not used as logos |

Wordmarks and the old favicon set (`stats2pitch-logo*.png`, `brand-mark.png`, `stats2pitch-favicon*.png`, `stats2pitch-apple.png`) are removed.

## Setup

Node 22 or newer.

```bash
npm install
npm test
npm run typecheck
```

## Run on an Android phone

1. Install [Expo Go](https://expo.dev/go) from the Play Store.
2. From this repo run `npm start`.
3. Scan the QR code with Expo Go. Phone and computer need to be on the same network.
4. Allow notifications when the app asks. Settlement alerts are local notifications on Android. On web they show as in-app toasts.

`npm run web` runs the same UI in a browser. Browsers cannot call Sofascore directly (the feed does not send usable browser access from this app), so use Expo Go on the phone for the live feed.

## Build an APK

The preview profile in `eas.json` produces an APK. A Play Store listing needs a paid Play Console account; that profile is `production` and emits an AAB.

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

`eas init` will ask for an Expo account and can write the project id into `app.json`. The Android package is `com.stats2pitch.app`.

## Architecture

```
app/                     screens (expo-router)
src/engine/              pure trend, confidence, squad, grade, VAR and settlement logic
src/data/sofascore.ts    the only module that calls Sofascore
src/bookies/stub.ts      pluggable bookie adapters, all local stubs
src/db/repo.ts           SQLite on Android; web uses an on-device document store
src/state/board.tsx      board, polling, slips, lists
```

Sofascore has no official public API. The owner accepted that risk. `createSofascoreSource` is the only place that knows the host, paths and headers. Set `EXPO_PUBLIC_SOFASCORE_BASE_URL` to point the same adapter at another base later. Calls are queued (about 350ms apart), cached, retried on 429 and 5xx, and a failure returns the last cached payload when one exists. A 403 or a dead network does not throw into the UI.

Live scores refresh about every 10 seconds. Incident checks for a handful of live matches run on that same loop, so a confirmed Sofascore event reaches the app on the next poll rather than by a push socket.

### Tips

- Trend window: last 10 matches. Form window: last 5.
- A line tips at 80% with at least 5 matches. Four from four does not tip.
- Form at 80% tips as a head start when the 10-match trend is still short.
- Same-venue matches are used when there are at least five. Otherwise the overall record is used.
- Confidence = team rate + (opponent rate − 0.5) × 0.5, clamped to 0–1.
- A supporting opponent lifts the tip. A contradictory record can drop an 80% trend into the Watch group. The tip is still bookmarked.
- Picks group by confidence band, by market, and by odds band (short / medium / long). Odds sort ascending or descending. Missing prices stay last.
- Blacklisted teams, leagues, competitions and markets are hidden. Greenlisted ones sort first.

### Squads

A usual starter is someone who started at least 60% of the last lineups, once three lineups exist. Full strength means at least 90% of that group is starting. Half strength means under 60%. Three or more usual starters missing raises a rotation flag.

### VAR

A pending check is labelled VAR and is not a goal. The score and the goal notification update only when the check is awarded. A disallowed check does not change the score.

### Grades

Week, month and year use your tracked picks and slip legs. The week starts Monday 00:00 UTC. A group with at least three settled results and the best hit rate is marked lucky. Letters: A+ 80%+, A 70%+, B 60%+, C 50%+, otherwise D.

### Lists

Three busts in a row, or a 70% bust rate over the recent book, blacklist that team, market, competition or league. Three lands, or an 80% land rate, greenlist it. A row you add by hand is not overwritten.

### Suggestions

Same market, then closeness of confidence, trend and form. A different market scores zero. This is a heuristic, not a learned model.

## Sample board

If Sofascore refuses the connection, Matches offers **Preview the sample board**. Those fixtures are labelled in the app and are not a second data source. Set `EXPO_PUBLIC_OPEN_SAMPLE=1` to open that board automatically after a failed read.

## Stubbed

- Every bookie adapter returns a local code such as `S2P-SPO-……`. Nothing is sent to SportyBet, Bet365, 1xBet or Betway.
- There is no account system and no server. Slips, lists, tracked picks and the HTTP cache stay on the device.
- Odds only appear when Sofascore's odds payload maps onto a known market. Otherwise the price is blank.
- Play Store signing, store listing and a paid console account are not part of this project.
