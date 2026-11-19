import { mergeStore, scopeStore } from '../server/policy.ts';
import { approvedGroups, authorizedResearchEntries, timestamp, type Research, type Store, type User } from './model.ts';

export type ResearchDemoFile = { id: string; owner: string; name: string; content: Buffer };

export function researchDemoPdf(lines: string[]) {
  const safe = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7E]/g, ' ').replace(/[\\()]/g, '\\$&');
  const stream = 'BT /F1 11 Tf 16 TL 45 790 Td\n' + lines.map(s => `(${safe(s)}) Tj T*`).join('\n') + '\nET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [4 0 R] >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let text = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}

export function createResearchDemo(store: Store, today: string) {
  const day = (offset: number) => new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || day(0) !== today) throw new Error('Tanggal dummy tidak valid.');
  const owners = store.users.filter(u => u.role === 'PEN' && u.status === 'Aktif');
  const admin = store.users.find(u => u.role === 'ADM' && u.status === 'Aktif');
  if (!owners.length || !admin) throw new Error('Diperlukan akun peneliti aktif dan Admin aktif.');
  let next: Store = { ...structuredClone(store), research: [] };
  const files: ResearchDemoFile[] = [];
  function mutate(actor: User, id: string, action: string, update: (snapshot: Store) => void) {
    const snapshot = scopeStore(next, actor); update(snapshot);
    next = mergeStore(next, snapshot, actor, action, id, { allowLegacyResearchCreation: true });
  }
  const scenarios = [
    { title: 'Kajian edukasi dan kesiapsiagaan masyarakat', groups: ['edukasi','risiko'], state: 'Diajukan', versions: 0 },
    { title: 'Analisis kejadian dan korban banjir di Genuk', groups: ['kejadian','korban'], state: 'Disetujui', versions: 0 },
    { title: 'Permohonan kajian risiko di luar kebutuhan penelitian', groups: ['kajian'], state: 'Ditolak', versions: 0 },
    { title: 'Evaluasi distribusi bantuan dan persediaan logistik', groups: ['logistik','distribusi'], state: 'Disetujui', versions: 1 },
    { title: 'Kajian mitigasi banjir dan pemetaan wilayah rawan', groups: ['risiko','mitigasi'], state: 'Disetujui', versions: 2 },
    { title: 'Evaluasi kerusakan dan pemulihan fasilitas pascabencana', groups: ['kerusakan','pemulihan'], state: 'Diajukan', versions: 0 },
  ];
  scenarios.forEach((scenario, index) => {
    const owner = owners[index % owners.length], id = `RSET-DUMMY-${String(index + 1).padStart(3,'0')}`;
    const request: Research = {
      id, owner: owner.id, title: `[DUMMY] ${scenario.title}`, institution: owner.institution || 'Institusi Contoh',
      purpose: 'Data sintetis untuk mencoba alur permohonan, persetujuan Admin, unduhan data, dan penyerahan hasil. Bukan penelitian atau laporan resmi BPBD.',
      requestedGroups: scenario.groups, area: index === 1 ? 'Genuk' : 'all', start: day(-30).slice(0,4) + '-01-01', end: day(-30),
      deadline: day(60), status: 'Diajukan', access: 'Belum Aktif', accessEnd: day(60), download: false, decisions: {},
      history: [{at:timestamp(),actor:owner.name,action:'Permohonan dummy diajukan'}], versions: [],
    };
    mutate(owner, id, 'Permohonan dummy diajukan', s => { s.research.push(request); });
    if (scenario.state !== 'Diajukan') mutate(admin, id, 'Keputusan Admin untuk permohonan dummy', s => {
      const r = s.research.find(r => r.id === id)!;
      r.decisions = { ADM: { status: scenario.state, note: scenario.state === 'Disetujui'
        ? 'Contoh persetujuan seluruh dataset sekaligus akses unduh, tanpa aktivasi terpisah.'
        : 'Contoh penolakan: kebutuhan dataset belum sesuai dengan tujuan penelitian. Data tidak dapat diunduh.',
        groups: scenario.state === 'Disetujui' ? [...r.requestedGroups] : [], accessEnd: r.accessEnd, download: scenario.state === 'Disetujui' } };
      r.history.push({at:timestamp(),actor:admin.name,action:`Keputusan Admin: ${scenario.state}`,note:'Contoh alur penelitian terbaru.'});
    });
    for (let version = 1; version <= scenario.versions; version++) {
      const fileId = `FILE-DUMMY-HASIL-${index + 1}-V${version}`, name = `hasil-penelitian-dummy-${index + 1}-v${version}.pdf`;
      const summary = `Contoh hasil ${scenario.title.toLowerCase()}, versi ${version}. Seluruh temuan dan dokumen ini bersifat dummy untuk demonstrasi aplikasi.`;
      files.push({ id: fileId, owner: owner.id, name, content: researchDemoPdf([
        'DOKUMEN HASIL PENELITIAN DUMMY', 'BPBD - Demonstrasi layanan penelitian', '',
        scenario.title, `Nomor permohonan: ${id}`, `Versi: ${version} | Tanggal: ${today}`, '',
        'Dokumen sintetis untuk mencoba unduh dan arsip penelitian.', 'Bukan laporan resmi atau hasil penelitian sesungguhnya.', '',
        'Contoh temuan:', '- Pendataan terpadu membantu penelusuran informasi.', '- Metadata yang konsisten membantu analisis wilayah dan periode.', '',
        'Rekomendasi dummy:', '- Lengkapi metadata dan dokumentasi sumber secara berkala.', '- Gunakan cakupan yang disetujui Admin untuk analisis.',
      ]) });
      mutate(owner, id, `Hasil dummy versi ${version} dikirim`, s => {
        const r = s.research.find(r => r.id === id)!;
        r.versions.push({ id: `VER-DUMMY-${index + 1}-${version}`, at: '', fileId, filename: name, summary,
          feedback: 'Contoh rekomendasi: perbarui metadata, dokumentasikan perubahan, dan evaluasi layanan secara berkala.', review: 'Sudah', note: '' });
        r.complete = true;
        r.history.push({at:timestamp(),actor:owner.name,action:`Hasil dummy versi ${version} dikirim`});
      });
    }
  });
  for (const r of next.research) if (r.status === 'Disetujui' && !authorizedResearchEntries(next, r, r.owner).length) {
    throw new Error(`Tidak ada dataset yang dapat diunduh untuk ${r.id}; periksa data sumber.`);
  }
  return { next, files, scenarios: next.research.map(r => ({ id: r.id, status: r.status, access: r.access, download: r.download,
    result: r.versions.length ? 'Sudah' : 'Belum', versions: r.versions.length, approvedDatasets: approvedGroups(r).length })) };
}
