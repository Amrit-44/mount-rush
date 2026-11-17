import { COURSES, OPPONENTS } from '../src/game/data';
import { Track } from '../src/game/track';
import { AIDriver, SkierSim } from '../src/game/sim';

function run(courseId: string, diff: number, seedOff = 0) {
  const c = COURSES.find((x) => x.id === courseId)!;
  const T = new Track({ envId: c.env, seed: c.seed + seedOff, length: c.length, curve: c.curve, density: c.density });
  T.ensure(c.length + 400);
  const racers = OPPONENTS.slice(0, parseInt(process.env.N ?? "6")).map((o, i) => {
    const sim = new SkierSim();
    const skill = Math.min(0.97, Math.max(0.3, o.skill * 0.45 + diff * 0.55 + 0.1));
    sim.place(8 - Math.floor(i / 3) * 4, ((i % 3) - 1) * 3.2, T);
    return { name: o.name, sim, ai: new AIDriver(o, skill, 100 + i), skill };
  });
  // bot "human" collects coins: skill .9 aggressive
  const dt = 1 / 90;
  racers.forEach((r) => r.sim.begin());
  let t = 0; const causes: Record<string,number> = {}; const where: string[] = [];
  while (t < 400 && racers.some((r) => r.sim.state !== 'finished')) {
    for (const r of racers) {
      const inp = r.ai.control(r.sim, T, racers.map((x) => x.sim), dt);
      const pc = r.sim.crashes; r.sim.update(dt, inp, T, r.name === 'Viktor');
      if (r.sim.crashes > pc) { causes[r.sim.lastCause] = (causes[r.sim.lastCause]||0)+1; where.push(`${r.sim.lastCause}@${r.sim.s.toFixed(0)}/d${r.sim.d.toFixed(1)}/v${r.sim.v.toFixed(0)}/k${(T.query(r.sim.s).k*1000).toFixed(1)}`); }
    }
    t += dt;
  }
  console.log(JSON.stringify(causes), where.slice(0,14).join(' '));
  const sorted = [...racers].sort((a, b) => (a.sim.finishTime ?? 999) - (b.sim.finishTime ?? 999));
  console.log(`== ${c.name} (${c.env}) len=${c.length} diff=${diff} obstacles=${T.obstacles.length} ramps=${T.ramps.length} coins=${T.coins.length} zones=${T.zones.length} maxS=${T.maxS}`);
  for (const r of sorted) console.log(`  ${r.name.padEnd(7)} sk=${r.skill.toFixed(2)} t=${r.sim.finishTime?.toFixed(1)} crashes=${r.sim.crashes} mist=${r.sim.mistakes} top=${(r.sim.topSpeed * 3.6).toFixed(0)} coins=${r.sim.coins} jumps=${r.sim.jumps}`);
}
const ids = process.argv[2] ? process.argv[2].split(',') : COURSES.map((c) => c.id);
const diff = parseFloat(process.argv[3] ?? '0.5');
for (const id of ids) run(id, diff);
