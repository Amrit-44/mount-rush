import { useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS, Cat, CharacterDef, Item, Look, RARITY_STYLE, characterById, charVisualsOf, itemById, itemsOf, modsText, resolveCharLook } from '../game/data';
import { PreviewScene, Focus } from '../game/preview';
import { itemUnlockMet, syncUnlocks, unlockText } from '../game/progression';
import { SaveData, updateSave, useSave } from '../game/save';
import { Btn, Coin, Header, Panel, RarityBadge, sfx } from './common';

// Focus presets per category (CONTRACT §10).
const FOCUS: Record<Cat, Focus> = {
  ski: 'skis', skiColor: 'skis', skiDesign: 'skis',
  jacket: 'body', pants: 'body',
  helmet: 'head', headwear: 'head', hair: 'head', goggles: 'head', glasses: 'head', faceAcc: 'head',
  gloves: 'hands', boots: 'hands',
  back: 'all', special: 'all',
};
const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');
const ACC_ICON: Record<string, string> = { none: '∅', scarf: '🧣', backpack: '🎒', antenna: '📡', tail: '🦊', cape: '🦸' };
const HELM_ICON: Record<string, string> = { classic: '⛑️', racer: '🏁', beanie: '🧶', fin: '🦈', ears: '🐱', horns: '🛡️', none: '∅' };
const HAIR_ICON: Record<string, string> = { fade: '💈', crop: '✂️', curly: '🌀', long: '💇', wavy: '〰️', messy: '🌪️', braid: '🎀', pony: '🎠' };
const HEADWEAR_ICON: Record<string, string> = { none: '∅', beanie: '🧶', cap: '🧢', bandana: '🎀', phones: '🎧' };
const FACEACC_ICON: Record<string, string> = { none: '∅', mask: '😷', warmer: '🧣', paint: '🎨' };

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
    case 'jacket': return (
      <div className="w-full h-full rounded-xl flex overflow-hidden">
        <div className="flex-1 flex flex-col"><div className="flex-[3]" style={{ background: hexc(d.jacket) }} /><div className="h-1.5" style={{ background: hexc(d.accent) }} /><div className="flex-[2]" style={{ background: hexc(d.jacket) }} /></div>
        <div className="w-1" style={{ background: hexc(d.accent) }} />
        <div className="w-5 flex items-center justify-center text-[10px] font-display font-black" style={{ background: hexc(d.jacket), color: hexc(d.accent) }}>{d.style === 'hoodie' ? 'H' : d.style === 'race' ? 'R' : d.style === 'puffer' ? 'P' : 'J'}</div>
      </div>
    );
    case 'pants': return <div className="w-full h-full rounded-xl flex flex-col overflow-hidden"><div className="flex-1" style={{ background: hexc(d.color) }} /><div className="h-1.5 bg-black/30" />{d.wide ? <div className="text-[9px] font-bold text-white/80 text-center py-0.5" style={{ background: hexc(d.color) }}>BAGGY</div> : null}</div>;
    case 'helmet': return <div className="w-full h-full flex items-center justify-center"><div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: hexc(d.color), boxShadow: 'inset 0 -6px 10px #0004' }}>{HELM_ICON[d.style] ?? '⛑️'}</div></div>;
    case 'headwear': return <div className="w-full h-full flex flex-col items-center justify-center gap-1"><span className="text-3xl">{HEADWEAR_ICON[d.kind] ?? '🎩'}</span>{d.color !== undefined && <span className="w-6 h-2.5 rounded-full" style={{ background: hexc(d.color) }} />}</div>;
    case 'hair': return <div className="w-full h-full flex flex-col items-center justify-center gap-1"><span className="text-3xl">{HAIR_ICON[d.style] ?? '💇'}</span><span className="w-6 h-2.5 rounded-full border border-white/40" style={{ background: hexc(d.color) }} /></div>;
    case 'goggles': return <div className="w-full h-full flex items-center justify-center"><div className="w-14 h-7 rounded-lg border-4" style={{ background: hexc(d.lens), borderColor: hexc(d.frame) }} /></div>;
    case 'glasses': return <div className="w-full h-full flex items-center justify-center gap-1"><span className="text-2xl">🕶️</span><span className="w-5 h-2.5 rounded-full" style={{ background: hexc(d.frame) }} /></div>;
    case 'faceAcc': return <div className="w-full h-full flex flex-col items-center justify-center gap-1"><span className="text-3xl">{FACEACC_ICON[d.kind] ?? '🎭'}</span>{d.color !== undefined && <span className="w-6 h-2.5 rounded-full" style={{ background: hexc(d.color) }} />}</div>;
    case 'gloves': return <div className="w-full h-full flex items-center justify-center"><div className="w-10 h-10 rounded-xl rounded-tr-3xl" style={{ background: hexc(d.color), boxShadow: 'inset 0 -5px 8px #0004' }} /></div>;
    case 'boots': return <div className="w-full h-full flex flex-col items-center justify-center gap-1"><span className="text-3xl">🥾</span><span className="w-8 h-2.5 rounded-full" style={{ background: hexc(d.color) }} /></div>;
    case 'back': case 'special': return <div className="w-full h-full flex flex-col items-center justify-center gap-1"><span className="text-3xl">{ACC_ICON[d.kind] ?? '✦'}</span>{d.color !== undefined && <span className="w-6 h-2.5 rounded-full" style={{ background: hexc(d.color) }} />}</div>;
    default: return <div className="w-full h-full flex items-center justify-center text-3xl">{ACC_ICON[d.kind] ?? '✦'}</div>;
  }
}

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2 text-xs"><span className="w-20 text-sky-200/80">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-navy/70 overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-400 to-cyan-200" style={{ width: `${Math.min(100, Math.max(6, (v - 0.95) / 0.3 * 100))}%` }} /></div></div>
  );
}

