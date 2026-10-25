# richup.io — dice and token motion, measured from a screen recording

Captured 2026-10-17 from a 16-second screen recording of a live richup game (3824×2314,
120 fps, macOS screen capture, one human player rolling, four rolls in full and a fifth cut
off). The recording itself was not kept. Everything below was read off its frames with
ffmpeg: contact sheets for the overall timeline, frame differencing at the full 120 fps for
timings, and per-frame tracking of the dice's white pixels for their trajectory.

This closes item 9 of `richup-ux-and-flow.md`'s "Needs a human to open the site and check"
list (token movement: hop vs tween, and the dice animation).

Tags: **[MEASURED]** = read off frames, numbers trustworthy to about one frame (8 ms at
120 fps, 33 ms where a 30 fps strip was used). **[SEEN]** = clearly visible but not measured.
**[INFERRED]** = a reading of what is seen, not proven.

---

## 1. One roll, start to finish (roll 1 of the recording)

| t (s) | What happens | Tag |
|---|---|---|
| 1.50 | "Roll the dice" clicked; the button dims | MEASURED |
| 1.55–1.80 | Button fades out; dice still at rest | MEASURED |
| **1.85** | **Dice launch** — airborne within one frame | MEASURED |
| 2.33 | Apex | MEASURED |
| ~2.45 | Dice spin has essentially stopped; they hang in their final orientation | MEASURED (30 fps strip) |
| **2.47** | **Token sets off**, while the dice are still in the air just past the apex | MEASURED |
| **2.70** | **Token arrives**, 7 tiles on (START → Haifa) | MEASURED |
| **2.77** | **Dice land** | MEASURED |
| 2.80 | Dice finish a tiny settle (~5% of a die height), no visible bounce | MEASURED |
| 2.85–3.00 | Token shrinks back to its resting size | SEEN |
| 2.90–3.00 | "End turn" / "Buy for $110" fade in, enabled by ~3.00 | MEASURED |

Click to usable buttons: **~1.5 s**. Click to launch: ~0.35 s, which includes the network
round trip; the dice do not move until the server's answer arrives. **[INFERRED]**

The four complete rolls agree: dice motion lasts **0.92–1.05 s** each time
(1.85→2.85, 5.05→6.10, 8.20→9.20, 11.12→12.15, including the settle).

---

## 2. The dice

### Look at rest — the "isometric" pose **[SEEN]**

- Two **rounded cubes**: a large corner/edge radius (roughly a quarter of the side), no outline.
- Seen from above and in front, so each die shows **three faces**: the top face, large and
  brightest, plus two side faces below it, foreshortened. Pitch roughly 30–35° down onto the die.
- Shading is soft and continuous: top face near-white, side faces light grey darkening toward
  the bottom edge, as if lit from above. Pips are solid black, foreshortened into ellipses on
  the side faces.
- The two dice do **not** rest at the same angle: each has its own small yaw (very roughly
  ±15–25°), so the pair never look like copies. **[SEEN; the exact range is not measured]**
- They sit close together, almost touching (gap about a tenth of a die), and overlap a little
  in the air.
- Size: a die is about **13% of the board's width** in the recording. (Ours is about 9%.)
- Which face is the result is **not confirmed**. The top face is the obvious reading; the
  recording's log never printed the roll values, so it could not be checked against them.
- The rendering (smooth shaded bevels, true perspective on the pips) looks like real 3D —
  WebGL or pre-rendered frames — rather than CSS faces. `richup-ux-and-flow.md` §2 found a
  `/dice` asset path in the bundle, which fits pre-rendered images. **[INFERRED]**

### The throw **[MEASURED]**

Tracked from the top edge of the dice, in units of one die height:

- **Launch is a jump cut, not a wind-up.** From rest the dice are 0.15 die heights up in the
  very first frame of motion, and rising fast.
- **Rise** decelerates like a thrown object: apex **~0.67 die heights** above rest, reached
  **~0.5 s** after launch.
- **Fall** accelerates and lands **~0.92 s** after launch. The arc is close to symmetric
  (rise 0.48 s, fall 0.42 s), i.e. gravity-like.
- **No scale change in flight.** An airborne die measures the same height as a resting one; any
  apparent growth is the rotation.
- **Spin** is fastest at launch and decays: big orientation changes frame to frame for the
  first ~0.35 s, small wobbles by ~0.5 s, essentially still from ~0.6 s. The dice then **fall
  the last third of the flight already showing their result**, so the outcome is readable
  before they land.
- **Landing**: a ~5% settle and stop. No bounce, no squash.

### Shadows **[SEEN]**

- One soft-edged, flat **ellipse per die**, about one die wide and a third as tall, in a dark
  grey a little lighter than the felt.
- They **stay on the felt** where the dice will land; only the dice rise. That separation is
  most of what sells the height.
- Darker and a little larger when the die is low, fainter and smaller at the apex. Hidden under
  the die at rest.

---

## 3. The token

- **A smooth glide, not hops.** 7 tiles in **~0.22 s** (2.47→2.70): roughly 2 tiles in the first
  50 ms, then decelerating into the tile. Peak speed somewhere near 60 tiles/s. **[MEASURED at 20 fps]**
- It **starts while the dice are still airborne** (about 0.6 s into a 0.92 s flight), and
  arrives before they land. The dice and the walk overlap rather than run one after the other.
- **Bigger while moving**, shrinking back to rest size over ~0.15–0.2 s after it stops. **[SEEN]**
- Rests **centred on the tile**.

---

## 4. Other things seen in the recording

- **Prison corner is split in two**: a "Passing by" area and a barred "In Prison" cell. A
  prisoner and a visitor stand in different places on the same corner. **[SEEN]**
- Tiles carry their **price on a small badge at the top** of the tile ("60$", "110$"). **[SEEN]**
- The turn buttons **fade out on click** and **fade back in** once the move has finished
  (~0.1 s each way). **[MEASURED]**

