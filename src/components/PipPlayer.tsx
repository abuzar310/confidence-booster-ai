import React from 'react';
import { Download, X, Loader2 } from 'lucide-react';

export type PipState = 'STANDBY' | 'EDITING' | 'PLAYING';

interface PipPlayerProps {
  state: PipState;
  editCanvasRef: React.RefObject<HTMLCanvasElement>;
  onSkip: () => void;
  onDownload: () => void;
  canDownload: boolean;
  isConverting?: boolean;
  takeoverMode?: 'pip' | 'fullscreen';
}

export const PipPlayer: React.FC<PipPlayerProps> = ({
  state,
  editCanvasRef,
  onSkip,
  onDownload,
  canDownload,
  isConverting = false,
  takeoverMode = 'fullscreen'
}) => {
  const isPlaying = state === 'PLAYING';
  const isEditing = state === 'EDITING';
  const isFullscreen = isPlaying && takeoverMode === 'fullscreen';
  const isActive = isPlaying || isEditing;
  const status = isPlaying ? 'Playing' : isEditing ? 'Locking' : 'Ready';

  return (
    <div
      className={`absolute overflow-hidden ${
        !isActive
          ? 'pointer-events-none opacity-0 w-px h-px -z-10'
          : isFullscreen
          ? 'inset-0 w-full h-full z-40 bg-ink-deep flex flex-col'
          : isPlaying
          ? 'top-4 right-4 bottom-20 w-[42%] max-w-lg bg-ink-deep border border-[var(--color-border)] rounded-film flex flex-col z-[20]'
          : 'top-4 right-4 w-52 h-36 md:w-64 md:h-44 glass rounded-film z-[20]'
      }`}
      aria-hidden={!isActive}
    >
      {isActive && (
        <div
          className={`flex items-center justify-between z-[30] select-none ${
            isFullscreen
              ? 'absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 glass rounded-full gap-1 pl-3 pr-1'
              : 'px-3 py-1.5 border-b border-[var(--color-border)] flex-shrink-0 bg-ink-elevated/90'
          }`}
        >
          <div className="flex items-center gap-2 min-h-11 pr-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying
                  ? 'bg-brand motion-safe:animate-pulse'
                  : isEditing
                  ? 'bg-amber-400 motion-safe:animate-pulse'
                  : 'bg-brand-accent'
              }`}
              aria-hidden
            />
            <span className="text-xs font-medium">{status}</span>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-1 pointer-events-auto">
              {canDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={isConverting}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--foreground)] hover:text-white disabled:opacity-50"
                  aria-label={isConverting ? 'Converting clip' : 'Save clip'}
                >
                  {isConverting ? (
                    <Loader2 className="w-4 h-4 motion-safe:animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onSkip}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--foreground)] hover:text-white"
                aria-label="Skip edit"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1 w-full h-full overflow-hidden bg-ink-deep flex items-center justify-center">
        {isEditing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-brand/70 border-t-transparent motion-safe:animate-spin" aria-hidden />
            <p className="text-sm font-medium text-[var(--foreground)]">Locking shot</p>
          </div>
        )}

        <canvas
          ref={editCanvasRef}
          className={`w-full h-full ${isFullscreen ? 'object-cover' : 'object-contain'} ${
            isPlaying ? 'opacity-100 block' : 'opacity-0 pointer-events-none'
          }`}
        />
      </div>
    </div>
  );
};