// ---------------- tabs ----------------
type TabId = 'characters' | 'outfits' | 'hairstyles' | 'accessories' | 'gear' | 'collections';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'characters', label: 'Characters', icon: '⛷️' },
  { id: 'outfits', label: 'Outfits', icon: '🧥' },
  { id: 'hairstyles', label: 'Hairstyles', icon: '💇' },
  { id: 'accessories', label: 'Accessories', icon: '🥽' },
  { id: 'gear', label: 'Gear', icon: '🎿' },
  { id: 'collections', label: 'Collections', icon: '🏆' },
];
const SUBS: Record<Exclude<TabId, 'characters' | 'collections'>, { id: string; label: string }[]> = {
  outfits: [
    { id: 'all', label: 'All' },
    { id: 'jackets', label: 'Jackets' },
    { id: 'hoodies', label: 'Hoodies' },
    { id: 'pants', label: 'Pants' },
  ],
  hairstyles: [
    { id: 'all', label: 'All' },
    { id: 'hair', label: 'Hair' },
    { id: 'headwear', label: 'Headwear' },
  ],
  accessories: [
    { id: 'all', label: 'All' },
    { id: 'goggles', label: 'Goggles' },
    { id: 'glasses', label: 'Glasses' },
    { id: 'faceAcc', label: 'Face' },
    { id: 'back', label: 'Back' },
    { id: 'special', label: 'Special' },
  ],
  gear: [
    { id: 'all', label: 'All' },
    { id: 'ski', label: 'Skis' },
    { id: 'skiColor', label: 'Ski Colour' },
    { id: 'skiDesign', label: 'Ski Design' },
    { id: 'gloves', label: 'Gloves' },
    { id: 'boots', label: 'Boots' },
  ],
};

