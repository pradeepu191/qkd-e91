# qkd-e91

Browser-based control software for running the **Ekert 91**
entanglement-based quantum key distribution protocol on the
qutools quEDU educational SPDC platform.

Built as part of MIT's 6.2410 final project, Spring 2026, by Deepu Pradeep,
Rushil Shah, Daniel Xu, Gideon Tzafriri, and Harshil Avlani.

## What's in this repo

- **`qkd_e91.html`** — the control panel. A single static page; no
  install step, no build step. Open it in a browser.
- **`proxy.js`** — a small Node.js reverse proxy needed to bridge
  the browser to the device.
- **`docs/`** — written documentation for users and developers.

## Documentation

- [**Getting started**](docs/getting-started.md) — step-by-step from
  cloning the repo to running your first calibration. Start here if
  you're a new student.
- [**Architecture & internals**](docs/architecture.md) — how the
  software talks to the quED at the network level, what data flows
  where, and why some of the design choices were made the way they
  were.
- [**Troubleshooting**](docs/troubleshooting.md) — common failure
  modes we hit during the project and how to fix them.

## Citation

If you use this code or build on it for a 6.2410 project or other
academic work, please cite:

> Pradeep, D., Shah, R., Xu, D., Tzafriri, G., and Avlani, H. (2026).
> *Experimental Implementation of the Ekert 91 Entanglement-Based QKD Protocol.*
> MIT 6.2410 Final Project. https://github.com/pradeepu191/qkd-e91

## License

MIT — see [LICENSE](LICENSE).
