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

## Planned conversion order

1. Tic-Tac-Toe, Connect Four and Mancala board batch: complete and build-tested.
2. Convert card/table games: Blackjack, Texas Hold'em, RPS Cards.
3. Convert casino machines: Slots, Wheel, Keno, Plinko, Coin Pusher, Crash.
4. Convert remaining spatial games: Worm and Rubik's Cube; Ocean Hunter is already the first true 3D game.
5. Run production build and targeted interaction checks after each category.

## Important implementation rule

Do not mark a game converted merely because it has a 3D background or CSS perspective. Its actual game pieces/surface must be rendered in Three.js and remain connected to the existing React game state and controls.
