# Arcade Hub Changelog

This changelog starts with v0.0.35. Earlier history remains available in the Git commit and pull-request history.

## v0.0.40 - 2026-08-23

### Added
- Made Arcade Lobby the public landing page with guest game launch support.
- Added shared keyboard navigation for game controls.
- Added Arcade Mission Control metrics and automatic admin dashboard refresh.

### Changed
- Replaced Coin Pusher with Whack Attack 3D in active game listings, rewards, and visual theming.
- Updated mobile E2E coverage for all current games.

### Fixed
- Fixed Free GC countdown interval cleanup.
- Fixed admin panel layering, mobile sizing, and Escape/backdrop closing.

## v0.0.36 - 2026-08-21

### Fixed
- Fixed Kong Climber mobile movement so holding left/right now continuously moves the player instead of being reset to zero by the animation loop.
- Added continuous touch-state handling for ladder up/down controls.
- Switched Kong's mobile D-pad to pointer controls so touch, stylus and compatible pointer input use the same hold/release behavior.
- Added movement bounds so the Kong player cannot run completely off the canvas.
- Fixed Neon Hopper water-carried movement so the player is rounded back onto the game grid before the next hop.

### Changed
- Merged the secure admin ticket-control work into master.
- Admin player management can show and set ticket balances through authenticated server RPCs.
- Ticket-shop redemptions now use the server-backed atomic redemption flow.
- Removed the simulated crypto-payment reward path that could award virtual balances from a fake confirmation action.
- Bumped the visible Arcade Hub version from v0.0.35 to v0.0.36.

## v0.0.35 - 2026-08-21

### Changed
- Increased Peg Plinko's visual depth with larger spherical 3D balls.
- Added stronger clearcoat highlights and more dimensional ball materials.
- Raised balls farther off the backboard so their height is visible during drops.
- Added soft contact shadows beneath moving balls.
- Thickened Plinko pegs and made them protrude farther from the cabinet.
- Added metallic peg highlights, casting/receiving shadows, and stronger hit glow response.
- Deepened the cabinet backboard, rails, buckets, and divider geometry.
- Added soft shadow mapping, fill and rim lighting, tone mapping, and a slight cabinet perspective.
- Kept existing Plinko gameplay physics and payout values unchanged.
- Bumped the visible Arcade Hub version from v0.0.34 to v0.0.35.

### Process
- New feature work should include a version bump when appropriate and a matching changelog entry before merge.
