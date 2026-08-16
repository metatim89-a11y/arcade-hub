# Arcade Hub 3D Migration Recovery Notes

Last updated: 2026-08-15 UTC

## Goal

Convert every game's actual playable surface and pieces to interactive 3D. The existing `GameAtmosphere3D` is only ambient decoration and does not count as a completed game conversion.

## Already deployed before this work

- Ocean Hunter uses a real Three.js renderer in `components/games/oceanHunter3D.ts`.
- Phaser owns the Ocean Hunter game clock/lifecycle.
- A site-wide ambient Three.js layer and shared CSS motion effects exist.
- Deployed commit before this batch: `31c3867 Add 3D rendering and sitewide motion engine`.

## Current local work (not yet committed or pushed)

- Added `components/games/BoardGames3D.tsx`.
  - `TicTacToeBoard3D`: real lit board geometry, metallic X/O meshes, ray-cast cell picking, placement animation, hover lighting, win pulses.
  - `ConnectFourBoard3D`: modeled standing frame, sockets, feet, real disc meshes, ray-cast column picking, gravity/bounce drops, player hover color, win pulses.
- Replaced the flat Tic-Tac-Toe grid in `components/games/TicTacToeGame.tsx` with `TicTacToeBoard3D` while preserving the existing rules and CPU logic.
- Replaced the flat Connect Four board in `components/games/ConnectFourGame.tsx` with `ConnectFourBoard3D` while preserving rules and CPU logic. The winning board now stays visible at game over.
- Added `components/games/MancalaBoard3D.tsx` and connected it to `MancalaGame.tsx`.
  - Carved board, pits and stores are modeled geometry.
  - Stones are individual colored meshes driven by the existing pit counts.
  - Ray-cast pit selection, theme colors, highlighted destination and move-path lighting are active.
  - Existing sowing, capture, puzzle, timer and CPU rules remain in React.
- Production build passed after all three board conversions (`vite build`, 129 modules, completed in 2m 53s). Only the repository's existing large-chunk warnings remain.

## Second local batch

- Raised Tic-Tac-Toe and Mancala to high, near top-down cameras so the full boards read clearly; Connect Four remains upright.
- Added `components/games/CardGames3D.tsx`.
  - Blackjack now has a modeled felt table, rail and dealt 3D card meshes with generated face/back textures.
  - RPS Memory now has a ray-cast 4×4 board of thick 3D cards with hover lift and matched-card effects.
- Added `components/games/SlotsMachine3D.tsx` and connected it to `SlotsGame.tsx`.
  - Upright cabinet, metallic frame, cylindrical reels, generated symbol textures, physical spin rotation, bulbs, anticipation state and win glow are modeled in Three.js.
  - The existing weighted outcomes, paylines, wallet operations, free spins and Hold & Spin rules are unchanged.
- Production build passed for this batch (`vite build`, 131 modules). Existing chunk-size warnings only.

## Additional product requirement

- Applied Supabase migrations `20260815231952_grant_new_accounts_1000_rc` and then the user-requested correction `20260815232507_set_new_account_balances_1000_gc_5_rc` to production.
- Final registered-account defaults are 1000 GC (`fun_coins`) and 5 RC (`real_coins`). The existing `auth.users` trigger inserts a balance row without overriding either default.
- Verified both defaults remotely (`fun_coins = 1000`, `real_coins = 5`). Existing accounts were intentionally not modified.
- Guest wallets now initialize with 250 GC locally; each guest session gets its own storage key, and guest reset returns to 250 GC / 0 RC.

## Third local graphics batch

- Texas Hold'em now mirrors community cards, all four seats' hole cards and table bets as dealt 3D meshes on a modeled table. Existing seat/status controls remain above the scene.
- Ocean Hunter creature modeling was revised toward natural silhouettes and materials:
  - clear-coated marine skin instead of flat plastic materials;
  - dedicated shark, whale and segmented shrimp rigs;
  - smaller natural eyes, gills, belly shading, fins and articulated tails;
  - schooling cohesion/separation and predator pursuit added to randomized routes;
  - smooth direction turns replace instant model flips.
- Volt Vault Slots gained direct 3D cabinet interaction:
  - the lever and illuminated cabinet spin button can trigger a real spin;
  - cabinet lighting changes for base, Power Spin and Free Spin themes;
  - lever pull, disabled-button and anticipation feedback are state-driven.

## Fourth local graphics batch

- Added `components/games/CasinoBoards3D.tsx`.
- Plinko now mirrors its existing live physics into a vertical 3D cabinet with modeled rails, pegs, bucket blocks, moving ball meshes and collision lighting. Payout calculations remain unchanged.
- Keno's flat 80-button grid is replaced by a near top-down ray-cast 3D chip board. Selected, drawn and matched numbers use height, lighting and pulse state while preserving the existing draw and payout logic.

