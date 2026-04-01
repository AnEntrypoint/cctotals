# cctotals

📊 Analyze and visualize your Claude Code token usage with beautiful weekly graphs in the terminal.

## Quick Start

```bash
bun x cctotals
# or
npx cctotals
```

## Features

- 📈 Weekly token totals bar chart
- 🤖 Breakdown by model (Sonnet, Haiku, etc.)
- 🎨 Colorful terminal output
- 📊 Statistics: total, average, per-week data

## Installation

```bash
npm install -g cctotals
```

## Usage

```bash
cctotals
```

### Output Example

```
══════════════════════════════════════════════════════════════════════
  WEEKLY TOKEN USAGE GRAPH
══════════════════════════════════════════════════════════════════════

  Week Start    | Tokens (scaled)
────────────┼────────────────────────────────────────────────────────────
  2026-02-23  │███████████████████████████████████████████████████████████  2,382,993
  2026-03-02  │█                                                          15,378
────────────┼────────────────────────────────────────────────────────────

  Total:  2,398,371 tokens across 2 weeks
  Average:  1,199,186 tokens/week

══════════════════════════════════════════════════════════════════════

  DETAILED BREAKDOWN BY MODEL
──────────────────────────────────────────────────
  claude-sonnet-4-6                    1,327,999 (55.4%)
  claude-haiku-4-5-20251001            1,070,372 (44.6%)
```

## How It Works

Reads from Claude Code's telemetry data at `~/.claude/stats-cache.json` and aggregates token usage by week.

## Requirements

- Node.js 18+ or Bun
- Claude Code with telemetry enabled

## License

MIT
