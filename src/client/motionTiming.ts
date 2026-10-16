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

/**
 * A walk's length in seconds grows with the square root of the tiles covered: a long move
 * covers far more ground than a short one in only a little more time, so the trip from the
 * far side of the board back to START stays brisk while a one-tile step still reads as a
 * move. 1 tile ≈ 0.4s, a typical roll of 7 ≈ 0.6s, the 30 to START ≈ 1.0s.
 */
const WALK_BASE_S = 0.26;
const WALK_PER_ROOT_TILE_S = 0.13;

export function walkSeconds(tiles: number): number {
  return tiles <= 0 ? 0 : WALK_BASE_S + WALK_PER_ROOT_TILE_S * Math.sqrt(tiles);
}

/**
 * The glide's easing: it pulls away hard (top speed within the first quarter of the walk)
 * and spends the rest easing to a stop on the tile.
 */
export const WALK_EASE = [0.3, 0, 0.12, 1] as const;

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
export const LAND_BEAT_MS = 120;
