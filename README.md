# Exercise Tracker

A calendar-first exercise tracking app for a personal 9-year fitness plan. View your scheduled workouts by week, tick off exercises during sessions, and reschedule missed days.

## Stack

- **Backend:** [Bun](https://bun.sh) + [Hono](https://hono.dev) (TypeScript)
- **Frontend:** Vanilla JS + CSS (no framework, mobile-optimised)
- **Persistence:** JSON files on disk

## Project structure

```
├── server/
│   ├── index.ts          # Entry point — serves API + static files on port 3000
│   ├── routes/           # schedule, completions, reschedule
│   ├── lib/              # scheduler logic, JSON store helpers
│   └── data/
│       ├── exercises.json     # Exercise definitions with form cues
│       ├── workouts.json      # Day A / B / C workout templates
│       ├── plan.json          # Start date, weekly pattern, progression phases
│       ├── completions.json   # Tick-off records (written at runtime)
│       └── reschedules.json   # Rescheduled sessions (written at runtime)
└── client/
    ├── index.html
    ├── app.js
    └── style.css
```

## Running locally

```bash
bun install
bun run start     # production
bun run dev       # watch mode
```

The app is served at `http://localhost:3005`.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` | Scheduled days with status |
| `GET` | `/api/schedule/:date` | Single day detail with exercises |
| `POST` | `/api/completions` | Record exercise completions for a date |
| `PATCH` | `/api/completions/:date` | Update a completion record |
| `POST` | `/api/reschedule` | Move a missed session to a rest day |
| `DELETE` | `/api/reschedule/:originalDate` | Cancel a reschedule |
| `GET` | `/api/reschedule/available-days` | Future rest days available for rescheduling |
| `GET` | `/api/exercises` | Full exercise list |
| `GET` | `/api/plan` | Plan metadata and current phase |

## Deployment

Hosted at `exercise.scherzinger.online` via a Cloudflare ZeroTrust tunnel pointing to `localhost:3005` on a home server. Run as a persistent process with systemd or pm2.

```bash
# Example systemd service (create at /etc/systemd/system/exercise-planner.service)
[Unit]
Description=Exercise Planner
After=network.target

[Service]
WorkingDirectory=/path/to/ExerciseTracker
ExecStart=/usr/local/bin/bun run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
