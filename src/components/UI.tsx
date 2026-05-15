import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-[#140810] border border-rose-500/15 rounded-3xl p-6 shadow-xl', className)}>{children}</div>
);

export const Input = ({
  label,
  className,
  ...props
}: React.ComponentProps<'input'> & { label?: string }) => (
  <div className="flex flex-col gap-1 w-full min-w-0">
    {label && (
      <label className="text-[9px] font-black uppercase text-rose-300/45 tracking-widest ml-0.5">{label}</label>
    )}
    <input
      {...props}
      className={cn(
        'block w-full min-w-0 bg-rose-950/40 border border-rose-500/20 rounded-lg px-2 py-1.5 outline-none focus:border-rose-400/50 focus:bg-rose-950/60 transition-all font-medium text-xs text-rose-50',
        className
      )}
    />
  </div>
);

export const Badge = ({ children, color = 'pink' }: { children: React.ReactNode; color?: string }) => (
  <span
    className={cn(
      'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter',
      color === 'pink' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/5 text-white/40'
    )}
  >
    {children}
  </span>
);
