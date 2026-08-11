# Termux project control: arcade-hub

This directory contains local shell context for this Git repository. Entering the repository loads `termux.sh`; leaving it unloads only state registered through the project helpers. No command runs automatically.

## Project summary

- **Purpose:** AI Studio arcade application with browser games and Solana-aware UI components.
- **Stack:** React, TypeScript, Vite, Solana
- **GitHub/origin:** `git@github.com:metatim89-a11y/arcade-hub.git`
- **Ports:** 3000 (explicitly configured by `vite.config.ts`)

## How to start

From the repository root, run:

```bash
npm run dev
```

Install dependencies separately with `npm install` only when needed; entering the repository never installs or starts anything.

## Process commands

| Action | Documented command |
|---|---|
| Start | `npm run dev` |
| Stop | `Not documented` |
| Status | `git status` (repository state) |

## Project-context commands

| Shell command | Underlying command |
|---|---|
| `pull` | `git pull --ff-only` |
| `push` | `git push` |
| `status` | `git status` |
| `start` | `npm run dev` |
| `install` | `npm install` |

## Unresolved setup notes

The repository does not document a stop command or test command. Stop the foreground Vite process from its terminal if needed; no `stop` alias is defined.

## Local state

`.last_opened` is updated whenever this context is entered. It is excluded through this repository's local Git exclude file and must not be committed.