/** Items visible for a tab + sub-chip. Hoodies are jacket items with d.style === 'hoodie'. */
function itemsFor(tab: TabId, sub: string): Item[] {
  switch (tab) {
    case 'outfits':
      if (sub === 'jackets') return itemsOf('jacket').filter((i) => i.d.style !== 'hoodie');
      if (sub === 'hoodies') return itemsOf('jacket').filter((i) => i.d.style === 'hoodie');
      if (sub === 'pants') return itemsOf('pants');
      return [...itemsOf('jacket'), ...itemsOf('pants')];
    case 'hairstyles':
      if (sub === 'hair') return itemsOf('hair');
      if (sub === 'headwear') return itemsOf('headwear');
      return [...itemsOf('hair'), ...itemsOf('headwear')];
    case 'accessories':
      if (sub === 'all') return [...itemsOf('goggles'), ...itemsOf('glasses'), ...itemsOf('faceAcc'), ...itemsOf('back'), ...itemsOf('special')];
      return itemsOf(sub as Cat);
    case 'gear':
      if (sub === 'all') return [...itemsOf('ski'), ...itemsOf('skiColor'), ...itemsOf('skiDesign'), ...itemsOf('gloves'), ...itemsOf('boots')];
      return itemsOf(sub as Cat);
    default:
      return [];
  }
}

/** First item category of a tab (used to pick the initial selection + focus). */
function firstCat(tab: TabId, sub: string): Cat {
  const list = itemsFor(tab, sub);
  return (list[0]?.cat ?? 'ski') as Cat;
}

// ---------------- collections (DISPLAY-ONLY: no prices, no bundles, no discounts) ----------------
interface CollectionDef { id: string; name: string; blurb: string; members: string[]; tab: TabId; sub: string }
const COLLECTIONS: CollectionDef[] = [
  { id: 'arctic', name: 'Arctic Pro Set', blurb: 'Anya\'s frost-pattern kit — ice-blue shell, crystal lenses, long flow.', members: ['jk_frost', 'pt_arctic', 'gg_mirror', 'hr_long'], tab: 'outfits', sub: 'all' },
  { id: 'street', name: 'Street Freestyle Set', blurb: 'Jax\'s oversized hoodie, baggy pants, shades and a packed bag.', members: ['jk_hoodie', 'pt_baggy', 'gs_sun', 'bk_backpack'], tab: 'outfits', sub: 'all' },
  { id: 'gold', name: 'Gold Legend Set', blurb: 'Kai\'s gold-and-black legend kit, head to toe.', members: ['jk_gold', 'pt_black', 'gg_gold', 'bt_gold'], tab: 'outfits', sub: 'all' },
  { id: 'racing', name: 'Racing Pro Set', blurb: 'Marcus\'s aero race suit with mirror lenses and a racer helmet.', members: ['jk_race', 'pt_navy', 'gg_mirror', 'hm_racer'], tab: 'outfits', sub: 'all' },
];

// ---------------- equip helpers (per-character overrides, CONTRACT §9–§10) ----------------
/** Write one equip into BOTH charLooks[selected][slot] AND equipped[slot], plus goggles/glasses mutual exclusion (§9 rule 3). */
function writeEquip(d: SaveData, it: Item) {
  const sel = d.characters?.selected ?? 'rookie';
  if (!d.characters) d.characters = { owned: ['rookie'], selected: 'rookie' };
  if (!d.charLooks) d.charLooks = {};
  if (!d.charLooks[sel]) d.charLooks[sel] = {} as Look;
  const overrides = d.charLooks[sel];
  overrides[it.cat] = it.id;
  d.equipped[it.cat] = it.id;
  if (it.cat === 'glasses' && it.id !== 'gs_none') { overrides.goggles = 'gg_none'; d.equipped.goggles = 'gg_none'; }
  if (it.cat === 'goggles' && it.id !== 'gg_none') { overrides.glasses = 'gs_none'; d.equipped.glasses = 'gs_none'; }
}

/** Unequip restores that character's defaultLook slot in BOTH charLooks and equipped (§9 rule 7). */
function writeUnequip(d: SaveData, it: Item) {
  const sel = d.characters?.selected ?? 'rookie';
  const fallback = characterById(sel)?.defaultLook[it.cat];
  if (!fallback) return;
  if (!d.charLooks) d.charLooks = {};
  if (!d.charLooks[sel]) d.charLooks[sel] = {} as Look;
  d.charLooks[sel][it.cat] = fallback;
  d.equipped[it.cat] = fallback;
}

