A browser-based control panel for the Ekert 91 entanglement-based
quantum key distribution protocol, running on the
qutools quED educational SPDC source.
Built as part of the 6.2410 final project, Spring 2026.

What this is
The qutools quED is a benchtop source of polarization-entangled photon
pairs with motorized polarizers and onboard coincidence electronics,
exposed via a REST API on TCP port 8082 and a WebSocket stream on
port 8081. This project is a single-page web app that drives the
device end-to-end through both interfaces:

random basis-and-bit generation for Alice and Bob
motor control with parallel, grouped, and reordered execution
coincidence acquisition over the raw event-counter channel (channel 6)
calibration sweeps with inline cosine fitting
modified-E91 probabilistic sift, QBER, and Devetak–Winter SKR
per-(basis, basis) correlation tables for CHSH-style analysis
CSV export at every stage

A small Node.js reverse proxy (proxy.js) sits between the browser
and the device, since the quED's HTTP server doesn't emit CORS
headers that browsers require.
Hardware

qutools quED with a single APD per detection arm and motorized
polarizers (4800 motor steps per revolution).
Source HWP set to the + position (produces $|\Phi^+\rangle =
(|HH\rangle + |VV\rangle)/\sqrt{2}$).
Network access to the device on ports 8081 (WebSocket) and 8082
(REST). The device's default address 169.254.69.140 works if
it's plugged into your machine via Ethernet with link-local addressing,
or you can tunnel through a Raspberry Pi as we did.

Software

Node.js v18 or higher (the proxy uses only the built-in http
module, so no npm install is required).
A modern browser. Tested in Chrome and Firefox.

Quick start
bashgit clone https://github.com/pradeepu191/qkd-e91.git
cd qkd-e91

# Edit proxy.js if your quED is somewhere other than localhost:8082
# Then start the proxy:
node proxy.js
Open qkd_e91.html in a browser (double-click is fine, no web
server needed). In the Connection panel:

Confirm host/REST port/WS port match your setup. With the proxy
running locally and the device tunneled to localhost:8082, the
defaults work as-is.
Click Connect WebSocket. The status pill in the top-right
should turn green.
Click Push exposure to device to set the integration window.
Click Ping to confirm coincidence counts arrive.

From there: tune laser power → run a calibration sweep → fit the
cosine → generate basis assignments → run the experiment → click
Modified sift & analyze for results.
Architecture
                                 ┌───────────────────────┐
                                 │      qutools quED      │
                                 │ ┌──────────────────┐  │
                                 │ │ FPGA, motors,    │  │
                                 │ │ APDs, source     │  │
                                 │ └──────────────────┘  │
                                 └─────┬───────┬─────────┘
                          REST :8082 / └───────┴──┐
                          WebSocket :8081         │
        ┌─────────────────┐         │             │
        │  proxy.js       │◀───────-┘             │
        │  (CORS-adding   │                       │
        │   reverse       │                       │
        │   proxy :8083)  │                       │
        └────┬────────────┘                       │
             │                                    │
             │REST                       WebSocket│
             ▼                                    │
        ┌─────────────────┐                       │
        │  qkd_e91.html   │◀──────────────────────┘
        │  (browser tab)  │
        └─────────────────┘
The proxy is necessary only for the REST traffic. The WebSocket
connection is exempt from CORS and goes directly from the browser
to the device.
Modified E91 protocol
A textbook E91 implementation requires per-trial single-photon
detection — for each entangled pair, both Alice and Bob need a
discrete polarization eigenvalue readout. The quED's CW pump and
single-detector-per-arm geometry give us coincidence rates over an
integration window instead, with no way to attribute counts to
individual emitted pairs.
To bridge this gap, we implemented a probabilistic sift: at each
trial Alice computes an acceptance probability
p = (n - n_min) / (n_max - n_min)
where n is the trial's coincidence count and n_min, n_max come
from the calibration sweep's fitted cosine baseline minus amplitude
and baseline plus amplitude respectively. She flips a biased coin
with that probability and broadcasts the result; only on heads does
the trial enter the raw key. This recovers a discrete bit-decision
structure from continuous-rate data while preserving the protocol's
basis-matching semantics. See the report for a fuller discussion.
Repository contents

qkd_e91.html — the control panel. All HTML, CSS, JS in one file.
proxy.js — Node.js CORS-adding reverse proxy. Edit
QUED_HOST/QUED_PORT at the top to point at your device.
LICENSE — MIT.

Authors
Deepu Pradeep, Rushil Shah, Daniel Xu, Gideon Tzafriri, Harshil Avlani.
MIT 6.2410, Spring 2026.
Citation
If you use this code or build on it, please cite:

Pradeep, D., Shah, R., Xu, D., Tzafriri, G., and Avlani, H. (2026).
Experimental Implementation of the Ekert 91 Entanglement-Based QKD Protocol.
MIT 6.2410 Final Project. https://github.com/pradeepu191/qkd-e91

License
MIT — see LICENSE.
