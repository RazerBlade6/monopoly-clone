import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CASH_BUBBLE_DRIFT_PX, CASH_BUBBLE_S } from '../motionTiming';

interface Bubble { id: number; amount: number }

/**
 * A balance with a small `+$N` / `-$N` under it whenever it changes: a gain floats up into
 * the balance and a loss drops away from it, both fading as they go.
 * It diffs the balance it is shown rather than listening for events, so it follows the
 * playback queue: each payment the board plays out gets its own bubble, in step with it.
 */
export function CashDelta({ cash, className }: { cash: number; className: string }) {
  const reduced = useReducedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const previous = useRef(cash);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const amount = cash - previous.current;
    previous.current = cash;
    if (amount === 0) return;
    const id = ++nextId.current;
    setBubbles(bs => [...bs, { id, amount }]);
    // Not cleared when the balance changes again: each bubble lives out its own time.
    const t = setTimeout(() => {
      timers.current.delete(t);
      setBubbles(bs => bs.filter(b => b.id !== id));
    }, CASH_BUBBLE_S * 1000);
    timers.current.add(t);
  }, [cash]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const drift = reduced ? 0 : CASH_BUBBLE_DRIFT_PX;
  return (
    <span className={`cash-delta ${className}`}>
      {cash < 0 ? `-$${-cash}` : `$${cash}`}
      <AnimatePresence>
        {bubbles.map(b => (
          <motion.span
            key={b.id}
            className={`cash-delta__bubble cash-delta__bubble--${b.amount > 0 ? 'gain' : 'loss'}`}
            aria-hidden
            initial={{ opacity: 0, y: b.amount > 0 ? drift : 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: b.amount > 0 ? 0 : drift }}
            transition={{ duration: CASH_BUBBLE_S, ease: 'easeOut', opacity: { duration: CASH_BUBBLE_S, times: [0, 0.12, 0.6, 1] } }}
          >
            {b.amount > 0 ? `+$${b.amount}` : `-$${-b.amount}`}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
