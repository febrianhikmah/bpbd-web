import type { PoolClient } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { approvedGroups, type Store } from '../bpbd/model.ts';
import { researchDemoPdf, type ResearchDemoFile } from '../bpbd/research-demo.ts';
import { researchDatasetTitle } from '../bpbd/research-datasets.ts';
import { catalogRequestData, decideCatalogRequest, submitCatalogRequest } from './research-catalog-requests.ts';
import { readResearchDatasets } from './research-datasets.ts';
import { mergeStore, scopeStore } from './policy.ts';

export async function createAnnualResearchDemo(client: PoolClient, store: Store, today: string) {
  const day = (offset: number) => new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || day(0) !== today) throw new Error('Tanggal dummy tidak valid.');
  const owners = store.users.filter(user => user.role === 'PEN' && user.status === 'Aktif');
  const owner = owners.find(user => user.id === 'PEN-001') || owners[0];
  const admin = store.users.find(user => user.role === 'ADM' && user.status === 'Aktif');
  if (!owner || !admin) throw new Error('Diperlukan akun peneliti aktif dan Admin aktif.');
  const catalog = await readResearchDatasets(client);
  const datasetIds = (codes: string[]) => codes.flatMap(code => [2025, 2026].map(year => {
    const dataset = catalog.find(dataset => dataset.code === code && dataset.year === year);
    if (!dataset) throw new Error(`Dataset tahunan ${code} / ${year} belum tersedia. Jalankan research:import-catalog.`);
    return dataset.id;
  }));
  const definitions = [
    { title: 'Pemetaan risiko dan kesiapsiagaan masyarakat 2025–2026', codes: ['1.2','1.6'], status: 'Diajukan', versions: 0, purpose: 'Membandingkan indikator risiko dan kegiatan pelatihan untuk menyusun rekomendasi kesiapsiagaan masyarakat.' },
    { title: 'Perbandingan kejadian dan dampak bencana 2025–2026', codes: ['2.1','2.2'], status: 'Disetujui', versions: 0, purpose: 'Menganalisis perbedaan kejadian dan dampak bencana pada dua tahun yang diminta.' },
    { title: 'Permohonan data bantuan rumah di luar tujuan penelitian', codes: ['3.2'], status: 'Ditolak', versions: 0, purpose: 'Mengkaji kesiapsiagaan perangkat peringatan dini; kebutuhan data penerima bantuan rumah diajukan sebagai contoh cakupan yang tidak sesuai.' },
    { title: 'Evaluasi logistik, posko, dan tanggap darurat 2025–2026', codes: ['2.3','2.4','2.7'], status: 'Disetujui', versions: 1, purpose: 'Mengevaluasi keterkaitan distribusi bantuan, kapasitas posko, dan status tanggap darurat berdasarkan dataset tahunan.' },
    { title: 'Kajian rehabilitasi dan pemulihan pascabencana 2025–2026', codes: ['3.1','3.3','3.4','3.5'], status: 'Disetujui', versions: 2, purpose: 'Menelaah asesmen kerusakan, progres hunian, anggaran, dan pemulihan infrastruktur untuk dua tahun penelitian.' },
    { title: 'Kesiapan EWS dan dokumen kontinjensi lintas bidang 2025–2026', codes: ['1.4','1.7','2.1'], status: 'Diajukan', versions: 0, purpose: 'Mengkaji keterkaitan kesiapan perangkat, dokumen kontinjensi, serta kejadian bencana lintas bidang dan tahun.' },
  ];
  const before = structuredClone(store);
  let next: Store = { ...structuredClone(store), research: [] };
  const files: ResearchDemoFile[] = [];
  for (const [index, definition] of definitions.entries()) {
    const id = `RSET-DUMMY-${String(index + 1).padStart(3, '0')}`;
    const submitted = await submitCatalogRequest(client, next, owner, {
      id, title: `[DUMMY] ${definition.title}`, institution: owner.institution || 'Institusi Contoh',
      purpose: definition.purpose + ' Seluruh kegiatan dan dokumen hasil pada permohonan ini merupakan dummy demonstrasi, bukan penelitian resmi.',
      deadline: day(60), datasetIds: datasetIds(definition.codes), consent: true,
    });
    next = submitted.next;
    if (definition.status !== 'Diajukan') next = await decideCatalogRequest(client, next, admin, id, {
      status: definition.status, accessEnd: day(90), note: definition.status === 'Disetujui'
        ? 'Contoh persetujuan Admin untuk seluruh dataset dan tahun yang diminta. Akses serta unduhan langsung aktif sesuai masa berlaku.'
        : 'Kebutuhan data penerima bantuan rumah tidak sejalan dengan tujuan kajian peringatan dini. Permohonan ditolak sebagai contoh keputusan Admin.',
    });
    for (let version = 1; version <= definition.versions; version++) {
      const request = next.research.find(request => request.id === id)!;
      const fileId = `FILE-DUMMY-HASIL-${index + 1}-V${version}`;
      const name = `hasil-penelitian-dummy-${index + 1}-v${version}.pdf`;
      const summary = `Contoh temuan ${definition.title.toLowerCase()}, versi ${version}. Ringkasan ini sintetis untuk demonstrasi arsip dan revisi hasil penelitian.`;
      files.push({ id: fileId, owner: owner.id, name, content: researchDemoPdf([
        'DOKUMEN HASIL PENELITIAN DUMMY', 'BPBD - Demonstrasi penelitian berbasis dataset tahunan', '',
        definition.title, `Permohonan: ${id}`, `Versi: ${version} | Tanggal: ${today}`, '',
        'Dataset sesuai persetujuan Admin:', ...request.catalog!.datasets.map(dataset => '- ' + researchDatasetTitle(dataset)), '',
        'Contoh temuan:', '- Analisis menggunakan tabel 2025 dan 2026 secara terpisah.', '- ID dan relasi sumber tetap dipertahankan pada setiap tabel.', '',
        'Rekomendasi dummy:', '- Perbarui metadata dan dokumentasikan perubahan secara berkala.', '- Gunakan data sesuai cakupan dan masa akses yang disetujui Admin.', '',
        'Dokumen sintetis untuk demo. Bukan hasil penelitian atau laporan resmi.',
      ]) });
      const snapshot = scopeStore(next, owner), target = snapshot.research.find(request => request.id === id)!;
      target.versions.push({ id: `VER-DUMMY-${index + 1}-${version}`, at: '', fileId, filename: name, summary,
        feedback: 'Rekomendasi dummy: jaga konsistensi ID dan metadata, dokumentasikan versi data, dan evaluasi layanan penelitian secara berkala.', review: 'Sudah', note: '' });
      target.complete = true;
      target.history.push({ at: '', actor: owner.name, action: `Hasil dummy versi ${version} dikirim` });
      next = mergeStore(next, snapshot, owner, `Hasil penelitian dummy versi ${version} diterima`, id);
    }
  }
  for (const request of next.research) if (request.status === 'Disetujui') {
    const allowed = await catalogRequestData(client, next, owner, request.id, true);
    if (allowed.datasets.length !== request.requestedGroups.length) throw new Error('Cakupan persetujuan dummy tidak lengkap.');
  }
  if (!isDeepStrictEqual(store, before) || !isDeepStrictEqual(next.users, store.users) || !isDeepStrictEqual(next.entries, store.entries)) throw new Error('Pembuatan dummy mengubah data di luar penelitian.');
  return { next, files, ownerId: owner.id, ownerName: owner.name, scenarios: next.research.map(request => ({
    id: request.id, title: request.title, status: request.status, access: request.access, download: request.download,
    result: request.versions.length ? 'Sudah' : 'Belum', versions: request.versions.length,
    datasets: request.catalog!.datasets.length, rows: request.catalog!.datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0),
    years: [...new Set(request.catalog!.datasets.map(dataset => dataset.year))].sort(), approvedDatasets: approvedGroups(request).length,
  })) };
}
