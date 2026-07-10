# 🎣 Ryan's Fishing Game

A calm, cozy fishing game for little anglers — a quiet morning on the pier,
with the thrill of the catch. Made for a 5-year-old to play on a phone.

## How to play

1. **Tap to Play**
2. **Cast:** press anywhere, pull back (like a slingshot), and let go.
   The further you pull, the further the bobber flies — and the bigger
   the fish that swim out there!
3. **Wait for it…** watch the bobber. Little ripples mean a nibble.
4. **The bite:** when the bobber tugs under and the phone buzzes — **swipe UP** fast to pull the fish out of the water!
5. Catch fish, earn stars ⭐, and check your bucket (🐟 button) to see
   everything you've caught.

## The fish (easiest → most points)

| Fish | Points |
|---|---|
| Sardine | 10 |
| Shiner Perch | 15 |
| Surf Perch | 20 |
| Opaleye | 30 |
| Mackerel | 40 |
| Striped Bass | 60 |
| Halibut | 80 |
| Salmon | 100 |

Bigger fish live further out — cast far for a chance at the salmon!

## Running it

It's a single self-contained `index.html` — no build, no dependencies.

- **On a phone:** serve the folder (`python3 -m http.server` or GitHub Pages)
  and open it in the phone's browser. Add it to the home screen for
  full-screen play.
- **On a computer:** just open `index.html`; mouse drag works like touch.

Notes: the score is saved on the device (localStorage). The gentle bite
vibration works on Android browsers; iOS Safari doesn't support web
vibration, but the big bouncing "PULL UP!" cue makes bites easy to spot.
