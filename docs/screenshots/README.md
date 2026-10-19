# Screenshots

The root `README.md` links to the files below. Drop the captures in this folder using exactly these
names and the table there will render them.

| File | What to capture |
| --- | --- |
| `landing.png` | The landing hero with the animated rating graph and floating code snippets |
| `problems.png` | `/problems` with a few topics selected, the rating slider moved, and solved marks visible (link a Codeforces handle first) |
| `dashboard.png` | `/profile` showing the stat tiles, combined heatmap and the topic radar |
| `practice.png` | `/practice` with the weak-topic panel on the right and the "why this?" lines on the cards |
| `contests.png` | `/contests` in **Month** view, so the platform colour coding is obvious |
| `share-card.png` | `/u/your-username` with the theme chips visible — ideally a composite of all four themes |
| `stale-badge.png` | Any page showing the amber "Last updated Xh ago" badge |

## Capturing the stale badge

The badge only appears when a live fetch fails and a snapshot exists, so force it deliberately:

1. Load your dashboard once while online, so snapshots are written.
2. Go offline (or temporarily set `LEETCODE_GRAPHQL_URL` in `server/.env` to an unreachable URL and
   restart the API).
3. Clear the in-memory cache by restarting the API, then reload the dashboard.

The page keeps rendering from the snapshot and the badge appears next to the affected platform — which
is the point worth showing in a demo.

## Tips

- Capture at a 1440px-wide window; the layout is widest and most readable there.
- Take one set in dark mode (the default) and, if you have room in the report, one in light mode.
- `npm run seed --workspace=server` gives you enough problems for the browser to look populated
  without needing network access.
