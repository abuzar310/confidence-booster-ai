import React from 'react';
import {
  Camera,
  FlipHorizontal,
  Volume2,
  VolumeX,
  Zap,
  Download,
  Sliders,
  Maximize,
  Music,
  Eye,
  Coffee,
  Loader2,
  Blend
} from 'lucide-react';
import { TriggerMode, EditPresetId } from '../types';

interface ControlsBarProps {
  onSwitchCamera: () => void;
  onToggleMirror: () => void;
  isMirrored: boolean;
  soundMuted: boolean;
  onToggleSound: () => void;
  onOpenSoundboard: () => void;
  triggerMode: TriggerMode;
  onChangeTriggerMode: (mode: TriggerMode) => void;
  selectedPreset: EditPresetId;
  onChangePreset: (preset: EditPresetId) => void;
  onForceTrigger: () => void;
  onDownloadClip: () => void;
  hasDownloadableClip: boolean;
  isConverting?: boolean;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  isEditing: boolean;
}

const PRESETS: { id: EditPresetId; label: string; short: string }[] = [
  { id: 'ghost_trail_impact', label: 'Ghost', short: 'Ghost' },
  { id: 'sigma_hard_snaps', label: 'Sigma', short: 'Sigma' },
  { id: 'dark_manga_strobe', label: 'Manga', short: 'Manga' }
];

function dropLabel(preset: EditPresetId) {
  if (preset === 'dark_manga_strobe') return 'Manga drop';
  if (preset === 'ghost_trail_impact' || preset === 'parallax_dual_speed') return 'Ghost drop';
  return 'Sigma drop';
}

function iconBtn(active: boolean) {
  return `min-h-11 min-w-11 inline-flex items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-green disabled:opacity-40 ${
    active
      ? 'bg-cyber-green/15 border-cyber-green text-cyber-green'
      : 'bg-black/50 border-white/15 text-zinc-200 hover:border-cyber-green/60 hover:text-white'
  }`;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  onSwitchCamera,
  onToggleMirror,
  isMirrored,
  soundMuted,
  onToggleSound,
  onOpenSoundboard,
  triggerMode,
  onChangeTriggerMode,
  selectedPreset,
  onChangePreset,
  onForceTrigger,
  onDownloadClip,
  hasDownloadableClip,
  isConverting = false,
  sensitivity,
  onChangeSensitivity,
  isEditing
}) => {
  const toggleFullscreen = () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch(() => {});
    } else {
      (document.exitFullscreen || doc.webkitExitFullscreen)?.call(document)?.catch(() => {});
    }
  };

  const cycleTrigger = () => {
    const order: TriggerMode[] = ['both', 'drink', 'glasses'];
    const next = order[(order.indexOf(triggerMode) + 1) % order.length];
    onChangeTriggerMode(next);
  };

  const cycleSens = () => {
    onChangeSensitivity(sensitivity === 1.0 ? 1.5 : sensitivity === 1.5 ? 2.0 : 1.0);
  };

  const triggerIcon =
    triggerMode === 'drink' ? <Coffee className="w-5 h-5" /> : triggerMode === 'glasses' ? <Eye className="w-5 h-5" /> : <Blend className="w-5 h-5" />;

  const triggerName = triggerMode === 'drink' ? 'Drink only' : triggerMode === 'glasses' ? 'Glasses only' : 'Sip or glasses';

  const tools = (
    <>
      <button type="button" onClick={onSwitchCamera} className={iconBtn(false)} aria-label="Switch camera">
        <Camera className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onToggleMirror}
        className={iconBtn(isMirrored)}
        aria-label={isMirrored ? 'Mirror on' : 'Mirror off'}
        aria-pressed={isMirrored}
      >
        <FlipHorizontal className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onToggleSound}
        className={iconBtn(soundMuted)}
        aria-label={soundMuted ? 'Unmute' : 'Mute'}
        aria-pressed={soundMuted}
      >
        {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <button type="button" onClick={onOpenSoundboard} className={iconBtn(false)} aria-label="Tracks and volume">
        <Music className="w-5 h-5" />
      </button>
      <button type="button" onClick={cycleTrigger} className={iconBtn(false)} aria-label={`Trigger: ${triggerName}`}>
        {triggerIcon}
      </button>
      <button
        type="button"
        onClick={cycleSens}
        className={`${iconBtn(false)} px-2.5 min-w-[3.25rem] text-xs font-semibold tracking-wide`}
        aria-label={`Sensitivity ${sensitivity === 1.0 ? 'normal' : sensitivity === 1.5 ? 'high' : 'hyper'}`}
      >
        <Sliders className="w-4 h-4 mr-1 hidden sm:inline" />
        {sensitivity === 1.0 ? '1x' : sensitivity === 1.5 ? '1.5x' : '2x'}
      </button>
      {hasDownloadableClip && (
        <button
          type="button"
          onClick={onDownloadClip}
          disabled={isConverting}
          className={`${iconBtn(true)} px-3 min-w-[2.75rem]`}
          aria-label={isConverting ? 'Converting clip' : 'Download MP4'}
        >
          {isConverting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        </button>
      )}
      <button
        type="button"
        onClick={toggleFullscreen}
        className={`${iconBtn(false)} hidden md:inline-flex`}
        aria-label="Fullscreen"
      >
        <Maximize className="w-5 h-5" />
      </button>
    </>
  );

  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-4 ${isEditing ? 'opacity-0' : ''}`}>
      <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-2 md:max-w-5xl md:flex-row md:items-center md:gap-3">
        <div
          role="tablist"
          aria-label="Edit style"
          className="grid grid-cols-3 rounded-2xl border border-white/10 bg-[#0b0f17]/90 p-1 backdrop-blur-md md:w-72 md:shrink-0"
        >
          {PRESETS.map((preset) => {
            const selected =
              selectedPreset === preset.id ||
              (preset.id === 'ghost_trail_impact' && selectedPreset === 'parallax_dual_speed');
            return (
              <button
                key={preset.id}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={isEditing}
                onClick={() => onChangePreset(preset.id)}
                className={`min-h-11 rounded-xl text-sm font-semibold tracking-wide transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-green disabled:opacity-40 ${
                  selected ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                {preset.short}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onForceTrigger}
          disabled={isEditing}
          aria-keyshortcuts="Space"
          className="min-h-12 w-full md:w-auto md:px-8 rounded-2xl bg-cyber-green text-black text-base font-bold tracking-wide shadow-[0_0_24px_rgba(0,255,102,0.28)] transition-colors duration-150 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" aria-hidden />
          {dropLabel(selectedPreset)}
          <span className="hidden md:inline text-xs font-medium opacity-70">Space</span>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0b0f17]/90 px-2 py-2 backdrop-blur-md md:ml-auto">
          {tools}
        </div>
      </div>
    </div>
  );
};
