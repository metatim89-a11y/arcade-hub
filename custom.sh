#!/usr/bin/env bash

set -u
set -o pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd) || exit 1
cd "$project_root" || exit 1

show_help() {
  cat <<'EOF'
Arcade Hub project commands

Usage: bash custom.sh COMMAND [OPTIONS]

Commands:
  help                  Show this command list
  start                 Run the Vite development server
  build                 Build the production site
  preview               Preview the production build
  install               Install/update npm dependencies
  repo-check [OPTIONS]  Compare local files and commits with GitHub
  repo-status           Show the complete Git working-tree status
  repo-diff [OPTIONS]   Show local content changes

Examples:
  bash custom.sh start
  bash custom.sh repo-check
  bash custom.sh repo-check --no-fetch
EOF
}

command_name=${1:-help}
if (($#)); then
  shift
fi

case "$command_name" in
  help|-h|--help)
    show_help
    ;;
  start)
    exec npm run dev -- "$@"
    ;;
  build)
    exec npm run build -- "$@"
    ;;
  preview)
    exec npm run preview -- "$@"
    ;;
  install)
    exec npm install "$@"
    ;;
  repo-check)
    exec bash "$project_root/scripts/check-repo-sync.sh" "$@"
    ;;
  repo-status)
    exec git status "$@"
    ;;
  repo-diff)
    exec git diff "$@"
    ;;
  *)
    echo "Error: unknown command '$command_name'." >&2
    echo >&2
    show_help >&2
    exit 2
    ;;
esac
