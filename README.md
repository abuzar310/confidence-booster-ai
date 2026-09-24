# Confidence Booster

Phone-first webcam editor. Sip, fix your glasses, or tap Drop. A phonk cut plays over your camera. Save the MP4 when it ends.

Everything runs in the browser. The camera and mic never leave the device.

## Stack

React 18 · TypeScript · Vite 6 · Tailwind · MediaPipe Face/Hand Landmarker · Web Audio · Mediabunny MP4

## Run locally

```bash
git clone https://github.com/abuzar310/confidence-booster-ai.git
cd confidence-booster-ai
npm install
npm run dev
```

Open the URL Vite prints. Allow the camera. Tap **Start camera**.

Phone on the same Wi-Fi: use the Network URL. Camera on a phone needs HTTPS (deploy, or a tunnel) unless you are on `localhost`.

Needs Node 18+ and a Chromium browser with hardware acceleration on.

## Use

| Control | What it does |
|---|---|
| **Start camera** | Unlocks audio and the webcam |
| **Drop** / Space | Plays the cut now |
| **Ghost / Sigma / Manga** | Edit style |
| Sip or glasses | Auto-triggers while Live |
| Tracks | Volume and preview |
| Save clip | Downloads the last MP4 (share sheet on iOS) |

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve `dist/` |

## Privacy

No analytics, no upload. Frames stay in the browser.

## License

MIT. See [LICENSE](LICENSE).
