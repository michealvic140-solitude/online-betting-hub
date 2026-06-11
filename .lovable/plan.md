# Knockout Bracket Tournament System

A clean plan before I touch code so we don't go sideways again. Reply "go" to build it.

## 1. Storage bucket fix (immediate)

The "Bucket not found" error you see when uploading event images means the `event-banners` bucket was never created. I'll:

- Create the `event-banners` bucket (public).
- Create a `bracket-emblems` bucket (public) for tournament participant logos.
- Add RLS policies so admins can upload, everyone can read.

## 2. New database tables

```text
tournaments              -> id, name, banner_url, tagline, size (8/16/26/32), status, starts_at
tournament_participants  -> id, tournament_id, player_id, team_id, display_name, emblem_url, seed
tournament_matches       -> id, tournament_id, round (opening/r16/qf/sf/final),
                            slot_index, code (M1, R16-1, QF1...),
                            participant_a_id, participant_b_id,
                            score_a, score_b, winner_id, loser_id,
                            status (pending/qualified/disqualified), played_at
```

When a match is marked qualified: winner is auto-cloned into the correct next-round slot. When marked disqualified: loser is set, participant is removed from advancement.

## 3. Admin: Tournament Bracket panel

New "Bracket" tab in admin console with **labeled columns** (no numbers as headers):

| Column label | What you enter |
|---|---|
| MATCH CODE | Auto (M1, R16-1, QF1…) |
| SHOOTER A | Pick from seeded shooters |
| SHOOTER B | Pick from seeded shooters |
| KILLS — SHOOTER A | Single number (their kills) |
| KILLS — SHOOTER B | Single number (their kills) |
| RESULT | Buttons: **Mark Qualified** / **Mark Disqualified** |
| LOST TO | Auto-filled when disqualified |

Confirmation dialog before Qualified / Disqualified (you reported the buttons not working — I'll wire them with confirm + toast + error surfacing so it's obvious when it succeeds or fails).

When a winner is marked: their slot in the next round is filled automatically and bracket re-renders live.

## 4. User-facing bracket page

New route `/tournament/$id` and a homepage card linking to it:

- Exact visual layout from your screenshot: 5 columns (Opening / R16 / QF / SF / Final), gold accents, glassmorphism cards, trophy + "CHAMPION" on the right.
- **Fits the viewport** — no scroll. Uses CSS scale-to-fit so the whole bracket renders at one zoom level regardless of device.
- Each cell shows: shooter name, gang tag (if any), kills, win/loss badge, who they lost to (e.g. "Lost to UNCLE RISOTTO · 12-8").
- Tournament format strip at the bottom matching the screenshot.

## 5. Ticket / voucher progress tree

When a user has a futures bet on a tournament participant, their ticket page (`/ticket/$id`) shows a "PAR ROUND PROGRESS" tree:

- ROUND OF 26 → ROUND OF 16 → QUARTERFINALS → SEMIFINALS → FINAL → CHAMPION
- Each node labeled with: round name, opponent, kills score, status (Qualified / Lost to X / Pending).
- Updates in realtime via Supabase channel as admin marks results.

## 6. Realtime updates

Subscribe to `tournament_matches` on both the bracket page and ticket page so scores flow instantly without refresh.

## 7. Betting integration

Existing futures betting (Tournament Champion, Reach Semifinals) keeps working. When a participant is disqualified, futures selections on that participant auto-mark as "lost" on user tickets.

## Out of scope (tell me if you want these too)

- Knockout for **gangs** (this plan is shooters-only per your earlier choice).
- Bracket reseeding mid-tournament.
- Public bracket image export.

---

Reply **"go"** and I'll build it end-to-end in one pass: storage bucket, migration, admin panel, public bracket page, ticket progress tree, realtime, and the column labels you asked for.
