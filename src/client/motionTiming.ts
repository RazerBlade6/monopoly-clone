/**
 * Every duration the board's motion runs on, in one place. The playback queue
 * (`playback.ts`) waits on these and the sprites (`Board.tsx`) animate with them, so the
 * two can never drift apart: the queue never has to be told an animation has finished,
 * because it already knows how long it takes.
 *
 * Seconds for Framer Motion, milliseconds for the queue's timers — each name says which.
 */

/** One die's tumble, from leaving the felt to resting on its face. */
export const DICE_SPIN_S = 1.0;
/** The second die leaves a beat after the first, so the pair don't move as one block. */
export const DICE_STAGGER_S = 0.07;
/** How long the queue holds before the token sets off: the dice are still just settling. */
export const DICE_SETTLE_MS = 1000;

/** A hop from one tile to the next, at cruising pace. */
const HOP_S = 0.24;
/** The first hop is a push-off and the last a landing, so both take longer than cruising. */
const FIRST_HOP_FACTOR = 1.35;
const LAST_HOP_FACTOR = 1.55;
/** A long card move speeds up so it is never a slog, but a hop never gets shorter than this. */
const LONG_WALK_S = 3.2;
const MIN_HOP_S = 0.1;

/**
 * Seconds per hop for a walk of `count` tiles. A short walk (a dice roll) runs at the
 * cruising pace with a slower first and last hop, which is what makes the token speed up
 * and slow down over the walk rather than ticking along at one speed. A long walk (a card
 * that sends you most of the way round) shrinks the cruising hop so the whole walk fits
 * in `LONG_WALK_S`.
 */
export function hopDurations(count: number): number[] {
  if (count <= 0) return [];
  const ends = count === 1 ? LAST_HOP_FACTOR : FIRST_HOP_FACTOR + LAST_HOP_FACTOR;
  const middle = Math.max(0, count - 2);
  const natural = (ends + middle) * HOP_S;
  const hop = natural <= LONG_WALK_S ? HOP_S : Math.max(MIN_HOP_S, LONG_WALK_S / (ends + middle));
  if (count === 1) return [hop * LAST_HOP_FACTOR];
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? hop * FIRST_HOP_FACTOR : i === count - 1 ? hop * LAST_HOP_FACTOR : hop);
}

/** A walk only ever goes backwards when a card says so (three back, on every map). */
export const MAX_BACKWARD_WALK = 6;

/** Prison: the token shrinks away, then pops back up on the prison corner. */
export const JUMP_OUT_S = 0.22;
export const JUMP_IN_S = 0.42;
/** A breath on the Go To Prison corner before the token is taken away. */
export const JUMP_PAUSE_MS = 280;

/** How long a drawn card holds the stage before its effect (a move, a payment) plays. */
export const CARD_READ_MS = 1600;
/** And how long it stays up in total. */
export const CARD_SHOW_MS = 4500;

/** A held breath between landing and the money changing hands, so the two read as cause and effect. */
export const LAND_BEAT_MS = 180;
