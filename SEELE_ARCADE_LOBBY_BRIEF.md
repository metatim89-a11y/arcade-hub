# Arcade Hub lobby graphics brief for SEELE

## Objective

Redesign and implement the authenticated Arcade Hub **lobby/home page** so it feels like a polished, premium browser arcade while preserving the existing application, navigation, authentication, game logic, and responsive behavior.

The primary implementation target is `components/ArcadeLobby.tsx`. You may make small, necessary visual changes to `components/Header.tsx`, `components/Footer.tsx`, and the global styles in `index.html`, but do not redesign unrelated screens or rewrite the application.

## Product and technical context

- Stack: React 19, TypeScript, Vite, Tailwind CSS via CDN, Three.js, Phaser, and Supabase.
- Target: browser, responsive from 360 px phones through desktop.
- Deployment base path: `/arcade-hub/` on GitHub Pages.
- The lobby has two modes: Under 18 and Casino (18+).
- The actual games already use Three.js/Phaser. Do not modify their rules, odds, wallet behavior, controls, or rendering.
- The app must continue to build with `npm ci` and `npm run build`.

## Current lobby structure to preserve

- Featured hero with game title, description, and `PLAY NOW` action.
- “Arcade Originals” game-card grid.
- Daily Challenge callout.
- Existing mode-specific game arrays and click handlers.
- Existing header functions: home, profile, shop, support, logout, wallet display, and Under 18/Casino mode selection.
- Existing legal notice and the clear distinction between virtual coins/RC and real money.

## Visual direction

Create a cohesive “neon boardwalk arcade after dark” identity: deep navy/ink background, electric cyan and violet atmosphere, warm amber/gold actions, dimensional glass/metal panels, soft bloom, subtle grain, and tasteful depth. It should feel playful and premium, not like a casino template and not like a generic AI landing page.

Replace the current oversized emoji artwork with original, coherent game key art or lightweight illustrated/3D-rendered thumbnails for each visible game. Every card must have a clear focal subject, readable title, strong contrast, consistent composition, and a visual identity related to its game. Do not use copyrighted characters, logos, or recognizable franchise art.

Use restrained motion: card lift/tilt, light sweep, ambient particles, and hero parallax only where they improve clarity. Respect `prefers-reduced-motion`.

## Required game identities

Under 18:

- Nim — luminous strategy tokens/stacks.
- Chutes & Ladders — colorful climb-and-slide board.
- Block Drop — neon falling blocks.
- Connect Four — red/yellow discs in a dimensional blue frame.
- Color Recall — four glowing color controls.
- Mancala — carved wooden board with jewel-like stones.
- RPS Cards — premium neon symbol cards.
- Tic Tac Toe — metallic X/O board.

Casino (18+), still clearly virtual-play only:

- Spin Wheel — jewel-toned prize wheel.
- Crash — rocket and rising flight trail.
- Blackjack — cinematic felt table and cards.
- Hold'em — poker table and chips.
- Keno — glowing numbered chip board.
- Plinko — luminous pegs and falling ball.
- Slots — premium five-reel cabinet.
- Ocean Hunter — underwater creature hunt.
- Coin Pusher — coins on a mechanical shelf.

## UX and responsive requirements

- Preserve semantic buttons, keyboard focus states, and readable text contrast.
- Do not put essential text inside generated images.
- Desktop hero should remain impressive without pushing the first row below the fold on a typical laptop.
- On 360–430 px phones, keep the hero action and at least the start of game discovery visible quickly. Avoid horizontal page overflow.
- Use CSS `clamp()`, responsive grids, and stable aspect ratios to avoid layout shift.
- Keep touch targets at least 44 px where practical.
- Make the active mode and primary action unmistakable.

## Performance constraints

- Do not add a new always-running Three.js/WebGL lobby scene. The games already use WebGL and mobile performance matters.
- Prefer optimized AVIF/WebP artwork with CSS effects. Use SVG only for simple original interface decoration.
- Aim for no more than 800 KB for featured hero artwork and 200 KB per card thumbnail; lazy-load noncritical card art.
- Do not add autoplay video, large font packages, trackers, or a heavy UI framework.
- Keep generated assets under `public/assets/lobby/` with descriptive lowercase filenames.

## Hard boundaries

- Do not change Supabase code, database migrations, authentication, analytics, wallet balances, currency labels, game math, payouts, game IDs, or game component behavior.
- Do not remove the virtual-play/tournament legal notice.
- Do not expose or request secret keys. The supplied `.env.example` contains placeholders only.
- Do not replace the project with a static mockup or a different framework.
- Do not break the `/arcade-hub/` Vite base path.
- Do not add copyrighted or trademarked game/franchise artwork.

## Deliverables

1. Implement the redesigned lobby in the supplied React/Vite project.
2. Put all new visual assets in `public/assets/lobby/`.
3. Return the complete modified project, not screenshots alone.
4. Include a short change log naming every changed file and asset.
5. Verify `npm run build` succeeds.
6. Check the lobby at 390×844, 768×1024, and 1440×900 in both Under 18 and Casino modes.
7. Confirm Play Now, every game card, home navigation, mode switching, profile, shop, support, logout, and legal copy still work.

## First-pass priority

Start with the Under 18 lobby and establish the reusable art/card system. Show a working preview before expanding the same system to Casino mode. If a design decision is uncertain, preserve the current behavior and ask before changing product scope.
