// pnpm guardar — te dice qué trabajo NO está a salvo en GitHub: cambios sin commitear, ramas sin empujar o por delante de su copia
// remota, y ramas con commits que todavía no están en `main`. Con `--empujar` empuja las ramas pendientes (nunca `main`).
// Solo lee el estado de git; no borra nada, no cambia de rama ni hace commits.
import { execFileSync } from 'node:child_process';

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};
const lineas = (s) => (s ? s.split('\n').filter(Boolean) : []);
const empujar = process.argv.includes('--empujar');
// Ramas de trabajo temporales o de respaldo que no vale la pena avisar (se pueden borrar a mano).
const IGNORAR = /^(backup-|tmp-)/;

if (git('rev-parse', '--is-inside-work-tree') !== 'true') {
  console.error('Esto no es un repositorio de git.');
  process.exit(1);
}
const actual = git('branch', '--show-current') ?? '';
let pendientes = 0;

// 1) Cambios sin commitear
const cambios = lineas(git('status', '--porcelain'));
if (cambios.length > 0) {
  pendientes += 1;
  console.log(`✖ Hay ${cambios.length} archivo(s) con cambios SIN commitear en la rama «${actual}»:`);
  for (const c of cambios.slice(0, 15)) console.log(`    ${c}`);
  if (cambios.length > 15) console.log(`    … y ${cambios.length - 15} más`);
  console.log('  → Pídele a Claude «guarda todo» (hace commit y empuja), o haz commit tú.');
}

// 2) Cambios guardados con stash
const stash = lineas(git('stash', 'list'));
if (stash.length > 0) {
  pendientes += 1;
  console.log(`✖ Hay ${stash.length} stash(es) guardado(s) solo en este equipo (git stash list).`);
}

// 3) Ramas locales: sin copia en GitHub o por delante de ella
const ramas = lineas(git('for-each-ref', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)', 'refs/heads'));
const porEmpujar = [];
for (const r of ramas) {
  const [nombre, upstream, pista] = r.split('|');
  if (nombre === 'main' || IGNORAR.test(nombre)) continue;
  const sobreMain = Number(git('rev-list', '--count', `main..${nombre}`) ?? 0);
  if (!upstream) {
    if (sobreMain > 0) porEmpujar.push({ nombre, motivo: `SIN copia en GitHub (${sobreMain} commit(s) que no están en main)` });
  } else if (/ahead/.test(pista ?? '')) {
    porEmpujar.push({ nombre, motivo: `por delante de GitHub (${pista.replace(/[[\]]/g, '')})` });
  }
}
if (porEmpujar.length > 0) {
  pendientes += 1;
  console.log('✖ Ramas con trabajo que NO está a salvo en GitHub:');
  for (const p of porEmpujar) console.log(`    ${p.nombre} — ${p.motivo}`);
  if (empujar) {
    for (const p of porEmpujar) {
      try {
        execFileSync('git', ['push', '-u', 'origin', p.nombre], { stdio: 'inherit' });
        console.log(`  ✔ Empujada: ${p.nombre}`);
      } catch {
        console.log(`  ✖ No se pudo empujar ${p.nombre} (revisa el mensaje de arriba: red, certificados o inicio de sesión de gh).`);
      }
    }
  } else console.log('  → Ejecuta «pnpm guardar --empujar» para empujarlas.');
}

// 4) `main` local por detrás o con commits propios (nunca debería tener commits propios)
const mainPropios = Number(git('rev-list', '--count', 'origin/main..main') ?? 0);
if (mainPropios > 0) {
  pendientes += 1;
  console.log(`✖ «main» local tiene ${mainPropios} commit(s) que no están en GitHub: no se empujan directo a main; muévelos a una rama feature/….`);
}

// 5) Ramas ya empujadas pero aún sin fusionar en main (informativo: se fusionan con un PR). Solo las tocadas en los últimos 14 días:
// las viejas suelen ser ramas ya fusionadas por «squash» que git no reconoce como fusionadas.
const hace14 = Date.now() / 1000 - 14 * 86400;
const candidatas = ramas
  .map((r) => r.split('|'))
  .filter(([n, u]) => n !== 'main' && !IGNORAR.test(n) && u && Number(git('rev-list', '--count', `origin/main..${n}`) ?? 0) > 0 && !porEmpujar.some((p) => p.nombre === n));
const recientes = candidatas.filter(([n]) => Number(git('log', '-1', '--format=%ct', n) ?? 0) >= hace14).map(([n]) => n);
if (recientes.length > 0) console.log(`ℹ Ramas a salvo en GitHub pero sin fusionar en main (necesitan su PR y tu merge): ${recientes.join(', ')}`);
if (candidatas.length > recientes.length) console.log(`ℹ Otras ${candidatas.length - recientes.length} rama(s) antiguas ya empujadas (probablemente fusionadas por «squash»; se pueden borrar).`);

if (pendientes === 0) console.log('✔ Todo a salvo: nada sin commitear, sin stash y todas las ramas con copia en GitHub.');
process.exit(pendientes === 0 ? 0 : 1);
