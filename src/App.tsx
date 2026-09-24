import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

import { TriggerMode, FaceData, PhonkTrackId, FrameRecord, EditPresetId } from './types';
import { cameraManager } from './services/cameraManager';
import { frameBuffer } from './services/frameBuffer';
import { visionDetector } from './services/visionDetector';
import { phonkAudio } from './services/phonkAudioEngine';
import { sigmaEditRenderer } from './services/sigmaEditRenderer';
import { clipRecorder } from './services/clipRecorder';
import { draw3dTargetCube } from './services/cube3dRenderer';
import { unthrottledDriver } from './services/unthrottledDriver';
import { mobileDetector } from './services/mobileDetector';

import { PipPlayer, PipState } from './components/PipPlayer';
import { ControlsBar } from './components/ControlsBar';
import { SoundboardModal } from './components/SoundboardModal';
import { Viewfinder } from './components/Viewfinder';

export const App: React.FC = () => {
  // Application & PIP States
  const [pipState, setPipState] = useState<PipState>('STANDBY');
  const pipStateRef = useRef<PipState>('STANDBY');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(true);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('both');
  const [selectedPreset, setSelectedPreset] = useState<EditPresetId>('ghost_trail_impact');
  const [sensitivity, setSensitivity] = useState(1.0);

  // Audio State
  const [soundMuted, setSoundMuted] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<PhonkTrackId>('montagem_tomada');
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.9);
  const [hasDownloadableClip, setHasDownloadableClip] = useState(false);
  const [isConvertingMp4, setIsConvertingMp4] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bufferHint, setBufferHint] = useState<string | null>(null);

  // Invalidates in-flight edit timeouts / audio .then() so skip cannot restart a session.
  const editGenRef = useRef(0);
  const editTimersRef = useRef<number[]>([]);

  // Edit Playback configuration
  const streamTakeoverMode: 'pip' | 'fullscreen' = 'fullscreen';
  const autoCyclePresets = true;

  // Vision State
  const defaultFace: FaceData = {
    detected: false,
    box: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
    pitch: 0,
    yaw: 0,
    roll: 0,
    mouthCenter: { x: 0.5, y: 0.65 },
    noseBridge: { x: 0.5, y: 0.45 },
    leftEye: { x: 0.4, y: 0.4 },
    rightEye: { x: 0.6, y: 0.4 },
    confidence: 0
  };
  const faceDataRef = useRef<FaceData>(defaultFace);

  // DOM Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active replay frames ref to protect from premature GPU memory release
  const activeReplayFramesRef = useRef<FrameRecord[] | null>(null);

  const animFrameRef = useRef<number | null>(null);

  // Stable state ref so callbacks never re-trigger or get cancelled by frame-by-frame re-renders
  const stateRef = useRef({
    faceData: defaultFace,
    isMirrored,
    selectedTrack,
    selectedPreset
  });
  useEffect(() => {
    stateRef.current = { faceData: faceDataRef.current, isMirrored, selectedTrack, selectedPreset };
  });

  // Listen to clip recorder state. Do NOT create AudioContext on mount (iOS blocks it).
  useEffect(() => {
    clipRecorder.setOnStateChange((converting) => {
      setIsConvertingMp4(converting);
    });
  }, []);

  // Cover the visible viewport (iOS URL bar / home indicator is not 100vh)
  useEffect(() => {
    const handleResize = () => {
      const liveCanvas = liveCanvasRef.current;
      if (liveCanvas) {
        const { width, height } = mobileDetector.getViewportSize();
        liveCanvas.width = width;
        liveCanvas.height = height;
      }
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const clearEditTimers = () => {
    for (const id of editTimersRef.current) window.clearTimeout(id);
    editTimersRef.current = [];
  };

  const finishEditSession = useCallback(() => {
    editGenRef.current += 1;
    clearEditTimers();
    sigmaEditRenderer.stop();
    phonkAudio.stop();
    clipRecorder.stopRecording();
    setHasDownloadableClip(true);
    visionDetector.resetCooldown();
    pipStateRef.current = 'STANDBY';
    setPipState('STANDBY');
    frameBuffer.stopLiveSession();
    if (activeReplayFramesRef.current) {
      frameBuffer.releaseClip(activeReplayFramesRef.current);
      activeReplayFramesRef.current = null;
    }
  }, []);

  // Step 1: Action Trigger (Drink sip, glasses adjust, or SPACEBAR)
  // Present-Clips Editing: Starts recording user's present action from this moment onwards!
  const triggerAction = useCallback((actionType: 'drink' | 'glasses' | 'manual') => {
    if (pipStateRef.current !== 'STANDBY') return;
    void phonkAudio.unlock();

    if (frameBuffer.getFrameCount() < 5) {
      setBufferHint('Camera warming up — tap Drop again');
      window.setTimeout(() => setBufferHint(null), 2000);
      return;
    }
    setBufferHint(null);

    const actionClip = frameBuffer.getReplayClip(3500);
    activeReplayFramesRef.current = actionClip;

    frameBuffer.stopLiveSession();
    frameBuffer.startLiveSession(0);
    const sessionStartTime = frameBuffer.getSessionStartTimestamp();

    const gen = ++editGenRef.current;
    pipStateRef.current = 'EDITING';
    setPipState('EDITING');

    const t1 = window.setTimeout(() => {
      if (editGenRef.current !== gen) return;
      pipStateRef.current = 'PLAYING';
      setPipState('PLAYING');

      const t2 = window.setTimeout(() => {
        if (editGenRef.current !== gen) return;
        const targetCanvas = editCanvasRef.current;

        if (!targetCanvas || frameBuffer.getFrameCount() === 0) {
          finishEditSession();
          return;
        }

        if (streamTakeoverMode === 'fullscreen') {
          const { width, height } = mobileDetector.getViewportSize();
          targetCanvas.width = width;
          targetCanvas.height = height;
        } else {
          targetCanvas.width = 640;
          targetCanvas.height = 640;
        }

        // Start video recording for 1-click download
        clipRecorder.startRecording(targetCanvas, phonkAudio.getAudioStream());

        let completed = false;
        const handlePlaybackComplete = () => {
          if (completed || editGenRef.current !== gen) return;
          completed = true;
          finishEditSession();
          if (autoCyclePresets) {
            const cycleOrder: EditPresetId[] = ['ghost_trail_impact', 'dark_manga_strobe', 'sigma_hard_snaps'];
            const cur = stateRef.current.selectedPreset;
            const curIdx = cycleOrder.indexOf(cur);
            const nextIdx = (curIdx + 1) % cycleOrder.length;
            handleSelectPreset(cycleOrder[nextIdx]);
          }
        };

        phonkAudio.playEditSequence(
          stateRef.current.selectedTrack,
          () => {
            if (editGenRef.current !== gen) return;
            confetti({
              particleCount: 50,
              spread: 90,
              origin: { x: 0.8, y: 0.5 },
              colors: ['#EC4899', '#5E6AD2', '#EDEDEF', '#FB7185']
            });
          },
          handlePlaybackComplete
        ).then(({ startTime: audioStartTime, durationMs }) => {
          if (editGenRef.current !== gen) {
            phonkAudio.stop();
            return;
          }
          const currentFace = stateRef.current.faceData;
          const currentMirrored = stateRef.current.isMirrored;

          sigmaEditRenderer.startEdit({
            canvas: targetCanvas!,
            preset: stateRef.current.selectedPreset,
            startTime: audioStartTime,
            durationMs,
            sessionStartTime,
            actionFrames: actionClip,
            getPostTriggerMoments: (nowTimestamp: number) =>
              frameBuffer.getPostTriggerMoments(sessionStartTime, nowTimestamp),
            getSessionFrames: () => frameBuffer.getSessionFrames(),
            getCurrentEyeCenter: () => {
              const f = stateRef.current.faceData;
              const m = stateRef.current.isMirrored;
              if (!f.detected) return undefined;
              return {
                x: m ? 1 - f.noseBridge.x : f.noseBridge.x,
                y: (f.leftEye.y + f.rightEye.y) / 2
              };
            },
            actionType,
            isMirrored: currentMirrored,
            eyeCenter: currentFace.detected
              ? {
                  x: currentMirrored ? 1 - currentFace.noseBridge.x : currentFace.noseBridge.x,
                  y: (currentFace.leftEye.y + currentFace.rightEye.y) / 2
                }
              : undefined,
            onDropImpact: () => {
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 150]);
              }
            },
            onComplete: handlePlaybackComplete
          });
        }).catch(() => {
          if (editGenRef.current === gen) finishEditSession();
        });
      }, 50);
      editTimersRef.current.push(t2);
    }, 200);
    editTimersRef.current.push(t1);
  }, [finishEditSession]);

  // Main Camera & AI Loop (Runs continuously, unthrottled in background tabs and minimized windows!)
  useEffect(() => {
    let active = true;
    let isProcessing = false;
    let lastProcessTime = 0;
    let lastBufferPushTime = 0;
    let lastAiDetectTime = 0;

    const processLoop = async (now: number) => {
      if (!active) return;

      const video = videoRef.current;
      const liveCanvas = liveCanvasRef.current;

      if (video && video.readyState >= 2) {
        // Prevent background pause by browser
        if (video.paused) {
          video.play().catch(() => {});
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          // 1. Buffer camera frames for edit replay (Dynamic: 50ms on mobile, 33ms on desktop)
          const bufferPushInterval = mobileDetector.getBufferPushIntervalMs();
          if (now - lastBufferPushTime >= bufferPushInterval) {
            lastBufferPushTime = now;
            frameBuffer.pushFrame(video); // Non-blocking async execution (mutex-protected)
          }

          // 2. Process AI Face Tracking (Dynamic: 90ms on mobile, 50ms on desktop)
          const aiDetectInterval = mobileDetector.getAiDetectIntervalMs();
          if (now - lastAiDetectTime >= aiDetectInterval) {
            lastAiDetectTime = now;
            const result = visionDetector.detect(video, now, triggerMode);
            faceDataRef.current = result.face;

            // Trigger action if detected while in STANDBY
            if (result.triggeredAction && pipStateRef.current === 'STANDBY') {
              triggerAction(result.triggeredAction);
            }
          }

          const currentFace = faceDataRef.current;

          // 3. Render feed at FULL 60 FPS directly on liveCanvas
          if (liveCanvas) {
            const view = mobileDetector.getViewportSize();
            const cw = liveCanvas.width || view.width;
            const ch = liveCanvas.height || view.height;
            const ctx = liveCtxRef.current || liveCanvas.getContext('2d');
            if (ctx) {
              if (!liveCtxRef.current) liveCtxRef.current = ctx;
              ctx.save();
              ctx.clearRect(0, 0, cw, ch);

              // 100% fullscreen cover with ZERO black borders!
              const scale = Math.max(cw / vw, ch / vh);
              const sw = cw / scale;
              const sh = ch / scale;

              // Face-aware auto-framing: keep the user's face centered and upright
              let sx = (vw - sw) / 2;
              let sy = (vh - sh) / 2;

              if (currentFace.detected) {
                const rawFaceX = (currentFace.leftEye.x + currentFace.rightEye.x) / 2;
                const rawFaceY = (currentFace.leftEye.y + currentFace.rightEye.y) / 2;
                const facePixelX = rawFaceX * vw;
                const facePixelY = rawFaceY * vh;

                if (vw > sw) {
                  // Keep face horizontally centered within crop bounds
                  sx = Math.max(0, Math.min(vw - sw, facePixelX - sw / 2));
                }
                if (vh > sh) {
                  // Keep eyes and face positioned comfortably in upper half (38% from top)
                  sy = Math.max(0, Math.min(vh - sh, facePixelY - sh * 0.38));
                }
              }

              if (isMirrored) {
                ctx.translate(cw, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
              } else {
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
              }

              ctx.fillStyle = 'rgba(236, 72, 153, 0.03)';
              ctx.fillRect(0, 0, cw, ch);
              ctx.restore();

              // Draw 3D Target Cube accurately aligned to canvas coordinates!
              if (currentFace.detected) {
                draw3dTargetCube(ctx, currentFace, cw, ch, isMirrored, {
                  sx, sy, sw, sh, dx: 0, dy: 0, dw: cw, dh: ch, vw, vh
                });
              }
            }
          }
        }
      }
    };

    // Unified unthrottled frame runner
    const runFrame = async (now: number) => {
      if (!active) return;
      if (now - lastProcessTime < 13) return; // Enforce ~60-70 FPS maximum
      lastProcessTime = now;

      if (isProcessing) return; // Prevent async queue buildup
      isProcessing = true;
      try {
        await processLoop(now);
      } catch (err) {
        console.error('[processLoop error]:', err);
      } finally {
        isProcessing = false;
      }
    };

    // 1. Worker tick callback: continuously drives frames in background tabs & minimized windows
    const onWorkerTick = (now: number) => {
      runFrame(now);
    };

    // 2. Native RAF loop: drives frames smoothly when the main tab is active/visible
    const onMainRaf = (now: number) => {
      if (!active) return;
      unthrottledDriver.recordRafTick(now);
      runFrame(now);
      animFrameRef.current = requestAnimationFrame(onMainRaf);
    };

    // Register unthrottled worker and start single-flight loop
    const unregisterWorker = unthrottledDriver.register(onWorkerTick);
    animFrameRef.current = requestAnimationFrame(onMainRaf);

    return () => {
      active = false;
      unregisterWorker();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isMirrored, triggerMode, triggerAction]);

  // Camera initialization
  const startCamera = async () => {
    setCameraError(null);
    if (!videoRef.current) return;

    try {
      // Same tap unlocks Web Audio (required on iOS) then camera.
      await phonkAudio.unlock();
      phonkAudio.preloadTomadaAudio();
      phonkAudio.preloadMoggedAudio();
      phonkAudio.preloadMoggerAudio();
      phonkAudio.startKeepAlive();
      cameraManager.setOnEnded(() => {
        setCameraError('Camera stopped. Check permission or close other apps using it.');
        setCameraActive(false);
        setAiReady(false);
      });
      await cameraManager.init(videoRef.current);
      setCameraActive(true);
      setIsMirrored(cameraManager.getIsMirrored());

      const view = mobileDetector.getViewportSize();
      if (liveCanvasRef.current) {
        liveCanvasRef.current.width = view.width;
        liveCanvasRef.current.height = view.height;
      }

      setAiLoading(true);
      let visionTimer = 0;
      const visionTimeout = new Promise<void>((_, reject) => {
        visionTimer = window.setTimeout(() => reject(new Error('Vision model timed out')), 20000);
      });
      try {
        await Promise.race([visionDetector.initialize(), visionTimeout]);
        setAiReady(visionDetector.isModelReady());
      } catch {
        setAiReady(false);
      } finally {
        window.clearTimeout(visionTimer);
      }
    } catch (err) {
      console.error('Camera startup error:', err);
      const msg = err instanceof Error ? err.message : 'Camera access was denied or not found.';
      setCameraError(`${msg} Allow camera in the browser, use HTTPS (or localhost), and close other apps using the camera.`);
    } finally {
      setAiLoading(false);
    }
  };

  // Keyboard shortcut: SPACEBAR for instant trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerAction('manual');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAction]);

  // Camera toggle
  const handleSwitchCamera = async () => {
    try {
      await cameraManager.toggleFacingMode();
      setIsMirrored(cameraManager.getIsMirrored());
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
  };

  const handleSkipPip = () => {
    finishEditSession();
  };

  useEffect(() => {
    return () => {
      editGenRef.current += 1;
      clearEditTimers();
      sigmaEditRenderer.stop();
      phonkAudio.stop();
      clipRecorder.stopRecording();
      frameBuffer.stopLiveSession();
      if (activeReplayFramesRef.current) {
        frameBuffer.releaseClip(activeReplayFramesRef.current);
        activeReplayFramesRef.current = null;
      }
      cameraManager.stopStream();
    };
  }, []);

  // Preset selector
  const handleSelectPreset = useCallback((preset: EditPresetId) => {
    setSelectedPreset(preset);
    if (preset === 'ghost_trail_impact' || preset === 'parallax_dual_speed') {
      setSelectedTrack('montagem_tomada');
      phonkAudio.preloadTomadaAudio();
    } else if (preset === 'dark_manga_strobe') {
      setSelectedTrack('mogger');
      phonkAudio.preloadMoggerAudio();
    } else {
      setSelectedTrack('marlon_mogged');
      phonkAudio.preloadMoggedAudio();
    }
  }, []);

  // Download Clip in Universal MP4 Format
  const handleDownloadClip = async () => {
    let filename = `sigma_mog_edit_${Date.now()}.mp4`;
    if (selectedPreset === 'ghost_trail_impact' || selectedPreset === 'parallax_dual_speed') {
      filename = `ghost_trail_edit_${Date.now()}.mp4`;
    } else if (selectedPreset === 'dark_manga_strobe') {
      filename = `dark_manga_edit_${Date.now()}.mp4`;
    }
    await clipRecorder.downloadLastClip(filename);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden select-none font-sans text-[var(--foreground)]">
      
      {/* WebRTC source video (tiny, not display:none — iOS stops decoding hidden videos) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '4px',
          height: '4px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -9999
        }}
      />

      {/* Camera Permission / Welcome Screen */}
      {!cameraActive && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center p-4 overflow-hidden">
          <div className="ambient-blob w-72 h-72 bg-brand top-[-10%] left-[-10%] motion-safe:animate-pulse" />
          <div className="ambient-blob w-64 h-64 bg-brand-accent bottom-[-8%] right-[-8%]" />
          <div className="relative max-w-md w-full p-7 glass rounded-film flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center text-brand">
              <Camera className="w-8 h-8" aria-hidden />
            </div>

            <div>
              <h1 className="font-display text-4xl text-glow-pink text-balance">
                Confidence Booster
              </h1>
              <p className="text-[var(--foreground-muted)] text-base mt-3 leading-relaxed max-w-sm mx-auto">
                Sip, fix your glasses, or tap Drop. The cut plays over your camera.
              </p>
            </div>

            {cameraError ? (
              <div className="w-full p-4 rounded-film border border-red-500/50 bg-red-950/40 text-red-100 text-sm text-left" role="alert">
                <p className="font-semibold mb-1">Camera blocked</p>
                <p className="text-red-100/90 leading-relaxed break-words">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-3 min-h-11 w-full rounded-film bg-color-destructive bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
                >
                  Try camera again
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <ol className="text-left text-[15px] leading-relaxed text-[var(--foreground)] space-y-2">
                  <li><span className="text-brand font-semibold">1</span> &nbsp;Allow the camera.</li>
                  <li><span className="text-brand font-semibold">2</span> &nbsp;Sip, adjust glasses, or tap Drop.</li>
                  <li><span className="text-brand font-semibold">3</span> &nbsp;Save the MP4 when it ends.</li>
                </ol>

                <button
                  type="button"
                  onClick={startCamera}
                  className="min-h-12 w-full rounded-film bg-brand text-brand-fg font-semibold text-base shadow-[0_0_28px_rgba(236,72,153,0.35)] inline-flex items-center justify-center gap-2 hover:brightness-110"
                >
                  <Zap className="w-5 h-5" aria-hidden />
                  Start camera
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Fullscreen Webcam Canvas */}
      <canvas
        ref={liveCanvasRef}
        className="w-full h-full object-cover block"
      />
      {cameraActive && <Viewfinder />}

      {/* Status + tap-to-drop on the live feed */}
      {cameraActive && (
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-40 pointer-events-none">
          <div
            className={`px-3 min-h-9 rounded-full text-xs font-medium flex items-center gap-2 glass ${
              aiLoading
                ? 'text-amber-200'
                : aiReady
                ? 'text-[var(--foreground)]'
                : 'text-red-200'
            }`}
            role="status"
            aria-live="polite"
          >
            <span className={`w-2 h-2 rounded-full ${aiLoading ? 'bg-amber-400 motion-safe:animate-pulse' : aiReady ? 'bg-brand-accent' : 'bg-red-400'}`} />
            <span>{aiLoading ? 'Loading AI' : aiReady ? 'Live' : 'Camera on — Drop still works'}</span>
          </div>
          {bufferHint && (
            <div className="mt-2 px-3 min-h-9 rounded-full text-xs font-medium glass text-[var(--foreground)]" role="status">
              {bufferHint}
            </div>
          )}
        </div>
      )}

      {/* PICTURE-IN-PICTURE / FULLSCREEN VIDEO PLAYER */}
      {cameraActive && (
        <PipPlayer
          state={pipState}
          editCanvasRef={editCanvasRef}
          onSkip={handleSkipPip}
          onDownload={handleDownloadClip}
          canDownload={hasDownloadableClip}
          isConverting={isConvertingMp4}
          takeoverMode={streamTakeoverMode}
        />
      )}

      {/* Minimal Bottom Controls Bar */}
      {cameraActive && (
        <ControlsBar
          onSwitchCamera={handleSwitchCamera}
          onToggleMirror={() => setIsMirrored(cameraManager.toggleMirror())}
          isMirrored={isMirrored}
          soundMuted={soundMuted}
          onToggleSound={() => {
            const next = !soundMuted;
            setSoundMuted(next);
            phonkAudio.setMuted(next);
          }}
          onOpenSoundboard={() => setIsSoundboardOpen(true)}
          triggerMode={triggerMode}
          onChangeTriggerMode={setTriggerMode}
          selectedPreset={selectedPreset}
          onChangePreset={handleSelectPreset}
          onForceTrigger={() => triggerAction('manual')}
          onDownloadClip={handleDownloadClip}
          hasDownloadableClip={hasDownloadableClip}
          isConverting={isConvertingMp4}
          sensitivity={sensitivity}
          onChangeSensitivity={(v) => {
            setSensitivity(v);
            visionDetector.setSensitivity(v);
          }}
          isEditing={pipState !== 'STANDBY'}
        />
      )}

      {/* Soundboard Modal */}
      <SoundboardModal
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        selectedTrack={selectedTrack}
        onSelectTrack={setSelectedTrack}
        volume={masterVolume}
        onVolumeChange={(v) => {
          setMasterVolume(v);
          phonkAudio.setVolume(v);
        }}
      />

    </div>
  );
};

export default App;
