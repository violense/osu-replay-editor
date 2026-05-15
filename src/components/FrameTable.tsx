import { memo } from 'react';
import { Clock, MousePointer } from 'lucide-react';
import { FRAME_TABLE_VISIBLE_ROWS } from '../config/replay';
import { ReplayFrame } from '../types/replay';
import { Badge, cn } from './UI';

const cellClass =
  'w-full min-w-0 bg-transparent border border-rose-500/20 rounded-md px-2 py-1 text-rose-50/90 outline-none focus:border-rose-400/55';

type FrameTableProps = {
  frames: ReplayFrame[];
  onFramePatch?: (index: number, patch: Partial<ReplayFrame>) => void;
  visibleLimit?: number;
  compact?: boolean;
  className?: string;
};

export const FrameTable = memo(
  ({
    frames,
    onFramePatch,
    visibleLimit = FRAME_TABLE_VISIBLE_ROWS,
    compact,
    className,
  }: FrameTableProps) => {
    const slice = frames.slice(0, visibleLimit);
    const editable = Boolean(onFramePatch);
    const cellPad = compact ? 'px-2 py-1' : 'px-4 py-2';
    const headPad = compact ? 'px-2 py-2' : 'px-4 py-4';

    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div
          className={cn(
            'border-b border-white/5 flex items-center justify-between bg-white/[0.01]',
            compact ? 'p-2' : 'p-6'
          )}
        >
          <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
            <MousePointer size={compact ? 14 : 18} className="text-rose-400" />
            <h3
              className={cn(
                'font-bold uppercase tracking-widest text-white/80',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            >
              Frames
            </h3>
          </div>
          <Badge>{frames.length.toLocaleString()} frames</Badge>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto font-mono scrollbar-hide',
            compact ? 'text-[10px] max-h-36' : 'text-[11px] min-h-[320px] max-h-[520px]'
          )}
        >
          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 bg-[#140810] text-rose-300/35 uppercase text-[9px] z-10">
              <tr>
                <th className={cn(headPad, 'text-left font-black w-[22%]')}>Time Δ</th>
                <th className={cn(headPad, 'text-left font-black w-[26%]')}>X</th>
                <th className={cn(headPad, 'text-left font-black w-[26%]')}>Y</th>
                <th className={cn(headPad, 'text-right font-black w-[26%]')}>Keys</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {slice.map((f, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-white/[0.02] transition-colors',
                    compact ? 'hover:bg-white/[0.02]' : 'hover:bg-rose-500/[0.06] group'
                  )}
                >
                  <td className={cn(cellPad, 'text-rose-200/75 align-middle')}>
                    {editable ? (
                      <input
                        type="number"
                        className={cellClass}
                        value={f.timeDelta}
                        onChange={(e) => onFramePatch?.(i, { timeDelta: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Clock size={10} className="opacity-30" /> {f.timeDelta}ms
                      </span>
                    )}
                  </td>
                  <td className={cn(cellPad, 'align-middle')}>
                    {editable ? (
                      <input
                        type="number"
                        step="any"
                        className={cellClass}
                        value={f.x}
                        onChange={(e) => onFramePatch?.(i, { x: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="text-white/60">{f.x.toFixed(2)}</span>
                    )}
                  </td>
                  <td className={cn(cellPad, 'align-middle')}>
                    {editable ? (
                      <input
                        type="number"
                        step="any"
                        className={cellClass}
                        value={f.y}
                        onChange={(e) => onFramePatch?.(i, { y: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="text-white/60">{f.y.toFixed(2)}</span>
                    )}
                  </td>
                  <td className={cn(cellPad, 'text-right align-middle')}>
                    {editable ? (
                      <input
                        type="number"
                        className={`${cellClass} text-right`}
                        value={f.keys}
                        onChange={(e) => onFramePatch?.(i, { keys: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="bg-white/5 px-2 py-1 rounded text-white/40 group-hover:text-white/80 transition-colors">
                        {f.keys}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {frames.length > visibleLimit && (
            <div
              className={cn(
                'text-center text-white/20 uppercase font-bold tracking-widest',
                compact ? 'p-2 text-[9px]' : 'p-6 text-[10px]'
              )}
            >
              Showing {visibleLimit.toLocaleString()} of {frames.length.toLocaleString()} frames
            </div>
          )}
        </div>
      </div>
    );
  }
);
