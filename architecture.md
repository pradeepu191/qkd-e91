# Architecture & Internals

This document describes how the control software talks to the quED
at the network and protocol level. The intended audience is someone
who wants to modify the code, debug an issue more deeply than
`troubleshooting.md` covers, or build a similar control panel for a
different qutools instrument.

If you're trying to *use* the panel for an E91 experiment, read
[`getting-started.md`](getting-started.md) first.

## High-level architecture

```
                                 ┌───────────────────────────┐
                                 │       qutools quED         │
                                 │                            │
                                 │   ┌──────────────────┐     │
                                 │   │ FPGA, source HWP │     │
                                 │   │ motors, APDs     │     │
                                 │   └──────────────────┘     │
                                 │                            │
                                 │   REST :8082    WS :8081   │
                                 └─────────┬──────────┬───────┘
                                           │          │
                                           ▼          │
                              ┌─────────────────────┐ │
                              │  proxy.js           │ │
                              │  Node.js reverse    │ │
                              │  proxy on :8083     │ │
                              │  (adds CORS)        │ │
                              └─────────┬───────────┘ │
                                        │             │
                                  REST  │             │ WebSocket
                                        ▼             ▼
                                ┌─────────────────────────┐
                                │  qkd_e91.html           │
                                │  (browser tab)          │
                                │                         │
                                │  - protocol logic       │
                                │  - motor sequencing     │
                                │  - calibration + fit    │
                                │  - sift + analysis      │
                                └─────────────────────────┘
```

The browser handles all the protocol logic. The proxy adds CORS
headers to REST responses. The quED's WebSocket is reachable
directly from the browser (WebSockets are exempt from the CORS
restriction).

## The two device interfaces

### REST API on port 8082

The quED's HTTP API is mostly URL-addressable. A few examples of
endpoints we use:

| Endpoint                                              | Method | Purpose                          |
| ----------------------------------------------------- | ------ | -------------------------------- |
| `/api/v1/qued/motors/target/{i}`                      | PUT    | Set motor i's target position    |
| `/api/v1/qued/motors/move/{i}`                        | PUT    | Trigger motor i to move          |
| `/api/v1/qued/motors/state/{i}`                       | GET    | (Always returns 0. See below.)   |
| `/api/v1/qued/motors/position/{i}`                    | GET    | Read motor i's current position  |
| `/api/v1/qued/laser/power`                            | PUT    | Set pump diode current           |
| `/api/v1/quedu/measure/event-counter/exposure-limit`  | PUT    | Set event counter integration window |

All `PUT` requests take a JSON body of the form `{"value": <number>}`.
The device responds with `200 OK` and an empty body on success.

The full route table is in the `routes.js` file on the quED itself
(visible if you fetch `http://<quED>:8082/quedu_routes.js`). The
panel only uses a handful of routes; many more exist.

### WebSocket on port 8081

The quED pushes live data over a WebSocket. Each message is a JSON
object with rough shape:

```json
{
  "info":  { "index": 6, /* ... */ },
  "data":  { "raw": [ { "val": 1234, "t": ... }, ... ] },
  "start": ...
}
```

The `info.index` field identifies the data channel:

| Index | Channel                | What it carries                           |
| ----- | ---------------------- | ----------------------------------------- |
| 6     | Event counter (raw)    | Integer coincidence count per integration window |
| 8     | Count rate (display)   | Coincidence rate for the polar plot; can have a hidden visual multiplier |
| 9     | Singles, detector 1    | Single-photon clicks on Alice's APD       |
| 10    | Singles, detector 2    | Single-photon clicks on Bob's APD         |

**We use channel 6 for the protocol** because it gives raw integer
counts with no scaling. Channel 8 looks similar but the device
silently multiplies low values by ~10 so the polar plot stays
readable — fine for visual display, terrible for data analysis.

We discovered this by sending the same physical setup to both
channels and comparing values.

Messages on each channel arrive at a rate of roughly
`1 / (hardware exposure time)`. With the default 1-second exposure,
that's ~1 packet/second on each channel; with 30 ms exposure, ~30
packets/second.

## Firmware quirks we worked around

### Motor commands are two-step

Setting `target/{i}` alone does **not** start motion. Required
sequence is:

```javascript
await restPut('/api/v1/qued/motors/target/2', 1200);  // 1200 steps = 90°
await restPut('/api/v1/qued/motors/move/2', 1);
```

Per the motor's value semantics (visible in `quedu_actors.js` on the
device): `value=0` stops the motor, `value=1` goes to the stored
target, `value=2` rotates continuously left, `value=3` rotates
continuously right. We only use `value=1`.

### Target must be an integer

The firmware silently rejects non-integer `target` values. Sending
`133.33` (which would be `10°` in motor steps) results in a 200 OK
response and no motion. We round to integer steps:

```javascript
const STEPS_PER_REV = 4800;
const targetSteps = Math.round(degrees * STEPS_PER_REV / 360);
```

### `state/{i}` always returns 0

The motor state endpoint returns 0 whether or not the motor is
currently moving. It cannot be polled to wait for motion completion.

We work around this by:

1. Tracking each motor's commanded position in a JS variable.
2. Computing the required travel as `|new - old|` steps.
3. Sleeping `travel_steps / STEPS_PER_SEC + overhead` before the
   next command.