## Fifth graphics batch — build passed, ready to push

- Spin Wheel now uses an interactive Three.js wheel with extruded wedges, a modeled rim, hub, pins, labels and pointer. The existing result math remains authoritative and drives the 3D rotation.
- Ocean Hunter received another environment pass with procedural rocks, swaying plants and depth-aware creature pitch for less flat movement.
- Coin Pusher now mirrors the live Matter.js simulation into a Three.js shelf with modeled coins, pusher plate, rails, bumpers, aiming beam and prize tray. The existing physics and wallet rules remain authoritative.
- Volt Vault Slots received a deeper 3D animation pass:
  - symbols roll around cylindrical reel depth instead of rotating as one flat panel;
  - cabinet pillars, floor, axles and glass add physical depth;
  - pointer parallax, spin vibration, anticipation zoom and 3D win coins add state-driven motion;
  - misleading `93% RTP` copy was removed, and Power/Free Spin messaging now correctly matches the implemented 1.5× multiplier.
- Fixed the Keno phone regression: the camera now maintains all ten columns at narrow aspect ratios, uses a true top view with crisp number faces, and selects on pointer-down for reliable touch play.
- `GameArea` now supplies one shared page-aware surface palette to every game. Root game panels inherit the current gold/green/blue/purple mode or equipped cosmetic accent instead of presenting unrelated opaque backgrounds.
- Production build passed for this combined batch (`vite build`, 134 modules, 2m 39s). Existing large-chunk warnings only.

## Sixth repair batch — build passed, ready to push

- Fixed RPS Memory's computer-turn deadlock: CPU selections can now use the internal card handler while player taps remain locked during the CPU turn.
- RPS Memory now uses immediate touch selection and a responsive top camera that keeps the full 4×4 table visible on narrow phones.
- Mancala now synchronizes its authoritative pit ref after every individual sow/capture mutation, preventing rapid animation state from reading a stale pit layout.
- Mancala also uses immediate touch selection and responsive top framing so the long board and both stores remain visible on phones.
- Color Recall is now a real interactive Three.js game surface:
  - four raised physical color controls with ray-cast input;
  - modeled base, rim, hub and animated signal rings;
  - state-driven button travel, emissive flashes, hover lift, phase lighting and pointer parallax;
  - keyboard controls, sequence logic, timing, scoring, audio and best-score persistence remain intact.
- Production build passed (`vite build`, 135 modules, 2m 26s). Existing large-chunk warnings only.

## Seventh smoothness pass — in progress

- Added GPU-compositing and stable transition hints to the shared game surface, plus broader reduced-motion protection for table, card and seat effects.
- Converted Tic-Tac-Toe, Connect Four, Spin Wheel and Slots 3D interactions to immediate pointer-down input for cleaner phone response.
- Made Slots, Coin Pusher, Mancala, Keno, RPS Memory and Color Recall easing frame-rate independent so motion keeps the same character across 30/60/120 Hz screens.
- Coin Pusher now interpolates coin, pusher and aiming-beam positions between Matter.js frames instead of visibly stepping.
- Ocean Hunter quality pass:
  - frame-rate-independent creature position, heading, facing and depth-pitch easing;
  - smoothed bullets, hit particles and cannon aiming;
  - deterministic camera shake instead of per-frame random jitter;
  - parallax backdrop, drifting bubble field and underwater light shafts;
  - smoother plant movement and camera drift while retaining Phaser as the game clock.
- Keno number faces now use high-contrast camera-facing 3D labels so all 1–80 values remain readable across WebGL/device texture variations.
- Increased the available desktop footprint for Tic-Tac-Toe, Connect Four, Blackjack, RPS Memory and Keno while retaining phone-specific height limits.
- Reduced Spin Wheel from a 430px wheel/620px cabinet to a 360px wheel/560px cabinet, with a smaller 320px phone cap.
- Mancala pits/stores were rebuilt as dark recessed wells with raised metallic wood rims and player-side guide rails; stones now read as pieces sitting inside carved spaces instead of pucks stacked on the board.
- RPS Memory cards now have symbol-specific neon palettes, a premium patterned back, state-driven 3D flip animation, brighter edge materials and animated matched-card halos.

## Planned conversion order

1. Tic-Tac-Toe, Connect Four and Mancala board batch: complete and build-tested.
2. Convert card/table games: Blackjack, Texas Hold'em, RPS Cards.
3. Convert casino machines: Slots, Wheel, Keno, Plinko, Coin Pusher, Crash.
4. Convert remaining spatial games: Worm and Rubik's Cube; Ocean Hunter is already the first true 3D game.
5. Run production build and targeted interaction checks after each category.

## Important implementation rule

Do not mark a game converted merely because it has a 3D background or CSS perspective. Its actual game pieces/surface must be rendered in Three.js and remain connected to the existing React game state and controls.
