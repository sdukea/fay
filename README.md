# Fay — AI-Optimized Emergency Dispatch Console

**Fay** (codename `vector`) is a real-time emergency dispatch command center that decides — with a transparent, explainable, deterministic algorithm — which ambulance, fire engine, police unit, hazmat team, or rescue crew should respond to which incident, and *why*.

Built for TreeHacks '26. Simulated over a live 3D map of Bengaluru, India, with 15 zones, 8 hospitals, and a 40-unit emergency fleet.

## The pitch

When multiple incidents compete for the same limited pool of emergency resources, dispatchers today mostly go with "nearest unit" gut calls. That's fast, but not optimal — it can leave a critical incident stuck behind a less urgent one that grabbed the closer ambulance first.

Fay treats dispatch as what it actually is: a constrained optimization problem. Every tick, it scores every viable (incident, resource) pair on distance/ETA, resource-type compatibility, incident severity, casualty count, wait time, and hospital capacity, then solves for the assignment plan that minimizes total *weighted* response time across the whole board — not just each incident in isolation — using the **Hungarian algorithm** for globally-optimal bipartite matching. Every recommendation comes with a plain-English "why," so an operator can approve, override, or ask Fay follow-up questions before anything moves.

Nothing safety-critical (severity, ETA, routing, dispatch) depends on an LLM — it's 100% deterministic math, so it's auditable and reproducible. An optional LLM layer (Gemini) only rewrites the deterministic explanation into more natural language; if it's not configured, or the call fails, Fay silently falls back to the deterministic explanation text. The app is fully functional with zero API keys.

## How it works

### The optimization engine
- **[`lib/domain/scoring.ts`](lib/domain/scoring.ts)** — the compatibility matrix (which resource types can handle which incident types, and how well) and the cost function the solver minimizes.
- **[`lib/optimization/engine.ts`](lib/optimization/engine.ts)** — evaluates every (incident, resource) pair, runs a naive "nearest free unit" baseline for comparison, and runs the real Hungarian-algorithm assignment.
- **[`lib/optimization/hungarian.ts`](lib/optimization/hungarian.ts)** — the Hungarian algorithm (Kuhn–Munkres) implementation itself.
- **[`lib/server/explain.ts`](lib/server/explain.ts)** — turns a recommendation into a `DecisionExplanation` (drivers + narrative + ranked alternatives) for the UI.