`STEPS_PER_SEC` is empirically calibrated by timing a full
revolution. The current value (in `qkd_e91.html`) is conservative;
faster values work if the hardware allows.

This matters: without the wait, consecutive motor commands race.
The device's behavior when receiving a new `move=1` while a previous
motion is still in progress appears to be "abort to 0 and restart,"
which manifested in early testing as motors visibly returning to 0
between every commanded angle.

### Coincidence channel scaling

As mentioned above, channel 8 has a hidden visual multiplier on
low values. The device's onboard QKD experiment uses channel 6
internally, which is what told us to switch.

## Trial execution optimizations

A naive implementation that sends one motor command per trial and
waits for each motion sequentially is bottlenecked by motor
movement time. We use three optimizations:

### Parallel motor commands

Alice's and Bob's motor commands are issued concurrently:

```javascript
await Promise.all([
  motorSet(aliceMotor, alphaAngle),
  motorSet(bobMotor,   betaAngle),
]);
```

The two motors move physically in parallel, so total wait time is
`max(t_Alice, t_Bob)` instead of `t_Alice + t_Bob`.

### Grouping by (α, β)

After basis-and-bit generation, the random trial list typically
contains many trials at the same motor settings. With 3 bases × 2
bits per side and 500 trials, there are at most ~36 unique
(α, β) pairs.

The panel groups trials by their motor settings and visits each
configuration only once, then takes back-to-back measurements at
that position. This reduces motor moves from 500 to ~36 with no
change to the data.

Trial results are stored at their original (pre-grouping) index,
so downstream analysis sees the same randomized trial order.

### Nearest-neighbor reordering

The order of distinct (α, β) configurations is reordered to
minimize total angular travel. The reorder uses a greedy
nearest-neighbor heuristic and exploits the polarizer's 180°
symmetry: a 170°→10° move is treated as 20° of travel, not 160°.

Combined with grouping, total motor travel drops by roughly 90%
relative to naive random-order execution.

## Reading coincidences: packet count vs wall-clock

For each trial measurement, the panel reads N WebSocket packets
from channel 6 and sums their counts.

Early versions used a wall-clock window ("sum every packet that
arrives in the next 100 ms"). This turned out to be fragile:

- The device clock and the browser's JavaScript event loop are
  independent. A 100 ms wall-clock window catches a variable
  number of 30 ms-spaced packets depending on phase alignment
  (typically 3, but sometimes 4 or just 1 if the JS thread
  hiccups).
- Slow console-log rendering blocks message processing.

The packet-count approach is invariant to all of this: N packets
is always exactly N · τ_hardware of integrated physics, regardless
of latency or scheduler jitter.

## The CORS proxy

`proxy.js` is ~60 lines. It listens on port 8083 and forwards every
incoming HTTP request to the quED at port 8082, with three changes
to the response:

- Adds `Access-Control-Allow-Origin: *`
- Adds `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- Adds `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`

It also intercepts `OPTIONS` preflight requests (the browser sends
these before any `PUT`) and answers them directly with the
appropriate CORS headers, without forwarding to the device.

The proxy doesn't modify request bodies or paths. Logging every
request to the terminal is useful for debugging — if a motor
doesn't move, the proxy log shows whether the browser even sent the
command.

## Calibration model

The calibration sweep parks Alice at a fixed angle `α_park` and
sweeps Bob's polarizer through a range of angles, recording
coincidence counts at each point. The fit model is:

```
N(θ) = A · cos((θ - φ) · π / 90) + C
```

where:
- `θ` is Bob's commanded angle
- `A` is the visibility amplitude
- `C` is the average count level
- `φ` is the polarizer phase

The `π/90` factor in the argument makes the cosine period equal to
180° (because the polarizer is 180°-symmetric, so the visibility
curve has period 180°, not 360°).

After fitting, `φ - α_park` is the relative reference-frame offset
between Alice's and Bob's analyzer mounts. This is the value
written into the experiment's `bobOffset` field.

`A/C` is the visibility. For a clean entangled source it should
be > 0.9.

## Probabilistic sift (modified E91)

For each trial with measured count `n`, the modified protocol
accepts the trial with probability

```
p = (n - n_min) / (n_max - n_min)
```

clamped to [0, 1]. Heads → trial enters the sifted key. Tails →
discard.

`n_min` is the trough of the calibration curve (`C - A`, the
expected count when polarizers are crossed). `n_max` is the peak
(`C + A`, polarizers aligned). Both are read from the cosine fit.

The "biased coin" is implemented as `Math.random() < p` per trial.
With the optional "repeat coin flips" setting, the trial is
accepted if any of K independent flips comes up heads, giving an
effective acceptance probability of `1 - (1-p)^K`.

The downstream analysis treats accepted trials as if they were
binary detection events from a textbook E91 implementation.

## Source files

- **`qkd_e91.html`** — about 1500 lines total. UI markup at the
  top, JavaScript at the bottom. The JS is broken into clearly
  marked sections (Connection, Laser tuning, Calibration,
  Experiment, etc.) that roughly mirror the UI panels.
- **`proxy.js`** — 60 lines. Read top-to-bottom for the full
  picture.

The HTML uses no external libraries and no build step. Just open
the file and read.
