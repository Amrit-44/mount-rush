import { ReactNode } from 'react';
import { audio } from '../game/audio';
import { RARITY_STYLE, Rarity } from '../game/data';

export const sfx = (n: string) => audio.play(n);

export function Btn({ children, onClick, variant = 'primary', disabled, className = '', big, sound = 'click' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'hot' | 'ghost' | 'danger'; disabled?: boolean; className?: string; big?: boolean; sound?: string;
}) {
  return (
    <button
      disabled={disabled}
      className={`btn btn-${variant} ${big ? 'px-8 py-3.5 text-2xl' : 'px-4 py-2 text-lg'} ${className}`}
      onMouseEnter={() => !disabled && sfx('hover')}
      onClick={() => { if (disabled) return; sfx(sound); onClick?.(); }}
    >{children}</button>
  );
}

export function MenuBtn({ children, onClick, sub, icon, delay = 0 }: { children: ReactNode; onClick: () => void; sub?: string; icon?: ReactNode; delay?: number }) {
  return (
    <button className="btn menu-btn slide-in" style={{ animationDelay: `${delay}ms` }} onMouseEnter={() => sfx('hover')} onClick={() => { sfx('click'); onClick(); }}>
      {icon && <span className="text-2xl w-9 text-center">{icon}</span>}
      <span className="flex flex-col items-start leading-none">
        <span>{children}</span>
        {sub && <span className="font-body text-[11px] font-normal normal-case tracking-normal text-sky-200/70 mt-1">{sub}</span>}
      </span>
    </button>
  );
}

export function Coin({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-extrabold tracking-wide ${className}`}>
      <span className="inline-block w-5 h-5 rounded-full bg-gradient-to-b from-yellow-200 to-amber-500 border-2 border-amber-600 shadow-inner" />
      {Math.floor(n).toLocaleString()}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const s = RARITY_STYLE[rarity];
  return (
    <span className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold uppercase tracking-wider"
      style={{ color: s.color, border: `1px solid ${s.border}`, background: s.glow, boxShadow: `0 0 8px ${s.glow}` }}>
      {s.label}
    </span>
  );
}

export function Medal({ m, size = 28 }: { m: number; size?: number }) {
  const cols = ['#3a4a6a', '#cd7f32', '#c9d4e0', '#ffc933'];
  return (
    <span className="inline-flex items-center justify-center rounded-full font-display font-black text-sm shrink-0"
      style={{ width: size, height: size, background: m ? `radial-gradient(circle at 30% 30%, #fff8, ${cols[m]})` : 'rgba(255,255,255,0.08)', border: `2px solid ${m ? cols[m] : 'rgba(255,255,255,0.2)'}`, color: m ? '#1a1200' : '#5d708f', boxShadow: m ? `0 0 12px ${cols[m]}88` : 'none' }}>
      {m ? ['', 'B', 'S', 'G'][m] : '–'}
    </span>
  );
}

export function Panel({ children, className = '', title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <div className={`glass rounded-2xl ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <h3 className="font-display font-extrabold uppercase tracking-wider text-xl text-sky-100">{title}</h3>{right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Header({ title, onBack, right, sub }: { title: string; onBack: () => void; right?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 sm:px-6 py-3 shrink-0">
      <Btn variant="ghost" sound="back" onClick={onBack}>← Back</Btn>
      <div className="flex-1 min-w-0">
        <h2 className="font-display font-black italic uppercase text-3xl sm:text-4xl logo-text leading-none truncate">{title}</h2>
        {sub && <div className="text-xs text-sky-200/70 mt-0.5 truncate">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm font-semibold text-sky-100"><span>{label}</span><span className="text-sky-300">{fmt ? fmt(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button className="flex items-center justify-between w-full py-2 text-left" onClick={() => { sfx('click'); onChange(!value); }}>
      <span><span className="text-sm font-semibold text-sky-100">{label}</span>{hint && <span className="block text-xs text-sky-300/60">{hint}</span>}</span>
      <span className={`w-12 h-7 rounded-full p-0.5 transition-colors ${value ? 'bg-sky-400' : 'bg-slate-600'}`}>
        <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-sky-300/30">
      {options.map((o) => (
        <button key={o.id} onClick={() => { sfx('click'); onChange(o.id); }}
          className={`flex-1 px-3 py-2 font-display font-extrabold uppercase tracking-wider text-sm transition-colors ${value === o.id ? 'bg-sky-400 text-navy' : 'bg-navy2/50 text-sky-100 hover:bg-navy2'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="text-amber-300 tracking-tighter">{'★'.repeat(n)}<span className="text-slate-500">{'★'.repeat(max - n)}</span></span>;
}

export function XpBar({ into, need }: { into: number; need: number }) {
  return (
    <div className="h-2.5 rounded-full bg-navy/70 overflow-hidden border border-sky-300/20">
      <div className="h-full bg-gradient-to-r from-sky-400 to-cyan-200 shine-bar" style={{ width: `${Math.min(100, (into / need) * 100)}%` }} />
    </div>
  );
}
