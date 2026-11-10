# Stats2Pitch

Android-first football live scores and betting insight. The app reads SportyBet Ghana through one adapter, tips every trend or form line at 80% or above, and settles the picks you track.

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

`npm run web` runs the same UI in a browser. SportyBet blocks many IPs outside Ghana, so use the app on a phone in Ghana for the live feed. A failed read can open the labelled sample board.

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
src/data/sportybet.ts    the only module that calls SportyBet
src/bookies/             SportyBet booking, then Football.com, MSport, Betika, Betpawa
src/db/repo.ts           SQLite on Android; web uses an on-device document store
src/state/board.tsx      board, polling, slips, lists
```

`createSportyBetSource` is the only place that knows the SportyBet host, paths and headers. Set `EXPO_PUBLIC_SPORTYBET_BASE_URL` to point the same adapter at another base. Calls are queued (about 350ms apart), cached, retried on 429 and 5xx, and a failure returns the last cached payload when one exists. A 403 or a dead network does not throw into the UI. The status line reads Live from SportyBet, Blocked, or Offline.

SportyBet event ids are Betradar ids (`sr:match:N`). Booking uses that id directly. A pasted SportyBet share code is read back and rebooked on the other Ghana books.

Live scores refresh about every 10 seconds. The list comes from `factsCenter/liveOrPrematchEvents`. Today's card comes from `factsCenter/pcUpcomingEvents`. Match detail, markets and the final score come from `factsCenter/event`. Team form comes from `factsCenter/teamEventList`.

### What SportyBet does not send

The public factsCenter payloads used here include score, status, kickoff, teams, competition and markets. They do not include a reliable recent starting XI, so rotation and squad strength stay **unknown** unless an event payload happens to include `homeLineup` / `awayLineup`. Cards and substitutions show only when a timeline (`comments`, `eventTimeline` or `timeline`) is present. Detailed match statistics are not in these payloads.

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

A usual starter is someone who started at least 60% of the last lineups, once three lineups exist. Full strength means at least 90% of that group is starting. Half strength means under 60%. Three or more usual starters missing raises a rotation flag. SportyBet does not currently supply those recent XIs, so the squad card stays on "Squad not compared yet".

### VAR

SportyBet publishes a score, not a separate VAR decision on every goal. The first score seen for a match is accepted. A later increase is labelled VAR and is not awarded for 45 seconds (`GOAL_HOLD_MS` in `src/data/var-hold.ts`). If that same score is still there when the hold ends, it becomes a confirmed goal and the notification can fire. If the score falls back, the check is disallowed and the goal is not awarded. A timeline row that says the goal was VAR confirmed awards it immediately. A pending check is not a goal.

### Grades

Week, month and year use your tracked picks and slip legs. The week starts Monday 00:00 UTC. A group with at least three settled results and the best hit rate is marked lucky. Letters: A+ 80%+, A 70%+, B 60%+, C 50%+, otherwise D.

### Lists

Three busts in a row, or a 70% bust rate over the recent book, blacklist that team, market, competition or league. Three lands, or an 80% land rate, greenlist it. A row you add by hand is not overwritten.

### Suggestions

Same market, then closeness of confidence, trend and form. A different market scores zero. This is a heuristic, not a learned model.

## Sample board

If SportyBet refuses the connection, Matches offers **Preview the sample board**. Those fixtures are labelled in the app and are not a second data source. Set `EXPO_PUBLIC_OPEN_SAMPLE=1` to open that board automatically after a failed read.

## Booking

Slips book on SportyBet Ghana first (`POST /api/gh/orders/share`). The app reads that code (`GET /api/gh/orders/share/{code}`) and sends the same Betradar legs to Football.com, MSport, Betika and Betpawa. You can also paste an existing SportyBet code and convert it. Each bookie fails on its own and shows the reason. Share links:

- `https://www.sportybet.com/gh/?shareCode=CODE`
- `https://www.football.com/gh/?shareCode=CODE`
- `https://www.msport.com/gh/?shareCode=CODE`
- `https://www.betika.com/en-gh/share/CODE`
- `https://www.betpawa.com.gh/share-betslip/CODE`

Requests run from the phone. SportyBet returns 403 from many non-Ghana networks.

## Still local

- There is no account system and no server. Slips, lists, tracked picks and the HTTP cache stay on the device.
- Odds come from the SportyBet markets on the event (1X2, totals, BTTS, team totals). A market SportyBet did not price stays blank.
- Play Store signing, store listing and a paid console account are not part of this project.
