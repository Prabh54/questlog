#!/usr/bin/env python3
"""Prints the k6 results in bench/out as tables (and before/after comparison).

    python3 bench/report.py before            # one run
    python3 bench/report.py before after      # comparison
"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).parent / "out"
ENDPOINTS = [
    "dashboard_summary", "completions_30d", "completions_365d", "entries_feed", "me",
    "streaks", "xp_30d", "categories_breakdown", "quests_list", "quest_detail",
]
PAGES = ["dashboard", "analytics", "quests", "quest_detail"]


def load(label, pool):
    data = json.loads((OUT / f"{label}-{pool}.json").read_text())["metrics"]

    def trend(key):
        v = data.get(key, {}).get("values")
        return None if not v else (v["med"], v["p(95)"], v["p(99)"])

    return {
        "endpoints": {e: trend(f"http_req_duration{{endpoint:{e}}}") for e in ENDPOINTS},
        "pages": {p: trend(f"page_duration{{page:{p}}}") for p in PAGES},
        "rps": data["http_reqs"]["values"]["rate"],
        "pages_per_s": data["iterations"]["values"]["rate"],
        "failed": data["http_req_failed"]["values"]["rate"],
    }


def ms(x):
    return "—" if x is None else (f"{x:,.0f}" if x >= 10 else f"{x:.1f}")


def table(title, rows, labels, runs):
    print(f"\n{title}")
    head = "| " + " | ".join(["", *[f"{l} p50 / p95 (ms)" for l in labels]]) + " |"
    print(head)
    print("|" + "---|" * (len(labels) + 1))
    for row in rows:
        cells = []
        for run in runs:
            t = run[row]
            cells.append("—" if t is None else f"{ms(t[0])} / {ms(t[1])}")
        if len(runs) == 2 and runs[0][row] and runs[1][row]:
            cells[-1] += f"  (p95 {runs[0][row][1] / runs[1][row][1]:.1f}× faster)"
        print(f"| `{row}` | " + " | ".join(cells) + " |")


def main(labels):
    for pool in ["power", "mixed"]:
        runs = [load(label, pool) for label in labels]
        who = "power users (≈8.5k completions each)" if pool == "power" else "mixed (95% casual, 5% power)"
        print(f"\n### {who}")
        table("Page load (all of a page's API calls, in parallel)", PAGES, labels, [r["pages"] for r in runs])
        table("Per endpoint", ENDPOINTS, labels, [r["endpoints"] for r in runs])
        print()
        for label, r in zip(labels, runs):
            print(f"- **{label}:** {r['rps']:,.0f} requests/s, {r['pages_per_s']:,.1f} page loads/s, "
                  f"{r['failed'] * 100:.2f}% failed")


if __name__ == "__main__":
    main(sys.argv[1:] or ["before"])
