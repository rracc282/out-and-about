# Out & About – handover for a new Claude session

Owner: not a developer. Wants short, clear, click-by-click steps. Changes go live only when she says so.
Live app: https://rracc282.github.io/out-and-about/ (repo rracc282/out-and-about, GitHub Pages from `main`).

## How we work (keep this)
1. Build each batch on a branch `batch-N` and push it (not live).
2. Test with Playwright (Chromium at /opt/pw-browsers/chromium; block network with `page.route`; `page.clock.install` to fake the date). Check iPhone sizes 393, 375 and 320 px, light and dark.
3. Independent review ("challenger"): a fresh agent does three passes: (a) the owner's phone walkthrough first, (b) a code read of the diff, (c) a data sweep, then the walkthrough again. Findings are tagged blocker / should-fix / nit; verdict Ship / Fix first. Then one short re-check after fixes. Only for batches that change looks or behaviour.
4. Merge to `main` and push = publish. Bump the cache name in `sw.js` (currently oa-v89) on every publish.
5. Never put secrets in the repo (Supabase secret key, database password). Event names stay in their original language; the interface is in English.

## Code map
- `index.html`: one big file. Later `<script>` blocks wrap earlier functions (render, gloss, openSetup, filterOk, persist, adopt…). Add new blocks at the end. The Batch 5 CSS block sits before `/* toasts: above the tab bar` in the last `<style>`.
- Plan tab: the IIFE "Plan tab: a ready-made weekend…" (slots, fits(), score(), build(), view(), sheets). `window.OA` exposes MOODS/NEVER/prof.
- Data: `auto.js` (nightly events, picks, weather), `cine.js` (cinema), `data/curated.json`, `data/hikes.json` + `hikes/*.gpx`.
- Workflows: harvest.yml (nightly events), weather.yml (hourly), hikes.yml, cinema.yml, notify.yml.
- Fonts are bundled in `fonts/`; icons are icon-192/512, icon-maskable-512, apple-touch-icon, favicon-32.

## Done
Batches 1–5 are live: plan basics, preferences, labels and data cleanup, inviting friends (invite links, Back button, OG image), looks (icons, dark mode, iPhone pass).

Batch 6 is built on branch `batch-6`, not live:
- **37** Zurich "beta": a note under the header whenever Zurich is in view (including "Both"); dismissing it collapses it to a permanent "Zurich beta" chip that reopens on tap. Deliberately *not* in the title row — that row is nowrap at 320 px and an extra chip there overlaps the settings button.
- **39** Cinema screenings and ticketed ("big") shows are now Plan candidates, in both cities. A screening is wrapped as an event-shaped object so `fits()`/`score()`/the cards work unchanged; keeping one writes to `S.films`, not `goingSet`. Both are pushed down unless "Film"/"Concerts" is on; films capped at 2 a weekend, 1 a week.
- **36** Only Kaufleuten added. 22 candidates were tested by running the real collector on a throwaway branch; see "What was tried for Zurich feeds" below.
- **38** Filmpodium added as a scraped cinema. Arthouse, blue Cinema, Xenix and Kosmos stay as links — see below.

## Still to do (from the six-reviewer feedback list)
- **Batch 7 · Under the hood:** 33 nightly quality check (duplicates, wrong categories, too-far events, odd times); 51 sync merge / magic-link sign-in; 53 "Updated X ago"; 52 speed; 54 search that ignores accents; 50 "new version" prompt; 57 code cleanup.
- **Batch 8 · Niche extras:** the owner decides do/skip for items 19–25, 43, 56, 66–68, 70–73.
- **Batch 9 · Big ideas:** items 74–79 (owner decides).
- Item 44 was skipped by the owner.

## What was tried for Zurich feeds and cinemas (Batch 6, so nobody repeats it)
Tested by running the real collector on a throwaway branch — the dev sandbox cannot reach these sites, only GitHub Actions can.

- **Worked:** `kaufleuten.ch/en/events/` (18 events). Filmpodium, via its A–Z page (Swiss language notation: `E/d` = spoken English, `Jap/d/e` = English subtitles, `F/d` = neither) joined to its by-date page for times and ticket links. About 4 English screenings a week, which is what a repertory cinema honestly yields under an English-only rule.
- **Same page we already fetch:** the three Eventfrog Zurich category URLs (`/en/events/ch/zuerich/{markets,comedy-cabaret,concert}.html`) each returned the identical 901 items as `eventfrog.ch/de/events/zuerich.html`. Eventfrog ignores the category in the path.
- **Refuses us:** Songkick metro page (406). Arthouse (403 on every user-agent tried, mobile and desktop).
- **Showtimes/events only rendered in the browser, so a Node fetch sees nothing:** blue Cinema (Next.js, the payload holds only UI labels), Xenix (AngularJS shell, every path returns the same 5 KB), Kosmos (WordPress, no showtimes in the HTML), moods.club, gessnerallee, dynamo, rotefabrik, zuri.net concerts.
- **404 on every guessed path:** exil.club, mascotte, xtra.ch, schauspielhaus, theaterneumarkt, photobastei, museum-gestaltung, kunsthaus, landesmuseum, karldergrosse, zuerich.com/en/visit/events. The venues exist; the URLs were guesses and the sandbox could not check them first.

**The bigger Zurich problem is not missing feeds.** Seven feeds already in `sources.json` return zero events: zuri.net, New in Zurich, Zürich Unbezahlbar, Hallenstadion, guidle, Tonhalle, Infomaniak Zurich. Repairing those is worth more than adding more sources and belongs with Batch 7's quality check.

## Known leftovers
- Data: duplicate listings (e.g. Bürkliplatz flea market ×3, Simultanés ×3); wrong categories (Hector Obalk "Painting workshop", Rousseau herbarium "Party", book discussion "Dog-friendly outing"); too-far events (JazzOnze+ Lausanne in Geneva big concerts, Libingen walk ~50 km); a private Klangmassage session in Zurich. These belong in Batch 7's quality check.
- In dark mode, one rain-warning text is about 3.3:1 contrast (not pinned down).
- No Zurich hikes yet. Multi-day past plans don't appear in the rating loop.
- The Plan's mood-chip row scrolls sideways and its last chip is clipped at every width. That is how it already was; worth a look some time.
- Not yet checked on a real iPhone: the top status bar of the installed app, and colours on iOS 15–16.1.
