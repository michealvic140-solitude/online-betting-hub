The request spans backend schema, match-creation flow, leaderboard structure, admin console layout, theming, and clan management. `src/routes/admin.tsx` is 4,100 lines, so I'll batch the work to keep each step verifiable.

## Batch 1 — Theme + Admin Console layout (visual fixes first)

- Add thick dark-green background tokens to `src/styles.css` (apply app-wide), and place the LSL logo as a large, faintly-visible centered watermark on the root layout.
- Force the Admin Console page to a fixed desktop width on mobile (wrap the page in a `min-width:1280px` container so phones get a horizontally-scrollable desktop view — matches your screenshot literally).
- Re-flow the dashboard grid to match the screenshot:
  - Row: Recent Activity (wider) | (Live Gang Wars stacked over Event Countdown) | Highlights Hub (wider).
  - Row below: Broadcast Center | Quick Actions | Top Bets.
  - Tile row aligned in a single 6-up strip: Virtual / Battle / Challenges / Referrals / Users / Clans.
- Generate missing tile artwork (Virtual, Battle, Challenges, Users, Clans) via `imagegen` so all six tiles have hero images.

## Batch 2 — Clan admin: shooter seeding (gang optional) + delete teams/gangs

- Make `teams.tag`/clan tag nullable for shooters; update the ClansAdminPanel seed form so the Gang/Faction tag is optional.
- Add a delete action on each team/gang/faction row in `ClansAdminPanel`, with a confirm dialog. Wire to a `delete_team` server fn (admin-gated).

## Batch 3 — Shooter Match creation + leaderboard columns

- New "Shooter Match" tab in the admin match-creation UI: 1v1 between two seeded shooters (sourced from `players`/teams in the clan panel), with odds and a "post for marketing" toggle. Reuses existing `matches`/`odds` tables with a `match_kind = 'shooter'` discriminator.
- Update the Shooters Leaderboard table on the public leaderboard route to columns: `RANK | GANG & FACTION | PLAYER | W | L | D | P | PTS`. Gang/Faction is the shooter's current `team.tag` (or "—" if none). Sorted by PTS desc.

## Batch 4 — Top Bets ranking (total points)

- Top Bets panel ranks shooters by their total leaderboard points (same source feeding the leaderboard PTS column). Removes the "computed from bets" logic if any and queries the points view/aggregate directly.

## Technical notes

- DB: one migration to (a) make `teams.tag` nullable, (b) add `matches.match_kind` text column defaulting to 'gang', (c) add an admin-only `delete_team(_team_id uuid)` SECURITY DEFINER function with audit log entry.
- Watermark: a fixed `<div>` on `__root.tsx` with the logo at ~6% opacity, `pointer-events:none`, behind all content.
- Mobile-as-desktop: the Admin route gets `<div className="min-w-[1280px]">…</div>` plus a top-level `overflow-x-auto` wrapper.
- Image generation: 5 tile images (Battle, Challenges, Virtual, Users, Clans) at 1024x576 to match existing tile sizing.

Total scope is large but each batch is independently testable. I'll start with Batch 1 (theme + layout) since that's the most visible.

Reply "go" to start, or tell me to reorder/drop any batch.