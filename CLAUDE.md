# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Static single-page campaign dashboard for HTM (Avondkaart 2026). No build step, no package manager — open `index.html` directly in a browser or serve it locally.

## Architecture

All data and config live as inline JS globals at the top of `index.html`:

- `window.DASH_CONFIG` — client name, subtitle, logo, lastUpdated date
- `window.DASH_DATA` — all campaign data: `campaigns`, `pacing`, `performance`, per-channel daily time-series (`metaSee`, `metaThink`, `tiktok`, `metaDo`, `dooh`), `doohPublishers`, `doohCampaigns`, `ga4`

The three files under `assets/` do the rest:
- `assets/style.css` — all styling
- `assets/dashboard-core.js` — reads `window.DASH_DATA`, owns all UI state and chart rendering (Chart.js)
- `assets/chart.min.js` — bundled Chart.js (no CDN; CSP blocks external scripts)

`dashboard-core.js` state:
- `activeCampaign` (`'avondkaart'` | `'dooh'`)
- `activeDateRange` (`'all'` | `'last1'` | `'last7'` | `'last30'`)
- `activeChannels` — object keyed by channel slug (`meta-see`, `meta-think`, `tiktok`, `meta-do`)
- `CH_META` maps display channel names → `{ color, key, dataKey }` used throughout

## Data update workflow (mandatory final step)

Data leeft in `data.json` (vorm A: `{"config":{...}, "data":{...}}`), NIET hardcoded in index.html.
`index.html` laadt data via `fetch('./data.json')` — CSP staat op `connect-src 'self'`.
`data.json` staat in `.gitignore` en gaat nooit in Git.

Na elke data-update:
1. Schrijf `data.json` met shape `{"config": {...DASH_CONFIG...}, "data": {...DASH_DATA...}}`
2. Upload via PUT:
   ```
   curl -fsS -X PUT https://htm.mbuylive.nl/api/clients/htm/data \
     -H "Authorization: Bearer $MBUY_UPLOAD_TOKEN_HTM" \
     -H "Content-Type: application/json" \
     --data-binary @data.json
   ```
   Portal slug is `htm` (niet de mapnaam).

## Key conventions

- Daily time-series objects use `YYYY-MM-DD` string keys; values always include `imp`, `clicks`, `cost`, `reach`. TikTok also has `vv` (video views) and `vv100` (100% view-throughs).
- `getFilteredPerf()` in `dashboard-core.js` recalculates channel metrics from daily data when a date filter is active; for `activeDateRange === 'all'` it falls back to the pre-aggregated `performance` array in `DASH_DATA`.
- Charts are tracked in the `CHARTS` object and destroyed before recreation to avoid canvas conflicts.
- The CSP in `index.html` blocks all external connections (`connect-src 'none'`); all assets must be local.
