// Universal Game Controller System
// Provides unified keyboard, gamepad, and touch input handling for all games
// Usage: const controls = useGameControls();

import { useEffect, useRef, useState, useCallback } from 'react';

export type GameControlAction = 
  | 'up' | 'down' | 'left' | 'right'
  | 'action' | 'jump' | 'shoot' | 'interact'
  | 'select' | 'back' | 'menu'
  | 'analog_x' | 'analog_y' | 'trigger_left' | 'trigger_right';

export interface GameControls {
  // Button states (true = pressed)
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
  jump: boolean;
  shoot: boolean;
  interact: boolean;
  select: boolean;
  back: boolean;
  menu: boolean;
  
  // Analog stick values (-1 to 1)
  analogX: number;
  analogY: number;
  
  // Trigger values (0 to 1)
  triggerLeft: number;
  triggerRight: number;
  
  // Touch/pointer position (null if no touch)
  pointerX: number | null;
  pointerY: number | null;
  pointerDown: boolean;
}

// Standard keyboard mappings
const KEYBOARD_MAP: Record<string, GameControlAction> = {
  // Arrow keys
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  
  // WASD
  'w': 'up',
  's': 'down',
  'a': 'left',
  'd': 'right',
  
  // Actions
  ' ': 'jump',
  'Enter': 'action',
  'e': 'interact',
  'Escape': 'menu',
  'Backspace': 'back',
  'Control': 'shoot',
  
  // Numpad
  '8': 'up',
  '2': 'down',
  '4': 'left',
  '6': 'right',
};

// Gamepad button mappings (standard layout)
const GAMEPAD_BUTTON_MAP: Record<number, GameControlAction> = {
  0: 'action',  // A / Cross
  1: 'back',    // B / Circle
  2: 'shoot',   // X / Square
  3: 'jump',    // Y / Triangle
  4: 'trigger_left',  // LB
  5: 'trigger_right', // RB
  6: 'back',    // Back
  7: 'menu',    // Start
  8: 'back',    // Left Stick Click
  9: 'shoot',   // Right Stick Click
  10: 'menu',   // Guide
  12: 'up',     // D-Pad Up
  13: 'down',   // D-Pad Down
  14: 'left',   // D-Pad Left
  15: 'right',  // D-Pad Right
};

interface ControllerState {
  keys: Map<GameControlAction, boolean>;
  pointerX: number | null;
  pointerY: number | null;
  pointerDown: boolean;
  analogX: number;
  analogY: number;
  triggerLeft: number;
  triggerRight: number;
}

/**
 * Main hook for unified game controls
 * Combines keyboard, gamepad, and touch/pointer input
 */
