import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Download,
  Eye,
  FileMusic,
  List,
  MousePointer2,
  Settings2,
  Target,
  Upload,
  User,
} from 'lucide-react';
import { FrameTable } from './components/FrameTable';
import { PlayfieldCanvas } from './components/PlayfieldCanvas';
import { ReplayTimeline } from './components/ReplayTimeline';
import { ReplayTransport } from './components/ReplayTransport';
import { StatCard } from './components/StatCard';
import { Input, Panel, cn } from './components/UI';
import { GAME_MODE_OPTIONS } from './config/game-modes';
import { MOD_HARD_ROCK, MOD_TARGET_PRACTICE } from './config/replay';
import { applyHardRockFlipToHitObjects } from './lib/hit-object-hard-rock';
import { estimateBeatmapOffsetMs } from './lib/replay-map-sync';
import { approachRateWithMods, preemptMsFromApproachRate } from './lib/osu-beatmap-meta';
import { OSREngine } from './lib/osr-engine';
import { parseHitObjectsFromOsuBuffer } from './lib/osu-hitobjects';
import { cumulativeTimes, replayDurationMs } from './lib/replay-time';
import type { OsuParseResult, ParsedHitObject } from './types/beatmap';
import { ReplayData, ReplayFrame } from './types/replay';

function exportFileName(playerName: string) {
  const trimmed = playerName.trim();
  const base = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 120);
  return `${base || 'replay'}.osr`;
}

function hitObjectsForBeatmapSync(objects: ParsedHitObject[], mods: number): ParsedHitObject[] {
  if ((mods & MOD_HARD_ROCK) === 0) return objects;
  return applyHardRockFlipToHitObjects(objects);
}

function offsetHitObjects(objects: ParsedHitObject[], offsetMs: number): ParsedHitObject[] {
  if (offsetMs === 0) return objects;
  return objects.map((o) => {
    if (o.kind === 'circle') return { ...o, time: o.time + offsetMs };
    if (o.kind === 'spinner') return { ...o, time: o.time + offsetMs, endTime: o.endTime + offsetMs };
    return {
      ...o,
      time: o.time + offsetMs,
      ...(o.approxEndMs != null ? { approxEndMs: o.approxEndMs + offsetMs } : {}),
    };
  });
}

