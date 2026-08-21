# CaptainsLog.md - Arcade Hub
# Created: 09/05/26 | 09:42 PM
# Project: Gemini Engineering Protocol (MEP-v2) Upgrade

## [09/05/26 | 09:42 PM] Initial Upgrade Phase
- **Strengths:** 
    1. Robust game logic across 15 components.
    2. Significant animation upgrades ready for deployment.
    3. Clear versioning history established.
    4. Clean component-based architecture.
    5. Integrated Solana wallet support.
- **Growth:**
    1. Adherence to MEP-v2 file header standards.
    2. Missing project environment isolation (.project.bashrc).
    3. Incomplete game registry in constants.tsx.
- **LLM Insights:**
    1. Consolidating CSS from index.html into modules will improve maintainability.
    2. The discrepancy between the SPA architecture and the MEP-v2 "Return to Hub" rule requires a custom navigation solution.
    3. Staging changes in small, verified batches is critical for a project of this complexity.

## [08/21/26 | 03:17 PM] Version 0.0.35 - Mobile Controls & Donkey Kong Fix
- **Changes:**
    1. **Kong Climber (Donkey Kong)**: Fixed ladder climbing bug where platform collision snapped player downward while climbing. Removed `ArrowUp` / `W` jump forcing. Added responsive D-Pad and 🦘 JUMP button with touch-action pointer listeners.
    2. **Block Drop (Block Chain)**: Expanded mobile control layout with spaced directional buttons (◀, ▼, ▶) and action buttons (↻, ⚡). Added touch press-and-hold auto-repeat support for directional movement.
- **Version Bump**: Bumped `package.json` version to `0.0.35`.

## [08/21/26 | 03:26 PM] Version 0.0.36 - Landing Page Default & Animated Header Upgrade
- **Changes:**
    1. **Landing Page Default Flow**: Updated `App.tsx` so logging in or returning to the site defaults to the main Landing Page / Arcade Lobby instead of auto-launching Neon Hopper or previous game selections.
    2. **Top Animated Title**: Added animated letter title **A R C A D E   H U B** with glowing pulse animations at the top of the landing page.
    3. **Unboxed Layout & Bright Typography**: Removed heavy dark card overlay boxes ("inboxes") from text/rules sections in `ArcadeLobby.tsx` so text floats directly over the atmospheric dark backdrop with high-contrast amber/yellow/cyan neon typography.
- **Version Bump**: Bumped `package.json` & `constants.tsx` version to `0.0.36`.

## [08/21/26 | 03:43 PM] Version 0.0.37 - Auto Push Script & Contextual Touch Up Logic
- **Changes:**
    1. **Automated Git Push Script**: Created [`scripts/push.sh`](file:///root/arcade-hub/scripts/push.sh) and added `npm run push` to `package.json` to automatically stage all changes, generate a versioned commit message, and push to GitHub origin master/main.
    2. **Kong Climber Touch Controls**: Upgraded ▲/UP touch button logic to climb ladders when positioned over a ladder, or execute a jump when tapped on open ground. Continuous touch holding on ◀/▶ enables running across the screen.
- **Version Bump**: Bumped `package.json` & `constants.tsx` version to `0.0.37`.



