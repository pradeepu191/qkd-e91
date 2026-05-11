# Getting started

This guide takes you from a fresh laptop to running a calibration
sweep on the quED in about 15 minutes. It assumes:

- You have access to a qutools quED that's powered on and producing
  coincidences. (If you don't know whether it is, ask a lab staff
  member to walk you through the quED's own web UI first. Get
  comfortable seeing live coincidence counts on the device's own
  polar plot before you try to drive it programmatically.)
- You have a laptop you can plug into the quED's network.

Throughout this guide, italic *(why?)* notes explain reasoning. Skip
them if you just want to get moving.

## 1. Install Node.js

You need Node.js v18 or later. Check whether it's already installed
by opening a terminal and running:

```bash
node --version
```

If you see something like `v22.0.0`, you're set. Otherwise download
and install from [nodejs.org](https://nodejs.org). The default LTS
installer is fine.

*(why?)* The proxy that connects your browser to the quED is written
in Node. Nothing else in this project needs Node.

## 2. Clone the repository

```bash
git clone https://github.com/pradeepu191/qkd-e91.git
cd qkd-e91
```

If you don't have `git`, you can instead download the repo as a ZIP
from GitHub's "Code → Download ZIP" button.

## 3. Find the quED's network address

The quED exposes a REST API on port 8082 and a WebSocket stream on
port 8081. Both need to be reachable from your laptop.

There are two common configurations:

**A. Direct Ethernet connection.** Plug your laptop into the quED
with an Ethernet cable. The device's default address is usually
`169.254.69.140` (link-local). Test that you can reach it by opening
`http://169.254.69.140:8082/` in a browser — you should see the
quED's built-in interface load. If you do, your laptop is talking
to the device.

**B. Via a Raspberry Pi (or other bridge machine).** If the quED is
plugged into a Pi and you're SSH'd into the Pi, the address from
the Pi's perspective is `localhost`. To make it reachable from your
laptop, you can either:

- Run the Pi as the host for both the proxy and your browser
  (slow but works), or
- SSH-tunnel the ports from the Pi to your laptop:

  ```bash
  ssh -L 8081:localhost:8081 -L 8082:localhost:8082 pi@<pi-address>
  ```

  Then on your laptop, the device appears at `localhost:8081` and
  `localhost:8082`.

If neither works, the device may be behind a firewall or on a
different subnet. Ask lab staff.

## 4. Start the proxy

In a terminal, in the `qkd-e91` directory:

```bash
node proxy.js
```

You should see a line like:
```
CORS proxy listening on http://localhost:8083
forwarding → http://localhost:8082
```

**Leave this terminal open for the rest of the session.** Closing it
stops the proxy and the control panel can no longer send commands.

If the proxy can't reach the device (you'll see an error in the
terminal), edit `proxy.js` — the top of the file has
`QUED_HOST` and `QUED_PORT` constants. Change them to point at
your device. Save and run `node proxy.js` again.

*(why?)* Browsers refuse to send requests to a server that doesn't
include CORS headers (it's a security feature). The quED firmware
doesn't include those headers. The proxy sits between your browser
and the quED, adds the missing headers, and forwards everything
otherwise unchanged. It also gives you a log of every request the
browser sends, which is useful for debugging.

## 5. Open the control panel

In your file browser, double-click `qkd_e91.html`. It will open in
your default browser. There's nothing to install — the whole panel
runs as a single HTML file.

You should see a sidebar of controls on the left and an empty
"console" pane on the right. The top-right status indicators say
"ws offline" and "idle."

## 6. Connect

In the **Connection** panel at the top of the sidebar:

- **quED host**: `localhost` (or whatever the device's IP is)
- **REST port**: `8083` (the proxy's port — *not* the quED's
  direct port)
- **WS port**: `8081`

Click **Connect WebSocket**. The status pill turns green
("ws online") and you'll see `websocket open` in the console.

Click **Push exposure to device** to set the integration window to
the value in the "Event-ctr exposure" field (default 1000 ms is
fine for a first run).

Click **Ping**. The console should show a coincidence count and
the effective WebSocket update rate. If the count is in the
thousands, you have a live entangled source. If it's near zero,
the laser is off or the alignment is bad — go back to the device's
own UI and verify counts are visible there before continuing.

## 7. Tune the laser (optional but recommended)

The modified-E91 protocol's analysis assumes coincidence counts are
on a known scale. The easiest way to get there is to use the
**Laser power tuning** panel:

1. Set "Target rate" to whatever value gives clean counts for your
   integration time. For 1-second exposures, ~5–10 coincidences per
   window is a reasonable target.
2. Click **Bisection search**. The panel will sweep laser power and
   find the setting that produces your target rate.

This takes 1–2 minutes. The selected power gets pushed to the
device automatically. You can also use **Set power manually** with
a number around 50–100 if you want to skip this.

## 8. Calibrate

The **Calibration sweep** panel maps out the cosine visibility
curve and fits it to extract Bob's polarizer offset.

1. Leave "Park Alice" at 0°, "Start" at 0°, "End" at 180°, "Step"
   at 5°. (You can use bigger steps for a faster sweep — try 15°
   for a quick check first.)
2. Click **Run sweep**. The plot fills in as data comes in.
3. After it finishes, click **Fit cosine → bob_offset**. The fitted
   offset gets written into the "Bob offset" field used by the
   experiment.
4. Optional: click **Download calibration CSV** to save the data.

The fit's visibility (the ratio A/C printed in the console) tells
you how good the source alignment is. Above 0.9 is great. Below
0.7 means the alignment is poor and the protocol will struggle.

## 9. Run the experiment

The **Generate bases & bits** panel produces a random sequence of
Alice/Bob trials. Leave length at 500 to start. Click **Generate**.

The **Run QKD experiment** panel has the actual measurement loop:

- "Samples / point" = 1 is fine.
- Leave "Reorder for short moves" and "Group by (α,β)" both
  checked. They speed up the run by ~10× without affecting the data.
- Click **Run experiment**.

You'll see one log line per trial. A 500-trial run takes a few
minutes. Save the data with **Download CSVs** when it's done.

## 10. Analyze

The **Post-processing** panel runs the threshold sift (the naive
analysis); the **Modified E91 (probabilistic sift)** panel runs the
modified analysis. Use the modified one — it's what the protocol
was actually designed around.

Click **Modified sift & analyze**. You'll get QBER, secure key rate,
and a per-basis breakdown of the sifted bits.

The **Show per-bucket counts** button shows the raw E(a,b)
correlation table, which is the most fundamental view of what your
data is doing. Worth looking at after every run.

## Where to go next

- [`architecture.md`](architecture.md) explains what's happening at
  the network and protocol level so you can extend the software.
- [`troubleshooting.md`](troubleshooting.md) covers common problems.
- The full report (linked in the main README) covers the physics in
  detail.
