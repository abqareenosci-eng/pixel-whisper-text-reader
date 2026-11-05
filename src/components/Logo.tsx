import { Plane } from 'lucide-react';

export function Logo({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const sizes = {
    sm: { box: 'w-8 h-8', icon: 16, text: 'text-base', gap: 'gap-2' },
    md: { box: 'w-10 h-10', icon: 20, text: 'text-xl', gap: 'gap-3' },
    lg: { box: 'w-12 h-12', icon: 24, text: 'text-2xl', gap: 'gap-3' },
  };
  const s = sizes[size];

  return (
    <div className={`flex items-center ${s.gap}`}>
      <div className="relative">
        <div className={`${s.box} flex items-center justify-center rounded-xl passport-cover shadow-soft`}>
          <Plane size={s.icon} className="text-gold -rotate-45" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-highlight ring-2 ring-background" />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display font-semibold tracking-tight ${s.text} ${light ? 'text-primary-foreground' : 'text-navy-900'}`}>
          ST<span className="text-accent-500 italic">&</span>ID
        </span>
        <span className={`mt-1 font-mono text-[10px] font-medium tracking-[0.16em] uppercase ${light ? 'text-primary-foreground/60' : 'text-navy-400'}`}>
          Smart Travel & Identity
        </span>
      </div>
    </div>
  );
}
