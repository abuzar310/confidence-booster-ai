import React, { useEffect, useRef } from 'react';
import { X, Music, Volume2, Play } from 'lucide-react';
import { PhonkTrackId } from '../types';
import { phonkAudio, PHONK_TRACKS } from '../services/phonkAudioEngine';

interface SoundboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack: PhonkTrackId;
  onSelectTrack: (track: PhonkTrackId) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export const SoundboardModal: React.FC<SoundboardModalProps> = ({
  isOpen,
  onClose,
  selectedTrack,
  onSelectTrack,
  volume,
  onVolumeChange
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center bg-ink-deep/60 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracks-title"
        onClick={(e) => e.stopPropagation()}
        className="glass sheet-enter rounded-t-film sm:rounded-film max-w-lg w-full max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
      >
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-brand" aria-hidden />
            <h2 id="tracks-title" className="font-display text-xl text-balance">
              Tracks
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--foreground-muted)] hover:text-white rounded-film"
            aria-label="Close tracks"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-film bg-white/5 p-3">
          <Volume2 className="w-4 h-4 text-brand-accent" aria-hidden />
          <span className="text-sm">Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 accent-brand cursor-pointer h-2 min-h-11"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
          />
          <span className="text-sm font-medium tabular-nums w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </label>

        <div className="flex flex-col gap-2" role="listbox" aria-label="Tracks">
          {(['montagem_tomada', 'marlon_mogged', 'mogger'] as PhonkTrackId[]).map((trackId) => {
            const track = PHONK_TRACKS[trackId];
            const isSelected = selectedTrack === trackId;
            return (
              <div
                key={trackId}
                className={`flex items-center justify-between p-2 pl-3 rounded-film border ${
                  isSelected
                    ? 'border-brand bg-brand/15'
                    : 'border-[var(--color-border)] bg-white/5'
                }`}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelectTrack(trackId)}
                  className="flex-1 min-h-11 text-left"
                >
                  <div className="text-sm font-semibold">{track.title}</div>
                  <div className="text-xs text-[var(--foreground-muted)] mt-0.5">
                    {track.bpm} BPM · {track.vibe}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void phonkAudio.unlock();
                    phonkAudio.playEditSequence(trackId);
                  }}
                  className="min-h-11 px-3 rounded-film bg-white/10 hover:bg-brand hover:text-white text-sm inline-flex items-center gap-1"
                  aria-label={`Preview ${track.title}`}
                >
                  <Play className="w-4 h-4" aria-hidden />
                  Preview
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