export function Garage({ preview, onBack }: { preview: PreviewScene | null; onBack: () => void }) {
  const save = useSave();
  const selectedId = save.characters?.selected ?? 'rookie';
  const [tab, setTab] = useState<TabId>('characters');
  const [sub, setSub] = useState<string>('all');
  const [cat, setCat] = useState<Cat>('ski');
  const [sel, setSel] = useState<string>(save.equipped.ski);
  const [selChar, setSelChar] = useState<string>(selectedId);
  const [confirm, setConfirm] = useState<Item | null>(null);
  const [confirmChar, setConfirmChar] = useState<CharacterDef | null>(null);
  const lastX = useRef<number | null>(null);

  const visibleItems = useMemo(() => itemsFor(tab, sub), [tab, sub]);
  const item = itemById(sel) ?? visibleItems[0];
  const owned = (id: string) => save.owned.includes(id);
  const charOwned = (id: string) => (save.characters?.owned ?? ['rookie']).includes(id);
  const selCharDef = characterById(selChar) ?? CHARACTERS[0];
  const previewCharDef = tab === 'characters' ? selCharDef : (characterById(selectedId) ?? CHARACTERS[0]);

  useEffect(() => { updateSave((d) => { syncUnlocks(d); }); }, []);
  useEffect(() => {
    preview?.setMode('garage', 0.17);
    return () => { preview?.setMode('menu', 0); };
  }, [preview]);
  useEffect(() => {
    if (!preview) return;
    const look = tab === 'characters'
      ? resolveCharLook(selCharDef, save.charLooks?.[selCharDef.id])
      : { ...save.equipped, [cat]: sel } as Look;
    const vis = charVisualsOf(previewCharDef);
    preview.setLook(look, vis.build, vis.char);
  }, [preview, tab, selCharDef, previewCharDef, save.charLooks, save.equipped, cat, sel]);
  useEffect(() => {
    preview?.setFocus(tab === 'characters' || tab === 'collections' ? 'all' : FOCUS[cat]);
  }, [preview, tab, cat]);
  useEffect(() => { return () => { if (preview) { const vis = charVisualsOf(characterById(selectedId) ?? CHARACTERS[0]); preview.setLook(save.equipped, vis.build, vis.char); } }; /* eslint-disable-next-line */ }, [preview]);

  const switchTab = (t: TabId) => {
    sfx('click');
    setTab(t);
    if (t === 'characters') { setSelChar(selectedId); return; }
    if (t === 'collections') return;
    setSub('all');
    const c = firstCat(t, 'all');
    setCat(c);
    setSel(save.equipped[c]);
  };
  const switchSub = (s: string) => {
    sfx('click');
    setSub(s);
    const c = firstCat(tab, s);
    setCat(c);
    setSel(save.equipped[c]);
  };
  const jumpToItem = (id: string, t: TabId, s: string) => {
    const it = itemById(id);
    if (!it) return;
    sfx('click');
    setTab(t); setSub(s); setCat(it.cat); setSel(id);
  };

  const equip = (it: Item) => { sfx('equip'); updateSave((d) => { writeEquip(d, it); }); };
  const unequip = (it: Item) => {
    sfx('equip');
    updateSave((d) => { writeUnequip(d, it); });
    const fallback = characterById(selectedId)?.defaultLook[it.cat];
    if (fallback) setSel(fallback);
  };
  const buy = (it: Item) => {
    if (save.coins < it.price) { sfx('deny'); return; }
    sfx('buy');
    updateSave((d) => { d.coins -= it.price; d.stats.coinsSpent += it.price; if (!d.owned.includes(it.id)) d.owned.push(it.id); writeEquip(d, it); });
    setConfirm(null);
  };

  const buyChar = (c: CharacterDef) => {
    if (save.coins < c.price) { sfx('deny'); return; }
    sfx('buy');
    updateSave((d) => {
      d.coins -= c.price; d.stats.coinsSpent += c.price;
      if (!d.characters) d.characters = { owned: ['rookie'], selected: 'rookie' };
      if (!d.characters.owned.includes(c.id)) d.characters.owned.push(c.id);
      d.characters.selected = c.id;
      d.equipped = resolveCharLook(c, d.charLooks?.[c.id]);
    });
    setSelChar(c.id);
    setConfirmChar(null);
  };
  const selectChar = (c: CharacterDef) => {
    sfx('equip');
    updateSave((d) => {
      if (!d.characters) d.characters = { owned: ['rookie'], selected: 'rookie' };
      d.characters.selected = c.id;
      d.equipped = resolveCharLook(c, d.charLooks?.[c.id]);
    });
    setSelChar(c.id);
  };
  const previewChar = (c: CharacterDef) => { sfx('click'); setSelChar(c.id); };

  const isOwned = item ? owned(item.id) : false;
  const equipped = item ? save.equipped[item.cat] === item.id : false;
  const met = item ? itemUnlockMet(save, item.id) : false;
  const canBuy = item ? item.unlock.t === 'coins' && !isOwned : false;
  const isDefault = item ? characterById(selectedId)?.defaultLook[item.cat] === item.id : false;
  const lookNow = { ...save.equipped, [cat]: sel } as Look;
  const charIsSelected = selCharDef.id === selectedId;
  const charIsOwned = charOwned(selCharDef.id);

  return (
    <div className="h-full flex flex-col screen-in">
      <Header title="Store" onBack={onBack} sub="Drag the skier to rotate" right={<div className="glass rounded-xl px-4 py-2"><Coin n={save.coins} className="text-amber-200 text-xl" /></div>} />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-3 sm:px-6 pb-4">
        <div className="flex-1 min-h-[22vh] touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => { if (preview) preview.dragging = true; lastX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (preview?.dragging && lastX.current !== null) { preview.drag(e.clientX - lastX.current); lastX.current = e.clientX; } }}
          onPointerUp={() => { if (preview) preview.dragging = false; lastX.current = null; }} onPointerCancel={() => { if (preview) preview.dragging = false; lastX.current = null; }} />
        <Panel className="lg:w-[470px] shrink-0 min-h-0 flex flex-col max-h-[62vh] lg:max-h-none">
          <div className="flex gap-1.5 p-3 overflow-x-auto shrink-0 border-b border-sky-300/15">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => switchTab(t.id)} className={`shrink-0 px-3 py-2 rounded-xl font-display font-extrabold uppercase text-sm tracking-wide transition-all ${tab === t.id ? 'bg-sky-400 text-navy' : 'bg-navy2/60 text-sky-100 hover:bg-navy2'}`}>
                <span className="mr-1">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          {tab !== 'characters' && tab !== 'collections' && (
            <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto shrink-0">
              {SUBS[tab].map((s) => (
                <button key={s.id} onClick={() => switchSub(s.id)} className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-display font-extrabold uppercase tracking-wide transition-all ${sub === s.id ? 'bg-sky-300 text-navy' : 'bg-navy/60 text-sky-200 hover:bg-navy/80'}`}>{s.label}</button>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {tab === 'characters' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CHARACTERS.map((c) => {
                  const o = charOwned(c.id), isSel = c.id === selectedId, isPreview = c.id === selChar;
                  const rs = RARITY_STYLE[c.rarity];
                  return (
                    <div key={c.id} role="button" tabIndex={0} onMouseEnter={() => sfx('hover')} onClick={() => previewChar(c)}
                      onKeyDown={(e) => { if (e.key === 'Enter') previewChar(c); }}
                      className={`relative rounded-xl p-3 text-left border-2 transition-all cursor-pointer ${isPreview ? '-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
                      style={{ borderColor: isPreview ? rs.border : `${rs.border}88`, background: isSel ? 'rgba(92,192,255,0.14)' : 'rgba(10,26,58,0.5)', boxShadow: `0 0 14px ${rs.glow}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-display font-black italic uppercase text-xl leading-none truncate">{c.name}</div>
                          <div className="text-[11px] text-sky-200/70 mt-0.5 truncate">{c.title}</div>
                        </div>
                        <RarityBadge rarity={c.rarity} />
                      </div>
                      <div className="text-xs text-sky-100/90 leading-snug mt-2">{c.desc}</div>
                      <div className="text-[11px] font-semibold text-emerald-300 mt-1.5">{modsText(c.mods)}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] font-display font-extrabold tracking-wide">
                          {isSel ? <span className="text-emerald-300">✓ SELECTED</span> : o ? <span className="text-sky-300">OWNED</span> : <Coin n={c.price} className="text-amber-200 text-xs" />}
                        </span>
                        <span className="flex gap-1.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); previewChar(c); }} className="px-2 py-1 rounded-lg bg-navy/70 border border-sky-300/30 text-[11px] font-display font-extrabold uppercase">Preview</button>
                          {!o && <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmChar(c); }} className="px-2 py-1 rounded-lg bg-gradient-to-b from-amber-300 to-orange-500 text-[#2b0e00] text-[11px] font-display font-extrabold uppercase">Buy</button>}
                          {o && !isSel && <button type="button" onClick={(e) => { e.stopPropagation(); selectChar(c); }} className="px-2 py-1 rounded-lg bg-sky-400 text-navy text-[11px] font-display font-extrabold uppercase">Select</button>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {tab === 'collections' && (
              <div className="grid grid-cols-1 gap-2.5">
                {COLLECTIONS.map((col) => (
                  <div key={col.id} className="rounded-xl p-3 border border-sky-300/20 bg-navy/50">
                    <div className="font-display font-black italic uppercase text-xl leading-none">{col.name}</div>
                    <div className="text-xs text-sky-100/90 leading-snug mt-1">{col.blurb}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {col.members.map((mid) => {
                        const mi = itemById(mid);
                        if (!mi) return null;
                        const o = owned(mid), eq = save.equipped[mi.cat] === mid;
                        return (
                          <button key={mid} onClick={() => jumpToItem(mid, col.tab, col.sub)} className="px-2 py-1 rounded-lg bg-navy/70 border border-sky-300/20 text-[11px] font-semibold hover:bg-navy/90">
                            {mi.name} {eq ? <span className="text-emerald-300">✓</span> : o ? <span className="text-sky-300">· owned</span> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2.5"><Btn variant="ghost" onClick={() => jumpToItem(col.members[0], col.tab, col.sub)}>View items →</Btn></div>
                  </div>
                ))}
                <div className="text-[11px] text-sky-200/60 leading-snug">Collections group existing items for inspiration only — buy each item individually in its own tab. No bundle prices or discounts.</div>
              </div>
            )}
            {tab !== 'characters' && tab !== 'collections' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {visibleItems.map((it) => {
                  const o = owned(it.id), eq = save.equipped[it.cat] === it.id, lock = !o && !(it.unlock.t === 'coins');
                  const rs = RARITY_STYLE[it.rarity ?? 'common'];
                  return (
                    <button key={it.id} onMouseEnter={() => sfx('hover')} onClick={() => { sfx('click'); setSel(it.id); setCat(it.cat); }}
                      className={`relative rounded-xl p-1.5 text-center border transition-all ${sel === it.id ? 'bg-sky-400/20 -translate-y-0.5' : 'bg-navy/50 hover:bg-navy/80'}`}
                      style={{ borderColor: sel === it.id ? rs.border : `${rs.border}55`, boxShadow: sel === it.id ? `0 0 12px ${rs.glow}` : 'none' }}>
                      <div className="flex justify-end"><RarityBadge rarity={it.rarity ?? 'common'} /></div>
                      <div className="aspect-square rounded-lg overflow-hidden bg-navy/60 p-1.5 mt-1"><Swatch it={it} look={lookNow} /></div>
                      <div className="text-[11px] font-bold leading-tight mt-1 h-7 flex items-center justify-center">{it.name}</div>
                      <div className="text-[10px] font-display font-extrabold tracking-wide">
                        {eq ? <span className="text-emerald-300">EQUIPPED</span> : o ? <span className="text-sky-300">OWNED</span> : lock ? <span className="text-amber-300">🔒 LOCKED</span> : <Coin n={it.price} className="text-amber-200 text-xs" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-sky-300/15 shrink-0">
            {tab === 'characters' && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-display font-black italic uppercase text-2xl leading-none">{selCharDef.name}</span><RarityBadge rarity={selCharDef.rarity} /></div>
                    <div className="text-xs text-sky-200/70 mt-1">{selCharDef.title} — {selCharDef.desc}</div>
                    <div className="text-xs text-emerald-300 font-semibold mt-1">{modsText(selCharDef.mods)}</div>
                    <div className="text-xs text-sky-200/70 mt-1">{charIsSelected ? 'Currently selected' : charIsOwned ? 'In your collection' : `Costs ${selCharDef.price} coins`}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {charIsSelected && <Btn variant="ghost" disabled className="flex-1">Selected ✓</Btn>}
                  {!charIsSelected && charIsOwned && <Btn variant="primary" className="flex-1" onClick={() => selectChar(selCharDef)}>Select</Btn>}
                  {!charIsOwned && <Btn variant="hot" className="flex-1" disabled={save.coins < selCharDef.price} onClick={() => setConfirmChar(selCharDef)}>{save.coins < selCharDef.price ? `Need ${selCharDef.price - save.coins} more coins` : `Buy · ${selCharDef.price} coins`}</Btn>}
                </div>
              </>
            )}
            {tab === 'collections' && (
              <div className="text-sm text-sky-100/90 leading-snug">Collections are display-only groupings. Tap any member item to jump to its tab and buy or equip it there — there is nothing to buy here.</div>
            )}
            {tab !== 'characters' && tab !== 'collections' && item && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-display font-black italic uppercase text-2xl leading-none">{item.name}</span><RarityBadge rarity={item.rarity ?? 'common'} /></div>
                    <div className="text-xs text-sky-200/70 mt-1">{isOwned ? (equipped ? 'Currently equipped' : 'In your collection') : canBuy ? `Costs ${item.price} coins` : `Unlock: ${unlockText(item.id)}`}</div>
                  </div>
                </div>
                {item.cat === 'ski' && <div className="mt-2 space-y-1"><StatBar label="Top speed" v={item.d.top} /><StatBar label="Grip" v={item.d.grip} /><StatBar label="Boost" v={item.d.boost} /></div>}
                <div className="mt-3 flex gap-2">
                  {isOwned && !equipped && <Btn variant="primary" className="flex-1" onClick={() => equip(item)}>Equip</Btn>}
                  {isOwned && equipped && !isDefault && <Btn variant="ghost" className="flex-1" onClick={() => unequip(item)}>Unequip</Btn>}
                  {isOwned && equipped && isDefault && <Btn variant="ghost" disabled className="flex-1">Equipped ✓</Btn>}
                  {!isOwned && canBuy && <Btn variant="hot" className="flex-1" disabled={save.coins < item.price} onClick={() => setConfirm(item)}>{save.coins < item.price ? `Need ${item.price - save.coins} more coins` : `Buy · ${item.price} coins`}</Btn>}
                  {!isOwned && !canBuy && <Btn variant="ghost" disabled className="flex-1">{met ? 'Unlocking…' : `🔒 ${unlockText(item.id)}`}</Btn>}
                </div>
              </>
            )}
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
      {confirmChar && (
        <div className="fixed inset-0 z-40 bg-navy/80 flex items-center justify-center p-4" onClick={() => setConfirmChar(null)}>
          <Panel className="p-6 max-w-sm w-full pop text-center"><div onClick={(e) => e.stopPropagation()}>
            <div className="font-display font-black text-2xl uppercase">Confirm purchase</div>
            <div className="my-3 text-sky-100">Buy <b>{confirmChar.name}</b> ({confirmChar.title}) for <Coin n={confirmChar.price} className="text-amber-200" />?</div>
            <div className="text-xs text-emerald-300 font-semibold mb-1">{modsText(confirmChar.mods)}</div>
            <div className="text-xs text-sky-200/70 mb-4">Balance after: {(save.coins - confirmChar.price).toLocaleString()} coins · {confirmChar.name} will be selected.</div>
            <div className="flex gap-2"><Btn variant="ghost" className="flex-1" sound="back" onClick={() => setConfirmChar(null)}>Cancel</Btn><Btn variant="hot" className="flex-1" sound="buy" onClick={() => buyChar(confirmChar)}>Buy</Btn></div>
          </div></Panel>
        </div>
      )}
    </div>
  );
}
