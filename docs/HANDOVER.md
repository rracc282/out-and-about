# Out & About – handover for a new Claude session

Owner: not a developer. Wants short, clear, click-by-click steps. Changes go live only when she says so.
Live app: https://rracc282.github.io/out-and-about/ (repo rracc282/out-and-about, GitHub Pages from `main`).

## How we work (keep this)
1. Build each batch on a branch `batch-N` and push it (not live).
2. Test with Playwright (Chromium at /opt/pw-browsers/chromium; block network with `page.route`; `page.clock.install` to fake the date). Check iPhone sizes 393, 375 and 320 px, light and dark.
3. Independent review ("challenger"): a fresh agent does three passes: (a) the owner's phone walkthrough first, (b) a code read of the diff, (c) a data sweep, then the walkthrough again. Findings are tagged blocker / should-fix / nit; verdict Ship / Fix first. Then one short re-check after fixes. Only for batches that change looks or behaviour.
4. Merge to `main` and push = publish. Bump the cache name in `sw.js` (currently oa-v90) on every publish.
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

### Batch 7c — LIVE (reviewed, verdict Ship)
Part of 33, "too-far events". `placeOf()` only ever read an event's `place` field, so anything with no venue of its own inherited the city its source searched. For Meetup that is most events and the town sits in the title, so a ski day in Andermatt, bouldering in Altdorf, life drawing in Zug and a bar evening in Winterthur were all filed as in-city Zurich. Titles are now matched against a `TOWNS` list and fed back through the existing distance logic, so they land as "≈ 24 km away" and the app's own distance filter applies. All out-of-town events in the live data are labelled correctly (4 of 4; an earlier note here claimed 7 of 8, which did not reproduce).

Ambiguous town names (`Zug`, `Baden`) only match after a preposition, because "Zug" is also the German for a train and "Baden" for bathing. A comma was tried as a third trigger and removed: it fired on ordinary German like "Entspannen, Baden und Sauna im Thermalbad". Note the earlier claim in this file that "Hike & Hot Springs Baden" was a deliberate trade-off was simply wrong — that event has a real venue, and `placeOf` consults the title only when the venue is empty, so no regex change could ever have affected it. 4 of 4 genuinely out-of-town events are now labelled correctly.

A town in the title sets the distance, never the city: a Geneva group's day trip to Bern stays in the Geneva list, even though Bern is nearer Zurich. Towns beyond 110 km are labelled "≈ 117 km away", not deleted — an earlier version dropped them as "unknown place", which would have silently removed Davos and Zermatt ski trips as the season starts.

Known and left: `townName` takes the matched phrase, so an unusual spelling could read oddly in the list row; there is no upper distance bound on the title path, so "Weekend in Annecy" from a Zurich source reads "≈ 247 km away" under zone 90, which the UI calls "Day out" — the curated data has a `zone:"far"` for this.

Still open in 33: wrong categories. Odd hours were tried and removed — online events are already filtered upstream, the rule could only fire at a weekend, and its whole yield was one junk post against the risk of deleting a sunrise hike.

### Batch 7d — LIVE (not independently reviewed; unit-tested and smoke-tested only)
**Item 54 was already done.** Accents have folded away on both sides for some time: `geneve` finds all 388 Genève events, `cafe` finds `café`, `musee` finds `musée`, `zurcher` finds `Zürcher`. Measured, not assumed — don't rebuild it.

The real gap was German, which goes the other way: `zuerich` returned **0** where `zurich` returned 538, because Swiss-German writes ü as "ue" (Zuerich, Muenstergasse). `qOk()` now folds ue→u, oe→o, ae→a and ß→ss as a *second* chance, after the normal test. Purely additive — a word that matched before still matches, so "Neue Musik" is unaffected (verified: still 19 hits). Live: `zuerich` now returns 563, the same as `zurich`.

