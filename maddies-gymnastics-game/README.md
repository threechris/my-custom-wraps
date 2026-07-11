# Maddie's Gymnastics Game 🤸‍♀️

A mobile web game for kids: draw a routine with your finger and watch Maddie —
a gymnast in a red, white and blue leotard — perform it, move by move!

## How to play

1. Pick an event: **Floor Routine**, **Balance Beam**, or **Vault**.
2. Draw a path with one finger. The sparkly trail stays visible the whole time.
3. Lift your finger — Maddie salutes and performs your routine along the path,
   with the trail turning gold behind her.
4. Points and power-up stars pop up as she performs. Confetti and a total
   score (with a 1–3 star rating) at the end!

## The shapes are the tricks

| You draw | Maddie does |
|---|---|
| ➰ small loop | Backflip / Front Flip (direction matters!) |
| ⭕ big loop | Big Layout Flip |
| ➿ loops in a row | DOUBLE or TRIPLE flip |
| ∟ one sharp corner | Cartwheel |
| 〽️ zigzag (2–3 corners) | Front / Back Handspring |
| ⚡ long zigzag | Handspring series |
| ◠ big smooth curve | Aerial |
| — long straight line | Split Leap |

The crazier and curlier the routine, the higher the score: every trick in a
row raises the combo multiplier, stars on the path are worth +25, and a wild,
twisty path earns a **Wild Routine Bonus**.

## Events

- **Floor Routine** — a top-down spring floor; fill it with tumbling passes.
- **Balance Beam** — trace along the beam; staying on the wood earns a
  **Steady Bonus** (Maddie wobbles when you stray!).
- **Vault** — run up the runway, hit the springboard, and any tricks over the
  table score **1.5× air bonus** ✈️.

## Tech

- Single self-contained `index.html` — no dependencies, works offline.
- HTML5 canvas, pointer events, Web Audio chimes, vibration on tricks.
- Best score per event saved in `localStorage`.
- Designed for phones (portrait), works with mouse on desktop too.

Just open `index.html` on a phone (or serve the folder) and play!
