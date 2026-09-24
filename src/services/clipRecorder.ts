import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  Mp4OutputFormat,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

let aacEncoderRegistered = false;
async function ensureAacSupport() {
  if (aacEncoderRegistered) return;
  try {
    const hasNativeAac = await canEncodeAudio('aac');
    if (!hasNativeAac) {
      registerAacEncoder();
      console.log('Mediabunny AAC WASM encoder registered successfully.');
    }
  } catch {
    registerAacEncoder();
  }
  aacEncoderRegistered = true;
}

export class ClipRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private lastBlobUrl: string | null = null;
  private lastMp4BlobUrl: string | null = null;
  private isRecording = false;
  private captureTracks: MediaStreamTrack[] = [];
  private isConverting = false;
  private conversionPromise: Promise<string | null> | null = null;
  private onStateChange: ((converting: boolean) => void) | null = null;

  public setOnStateChange(cb: (converting: boolean) => void) {
    this.onStateChange = cb;
  }

  public getIsConverting(): boolean {
    return this.isConverting;
  }

  private stopCaptureTracks() {
    for (const track of this.captureTracks) {
      try {
        if (track.kind === 'video') track.stop();
      } catch {
        // already stopped
      }
    }
    this.captureTracks = [];
  }

  public startRecording(canvas: HTMLCanvasElement, audioStream: MediaStream | null) {
    this.stopRecording();
    this.stopCaptureTracks();
    this.recordedChunks = [];

    // Clean up previous URLs to free memory
    if (this.lastBlobUrl) {
      URL.revokeObjectURL(this.lastBlobUrl);
      this.lastBlobUrl = null;
    }
    if (this.lastMp4BlobUrl) {
      URL.revokeObjectURL(this.lastMp4BlobUrl);
      this.lastMp4BlobUrl = null;
    }
    this.conversionPromise = null;
    this.isConverting = false;
    this.onStateChange?.(false);

    try {
      const canvasStream = canvas.captureStream(30); // 30 fps
      const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          combinedTracks.push(track);
        });
      }

      const combinedStream = new MediaStream(combinedTracks);
      this.captureTracks = combinedTracks;

      // Prioritize standard MP4 container first, fallback to WebM
      const preferredMimeTypes = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];

      const mimeType = preferredMimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: 4000000 // High quality 4.0 Mbps
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.stopCaptureTracks();
        if (this.recordedChunks.length > 0) {
          const rawBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
          this.lastBlobUrl = URL.createObjectURL(rawBlob);

          // Begin background processing into universal fast-start MP4
          this.isConverting = true;
          this.onStateChange?.(true);

          this.conversionPromise = this.processBlobToMp4(rawBlob)
            .then((mp4Blob) => {
              if (this.lastMp4BlobUrl) {
                URL.revokeObjectURL(this.lastMp4BlobUrl);
              }
              this.lastMp4BlobUrl = URL.createObjectURL(mp4Blob);
              this.isConverting = false;
              this.onStateChange?.(false);
              return this.lastMp4BlobUrl;
            })
            .catch((err) => {
              console.warn('[ClipRecorder] MP4 conversion error, falling back to raw blob:', err);
              this.isConverting = false;
              this.onStateChange?.(false);
              return this.lastBlobUrl;
            });
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (err) {
      this.stopCaptureTracks();
      this.isRecording = false;
      this.mediaRecorder = null;
      console.warn('MediaRecorder error:', err);
    }
  }

  private async processBlobToMp4(blob: Blob): Promise<Blob> {
    await ensureAacSupport();

    const input = new Input({
      source: new BlobSource(blob),
      formats: ALL_FORMATS,
    });

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });

    const hasAvc = await canEncodeVideo('avc');
    const primaryAudio = await input.getPrimaryAudioTrack();

    const conversion = await Conversion.init({
      input,
      output,
      video: hasAvc ? { codec: 'avc' } : undefined,
      audio: primaryAudio ? { codec: 'aac' } : { discard: true },
      showWarnings: false,
    });

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Mediabunny output buffer is empty');
    }

    console.log(`[ClipRecorder] Fast-start MP4 conversion complete! Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    return new Blob([buffer], { type: 'video/mp4' });
  }

  public stopRecording(): string | null {
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    return this.lastMp4BlobUrl || this.lastBlobUrl;
  }

  public getLastDownloadUrl(): string | null {
    return this.lastMp4BlobUrl || this.lastBlobUrl;
  }

  public async downloadLastClip(filename = 'sigma_phonk_edit.mp4'): Promise<void> {
    if (this.isConverting && this.conversionPromise) {
      await this.conversionPromise;
    }
    const downloadUrl = this.lastMp4BlobUrl || this.lastBlobUrl;
    if (!downloadUrl) return;

    // iOS Safari ignores <a download>. Use the share sheet when we can.
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch {
      // fall through to anchor download
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const clipRecorder = new ClipRecorder();
