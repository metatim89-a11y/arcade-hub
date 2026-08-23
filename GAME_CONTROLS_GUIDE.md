# Game Controls Integration Guide

All games should support **keyboard**, **gamepad**, and **touch/pointer** controls using the universal `useGameControls` hook.

## Quick Start

### Basic Usage in Your Game

```typescript
import { useGameControls, useGameDirection, useGameAction } from '../../lib/useGameControls';

interface MyGameProps {
  h2hMode?: boolean;
  onScoreUpdate?: (score: number) => void;
}

const MyGame: React.FC<MyGameProps> = ({ h2hMode, onScoreUpdate }) => {
  const controls = useGameControls();
  const direction = useGameDirection(controls);
  const jumpAction = useGameAction(controls, 'jump');
  
  // Use in your game logic:
  useEffect(() => {
    // Direction input
    if (direction.x !== 0 || direction.y !== 0) {
      movePlayer(direction.x, direction.y);
    }
    
    // Action inputs
    if (jumpAction.justPressed) {
      performJump();
    }
    
    if (controls.shoot) {
      fireWeapon();
    }
  }, [direction, jumpAction, controls]);
  
  return <div>Game UI</div>;
};
```

## Control Mapping

### Keyboard Controls
- **Movement**: Arrow Keys or WASD or Numpad (8/2/4/6)
- **Jump**: Spacebar
- **Action/Select**: Enter
- **Interact**: E
- **Shoot**: Ctrl
- **Menu**: Esc
- **Back**: Backspace

### Gamepad Controls (Standard Layout)
- **D-Pad**: Movement
- **Left Stick**: Analog Movement
- **A / Cross**: Action
- **B / Circle**: Back
- **X / Square**: Shoot
- **Y / Triangle**: Jump
- **LB**: Trigger Left
- **RB**: Trigger Right
- **Start**: Menu
- **Back**: Back
- **Guide**: Menu

### Touch/Pointer Controls
- **Tap**: Action (automatically mapped)
- **Pointer Position**: `controls.pointerX`, `controls.pointerY`
- **Drag Detection**: Check `controls.pointerDown` and track position changes

## Available Controls

```typescript
interface GameControls {
  // Directional buttons
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  
  // Action buttons
  action: boolean;      // Primary action
  jump: boolean;        // Jump/Up action
  shoot: boolean;       // Fire/Shoot action
  interact: boolean;    // Interact/Use action
  select: boolean;      // Select/Confirm action
  back: boolean;        // Back/Cancel action
  menu: boolean;        // Menu/Pause action
  
  // Analog inputs (-1 to 1)
  analogX: number;      // Left stick X axis
  analogY: number;      // Left stick Y axis
  triggerLeft: number;  // Left trigger (0-1)
  triggerRight: number; // Right trigger (0-1)
  
  // Pointer/Touch
  pointerX: number | null;   // Touch/mouse X coordinate
  pointerY: number | null;   // Touch/mouse Y coordinate
  pointerDown: boolean;      // Is pointer/touch down
}
```

## Helper Hooks

### `useGameDirection(controls)`
Returns normalized direction vector:
```typescript
const direction = useGameDirection(controls);
// Returns: { x: -1|0|1, y: -1|0|1 }
// Prefers digital (arrow keys) over analog when both pressed
```

### `useGameAction(controls, actionKey)`
Tracks action state changes:
```typescript
const jumpAction = useGameAction(controls, 'jump');
// Returns: {
//   isPressed: boolean,       // Currently held down
//   justPressed: boolean,     // Pressed this frame
//   justReleased: boolean,    // Released this frame
//   wasPressed: boolean       // Was pressed last frame
// }
```

## Implementation Patterns

### Pattern 1: Simple Directional Game (like Pac-Man)

```typescript
const MyPacManGame = () => {
  const controls = useGameControls();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const direction = useGameDirection(controls);
    setPosition(prev => ({
      x: prev.x + direction.x * 5,
      y: prev.y + direction.y * 5,
    }));
  }, [controls]);
  
  return <div style={{transform: `translate(${position.x}px, ${position.y}px)`}}>🟡</div>;
};
```

### Pattern 2: Jump Game (like Flappy Bird)