export default function App() {
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [replayFileName, setReplayFileName] = useState('');
  const [hitObjects, setHitObjects] = useState<ParsedHitObject[]>([]);
  const [osuParse, setOsuParse] = useState<(OsuParseResult & { source: string }) | null>(null);
  const [beatmapOffsetMs, setBeatmapOffsetMs] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [editOn, setEditOn] = useState(true);
  const [showFrames, setShowFrames] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'gameplay' | 'metadata'>('gameplay');
  const osrInputRef = useRef<HTMLInputElement>(null);
  const osuInputRef = useRef<HTMLInputElement>(null);

  const cum = useMemo(() => (replay ? cumulativeTimes(replay.frames) : []), [replay]);
  const renderHitObjects = useMemo(() => {
    const shifted = offsetHitObjects(hitObjects, beatmapOffsetMs);
    if (!replay || (replay.mods & MOD_HARD_ROCK) === 0) return shifted;
    return applyHardRockFlipToHitObjects(shifted);
  }, [hitObjects, beatmapOffsetMs, replay]);
  const durationMs = useMemo(() => {
    if (!replay) return 0;
    const rd = replayDurationMs(replay.frames);
    const cumEnd = cum.length ? cum[cum.length - 1] : rd;
    const replayEnd = Math.max(rd, cumEnd);
    let lastHitStart = 0;
    for (const o of renderHitObjects) lastHitStart = Math.max(lastHitStart, o.time);
    return Math.max(replayEnd, lastHitStart + 500, 1000);
  }, [replay, cum, renderHitObjects]);

  const beatmapPreemptMs = useMemo(() => {
    const ar = approachRateWithMods(osuParse?.approachRate ?? 5, replay?.mods ?? 0);
    return preemptMsFromApproachRate(ar);
  }, [osuParse?.approachRate, replay?.mods]);

  const playfieldHint = useMemo(() => {
    if (hitObjects.length > 0) return null;
    if (!osuParse) {
      return 'Load the matching osu!standard .osu difficulty. Replay files do not contain hit object geometry.';
    }
    if (osuParse.hitObjectLineCount === 0) {
      return 'No non-empty [HitObjects] section was found. Check that this is a difficulty file, not a storyboard.';
    }
    return `${osuParse.hitObjectLineCount} hit object lines found, but no supported std objects were parsed. Taiko, mania and catch need a different renderer.`;
  }, [hitObjects, osuParse]);

  useEffect(() => {
    if (!replay) return;
    setCurrentTimeMs(0);
    setPlaying(false);
  }, [replay]);

  useEffect(() => {
    if (!playing || !replay) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      setCurrentTimeMs((t) => {
        const next = t + dt;
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, replay, speed, durationMs]);

  const onUploadOsr = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplay(OSREngine.decode(await file.arrayBuffer()));
    setReplayFileName(file.name);
    setHitObjects([]);
    setOsuParse(null);
    setBeatmapOffsetMs(0);
    event.target.value = '';
  };

  const onUploadOsu = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const res = parseHitObjectsFromOsuBuffer(buf);
    setHitObjects(res.objects);
    setOsuParse({ ...res, source: file.name });
    setBeatmapOffsetMs(
      replay ? estimateBeatmapOffsetMs(hitObjectsForBeatmapSync(res.objects, replay.mods), replay.frames) : 0
    );
    event.target.value = '';
  };

  const onDownload = () => {
    if (!replay) return;
    const blob = new Blob([OSREngine.encode(replay)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edited_${exportFileName(replay.playerName)}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const patchReplay = useCallback((patch: Partial<ReplayData>) => {
    setReplay((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchFrame = useCallback((index: number, patch: Partial<ReplayFrame>) => {
    setReplay((prev) => {
      if (!prev) return prev;
      const frames = prev.frames.map((frame, i) => (i === index ? { ...frame, ...patch } : frame));
      return { ...prev, frames };
    });
  }, []);

  const moveCursorAtPlayhead = useCallback(
    (frameIndex: number, x: number, y: number) => {
      patchFrame(frameIndex, { x, y });
    },
    [patchFrame]
  );

  const toggleTargetPracticeMod = useCallback(() => {
    setReplay((prev) => {
      if (!prev) return prev;
      return { ...prev, mods: prev.mods ^ MOD_TARGET_PRACTICE };
    });
  }, []);

  const autoSyncBeatmap = useCallback(() => {
    if (!replay || hitObjects.length === 0) return;
    setBeatmapOffsetMs(estimateBeatmapOffsetMs(hitObjectsForBeatmapSync(hitObjects, replay.mods), replay.frames));
  }, [hitObjects, replay]);

  return (
    <div className="flex flex-col h-[100dvh] min-h-0 bg-[#0a0408] text-rose-50 overflow-hidden">
      <input ref={osrInputRef} type="file" accept=".osr" className="hidden" onChange={onUploadOsr} />
      <input ref={osuInputRef} type="file" accept=".osu" className="hidden" onChange={onUploadOsu} />

      <header className="shrink-0 flex items-center gap-1.5 px-1.5 py-1 border-b border-rose-500/18 bg-[#10060c]">
        <div className="flex items-center gap-1 shrink-0">
          <div className="leading-tight pl-0.5">
            <h1 className="text-[11px] font-black tracking-tight text-rose-50">OSR EDITOR</h1>
            <p className="text-[7px] text-rose-300/40 uppercase tracking-wider">replay</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 text-center px-2">
          <p className="text-[9px] font-mono text-rose-200/85 truncate" title={replayFileName || '—'}>
            {replay ? replayFileName || 'replay.osr' : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/25 text-rose-100/90"
            onClick={() => osrInputRef.current?.click()}
          >
            .osr
          </button>
          <button
            type="button"
            className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/25 text-rose-100/90 flex items-center gap-0.5 max-w-[42%]"
            onClick={() => osuInputRef.current?.click()}
            disabled={!replay}
            title={
              osuParse
                ? `${osuParse.source}: ${osuParse.objects.length} objects · AR ${osuParse.approachRate}`
                : 'Load .osu'
            }
          >
            <FileMusic size={11} /> .osu
            {osuParse && (
              <span className="truncate text-rose-200/80 font-mono">
                ({osuParse.objects.length})
              </span>
            )}
          </button>
          {replay && (
            <button
              type="button"
              onClick={onDownload}
              className="text-[9px] px-1.5 py-0.5 rounded-md bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold flex items-center gap-0.5 shadow-sm shadow-rose-900/40"
            >
              <Download size={11} /> export
            </button>
          )}
        </div>
      </header>

      {!replay ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <button
            type="button"
            className="glass-panel rounded-xl max-w-md w-full py-12 px-5 relative border border-rose-500/25 hover:border-rose-400/35 transition-colors group"
            onClick={() => osrInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <Upload size={36} className="text-pink-400/80 group-hover:scale-105 transition-transform" />
              <p className="text-sm font-bold text-rose-100/95">Open .osr</p>
              <p className="text-[10px] text-rose-300/50">Then load the matching .osu difficulty to render hit objects.</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-0.5 p-0.5">
          <aside className="w-8 shrink-0 flex flex-col gap-0.5 p-0.5 rounded-md border border-rose-500/15 bg-[#140810]">
            <button
              type="button"
              title="Edit: drag on the playfield to patch the frame at the playhead"
              className={cn(
                'p-1 rounded-md flex justify-center',
                editOn ? 'bg-rose-500/25 text-rose-100' : 'text-rose-400/45 hover:bg-rose-950/55'
              )}
              onClick={() => setEditOn(true)}
            >
              <MousePointer2 size={15} />
            </button>
            <button
              type="button"
              title="View only"
              className={cn(
                'p-1 rounded-md flex justify-center',
                !editOn ? 'bg-rose-500/25 text-rose-100' : 'text-rose-400/45 hover:bg-rose-950/55'
              )}
              onClick={() => setEditOn(false)}
            >
              <Eye size={15} />
            </button>
            <button
              type="button"
              title="Frame table"
              className={cn(
                'p-1.5 rounded-md flex justify-center',
                showFrames ? 'bg-rose-500/20 text-rose-200' : 'text-rose-300/45 hover:bg-rose-950/60'
              )}
              onClick={() => setShowFrames((v) => !v)}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              title="Inspector"
              className={cn(
                'p-1.5 rounded-md flex justify-center mt-auto',
                showInspector ? 'bg-rose-500/20 text-rose-200' : 'text-rose-300/45 hover:bg-rose-950/60'
              )}
              onClick={() => setShowInspector((v) => !v)}
            >
              <Settings2 size={15} />
            </button>
          </aside>

          <main className="flex-1 flex flex-col min-w-0 min-h-0 gap-0.5">
            <div className="flex-1 min-h-0 rounded-md border border-rose-500/18 bg-[#0c0409] overflow-hidden flex flex-col">
              <PlayfieldCanvas
                frames={replay.frames}
                cum={cum}
                hitObjects={renderHitObjects}
                currentTimeMs={currentTimeMs}
                preemptMs={beatmapPreemptMs}
                canEdit={editOn}
                onMoveCursor={moveCursorAtPlayhead}
                hint={playfieldHint}
              />
              <ReplayTransport
                currentTimeMs={currentTimeMs}
                durationMs={durationMs}
                playing={playing}
                speed={speed}
                onPlayPause={() => setPlaying((p) => !p)}
                onSeek={setCurrentTimeMs}
                onSpeed={setSpeed}
              />
              <ReplayTimeline
                frames={replay.frames}
                cum={cum}
                durationMs={durationMs}
                currentTimeMs={currentTimeMs}
                hitObjects={renderHitObjects}
                onSeek={setCurrentTimeMs}
              />
            </div>
            {showFrames && (
              <div className="shrink-0 rounded-md border border-rose-500/15 bg-[#140810] overflow-hidden max-h-[38%]">
                <FrameTable frames={replay.frames} onFramePatch={patchFrame} compact visibleLimit={120} />
              </div>
            )}
          </main>

          {showInspector && (
            <aside className="w-[184px] shrink-0 overflow-y-auto rounded-md border border-rose-500/15 bg-[#140810] p-1.5 space-y-1.5 text-[10px]">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-rose-500/15 bg-black/20 p-1">
                {(['gameplay', 'metadata'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      'rounded-md px-1 py-1 text-[8px] font-black uppercase tracking-wider',
                      inspectorTab === tab
                        ? 'bg-rose-500/20 text-rose-100'
                        : 'text-rose-300/45 hover:bg-rose-950/60'
                    )}
                    onClick={() => setInspectorTab(tab)}
                  >
                    {tab === 'gameplay' ? 'Gameplay' : 'Meta'}
                  </button>
                ))}
              </div>

              {inspectorTab === 'gameplay' ? (
                <>
                  <Panel className="p-1.5 rounded-lg border border-rose-500/15 shadow-none">
                    <div className="flex items-center gap-1 mb-1.5 text-rose-300/90">
                      <User size={11} />
                      <span className="font-black uppercase tracking-wider text-[8px]">Player</span>
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        label="Name"
                        value={replay.playerName}
                        className="!py-1.5 !text-xs"
                        onChange={(e) => patchReplay({ playerName: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          label="Score"
                          type="number"
                          value={replay.score}
                          className="!py-1.5 !text-xs"
                          onChange={(e) => patchReplay({ score: Number(e.target.value) })}
                        />
                        <Input
                          label="Combo"
                          type="number"
                          value={replay.maxCombo}
                          className="!py-1.5 !text-xs"
                          onChange={(e) => patchReplay({ maxCombo: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </Panel>

                  <StatCard
                    title="Judgement"
                    icon={Target}
                    stats={[
                      { key: 'count300', label: '300', value: replay.count300 },
                      { key: 'count100', label: '100', value: replay.count100 },
                      { key: 'count50', label: '50', value: replay.count50 },
                      { key: 'countMiss', label: 'miss', value: replay.countMiss },
                    ]}
                    onUpdate={(key, value) => patchReplay({ [key]: value } as Partial<ReplayData>)}
                    compact
                  />

                  <StatCard
                    title="Extra"
                    icon={Award}
                    stats={[
                      { key: 'countGeki', label: 'geki', value: replay.countGeki },
                      { key: 'countKatu', label: 'katu', value: replay.countKatu },
                    ]}
                    onUpdate={(key, value) => patchReplay({ [key]: value } as Partial<ReplayData>)}
                    compact
                  />

                  <Panel className="p-1.5 rounded-lg border border-rose-500/15 shadow-none">
                    <div className="flex items-center gap-1 mb-1.5 text-rose-300/90">
                      <Settings2 size={11} />
                      <span className="font-black uppercase tracking-wider text-[8px]">Sync</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[7px] font-black uppercase text-rose-300/45 ml-0.5">Mode</label>
                        <select
                          className="bg-rose-950/50 border border-rose-500/20 rounded-md px-1.5 py-1 text-[11px] outline-none text-rose-50"
                          value={replay.mode}
                          onChange={(e) => patchReplay({ mode: Number(e.target.value) })}
                        >
                          {GAME_MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Mods"
                        type="number"
                        value={replay.mods}
                        className="!py-1.5 !text-xs"
                        onChange={(e) => patchReplay({ mods: Number(e.target.value) })}
                      />
                      <div className="grid grid-cols-[1fr_auto] gap-1.5 items-end">
                        <Input
                          label="Map offset"
                          type="number"
                          value={beatmapOffsetMs}
                          className="!py-1.5 !text-xs"
                          onChange={(e) => setBeatmapOffsetMs(Number(e.target.value) || 0)}
                        />
                        <button
                          type="button"
                          className="mb-0.5 rounded-md border border-rose-500/20 bg-rose-950/60 px-1.5 py-1 text-[9px] font-bold text-rose-100/80 hover:bg-rose-900/70 disabled:opacity-40"
                          disabled={!replay || hitObjects.length === 0}
                          onClick={autoSyncBeatmap}
                        >
                          sync
                        </button>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-white/20"
                          checked={(replay.mods & MOD_TARGET_PRACTICE) !== 0}
                          onChange={toggleTargetPracticeMod}
                        />
                        Target practice
                      </label>
                      {(replay.mods & MOD_TARGET_PRACTICE) !== 0 && (
                        <Input
                          label="TP sum"
                          type="number"
                          step="any"
                          value={replay.targetPracticeAccuracy ?? ''}
                          className="!py-1.5 !text-xs"
                          onChange={(e) =>
                            patchReplay({
                              targetPracticeAccuracy: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      )}
                      <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-white/20"
                          checked={replay.perfect === 1}
                          onChange={(e) => patchReplay({ perfect: e.target.checked ? 1 : 0 })}
                        />
                        FC
                      </label>
                    </div>
                  </Panel>
                </>
              ) : (
                <Panel className="p-1.5 rounded-lg border border-rose-500/15 shadow-none">
                  <div className="flex items-center gap-1 mb-1.5 text-rose-300/90">
                    <Settings2 size={11} />
                    <span className="font-black uppercase tracking-wider text-[8px]">Metadata</span>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      label="Version"
                      type="number"
                      value={replay.version}
                      className="!py-1.5 !text-xs"
                      onChange={(e) => patchReplay({ version: Number(e.target.value) })}
                    />
                    <Input
                      label="Life"
                      value={replay.lifeBar}
                      className="!py-1.5 !text-xs"
                      onChange={(e) => patchReplay({ lifeBar: e.target.value })}
                    />
                    <Input
                      label="Ticks"
                      value={String(replay.timestamp)}
                      className="!py-1.5 !text-xs"
                      onChange={(e) => {
                        try {
                          patchReplay({ timestamp: BigInt(e.target.value || '0') });
                        } catch {
                          patchReplay({ timestamp: 0n });
                        }
                      }}
                    />
                    <Input
                      label="Score id"
                      value={String(replay.scoreId)}
                      className="!py-1.5 !text-xs"
                      onChange={(e) => {
                        try {
                          patchReplay({ scoreId: BigInt(e.target.value || '0') });
                        } catch {
                          patchReplay({ scoreId: 0n });
                        }
                      }}
                    />
                    <Input
                      label="Beatmap md5"
                      value={replay.beatmapHash}
                      className="!py-1.5 !text-xs font-mono"
                      onChange={(e) => patchReplay({ beatmapHash: e.target.value })}
                    />
                    <Input
                      label="Replay md5"
                      value={replay.replayHash}
                      className="!py-1.5 !text-xs font-mono"
                      onChange={(e) => patchReplay({ replayHash: e.target.value })}
                    />
                  </div>
                </Panel>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
