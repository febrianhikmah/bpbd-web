import { researchDataValidated, referenceDate, type Store } from './model.ts';

export function upgradeResearchAccess(store: Store, at = new Date().toISOString()) {
  const next = structuredClone(store), changed: string[] = [], skipped: { id: string; reason: string }[] = [];
  for (const r of next.research) {
    if (r.status !== 'Disetujui') continue;
    const decision = r.decisions.ADM;
    if (['Dicabut','Berakhir'].includes(r.access) || r.accessEnd < referenceDate) { skipped.push({ id: r.id, reason: 'Izin sudah dicabut/berakhir; dipertahankan.' }); continue; }
    if (!decision || !researchDataValidated(next, r)) { skipped.push({ id: r.id, reason: 'Keputusan Admin atau validasi cakupan perlu diperbarui.' }); continue; }
    if (r.access === 'Aktif' && r.download && decision.download) continue;
    r.access = 'Aktif'; r.download = true; decision.download = true;
    r.history.push({ at, actor: 'Sistem', action: 'Persetujuan Admin sekaligus mengaktifkan unduhan', note: 'Penyesuaian alur penelitian 17 November 2026; cakupan, versi data, dan masa berlaku tetap.' });
    changed.push(r.id);
  }
  return { next, changed, skipped };
}
