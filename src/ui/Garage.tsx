import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS, Cat, Item, ITEMS, Look, itemById, itemsOf } from '../game/data';
import { PreviewScene, Focus } from '../game/preview';
import { itemUnlockMet, syncUnlocks, unlockText } from '../game/progression';
import { updateSave, useSave } from '../game/save';
import { Btn, Coin, Header, Panel, sfx } from './common';

const FOCUS: Record<Cat, Focus> = { ski: 'skis', skiColor: 'skis', skiDesign: 'skis', outfit: 'body', helmet: 'head', goggles: 'head', gloves: 'hands', accessory: 'all' };
const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');
const ACC_ICON: Record<string, string> = { none: '∅', scarf: '🧣', backpack: '🎒', antenna: '📡', tail: '🦊', cape: '🦸' };
const HELM_ICON: Record<string, string> = { classic: '⛑️', racer: '🏁', beanie: '🧶', fin: '🦈', ears: '🐱', horns: '🛡️' };

function Swatch({ it, look }: { it: Item; look: Look }) {
  const d = it.d;
  const skiCol = hexc(itemById(look.skiColor)?.d.color ?? 0xe83030);
  switch (it.cat) {
    case 'ski': return <div className="w-full h-full flex items-center justify-center"><div className="h-3 rounded-full rotate-[-20deg]" style={{ width: `${40 + (d.len - 1.6) * 90}%`, background: skiCol, boxShadow: '0 4px 10px #0006' }} /></div>;
    case 'skiColor': return <div className="w-full h-full rounded-xl" style={{ background: `linear-gradient(135deg, ${hexc(d.color)}, ${hexc(d.color)}aa)` }} />;
    case 'skiDesign': {
      const bg: Record<string, string> = {
        solid: skiCol, stripes: `repeating-linear-gradient(90deg, ${skiCol} 0 8px, #fff 8px 14px)`, checker: `conic-gradient(#fff 25%, ${skiCol} 0 50%, #fff 0 75%, ${skiCol} 0) 0 0/16px 16px`,
        chevron: `repeating-linear-gradient(135deg, ${skiCol} 0 8px, #fff 8px 12px)`, flame: `linear-gradient(0deg, #ffe14a, #ff9a1a 40%, ${skiCol})`, stars: `radial-gradient(#fff 12%, transparent 14%) 0 0/14px 14px, ${skiCol}`,
        camo: `radial-gradient(circle at 30% 30%, #0004 20%, transparent 22%) 0 0/20px 20px, radial-gradient(circle at 70% 70%, #fff6 18%, transparent 20%) 0 0/24px 24px, ${skiCol}`,
      };
      return <div className="w-full h-full rounded-xl" style={{ background: bg[d.kind] }} />;
    }
    case 'outfit': return <div className="w-full h-full rounded-xl flex flex-col overflow-hidden"><div className="flex-[3]" style={{ background: hexc(d.jacket) }} /><div className="h-1.5" style={{ background: hexc(d.accent) }} /><div className="flex-[2]" style={{ background: hexc(d.pants) }} /></div>;
    case 'helmet': return <div className="w-full h-full flex items-center justify-center"><div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: hexc(d.color), boxShadow: 'inset 0 -6px 10px #0004' }}>{HELM_ICON[d.style]}</div></div>;
    case 'goggles': return <div className="w-full h-full flex items-center justify-center"><div className="w-14 h-7 rounded-lg border-4" style={{ background: hexc(d.lens), borderColor: hexc(d.frame) }} /></div>;
    case 'gloves': return <div className="w-full h-full flex items-center justify-center"><div className="w-10 h-10 rounded-xl rounded-tr-3xl" style={{ background: hexc(d.color), boxShadow: 'inset 0 -5px 8px #0004' }} /></div>;
    default: return <div className="w-full h-full flex items-center justify-center text-3xl">{ACC_ICON[d.kind]}</div>;
  }
}

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2 text-xs"><span className="w-20 text-sky-200/80">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-navy/70 overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-400 to-cyan-200" style={{ width: `${Math.min(100, Math.max(6, (v - 0.95) / 0.3 * 100))}%` }} /></div></div>
  );
}

