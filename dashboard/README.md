# MuseMate exhibitor dashboard

The curator and exhibitor side of MuseMate (SIH 2026 · PS 26214 · Team HackTuah). The handhelds narrate artifacts and answer spoken questions; this dashboard shows the museum what visitors did and asked, and lets staff edit what the guide says.

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/, served by the edge server
```

## Pages

| Page | What it answers |
|---|---|
| **Overview** | How is the museum doing in this period? Visitors, visit length, questions, unanswered rate, arrivals against the previous period, live floor feed, most asked-about artifacts, languages, narration modes, questions per visitor. |
| **Exhibition** | How is the whole exhibition used? Visitors inside by quarter hour, visit length spread and trend, questions per day, weekday × hour arrivals, reach and answer time per gallery, narration modes. |
| **Artifacts** | Every artifact with visitors, questions, dwell, skip and unanswered rates. Search, filter by gallery or status, CSV export. |
| **Artifact** | Edit the catalogue entry (description, curator notes, languages, verified) beside how visitors respond. It shows which question topics the entry can answer, so adding a provenance note visibly closes a gap. |
| **Visitors** | Every visit (one handheld, pick-up to return) with its language, mode, taps, questions and rating. Filters and CSV export of visitors and their questions. |
| **Visit** | One visitor's route: each tap by gallery, how much narration they heard, what they asked and whether it was answered, their review. |
| **Pain points** | Problems worked out from unanswered questions, device telemetry and reviews, each with a suggested fix and a "mark handled" state. |
| **Reviews** | Spoken end-of-visit ratings and comments, themes, and rating by language and mode. |
| **Reports** | CSV exports and a printable exhibition report (print or save as PDF). |

The date range (Today / 7 days / 30 days) in the top bar applies to every page. Light and dark themes follow the system or the sidebar switch.

## Data

The server is not wired up yet, so `src/data/seed.ts` generates 60 days of seeded visits from the 38-artifact catalogue in `src/data/catalog.ts`. The same seed always gives the same museum. The live feed (top bar) adds taps and questions every few seconds so a demo moves.

The simulation includes the problems the dashboard should find: thin catalogue entries, slow answers in Arms & Armour (a WiFi dead zone), NFC tags that need retries on the Chola bronzes, a Tamil voice with poor ratings, and visitors who never reach Textiles.

Artifact edits and "handled" pain points are saved in the browser's localStorage. To reset them, clear site data.

### Wiring up the real server

Pages only read through `src/data/store.ts` (sessions, artifacts, feed) and `src/data/selectors.ts` (aggregations). To go live, replace the generator in `store.ts` with calls to the FastAPI server, keeping the `Session → Stop → Query` shape in `src/data/types.ts`:

- `GET /sessions?from&to` returns sessions with their stops and queries
- `GET /artifacts`, `PATCH /artifacts/:id` for the catalogue
- a WebSocket that pushes `tap`, `query`, `start` and `end` events for the live feed

Visitors are anonymous visit IDs (`V-MMDD-NNN`) tied to a handheld session, never to a person.

## Layout

```
src/
  data/        catalog, generator, store, selectors, exports, coverage rules
  components/  UI primitives, charts, layout, table, artifact/feed bits
  pages/       one file per route
  lib/         formatting, CSV, date range, theme
  styles.css   design tokens (light and dark) and Tailwind setup
```
