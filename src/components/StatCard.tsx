import { LucideIcon } from 'lucide-react';
import { Panel, Input, cn } from './UI';

interface StatCardProps {
  title: string;
  icon: LucideIcon;
  stats: {
    label: string;
    value: number;
    key: string;
  }[];
  onUpdate: (key: string, val: number) => void;
  compact?: boolean;
}

export const StatCard = ({ title, icon: Icon, stats, onUpdate, compact }: StatCardProps) => (
  <Panel
    className={cn(
      'flex flex-col rounded-xl border border-rose-500/18 shadow-none',
      compact ? 'gap-2 p-2' : 'gap-6 p-8 rounded-3xl border-rose-500/15'
    )}
  >
    <div className={cn('flex items-center text-rose-400', compact ? 'gap-1.5' : 'gap-3')}>
      <Icon size={compact ? 12 : 18} />
      <span className={cn('font-black uppercase tracking-wider', compact ? 'text-[9px]' : 'text-[10px] tracking-[0.2em]')}>
        {title}
      </span>
    </div>

    <div className={cn('grid grid-cols-2', compact ? 'gap-1.5' : 'gap-4')}>
      {stats.map((s) => (
        <Input
          key={s.key}
          label={s.label}
          type="number"
          value={s.value}
          className={compact ? '!py-1.5 !text-xs' : undefined}
          onChange={(e) => onUpdate(s.key, Number(e.target.value))}
        />
      ))}
    </div>
  </Panel>
);