export function Garage({ preview, onBack }: { preview: PreviewScene | null; onBack: () => void }) {
  const save = useSave();
  const [cat, setCat] = useState<Cat>('ski');
  const [sel, setSel] = useState<string>(save.equipped.ski);
  const [confirm, setConfirm] = useState<Item | null>(null);
  const lastX = useRef<number | null>(null);
  const items = useMemo(() => itemsOf(cat), [cat]);
  const item = itemById(sel) ?? items[0];
  const owned = (id: string) => save.owned.includes(id);

  useEffect(() => { updateSave((d) => { syncUnlocks(d); }); }, []);
  useEffect(() => {
    preview?.setMode('garage', 0.17);
    return () => { preview?.setMode('menu', 0); };
  }, [preview]);
  useEffect(() => { preview?.setLook({ ...save.equipped, [cat]: sel } as Look); }, [preview, save.equipped, cat, sel]);
  useEffect(() => { preview?.setFocus(FOCUS[cat]); }, [preview, cat]);
  useEffect(() => { return () => { if (preview) preview.setLook(save.equipped); }; /* eslint-disable-next-line */ }, [preview]);

  const switchCat = (c: Cat) => { sfx('click'); setCat(c); setSel(save.equipped[c]); };
  const equip = (it: Item) => { sfx('equip'); updateSave((d) => { d.equipped[it.cat] = it.id; }); };
  const unequip = (it: Item) => {
    const def = ITEMS.find((i) => i.cat === it.cat && i.unlock.t === 'free')!;
    sfx('equip'); updateSave((d) => { d.equipped[it.cat] = def.id; }); setSel(def.id);
  };
  const buy = (it: Item) => {
    if (save.coins < it.price) { sfx('deny'); return; }
    sfx('buy');
    updateSave((d) => { d.coins -= it.price; d.stats.coinsSpent += it.price; if (!d.owned.includes(it.id)) d.owned.push(it.id); d.equipped[it.cat] = it.id; });
    setConfirm(null);
  };

  const isOwned = owned(item.id), equipped = save.equipped[item.cat] === item.id;
  const met = itemUnlockMet(save, item.id);
  const canBuy = item.unlock.t === 'coins' && !isOwned;
  const isDefault = item.unlock.t === 'free';
  const lookNow = { ...save.equipped, [cat]: sel } as Look;

  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Garage" onBack={onBack} sub="Drag the skier to rotate" right={<div className="glass rounded-xl px-4 py-2"><Coin n={save.coins} className="text-amber-200 text-xl" /></div>} />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-3 sm:px-6 pb-4">
        <div className="flex-1 min-h-[22vh] touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => { if (preview) preview.dragging = true; lastX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (preview?.dragging && lastX.current !== null) { preview.drag(e.clientX - lastX.current); lastX.current = e.clientX; } }}
          onPointerUp={() => { if (preview) preview.dragging = false; lastX.current = null; }} onPointerCancel={() => { if (preview) preview.dragging = false; lastX.current = null; }} />
        <Panel className="lg:w-[470px] shrink-0 min-h-0 flex flex-col max-h-[62vh] lg:max-h-none">
          <div className="flex gap-1.5 p-3 overflow-x-auto shrink-0 border-b border-sky-300/15">
            {CATS.map((c) => (
              <button key={c.id} onClick={() => switchCat(c.id)} className={`shrink-0 px-3 py-2 rounded-xl font-display font-extrabold uppercase text-sm tracking-wide transition-all ${cat === c.id ? 'bg-sky-400 text-navy' : 'bg-navy2/60 text-sky-100 hover:bg-navy2'}`}>
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {items.map((it) => {
                const o = owned(it.id), eq = save.equipped[it.cat] === it.id, lock = !o && !(it.unlock.t === 'coins');
                return (
                  <button key={it.id} onMouseEnter={() => sfx('hover')} onClick={() => { sfx('click'); setSel(it.id); }}
                    className={`relative rounded-xl p-1.5 text-center border transition-all ${sel === it.id ? 'border-sky-300 bg-sky-400/20 -translate-y-0.5' : 'border-sky-300/15 bg-navy/50 hover:bg-navy/80'}`}>
                    <div className="aspect-square rounded-lg overflow-hidden bg-navy/60 p-1.5"><Swatch it={it} look={lookNow} /></div>
                    <div className="text-[11px] font-bold leading-tight mt-1 h-7 flex items-center justify-center">{it.name}</div>
                    <div className="text-[10px] font-display font-extrabold tracking-wide">
                      {eq ? <span className="text-emerald-300">EQUIPPED</span> : o ? <span className="text-sky-300">OWNED</span> : lock ? <span className="text-amber-300">🔒 LOCKED</span> : <Coin n={it.price} className="text-amber-200 text-xs" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t border-sky-300/15 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-display font-black italic uppercase text-2xl leading-none">{item.name}</div>
                <div className="text-xs text-sky-200/70 mt-1">{isOwned ? (equipped ? 'Currently equipped' : 'In your collection') : canBuy ? `Costs ${item.price} coins` : `Unlock: ${unlockText(item.id)}`}</div></div>
            </div>
            {item.cat === 'ski' && <div className="mt-2 space-y-1"><StatBar label="Top speed" v={item.d.top} /><StatBar label="Grip" v={item.d.grip} /><StatBar label="Boost" v={item.d.boost} /></div>}
            <div className="mt-3 flex gap-2">
              {isOwned && !equipped && <Btn variant="primary" className="flex-1" onClick={() => equip(item)}>Equip</Btn>}
              {isOwned && equipped && !isDefault && <Btn variant="ghost" className="flex-1" onClick={() => unequip(item)}>Unequip</Btn>}
              {isOwned && equipped && isDefault && <Btn variant="ghost" disabled className="flex-1">Equipped ✓</Btn>}
              {!isOwned && canBuy && <Btn variant="hot" className="flex-1" disabled={save.coins < item.price} onClick={() => setConfirm(item)}>{save.coins < item.price ? `Need ${item.price - save.coins} more coins` : `Buy · ${item.price} coins`}</Btn>}
              {!isOwned && !canBuy && <Btn variant="ghost" disabled className="flex-1">{met ? 'Unlocking…' : `🔒 ${unlockText(item.id)}`}</Btn>}
            </div>
          </div>
        </Panel>
      </div>
      {confirm && (
        <div className="fixed inset-0 z-40 bg-navy/80 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <Panel className="p-6 max-w-sm w-full pop text-center"><div onClick={(e) => e.stopPropagation()}>
            <div className="font-display font-black text-2xl uppercase">Confirm purchase</div>
            <div className="my-3 text-sky-100">Buy <b>{confirm.name}</b> for <Coin n={confirm.price} className="text-amber-200" />?</div>
            <div className="text-xs text-sky-200/70 mb-4">Balance after: {(save.coins - confirm.price).toLocaleString()} coins</div>
            <div className="flex gap-2"><Btn variant="ghost" className="flex-1" sound="back" onClick={() => setConfirm(null)}>Cancel</Btn><Btn variant="hot" className="flex-1" sound="buy" onClick={() => buy(confirm)}>Buy</Btn></div>
          </div></Panel>
        </div>
      )}
    </div>
  );
}
