import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface DiceProps {
  value: number | null;
  canRoll: boolean;
  isMyTurn: boolean;
  onRoll: () => void;
}

// Dot component for dice faces
const Dot = ({ className = '' }: { className?: string }) => (
  <div className={`w-3 h-3 bg-red-600 rounded-full shadow-sm ${className}`} />
);

const DICE_FACES: Record<number, JSX.Element> = {
  1: (
    <div className="flex items-center justify-center w-full h-full p-3">
      <Dot />
    </div>
  ),
  2: (
    <div className="flex justify-between w-full h-full p-3">
      <Dot className="self-start" />
      <Dot className="self-end" />
    </div>
  ),
  3: (
    <div className="flex justify-between w-full h-full p-3">
      <Dot className="self-start" />
      <Dot className="self-center" />
      <Dot className="self-end" />
    </div>
  ),
  4: (
    <div className="grid grid-cols-2 w-full h-full p-3">
      <Dot />
      <Dot className="justify-self-end" />
      <Dot className="self-end" />
      <Dot className="justify-self-end self-end" />
    </div>
  ),
  5: (
    <div className="grid grid-cols-3 w-full h-full p-3">
      <Dot />
      <div />
      <Dot className="justify-self-end" />
      <div />
      <Dot className="justify-self-center self-center" />
      <div />
      <Dot className="self-end" />
      <div />
      <Dot className="justify-self-end self-end" />
    </div>
  ),
  6: (
    <div className="grid grid-cols-2 w-full h-full p-3 gap-y-1">
      <Dot />
      <Dot className="justify-self-end" />
      <Dot />
      <Dot className="justify-self-end" />
      <Dot />
      <Dot className="justify-self-end" />
    </div>
  ),
};

const ANIMATION_DURATION = 2000; // 2 seconds of rolling animation

export function Dice({ value, canRoll, isMyTurn, onRoll }: DiceProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When server value arrives, store it as pending
  useEffect(() => {
    if (value !== null) {
      setPendingValue(value);
      console.log('Server dice value received:', value);
    }
  }, [value]);

  // When animation completes AND we have server value, show it
  useEffect(() => {
    if (animationComplete && pendingValue !== null) {
      // Clear animation
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRolling(false);
      setDisplayValue(pendingValue);
      setAnimationComplete(false);
      console.log('Dice display updated to:', pendingValue);
    }
  }, [animationComplete, pendingValue]);

  // Reset dice when it's a new turn
  useEffect(() => {
    if (canRoll && value === null) {
      // New turn started, reset everything
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setDisplayValue(null);
      setPendingValue(null);
      setIsRolling(false);
      setAnimationComplete(false);
      console.log('Dice reset for new turn');
    }
  }, [canRoll, value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleRoll = () => {
    if (!canRoll || isRolling) return;

    setIsRolling(true);
    setAnimationComplete(false);
    setPendingValue(null);

    // Start rolling animation - cycle through random values
    intervalRef.current = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 80);

    // Send roll request to server
    onRoll();

    // After 2 seconds, mark animation as complete
    timeoutRef.current = setTimeout(() => {
      setAnimationComplete(true);
    }, ANIMATION_DURATION);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.button
        className={clsx(
          'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl',
          'flex items-center justify-center',
          'transition-all duration-200',
          'bg-gradient-to-br from-white to-gray-100 border-4 border-gray-200',
          'shadow-[0_6px_0_0_#d1d5db,0_8px_20px_rgba(0,0,0,0.2)]',
          canRoll && !isRolling && 'cursor-pointer hover:shadow-[0_4px_0_0_#d1d5db,0_6px_15px_rgba(0,0,0,0.2)] hover:translate-y-0.5 active:shadow-[0_2px_0_0_#d1d5db] active:translate-y-1',
          isRolling && 'cursor-wait',
          !canRoll && !isMyTurn && !isRolling && 'opacity-60 cursor-default'
        )}
        onClick={handleRoll}
        disabled={!canRoll || isRolling}
        animate={
          isRolling
            ? {
                rotate: [0, 15, -15, 15, -15, 10, -10, 5, -5, 0],
                scale: [1, 1.02, 1.05, 1.02, 1.05, 1.03, 1.02, 1.01, 1],
                y: [0, -8, 2, -6, 2, -4, 1, -2, 0],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          repeat: isRolling ? Infinity : 0,
          ease: 'easeInOut',
        }}
        whileHover={canRoll && !isRolling ? { y: -2 } : undefined}
        whileTap={canRoll && !isRolling ? { y: 2 } : undefined}
      >
        {displayValue !== null ? (
          <motion.div
            key={displayValue}
            initial={isRolling ? { scale: 0.9, rotateX: 20 } : { scale: 1.1 }}
            animate={{ scale: 1, rotateX: 0 }}
            transition={{ duration: isRolling ? 0.05 : 0.2, type: 'spring' }}
            className="w-full h-full"
          >
            {DICE_FACES[displayValue]}
          </motion.div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-4xl">🎲</span>
          </div>
        )}
      </motion.button>

      <AnimatePresence mode="wait">
        {isRolling ? (
          <motion.p
            key="rolling"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-purple-400 font-semibold"
          >
            Rolling...
          </motion.p>
        ) : canRoll ? (
          <motion.p
            key="tap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-gray-400"
          >
            Tap to roll
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
