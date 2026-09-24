# Confidence Booster — real system graph

Traced from imports and execution paths, not filenames. Do not treat this as a React page tree.

## Pipeline

```
CAMERA (getUserMedia)
  → cameraManager.init / startStream
  → hidden <video> (playsinline, 4px, opacity 0.01)
  → unthrottledDriver (RAF + Worker clock)
      ├─ frameBuffer.pushFrame @ 33ms desktop / 50ms mobile
      ├─ visionDetector.detect @ 50ms desktop / 90ms mobile
      └─ live canvas + cube3dRenderer @ ~60fps (13ms floor)
  → trigger (STANDBY only): sip / glasses / Drop / Space
      → getReplayClip(3500) + startLiveSession(0)
      → PipState EDITING (200ms) → PLAYING
      → clipRecorder.startRecording(edit canvas + phonkAudio dest)
      → phonkAudio.playEditSequence → audio clock
      → sigmaEditRenderer.startEdit (synced to audio)
      → onComplete / skip → finishEditSession
      → MediaRecorder onstop → mediabunny AAC/MP4
      → download / iOS share
```

Frequencies stay independent. MediaPipe must not run at 60fps. `processLoop` is async but mutexed (`isProcessing`) so work does not queue on the clock.

## State machine

`PipState`: `STANDBY` → `EDITING` → `PLAYING` → `STANDBY`

- `pipStateRef` is the realtime gate. A trigger while not `STANDBY` is ignored.
- `editGenRef` invalidates in-flight timeouts and `playEditSequence.then`. Skip cannot restart a session.
- `finishEditSession` is the only return path: bump gen, clear timers, stop renderer/audio/recorder, release clip, `STANDBY`.

## Nodes (actual)

| Node | Owner | Inputs | Outputs | Cleanup |
|---|---|---|---|---|
| A/B Camera permission + init | `cameraManager` | user gesture | `MediaStream` + video | `stopStream` (remove `ended` first) |
| C Video stream | hidden `<video>` | stream | decoded frames | `srcObject = null` |
| D Viewport | `mobileDetector` + `visualViewport` | resize/orient | canvas size | listeners off |
| E Frame buffer | `frameBuffer` | video | ImageBitmaps + session | `releaseClip` / `stopLiveSession` / `bitmap.close` |
| F/G/H Vision + face + trigger | `visionDetector` | video, mode | FaceData, action | cooldown; wait if already loading |
| I Trigger SM | `App.triggerAction` | STANDBY + ≥5 frames | EDITING/PLAYING | `editGenRef` |
| J/K Replay + live session | `frameBuffer` | buffer / now | protected bitmaps | `releaseClip` |
| L/M/N/O Audio | `phonkAudio` | tap unlock | clock + dest stream | `stop`; no AudioContext on mount |
| P Preset | ControlsBar → `stateRef` | user | renderer + track | none |
| Q Sigma edit | `sigmaEditRenderer` | frames + audio clock | edit canvas | `stop` |
| R 3D cube | `cube3dRenderer` | face + crop | live overlay | none (per frame) |
| S Live canvas | App loop | video + face | HUD feed | ctx reused |
| T Edit canvas | `PipPlayer` | renderer | record source | skip |
| U PIP | `PipPlayer` | pipState | fullscreen overlay | skip |
| V/W/X Record → MP4 → share | `clipRecorder` | canvas + audio | blob URLs | stop video capture tracks; revoke URLs |
| Y Soundboard | `SoundboardModal` | track/vol | engine | modal close |
| Z UI | ControlsBar / App | React state | refs each frame | — |
| AA Mobile | `mobileDetector` | UA + viewport | intervals, sizes | — |
| AB Cleanup | App unmount + finish | — | all engines stopped | camera + clip + audio + frames |

## Timing (do not collapse)

- Clock: RAF when visible; Worker when RAF stalls ≥18ms
- Buffer: 33 / 50 ms
- Vision: 50 / 90 ms
- Render: ~13 ms floor
- Edit lock: 200 ms then 50 ms canvas settle
- Vision trigger cooldown: 4500 ms
- Buffer warmup: 5 frames before Drop

## Failure recovery

- Camera denied → error card + retry (not infinite loading)
- Camera track `ended` (revoked / stolen) → error + `cameraActive` false. Intentional `stopStream` removes the listener first so flip-camera does not trip this.
- Vision load timeout 20s or model fail → camera stays live, Drop still works
- Concurrent `initialize()` waits (25s ceiling) instead of no-op
- Audio play reject / skip mid-flight → `finishEditSession`
- MediaRecorder constructor throw → stop captured canvas tracks
- MP4 convert fail → fall back to raw blob URL

## Memory

- Rolling buffer closes aged bitmaps unless `protectedBitmaps`
- Replay + session frames released on finish / unmount
- Canvas `captureStream` video tracks stopped on recorder stop/error (audio dest left running)
- Worker blob URL revoked after `new Worker`
- Previous clip object URLs revoked on next `startRecording`
