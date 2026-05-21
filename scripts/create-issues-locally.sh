#!/usr/bin/env bash
# Run after: gh auth login
set -euo pipefail

gh issue create --repo Prabh54/questlog --title "Polish mobile dashboard spacing" \
  --body "Improve stat card and heatmap layout on small screens." --label enhancement

gh issue create --repo Prabh54/questlog --title "Add quest export to CSV" \
  --body "Allow users to export completed quests and XP history from the profile page." --label enhancement

gh issue create --repo Prabh54/questlog --title "Improve demo account onboarding copy" \
  --body "Clarify demo credentials and first-login hints on the login and landing pages." --label enhancement

echo "Done. Check https://github.com/Prabh54/questlog/issues"