Only `index.html` changed. Nothing else in Batch 7 is started: 53 "Updated X ago" (the data exists as `AUTO.generated`; the `.stamp` line that would show it is hidden by the Batch 5 CSS, so it needs a new home that doesn't crowd the title row), 52 speed, 51 sync merge, 50 "new version" prompt (note the service worker currently calls `skipWaiting()`, i.e. it already auto-updates — worth asking whether a prompt is wanted at all), 57 cleanup.

### Found while publishing 7c/7d — not yet acted on
**Far events with a real venue are deleted under a reason that says the place was unknown.** `placeOf()` returns null above 110 km, and the caller counts that as "unknown place": 582 rows on the 12 Nov 06:48 run, about 10% of everything harvested. The samples are things like "Season Start Saas-Fee" with a full address — the place was known exactly. This is pre-existing, not from 7c: the same ~582 appears in the 11:37 and 14:02 runs on 11 Nov, before `TOWNS` existed, and the count oscillates between ~95 and ~585 depending on which Eventfrog category pages answer that night. It is the same mistake 7c fixed for title-matched towns, still live for venue-matched ones. Fixing it would surface ski-resort and mountain events (Saas-Fee, Zermatt) labelled by distance rather than dropping them — worth asking her first, since it would add a lot of 2–4 hour-away events.

## Batch 8 — far events, running clubs, and what that did to the Geneva day

Two things she chose explicitly: show far-away events labelled by distance instead of deleting
them, and keep running clubs in the app but let them be filtered out.

**The first review of this batch came back "fix first", and was right: neither worked.**
- The "Further" chip was a duplicate of "Any". `zoneOk()` is a threshold test and `far` is the
  maximum, so selecting it admitted every zone — 605 of 605 events. The chip is gone; far events
  are kept, labelled, and show under "Any", which is what was asked for. Do not re-add a `far`
  chip without first making `zoneOk` treat it as its own bucket.
- The running filter tested the description, so it hid an English comedy night whose blurb said
  "running since 2022" and a "long-running" kizomba night — and hid no running clubs at all,
  because all six sat in `curated.json`'s `drop` list and were spliced out of `EVENTS` before
  `never()` ever saw them. Removed from `drop`; `running` now has a title-only branch in
  `never()`, films exempt so "Blade Runner" stays in the Culture tab. Verified: hides exactly
  the eight running items and nothing else, over 507 live titles.

**What actually recovered the events** was none of the above: it was widening the `srcCity`
fallback from `if (srcCity && !text)` to `if (srcCity)`. Measured against a *same-night* `main`
baseline (a branch off main, collector run minutes apart — do this, don't compare against an
older run, source variance is large): **Geneva 241 -> 408, Zurich 261 -> 276, "unknown place"
579 -> 0, "too far" 20 -> 0.** La Décadanse alone went 42 -> 234.

### The cost, and the open question for her
The 40-per-city-per-day cap never used to bite in Geneva. With three times the events it now
discards ~250 a night. It also discarded them **silently**, with no report entry, which is why
this took four runs to find — it now reports as `day full (40 per city per day)` with samples.

Two cap attempts, both measured, both wrong before the third:
1. Equal round-robin across sources — wrong shape. `lesgenevois.com` only publishes for the
   coming weekend, so on exactly the days it covers it was cut to an eighth of the day alongside
   sources that had nothing to say. It went 58 -> 31.
2. "Keep the better listing" at the venue check — a guess, and it made things worse (Geneva
   titles absent went 34 -> 43). Reverted. Only 5 of 43 losses were venue clashes at all, three
   of those the same Acroyoga session and one a correct French/English cross-post.
3. What shipped: a soft ceiling of 16 of the 40 per site, then a second pass handing unwanted
   slots back. `lesgenevois` 31 -> 42, and Kurtág, La Nuit du conte, HEKA and FILMAR returned.

**Still open, and hers to decide:** 33 Geneva titles that were on `main` are still not on the
branch, among them the Ballet du Grand Théâtre public rehearsal and "L'ADC fête ses 40 ans".
The curated theatre agenda and the bulk nightlife agenda are genuinely competing for the same
40 slots on a busy Friday. Raising the cap, or ranking curated venues above nightlife, changes
what she sees every day — ask, don't pick.

### Smaller fixes in the same batch
- The postcode path matched any four digits before a capitalised word: "Salle 1000 Places" became
  the town "Places". It now requires the postcode to start an address segment. 11 cases tested.
- Postcode ranges were wrong at the edges. 1200–1299 is not all Geneva (1260 Nyon, 1296 Coppet
  are Vaud, 20–30 km out) so in-town stops at 1252; 8600–8999 was swallowing Glarus and
  Walenstadt as a "30 min" hop. A dead `8700–8799` clause inside `8600–8999` was removed.
- "Usine à gaz" (Nyon) and Ville-la-Grand (France) arrive as bare venue names with no town, so
  they were being labelled Geneva, In town. Named in `NEAR`. **Unverified, worth a look when
  something has network: "La Turbine", "Espace Léman" and "Chant'Grange" may also be out of
  canton.** The sandbox cannot reach the web, so this was not checked.
- Events hidden by hand in `curated.json` were still taking a slot in a full day.

### Two process notes
- Don't trigger `Collect events` by hand right after pushing — the push already triggers it and
  the two runs race, the second dying on a rebase conflict in `data/*.json`. Harmless, but noisy.
- I quoted before-numbers three times from an intermediate commit rather than `main`, and was
  wrong three times. Always generate the baseline by running the collector on a branch off main
  the same night, then compare.

### Item 33 and item 52 — investigated, not started
Full notes were written up during this batch:
- **33 (wrong categories), two measured defects.** 224 of 745 events land in "Culture & shows"
  purely by the `catsOf()` fallback with no culture keyword — 30% of the app. And three regexes
  lack word boundaries: `disco` matches "discover"/"discussion" (**31 events** wrongly in Fairs &
  festivals), `velo` matches "develop" (5 in Sports), `wine` matches "intertwine" (2). The
  boundary fix is tiny and has no judgement calls; the fallback needs her decision on whether to
  add an "Other" chip to a row that is already five wide at 320px.
- **52 (speed).** ~1.37 MB at boot (index.html 735K + auto.js 564K + cine.js 74K); `data/*.json`
  are collector-only and not fetched. All three scripts are in `<head>` with no `defer`, one of
  them a third-party CDN. **Do not just add `defer`:** the main inline script at :1149 calls
  `applyAuto()` at :1847 at parse time, would find `window.AUTO` undefined, hit its
  `if(!A||!A.periods)return` guard and bring the app up empty with no error. Measure cold vs warm
  first.

## Batch 9 — item 33, wrong categories (done, live)

Two defects, both measured by extracting `catsOf` from the old and new `harvest.mjs` and running
BOTH over the same live events. Do it this way: comparing new rules against the categories already
stored in `auto.js` is not a like-for-like comparison, and it hid a bug for a while.

1. **Three patterns had no word boundary.** `disco` matched inside "discover" and "discussion"
   (31 events wrongly under Fairs & festivals), `velo` inside "development" (11 under Sports —
   every single one a false positive, confirmed: the word was develop/developed/development each
   time), `wine` inside "intertwine". Note the asymmetry: `velo` and `wine` need a LEADING
   boundary only, because a trailing one blocks plurals ("vélos"); `disco` needs the trailing one
   too, since it is a prefix of "discover", so discos/discothèque are spelled out.
2. **The fallback filed 30% of the app under "Culture & shows"** — 224 of 745 events under a
   heading they had never been tested against (a DJ night, a mulled-wine stall, a city walk). The
   fallback is now the SOURCE: `SRC_CAT` maps concert halls and museums to culture and
   flea-market sites to markets, Meetup still defaults to meet-ups, and a general ticketing site
   maps to nothing — its unmatched events get NO category rather than a wrong one, show under
   "All", and stay out of the category filters. **This is why there is no "Other" chip** — the
   row is already full at 320px. `index.html` reads `(e.cat||[]).includes(...)` in the two places
   that matter, so an empty list is safe.

Same inputs, old -> new: culture 370 -> 216, fete 88 -> 63, corps 52 -> 41, marche 35 -> 44,
rencontre 108 -> 112, none 0 -> 148. A real collector run agrees (culture 347 -> 200, none 143).
Full device matrix passes with the empty categories in place.

Still uncategorised and not fixable from text alone: Eventfrog theatre shows whose titles never
say "theatre" ("Harry P.Otter und die Zauberprüfung"). A venue list for Eventfrog would catch
them; not worth it yet.

### Note on running the collector from a branch
The workflow's Save step rebases its new data commit onto main, and generated JSON conflicts
whenever main has had a nightly run since the branch was cut. The run still HARVESTS and pushes
its data commit before that step fails, so the output is usable — rebase the branch onto its own
remote and carry on. Don't re-trigger; and don't dispatch by hand right after a push, since the
push already triggers it and the two race.

## Still to do (from the six-reviewer feedback list)
- **Batch 7 · Under the hood:** the rest of 33 (duplicates and odd times; wrong categories and too-far events are done); 51 sync merge / magic-link sign-in; 53 "Updated X ago"; 52 speed; 54 search that ignores accents; 50 "new version" prompt; 57 code cleanup.
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
