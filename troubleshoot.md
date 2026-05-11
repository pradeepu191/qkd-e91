# Troubleshooting

Failure modes we hit during the project, ordered roughly by how
common they are. If you see a symptom not listed here, the
**proxy terminal log** is your best diagnostic — every request the
browser sends to the device shows up there.

## "Failed to fetch" when running anything

Almost always one of three things. Open the browser devtools
(F12 → Console) and look at the actual red error message — the
"failed to fetch" line in the panel's console is generic; the
browser's console says exactly what went wrong.

### "blocked by CORS policy"

Means the proxy isn't running, or the REST port in the Connection
panel is set to the quED's port directly (8082) rather than the
proxy's port (8083).

Fix:

1. Check that `node proxy.js` is still running in a terminal.
2. Check that "REST port" in the Connection panel is `8083`.
3. Look at the proxy terminal — if you see no log lines when you
   click a button, the browser isn't reaching the proxy. Check
   "quED host" too (should be `localhost` if the proxy is local).

### "net::ERR_CONNECTION_REFUSED"

The proxy is running but can't reach the quED. The error appears
in the proxy terminal as `upstream error: ECONNREFUSED`.

Fix:

1. Open `proxy.js`. Check the `QUED_HOST` and `QUED_PORT` at the
   top. They should match where the device actually is.
2. Verify the device is reachable by visiting `http://<host>:8082/`
   in a browser. If you can't see the quED's own UI, the device
   isn't networked properly.

### "Mixed content" or "Failed to load resource"

You opened the panel as `https://` somewhere (or through an
unusual file URL). Open `qkd_e91.html` by double-clicking the
file, or via `file://...` — anything but `https://`.

## Counts come back as 0 or very low

A few possibilities:

1. **Laser is off.** Check the device's own UI — does the polar
   plot show coincidences? If not, this is a hardware/source
   issue, not software.

2. **Wrong channel.** The Connection panel "Channel" dropdown
   defaults to `6 — event counter (raw)`. If you see channel 8
   selected, the count rate channel may not be active. Switch
   back to 6.

3. **Polarizers are at a crossed angle.** If both polarizers are
   at 90° relative to each other, an entangled source produces
   minimal coincidences. Try setting both to 0° (in the device's
   UI, or via the panel's manual motor controls) and re-ping.

4. **Source HWP in the wrong position.** The quED has an internal
   half-wave plate that selects which Bell state the source
   produces. If it's in the H or V position rather than +, you're
   getting a classical product state, not an entangled state.
   Check via lab staff.

## Motors don't move when commanded

If the proxy log shows `PUT motors/target/2 → 200` followed by
`PUT motors/move/2 → 200` and nothing happens physically:

1. **Try a larger motion.** Sending `target=0` when the motor is
   already at 0 produces no visible movement. Send something
   obvious like `target=2400` (90°) and see if it moves.

2. **Non-integer target.** The firmware silently rejects non-integer
   step values. If you're sending commands via the devtools
   console, make sure you're sending integers:

   ```javascript
   await restPut('/api/v1/qued/motors/target/2', 1200);  // OK
   await restPut('/api/v1/qued/motors/target/2', 1200.5); // silently rejected
   ```

   The panel rounds for you; this only matters for manual
   commands.

3. **Move command missing.** `target` alone doesn't move the
   motor — `move=1` is also required.

## Motors return to 0 between commands

If you see motors jump to 0° between each commanded angle in a
calibration sweep or experiment, the wait between consecutive
moves is too short. The device aborts in-flight motion to 0 when
a new move command arrives.

Fix: in `qkd_e91.html`, find the `STEPS_PER_SEC` constant near the
top of the JavaScript. Lower it (the wait is calculated as
`distance / STEPS_PER_SEC`, so smaller values give longer waits).
Try halving it until the motion is clean.

If you have a stopwatch, you can directly measure your motor's
speed: command a full revolution from 0 to 4800 steps, time how
long the motor takes to physically stop. The right value for
`STEPS_PER_SEC` is about 0.9 × (4800 / measured_seconds).

## WebSocket disconnects mid-run

Symptoms: the status pill turns red ("ws error" or "ws offline")
during a long run; the experiment loop reports errors trying to
read counts.

This is uncommon and usually transient. Reconnect via the
**Connect WebSocket** button. The experiment may need to be
restarted; check `window.detector` in devtools to see how many
trials had completed.

If it happens repeatedly, possible causes:

- Network instability between you and the quED (most likely on
  Wi-Fi or with an unreliable Ethernet cable).
- The quED's WebSocket server is overloaded by other clients.
  Close any other tabs/windows connected to the device.

## QBER is very high (>20%) for no obvious reason

Several causes; check each before concluding the protocol is
broken:

1. **Bob offset never calibrated.** Did you run **Fit cosine →
   bob_offset** after the calibration sweep? The value gets
   written into the "Bob offset" field; if that field shows 0
   or some stale value, the experiment isn't compensating for
   alignment.

2. **Park angle vs. fitted phi confusion.** If you parked Alice
   at 30° during calibration, the fit's `phi` will be ~30° plus
   the true offset. The panel handles this subtraction — but if
   you copy/paste between fields manually, double-check.

3. **Wrong Bell state.** If the source HWP is in the `-` position
   (producing |Φ⁻⟩) but the protocol assumes |Φ⁺⟩, you'll see
   weird basis-dependent QBER. Run the per-basis QBER breakdown
   (**Show per-bucket counts** → look at diagonal E values) to
   check.

4. **Visibility too low.** Look at A/C from the calibration fit.
   Below 0.7, the source isn't aligned well enough to support
   E91. This needs hardware alignment work, not software fixes.

5. **Threshold sift used on rate data.** The naive
   `count ≈ 1` sift is statistically unsound for CW data. Use the
   modified-E91 probabilistic sift instead.

## "node: command not found"

Node.js isn't installed or isn't on your `PATH`. Install from
[nodejs.org](https://nodejs.org) and reopen your terminal.

## Devtools console shows lots of red lines

Some of them are normal (Chrome warnings about deprecated APIs,
etc.). The lines that matter for debugging are:

- Anything mentioning the URL you're trying to reach
- Anything with "WebSocket"
- Anything in red specifically when you click a button

Ignore everything else.
