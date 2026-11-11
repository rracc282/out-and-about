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

Challenger review: two blockers and five should-fixes, all fixed and re-verified by driving the page; verdict **Ship**. Checked separately: with "Film" and "Concerts" off, `batch-6` produces plans identical to `main` on the same data, in both cities.

Three known residuals, none a regression and none loses data:
- `pricey` reads a figure out of the price string, so a ticketed show priced only as "Tickets" or "price to check" still passes. It carries a "Book ahead" chip but no price. Note the owner's saved profile has Concerts **on**, so the −7 penalty that would otherwise bury these does not apply to her.
- The Plan offers one showtime per film, so a later showing of the same film can only be chosen from the Culture tab. It does prefer whichever showtime is already in My plans, so it can't create a duplicate.
- The Filmpodium language regex caps each code at 8 characters and wants a comma before the running time; anything else shows up as a drop in `report["filmpodium.listed"]` (currently 10 listed → 4 English).

Note the branch also carries two bot commits ("Nightly events", "Cinema times") — pushing `scripts/sources.json` or `scripts/cinema.mjs` to any branch triggers those workflows, so they ran against `batch-6`. Harmless: the nightly job regenerates that data on `main` anyway.

## Batch 7, started — branch `batch-7`, not live
Part of item 33: the dead Zurich feeds. Each was diagnosed by fetching it from Actions, since the dev sandbox cannot reach these sites.
- **Hallenstadion** now has its own collector and yields ~10 events (was 0). Its listing has no event data and its JSON-LD is breadcrumbs only; every event page carries an AddEvent block (`<span class="start">11.11.2026 19:30</span>`), so links come from the listing and dates from the pages.
- **Nine of fifteen hand-added Meetup slugs do not exist** — meetup.com serves an identical ~59.6 KB placeholder for all of them. Removed, so the nightly run stops wasting nine fetches and the report shows real failures.
- Two general bugs this surfaced: numeric HTML entities were never decoded (`Let&#8217;s Dance`), and the weekly curation is merged *after* dedupe, so a hand-written entry and a scraped one for the same night both survived. Both fixed; `report.curatedOverlap` counts the second.

**Zürich unbezahlbar** also has its own collector (`kind: "unbezahlbar"`): a server-rendered poster list, 24 a page, everything on it free. Venue and description come from each event's detail page (`<address class="detailpost__address">`) — without them the venue reads "Zurich" on every card, the day+time+venue dedupe collides, and the German-language filter has only a title to judge by. Permanently-open facilities are listed 00:00–23:59 and skipped. The page's `<time datetime>` attribute is wrong, so the German visible date is parsed; the year only rolls forward when a date is >60 days behind, or a listing for yesterday becomes an event a year out.

Meetup is now searched **by activity** (nine keyword searches) as well as by group, and six real Zurich groups were found through Meetup's own group search. `meetupSkip` in sources.json holds slugs meetup.com answers with "Group not found" — they are also linked from index.html, so removing them from `meetupExtra` alone does not stop them being fetched.

Still zero, with the reason, so nobody re-probes them: **guidle**, **infomaniak.events** and **tonhalle-orchester** build their listings in the browser — their HTML is navigation and nothing else. **newinzurich** returned 502 on every attempt, so it is unknown rather than empty; worth retrying. **zuri.net** does server-render, but its own page says the agenda is "presented with the kind support of Eventfrog" and its ticket links are Eventfrog ids, so it is a reskin of a feed we already take. Note `microdata()` only matches `schema.org/*Event`; zuri.net uses the legacy `data-vocabulary.org` namespace.

**What this actually changed, stated carefully.** Zurich went from 251 to 263 kept events (like-for-like against the 11:37 run on batch-6 code). The count understates it: roughly 56 new English-accessible events came in, and roughly 45 German-only ones correctly went out, because fetching descriptions finally gave the German-language filter something to judge by — it had only titles before. Do not quote a bare before/after number for this batch; the composition changed more than the total. Geneva 279 → 276, ordinary listing churn.

Known and left for next time: three unbezahlbar detail pages (under `clubs-parties`, `bildende-kunst-performance`, `sport-freizeit/diverse`) use a second address markup the `detailpost__address` pattern misses, so those fall back to "Zurich" and also pick up a page-dump description; `BIGHALL` includes Kaufleuten and Volkshaus, which are multi-room, so a curated night there could still suppress a different event in another room (it is named in `report.curatedOverlapDropped` if it happens); all-day entries with a date and no time are still discarded by the unbezahlbar collector, which loses exactly the free markets this source is for; the detail fetching is sequential and is now the slowest source in the run.

## Still to do (from the six-reviewer feedback list)
- **Batch 7 · Under the hood:** the rest of 33 (duplicates, wrong categories, too-far events, odd times); 51 sync merge / magic-link sign-in; 53 "Updated X ago"; 52 speed; 54 search that ignores accents; 50 "new version" prompt; 57 code cleanup.
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
