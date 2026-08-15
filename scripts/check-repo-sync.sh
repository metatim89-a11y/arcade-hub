#!/usr/bin/env bash

set -u
set -o pipefail

usage() {
  cat <<'EOF'
Usage: scripts/check-repo-sync.sh [--remote NAME] [--branch NAME] [--no-fetch]

Fetches the Git remote, compares it with this checkout, reports commit and file
differences, and asks before performing a synchronization action.

Options:
  --remote NAME  Remote to compare (default: origin)
  --branch NAME  Remote branch to compare (default: current branch)
  --no-fetch     Use existing remote-tracking data without fetching
  -h, --help     Show this help
EOF
}

remote="origin"
branch=""
fetch_remote=true

while (($#)); do
  case "$1" in
    --remote)
      [[ $# -ge 2 ]] || { echo "Error: --remote needs a name." >&2; exit 2; }
      remote=$2
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || { echo "Error: --branch needs a name." >&2; exit 2; }
      branch=$2
      shift 2
      ;;
    --no-fetch)
      fetch_remote=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: run this from inside a Git working tree." >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel) || exit 1
cd "$repo_root" || exit 1

current_branch=$(git symbolic-ref --quiet --short HEAD) || {
  echo "Error: detached HEAD is not supported; check out a branch first." >&2
  exit 1
}
[[ -n "$branch" ]] || branch=$current_branch

git remote get-url "$remote" >/dev/null 2>&1 || {
  echo "Error: remote '$remote' does not exist." >&2
  echo "Available remotes: $(git remote | tr '\n' ' ')" >&2
  exit 1
}

target="$remote/$branch"

echo "Repository: $repo_root"
echo "Local:      $current_branch"
echo "Remote:     $target ($(git remote get-url "$remote"))"

if [[ "$fetch_remote" == true ]]; then
  echo
  echo "Fetching the latest remote information..."
  if ! git fetch --prune "$remote"; then
    echo "Error: fetch failed; no synchronization action was taken." >&2
    exit 1
  fi
else
  echo "Fetch:      skipped (remote-tracking data may be stale)"
fi

git rev-parse --verify --quiet "$target^{commit}" >/dev/null || {
  echo "Error: remote branch '$target' was not found." >&2
  exit 1
}

read -r behind ahead < <(git rev-list --left-right --count "$target...HEAD")
local_commit=$(git rev-parse --short HEAD)
remote_commit=$(git rev-parse --short "$target")
local_date=$(git log -1 --format=%cI HEAD)
remote_date=$(git log -1 --format=%cI "$target")

echo
echo "Commit comparison"
echo "  Local:  $local_commit  $local_date"
echo "  Remote: $remote_commit  $remote_date"
echo "  Ahead by $ahead commit(s); behind by $behind commit(s)."

if ((ahead == 0 && behind == 0)); then
  echo "  Result: local and remote point to the same commit."
elif ((ahead > 0 && behind == 0)); then
  echo "  Result: local is newer in Git history."
elif ((ahead == 0 && behind > 0)); then
  echo "  Result: remote is newer in Git history."
else
  echo "  Result: histories have diverged; neither side is simply newer."
  if [[ "$local_date" > "$remote_date" ]]; then
    echo "  The local tip has the later timestamp, but both sides contain unique work."
  elif [[ "$remote_date" > "$local_date" ]]; then
    echo "  The remote tip has the later timestamp, but both sides contain unique work."
  fi
fi

diff_file=$(mktemp "${TMPDIR:-/tmp}/repo-sync-diff.XXXXXX") || exit 1
untracked_file=$(mktemp "${TMPDIR:-/tmp}/repo-sync-untracked.XXXXXX") || {
  rm -f "$diff_file"
  exit 1
}
trap 'rm -f "$diff_file" "$untracked_file"' EXIT

git diff --name-status --find-renames "$target" -- >"$diff_file"
git ls-files --others --exclude-standard >"$untracked_file"

echo
echo "File comparison (remote snapshot -> local working tree)"
if [[ ! -s "$diff_file" && ! -s "$untracked_file" ]]; then
  echo "  All version-controlled files have the same content."
else
  if [[ -s "$diff_file" ]]; then
    while IFS=$'\t' read -r status path remainder; do
      case "$status" in
        A) label="local only" ;;
        D) label="remote only" ;;
        M) label="different" ;;
        R*) label="renamed" ;;
        C*) label="copied" ;;
        T) label="type changed" ;;
        U) label="unmerged" ;;
        *) label="changed" ;;
      esac
      if [[ -n "${remainder:-}" ]]; then
        printf '  %-12s %s -> %s\n' "$label" "$path" "$remainder"
      else
        printf '  %-12s %s\n' "$label" "$path"
      fi
    done <"$diff_file"
  fi
  if [[ -s "$untracked_file" ]]; then
    while IFS= read -r path; do
      printf '  %-12s %s (untracked)\n' "local only" "$path"
    done <"$untracked_file"
  fi
fi
echo "  Ignored files (such as node_modules and local secrets) are not compared."

working_tree_dirty=false
[[ -n "$(git status --porcelain)" ]] && working_tree_dirty=true

confirm() {
  local answer
  printf '%s [y/N] ' "$1"
  read -r answer
  [[ "$answer" =~ ^([yY]|[yY][eE][sS])$ ]]
}

echo
if [[ "$working_tree_dirty" == true ]]; then
  echo "Recommended next step: review and commit, stash, move, or ignore the local-only/changed files."
  echo "No pull, push, rebase, or merge is offered while the working tree has changes."
  exit 3
fi

if ((ahead == 0 && behind == 0)); then
  echo "No synchronization is needed."
elif ((ahead == 0 && behind > 0)); then
  if confirm "Fast-forward local '$current_branch' to '$target' now?"; then
    git merge --ff-only "$target"
  else
    echo "No changes made."
  fi
elif ((ahead > 0 && behind == 0)); then
  if confirm "Push local '$current_branch' to '$remote/$branch' now?"; then
    git push "$remote" "HEAD:$branch"
  else
    echo "No changes made."
  fi
else
  echo "Choose how to combine the diverged histories:"
  echo "  1) Rebase local commits onto $target"
  echo "  2) Merge $target into $current_branch"
  echo "  3) Make no changes"
  printf 'Choice [3]: '
  read -r choice
  case "$choice" in
    1) confirm "Run 'git rebase $target'?" && git rebase "$target" || echo "No changes made." ;;
    2) confirm "Run 'git merge $target'?" && git merge "$target" || echo "No changes made." ;;
    *) echo "No changes made." ;;
  esac
fi