**Priority score** (who gets served first) — severity dominates (`severity² × 10`), casualties scale sub-linearly (`√casualties × 8`, so a 20-person mass-casualty event doesn't fully drown out other critical calls elsewhere), and every minute waited adds urgency (capped at 60 min):

```
priority = severity² × 10 + √casualties × 8 + min(waitMinutes, 60) × 0.6
```

**Assignment cost** (lower = better pairing) — the solver minimizes total cost across all pairs simultaneously, so it can "steal" a nearby-but-not-nearest unit toward a more urgent incident when the fleet is stretched thin:

```
cost = (ETA × 6) − (priority × 1.4) + compatibilityPenalty + hospitalPenalty + loadPenalty
```

### The four modes (top bar)

| Mode | What it does |
|---|---|
| **Live** | Real-time operations view. Click an incident to see Fay's recommended unit, its reasoning, and alternatives. |
| **Optimize** | Runs a full board-wide re-optimization, shows baseline vs. optimized metrics side by side, and lets you apply the plan with one click. |
| **Simulate** | Trigger stress-test scenarios (mass casualty, resource failure, traffic disruption, hospital overload, multi-incident surge) to see how Fay adapts. |
| **Replay** | Step back through the event log to review what happened and when. |

### Dispatch modes (toggle in the top bar)
- **Human Approval** — Fay recommends, an operator confirms (or overrides) every dispatch.
- **Auto Dispatch** — Fay assigns resources on its own, no confirmation required.

### Ask Fay (bottom command bar)
A natural-language query box (`✦ Ask Fay`) answers operational questions ("which critical incidents are at risk?") grounded strictly in current system state — it's told never to invent incidents, resources, or numbers that aren't actually on the board.

## Reading the map — symbol legend

The main view is a live, pitched 3D Mapbox scene (falls back to a simplified 2D schematic map if no Mapbox token is set). Everything on it is color- and shape-coded:

### Incidents (circles, sized and colored by severity)
| Severity | Color | Label |
|---|---|---|
| 5 | 🔴 Red | Critical |
| 4 | 🟠 Amber | Severe |
| 3 | 🟡 Yellow | Elevated |
| 1–2 | ⚪ Gray | Minor |

- Severity 4–5 incidents additionally get a **soft pulsing halo** — the "this needs attention now" cue.
- A selected incident gets a **white outline ring**.

### Resources / units (small circles, colored by status)
| Status | Color | Meaning |
|---|---|---|
| Available | 🩵 Cyan | Free and ready to dispatch |
| En route | 🟠 Amber | Moving toward an assigned incident |
| On scene | 🔵 Blue | Arrived and working the incident |
| Returning | ⚪ Gray | Heading back to base after completion |
| Offline | ⬛ Dark gray | Out of service (e.g. simulated failure) |

- A selected resource gets a **white outline ring**.
- An en-route unit's marker **animates along its real, road-snapped route** in sync with its actual ETA — it visually arrives exactly when the backend marks it `ON_SCENE`, not before or after.

### Hospitals
Small dark circles with a **blue ring** — capacity/load isn't shown as a separate marker but drives the "hospital available" check in Fay's scoring.

### Routes
- **Solid purple glowing line** — the real driving route from the responding unit to the selected incident (fetched from Mapbox Directions), animated in as it's computed.
- **Faint dashed gray line** — an alternate (non-recommended) route shown for comparison.

### Coverage halo
A faint **purple translucent circle** around every available unit — a rough visual sense of response coverage across the city.

## Fay panel — decision detail (right-hand floating panel)

When you select an incident in Live mode, Fay shows:
- **Recommends** — the top-ranked unit and its ETA, in a highlighted cyan pill.
- **Why** — the six scoring drivers behind that pick: Severity, Casualties, Wait time, Distance, Compatibility %, and Hospital availability.
- **Narrative** — a plain-English explanation (Gemini-polished if configured, otherwise the deterministic version).
- **Alternatives** — the next-best candidates, each showing its ETA delta vs. the recommendation.

Picking a non-recommended alternative is flagged as an **operator override** and shows the projected response-time impact (in green if it happens to be faster, amber if slower) before you confirm.

## Incident & resource status reference

**Incident status:** `UNASSIGNED` → `ASSIGNED` → `ON_SCENE` → `RESOLVED`

**Resource status:** `AVAILABLE` → `EN_ROUTE` → `ON_SCENE` → `RETURNING` → back to `AVAILABLE` (or `OFFLINE` if taken out of service)

**Incident types → best-matched resource(s):**
| Incident type | Best resource | Also usable (partial credit) |
|---|---|---|
| Medical | Ambulance | Rescue (60%), Police (30%) |
| Fire | Fire Engine | Rescue (50%) |
| Traffic Collision | Ambulance | Police (80%), Rescue (70%), Fire Engine (60%) |
| Structural | Rescue | Fire Engine (80%) |
| Hazmat | Hazmat unit | Fire Engine (40%) |
| Public Safety | Police | — |
| Mass Casualty | Ambulance | Rescue (70%), Fire Engine (50%) |

## Simulation scenarios (Simulate mode)

| Scenario | Effect |
|---|---|
| Normal Operations | Baseline steady state; clears any active disruption. |
| Mass Casualty Event | Spawns 10–12 simultaneous high-severity incidents near a random zone. |
| Resource Failure | Knocks up to 3 active units offline mid-response, unassigning their incidents. |
| Traffic Disruption | City-wide travel-time multiplier (1.9×) applied to all ETAs. |
| Hospital Overload | Fills 3 hospitals to capacity, blocking hospital-required dispatches near them. |
| Multiple Simultaneous Incidents | Spawns 5–6 mixed-type incidents across the city at once. |

Scenarios are seeded with a deterministic PRNG (mulberry32) so a demo replay is reproducible.

## Status bar metrics (bottom of top bar)

| Metric | Meaning |
|---|---|
| Active | Incidents not yet resolved |
| Critical | Incidents at severity ≥ 4 |
| Avg ETA | Mean response time across active, assigned incidents |
| Coverage | % of incidents currently served by a compatible unit |
| Available | Free units / total fleet size |

Coverage and Critical are color-coded: green = healthy, amber = watch, red = degraded.

## Architecture at a glance

```
app/                  Next.js App Router pages + API routes (dispatch, optimize, simulate, replay, auth)
components/
  map/                 Mapbox 3D scene + 2D schematic fallback, style layers, routing
  decision/            Fay's decision panel + explanation detail view
  incidents/           Incident/resource list drawer, quick-dispatch UI
  analytics/           Optimize-mode comparison panel (baseline vs. optimized)
  simulate/             Scenario trigger controls
  replay/                Event timeline
  shell/                Top bar, status bar, command bar, notifications, help
lib/
  domain/               Geo math, scoring, incident generation, lifecycle transitions
  optimization/         Hungarian algorithm + optimization engine
  llm/                    Gemini provider + deterministic fallback (explanations only, never decisions)
  server/                 Dispatch, auth, DB access, natural-language query handling
prisma/                 Postgres schema (Neon-compatible) + world seed data
```

**Tech stack:** Next.js 16, React 19, TypeScript, Prisma + PostgreSQL (Neon), Mapbox GL JS, Tailwind CSS, Framer Motion, Recharts, Google Gemini (optional), Vitest.

## Running it

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with any name (identity only — no password; used to attribute dispatch actions to an operator).

`DATABASE_URL` (any Postgres connection string — [Neon](https://neon.tech) works well) is required. Two more are optional — see [`.env.example`](.env.example):
- `NEXT_PUBLIC_MAPBOX_TOKEN` — powers the 3D map; without it, Fay falls back to a 2D schematic map.
- `GEMINI_API_KEY` — polishes explanations into natural language; without it, Fay uses its deterministic explanation text.

Run the test suite (optimization engine, Hungarian solver, incident generator, lifecycle transitions, scoring):

```bash
npm test
```