```typescript
const MyJumpGame = () => {
  const controls = useGameControls();
  const jumpAction = useGameAction(controls, 'jump');
  const [velocity, setVelocity] = useState(0);
  
  useEffect(() => {
    if (jumpAction.justPressed) {
      setVelocity(-10); // Jump upward
    }
  }, [jumpAction.justPressed]);
  
  return <div>Bird with velocity {velocity}</div>;
};
```

### Pattern 3: Shooter Game (like Space Invaders)

```typescript
const MyShooterGame = () => {
  const controls = useGameControls();
  const direction = useGameDirection(controls);
  const [position, setPosition] = useState(0);
  const [bullets, setBullets] = useState([]);
  
  useEffect(() => {
    // Move player horizontally
    setPosition(prev => prev + direction.x * 5);
  }, [direction.x]);
  
  useEffect(() => {
    // Shoot
    if (controls.shoot) {
      setBullets(prev => [...prev, { x: position, y: 0 }]);
    }
  }, [controls.shoot, position]);
  
  return <div>Player at {position} with {bullets.length} bullets</div>;
};
```

### Pattern 4: Pointer/Touch Game (like Fishing)

```typescript
const MyFishingGame = () => {
  const controls = useGameControls();
  const [targetX, setTargetX] = useState(0);
  
  useEffect(() => {
    if (controls.pointerDown && controls.pointerX !== null) {
      setTargetX(controls.pointerX);
    }
  }, [controls.pointerX, controls.pointerDown]);
  
  return <div>Targeting at {targetX}</div>;
};
```

### Pattern 5: Multi-Button Game (like Platformer)

```typescript
const MyPlatformerGame = () => {
  const controls = useGameControls();
  const direction = useGameDirection(controls);
  const jumpAction = useGameAction(controls, 'jump');
  const shootAction = useGameAction(controls, 'shoot');
  
  useEffect(() => {
    if (direction.x !== 0) moveHorizontal(direction.x);
    if (jumpAction.justPressed && isGrounded) jump();
    if (shootAction.isPressed) fireWeapon();
  }, [direction, jumpAction, shootAction]);
  
  return <div>Full platformer</div>;
};
```

## Migration Checklist

For existing games, add:

1. ✅ Import the hook:
   ```typescript
   import { useGameControls, useGameDirection } from '../../lib/useGameControls';
   ```

2. ✅ Call the hook in your component:
   ```typescript
   const controls = useGameControls();
   ```

3. ✅ Replace existing keyboard handlers with control checks:
   ```typescript
   // OLD:
   window.addEventListener('keydown', handleKeyDown);
   
   // NEW:
   const direction = useGameDirection(controls);
   if (direction.x !== 0 || direction.y !== 0) {
     movePlayer(direction);
   }
   ```

4. ✅ Remove old event listeners (clean up memory leaks)

5. ✅ Add gamepad support by using the controls directly

6. ✅ Test on keyboard, gamepad, and touch

## Testing Checklist

- [ ] Keyboard: Arrow keys work
- [ ] Keyboard: WASD works
- [ ] Keyboard: Numpad works
- [ ] Keyboard: Space/Enter/E work for actions
- [ ] Gamepad: D-Pad works
- [ ] Gamepad: Left stick works
- [ ] Gamepad: Buttons work (A, B, X, Y)
- [ ] Gamepad: Triggers work
- [ ] Touch: Tap works
- [ ] Touch: Drag/pointer movement works
- [ ] Mobile: No console errors
- [ ] No duplicate inputs when using multiple control types

## Troubleshooting

### "Gamepad not detected"
- Check browser console for gamepad errors
- Note: Gamepad API requires user interaction first (click/touch)
- Try pressing a gamepad button before testing

### "Controls not responding"
- Check if event listeners are being removed/re-added
- Use `useCallback` to memoize functions
- Verify `useGameControls` is called at component root

### "Analog stick jitter"
- Deadzone is set to 0.15 (15% from center)
- Can be adjusted in `useGameControls.ts` if needed

### "Multiple inputs triggering"
- If keyboard + gamepad both work, that's correct (player choice)
- If you want only one, add logic to disable one or the other

## Performance Notes

- `useGameControls` uses `requestAnimationFrame` for gamepad polling (~60fps)
- Keyboard and pointer events are added to window (not component)
- Clean up is handled automatically in useEffect cleanup
- No performance impact on games not using gamepads
