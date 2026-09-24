import { mobileDetector } from './mobileDetector';

export class CameraManager {
  private currentStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private facingMode: 'user' | 'environment' = 'user';
  private isMirrored = true;

  public async init(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.videoElement = videoElement;
    this.prepareVideoEl(videoElement);
    return this.startStream();
  }

  private prepareVideoEl(el: HTMLVideoElement) {
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.playsInline = true;
    el.muted = true;
    el.autoplay = true;
  }

  private async attachStream(stream: MediaStream): Promise<void> {
    this.currentStream = stream;
    const [track] = stream.getVideoTracks();
    if (track) {
      try {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as MediaTrackCapabilities & { zoom?: { min: number } };
        if (capabilities?.zoom && typeof capabilities.zoom.min === 'number') {
          await track.applyConstraints({ advanced: [{ zoom: capabilities.zoom.min } as MediaTrackConstraintSet] });
        }
      } catch {
        // zoom is optional
      }
    }
    if (this.videoElement) {
      this.prepareVideoEl(this.videoElement);
      this.videoElement.srcObject = stream;
      await this.videoElement.play();
    }
  }

  public async startStream(): Promise<MediaStream> {
    const hadStream = !!this.currentStream;
    this.stopStream();
    // iOS needs a beat after stop() before the next getUserMedia
    if (hadStream && mobileDetector.isIOS()) {
      await new Promise((r) => setTimeout(r, 120));
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API is not available. Use Safari or Chrome over HTTPS.');
    }

    const isPhone = mobileDetector.isMobile();
    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: isPhone ? 640 : 1280 },
          height: { ideal: isPhone ? 480 : 720 },
          frameRate: { ideal: isPhone ? 24 : 30, max: 30 }
        },
        audio: false
      },
      { video: { facingMode: { exact: this.facingMode } }, audio: false },
      { video: { facingMode: this.facingMode }, audio: false },
      { video: true, audio: false }
    ];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await this.attachStream(stream);
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Camera access failed');
  }

  public async toggleFacingMode(): Promise<'user' | 'environment'> {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.isMirrored = this.facingMode === 'user';
    await this.startStream();
    return this.facingMode;
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public isFrontCamera(): boolean {
    return this.facingMode === 'user';
  }

  public toggleMirror(): boolean {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  public getIsMirrored(): boolean {
    return this.isMirrored;
  }

  public getStream(): MediaStream | null {
    return this.currentStream;
  }

  public stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

export const cameraManager = new CameraManager();