export function useGameControls(): GameControls {
  const stateRef = useRef<ControllerState>({
    keys: new Map(),
    pointerX: null,
    pointerY: null,
    pointerDown: false,
    analogX: 0,
    analogY: 0,
    triggerLeft: 0,
    triggerRight: 0,
  });

  const [state, setState] = useState<ControllerState>(stateRef.current);
  const gamepadPollRef = useRef<number | null>(null);

  // Set a key state
  const setKey = useCallback((action: GameControlAction, pressed: boolean) => {
    const state = stateRef.current;
    if (pressed) {
      state.keys.set(action, true);
    } else {
      state.keys.delete(action);
    }
    setState({ ...state });
  }, []);

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = KEYBOARD_MAP[e.key];
      if (action) {
        e.preventDefault();
        setKey(action, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = KEYBOARD_MAP[e.key];
      if (action) {
        e.preventDefault();
        setKey(action, false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setKey]);

  // Pointer/Touch input handler
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      stateRef.current.pointerX = e.clientX;
      stateRef.current.pointerY = e.clientY;
      stateRef.current.pointerDown = true;
      setState({ ...stateRef.current });
      setKey('action', true);
    };

    const handlePointerMove = (e: PointerEvent) => {
      stateRef.current.pointerX = e.clientX;
      stateRef.current.pointerY = e.clientY;
      setState({ ...stateRef.current });
    };

    const handlePointerUp = () => {
      stateRef.current.pointerDown = false;
      setState({ ...stateRef.current });
      setKey('action', false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [setKey]);

  // Gamepad polling
  useEffect(() => {
    const pollGamepads = () => {
      const gamepads = navigator.getGamepads?.() || [];
      let hasAnyGamepad = false;

      for (const gamepad of gamepads) {
        if (!gamepad) continue;
        hasAnyGamepad = true;

        // Poll buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
          const button = gamepad.buttons[i];
          const action = GAMEPAD_BUTTON_MAP[i];
          if (action && button.pressed) {
            setKey(action, true);
          } else if (action) {
            setKey(action, false);
          }
        }

        // Poll analog sticks (with deadzone)
        const deadzone = 0.15;
        
        // Left stick
        let lx = gamepad.axes[0] ?? 0;
        let ly = gamepad.axes[1] ?? 0;
        if (Math.abs(lx) < deadzone) lx = 0;
        if (Math.abs(ly) < deadzone) ly = 0;

        stateRef.current.analogX = parseFloat(lx.toFixed(2));
        stateRef.current.analogY = parseFloat(ly.toFixed(2));

        // D-Pad via analog stick if needed
        if (lx < -deadzone) setKey('left', true);
        else setKey('left', false);
        if (lx > deadzone) setKey('right', true);
        else setKey('right', false);
        if (ly < -deadzone) setKey('up', true);
        else setKey('up', false);
        if (ly > deadzone) setKey('down', true);
        else setKey('down', false);

        // Triggers
        stateRef.current.triggerLeft = gamepad.buttons[4]?.value ?? 0;
        stateRef.current.triggerRight = gamepad.buttons[5]?.value ?? 0;

        setState({ ...stateRef.current });
      }

      gamepadPollRef.current = requestAnimationFrame(pollGamepads);
    };

    gamepadPollRef.current = requestAnimationFrame(pollGamepads);

    return () => {
      if (gamepadPollRef.current !== null) {
        cancelAnimationFrame(gamepadPollRef.current);
      }
    };
  }, [setKey]);

  return {
    up: state.keys.get('up') ?? false,
    down: state.keys.get('down') ?? false,
    left: state.keys.get('left') ?? false,
    right: state.keys.get('right') ?? false,
    action: state.keys.get('action') ?? false,
    jump: state.keys.get('jump') ?? false,
    shoot: state.keys.get('shoot') ?? false,
    interact: state.keys.get('interact') ?? false,
    select: state.keys.get('select') ?? false,
    back: state.keys.get('back') ?? false,
    menu: state.keys.get('menu') ?? false,
    analogX: state.analogX,
    analogY: state.analogY,
    triggerLeft: state.triggerLeft,
    triggerRight: state.triggerRight,
    pointerX: state.pointerX,
    pointerY: state.pointerY,
    pointerDown: state.pointerDown,
  };
}

/**
 * Helper hook for games that use directional input
 * Returns direction as {x, y} normalized values
 */
export function useGameDirection(controls: GameControls): { x: number; y: number } {
  const x = controls.right ? 1 : controls.left ? -1 : controls.analogX;
  const y = controls.down ? 1 : controls.up ? -1 : controls.analogY;
  return { x, y };
}

/**
 * Helper hook for games with button-based actions
 * Tracks action press/release frames
 */
export function useGameAction(
  controls: GameControls,
  actionKey: keyof Omit<GameControls, 'analogX' | 'analogY' | 'triggerLeft' | 'triggerRight' | 'pointerX' | 'pointerY' | 'pointerDown'>
) {
  const prevRef = useRef(false);
  const [wasPressed, setWasPressed] = useState(false);
  const [justPressed, setJustPressed] = useState(false);
  const [justReleased, setJustReleased] = useState(false);

  useEffect(() => {
    const isPressed = controls[actionKey];
    
    setWasPressed(prevRef.current);
    setJustPressed(isPressed && !prevRef.current);
    setJustReleased(!isPressed && prevRef.current);
    
    prevRef.current = isPressed;
  }, [controls[actionKey], actionKey]);

  return {
    isPressed: controls[actionKey],
    justPressed,
    justReleased,
    wasPressed,
  };
}

export default useGameControls;
