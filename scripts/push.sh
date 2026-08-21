#!/usr/bin/env bash
# Automated Git Stage, Commit, Pull, and Push Script for Arcade Hub
set -e

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$repo_root"

VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "v0.0.x")
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "master")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "==============================================="
echo " Arcade Hub Auto Sync Script"
echo " Version:  $VERSION"
echo " Branch:   $CURRENT_BRANCH"
echo " Time:     $TIMESTAMP"
echo "==============================================="

echo "1. Staging all changes..."
git add -A

if git diff --staged --quiet; then
    echo "No local changes to commit."
else
    COMMIT_MSG="release: $VERSION - $TIMESTAMP updates"
    echo "2. Committing changes: '$COMMIT_MSG'..."
    git commit -m "$COMMIT_MSG"
fi

echo "3. Fetching and rebasing from origin $CURRENT_BRANCH..."
git pull --rebase origin "$CURRENT_BRANCH" || git rebase --abort

echo "4. Pushing to origin $CURRENT_BRANCH..."
git push origin "$CURRENT_BRANCH"

echo "==============================================="
echo " Successfully pushed version $VERSION to $CURRENT_BRANCH!"
echo "==============================================="
