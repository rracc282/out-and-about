# Out & About

Events dashboard for Geneva and Zurich — evenings, weekends, big nights, exhibitions and day trips — installable as a web app.

- **App:** https://rracc282.github.io/out-and-about/
- `index.html` is the whole app. Event data lives in its script: Geneva in `EVENTS`, `TRIPS`, … and Zurich in the `*_ZH` constants. Weekly refreshes edit only their own city's data.
- Sign-in, saved plans and notification sign-ups use Supabase (tables `state` and `push_subscriptions`, row-level security on).
- `sw.js` keeps an offline copy and shows push notifications; `.github/workflows/notify.yml` sends them (daily reminders for your plans, Monday "New this week").
