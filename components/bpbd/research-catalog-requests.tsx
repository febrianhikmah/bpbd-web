"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/bpbd/api';
import { download, saveFile, validateDocument } from '@/lib/bpbd/files';
import { accessActive, approvedGroups, formatDate, uid, type Research } from '@/lib/bpbd/model';
import { catalogToday, researchDatasetTitle, type ResearchDataset, type ResearchDatasetSummary } from '@/lib/bpbd/research-datasets';
import { useApp } from './context';
import { Action, Badge, Crumbs, Field, Metadata, Modal, Notice, PageHead } from './shared';
import { ResearchDatasetRecords, useResearchResource } from './research-catalog';
import { SystemPage } from './operations';
import { ResearchDatasetPicker } from './research-dataset-picker';

export function CatalogResearchForm({ id }: { id?: string }) {
  const { user, store, navigate, refresh, setDirty } = useApp();
  const resource = useResearchResource<ResearchDatasetSummary[]>('research-datasets');
  const [requestId] = useState(() => uid('RSET'));
  const [form, setForm] = useState({ title: '', institution: user?.institution || '', purpose: '', deadline: catalogToday().slice(0, 4) + '-12-31' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false), [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const errorNotice = useRef<HTMLDivElement>(null);
  useEffect(() => () => setDirty(false), [setDirty]);
  const selected = (resource.data || []).filter(dataset => selectedIds.includes(dataset.id));
  const change = (key: keyof typeof form, value: string) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); };
  const choose = (datasetId: string, checked: boolean) => { setSelectedIds(previous => checked ? [...new Set([...previous, datasetId])] : previous.filter(id => id !== datasetId)); setDirty(true); };
  function validationError(message: string) { setError(message); requestAnimationFrame(() => { errorNotice.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); errorNotice.current?.focus({ preventScroll: true }); }); }
  if (id) return <SystemPage code="403" />;
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      let supportingId: string | undefined;
      if (file) {
        if (uploaded.current?.file !== file) {
          await validateDocument(file, store.settings.maxUploadMb);
          const fileId = uid('FILE'); await saveFile(fileId, file); uploaded.current = { file, id: fileId };
        }
        supportingId = uploaded.current!.id;
      }
      const saved = await api<{ id: string }>('catalog-requests', 'POST', { id: requestId, ...form, datasetIds: selectedIds, consent, ...(supportingId ? { supportingId } : {}) });
      await refresh(); setDirty(false); setConfirm(false);
      toast.success('Permohonan berhasil disimpan.'); navigate(`/peneliti/permohonan/${saved.id}`);
    } catch (error) { setError((error as Error).message); setConfirm(false); }
    finally { setBusy(false); }
  }
  return <>
    <Crumbs items={[{ label: 'Permohonan Data', path: '/peneliti/permohonan' }, { label: 'Permohonan Baru' }]} navigate={navigate} />
    <PageHead title="Ajukan Permohonan Data" subtitle="Pilih dataset dan tahun yang dibutuhkan untuk diperiksa oleh Admin." />
    {error && <div ref={errorNotice} tabIndex={-1} className="research-request-error"><Notice kind="danger">{error}</Notice></div>}
    <section className="panel panel-pad research-request-form-panel"><form onSubmit={event => {
      event.preventDefault();
      if (!form.title.trim() || !form.institution.trim() || !form.purpose.trim() || !consent || !selected.length || selected.length !== selectedIds.length) { validationError('Lengkapi isian wajib, pilih dataset beserta tahunnya, dan setujui kewajiban peneliti.'); return; }
      if (!form.deadline || form.deadline < catalogToday()) { validationError('Pilih tenggat penelitian hari ini atau sesudahnya.'); return; }
      setError(''); setConfirm(true);
    }}>
      <div className="form-grid">
        <Field label="Judul penelitian" required htmlFor="research-title" className="span-2"><input id="research-title" value={form.title} onChange={event => change('title', event.target.value)} /></Field>
        <Field label="Institusi" required htmlFor="research-institution"><input id="research-institution" value={form.institution} onChange={event => change('institution', event.target.value)} /></Field>
        <Field label="Rencana selesai penelitian" required htmlFor="research-deadline" help="Admin menetapkan tenggat akhir. Pengingat hasil mengikuti jadwal penelitian."><input id="research-deadline" type="date" min={catalogToday()} value={form.deadline} onChange={event => change('deadline', event.target.value)} /></Field>
        <Field label="Tujuan dan penggunaan data" required htmlFor="research-purpose" className="span-2"><textarea id="research-purpose" value={form.purpose} onChange={event => change('purpose', event.target.value)} /></Field>
        <Field label="Dokumen pendukung" htmlFor="research-file" className="span-2" help={`Word / PDF, maksimal ${store.settings.maxUploadMb} MB.`}><input id="research-file" type="file" accept=".docx,.pdf" onChange={event => { setFile(event.target.files?.[0] || null); setDirty(true); }} /></Field>
        <div className="span-2 research-request-datasets">
          <div className="research-request-heading"><div><h2>Kebutuhan data *</h2><p>Pilih satu atau kedua tahun untuk dataset yang dibutuhkan.</p></div></div>
          {resource.error ? <><Notice kind="danger">{resource.error.message}</Notice><Action secondary type="button" onClick={resource.retry}>Muat ulang dataset</Action></> : !resource.data ? <p role="status">Memuat dataset penelitian…</p> : <ResearchDatasetPicker datasets={resource.data} selectedIds={selectedIds} onChange={ids => { setSelectedIds(ids); setDirty(true); }} />}
          {selected.length > 0 && <details className="research-request-chosen"><summary>Lihat rincian {selected.length} dataset yang dipilih</summary><ul className="research-request-selected">{selected.map(dataset => <li key={dataset.id}><span>{researchDatasetTitle(dataset)}</span><button className="text-button" type="button" aria-label={`Hapus pilihan ${researchDatasetTitle(dataset)}`} onClick={() => choose(dataset.id, false)}>Hapus</button></li>)}</ul></details>}
        </div>
        <label className="form-check span-2"><Checkbox checked={consent} onCheckedChange={value => { setConsent(value === true); setDirty(true); }} /><span>Saya akan menggunakan data sesuai cakupan izin, menyerahkan hasil penelitian, serta memberikan feedback kepada BPBD.</span></label>
      </div>
      <div className="research-request-sticky" role="region" aria-label="Ringkasan pilihan dataset"><div className="research-request-sticky-count" role="status"><strong>{selected.length} dataset dipilih</strong><span>{selected.reduce((sum, dataset) => sum + dataset.rowCount, 0)} baris · {new Set(selected.map(dataset => dataset.year)).size} tahun</span></div><div className="research-request-sticky-actions"><button className="research-request-cancel" type="button" onClick={() => navigate('/peneliti/permohonan')}>Batal</button><Action type="submit" disabled={!resource.data || !selected.length || busy}>Lanjut<ArrowRight size={16} aria-hidden="true" /></Action></div></div>
    </form></section>
    <Modal open={confirm} onOpenChange={setConfirm} title="Ringkasan permohonan"><Metadata items={[["Judul", form.title], ["Institusi", form.institution], ["Tenggat hasil", formatDate(form.deadline)], ["Jumlah", `${selected.length} dataset · ${selected.reduce((sum, dataset) => sum + dataset.rowCount, 0)} baris`]]} /><ul className="research-request-selected">{selected.map(dataset => <li key={dataset.id}>{researchDatasetTitle(dataset)}</li>)}</ul><Notice>Admin memutuskan seluruh dataset dan tahun yang dipilih. Persetujuan langsung mengaktifkan akses dan unduhan sesuai masa berlaku.</Notice><div className="review-actions"><Action disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim Permohonan'}</Action></div></Modal>
  </>;
}

export function CatalogRequestTables({ request, internal = false }: { request: Research; internal?: boolean }) {
  const resource = useResearchResource<{ datasets: ResearchDataset[] }>(`research/${encodeURIComponent(request.id)}/catalog`);
  const [busy, setBusy] = useState('');
  async function exportDataset(dataset: ResearchDataset) {
    if (busy) return;
    setBusy(dataset.id);
    try {
      const response = await fetch(`/api/bpbd/research/${encodeURIComponent(request.id)}/catalog/${encodeURIComponent(dataset.id)}/csv`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { const data = await response.json() as { error: string }; throw new Error(data.error); }
      download(await response.blob(), `${dataset.id}.csv`); toast.success('Dataset yang disetujui berhasil diunduh.');
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(''); }
  }
  if (resource.error) return <Notice kind="warning">{resource.error.message}</Notice>;
  if (!resource.data) return <p role="status">Memuat cakupan dataset permohonan…</p>;
  return <div className="research-request-tables">{resource.data.datasets.map(dataset => <section className="panel panel-pad" key={dataset.id} aria-label={`Dataset ${researchDatasetTitle(dataset)}`}>
    <div className="research-request-heading"><div><h3>{researchDatasetTitle(dataset)}</h3><p>{internal ? `${dataset.rows.length} baris untuk pemeriksaan Admin` : `Menampilkan ${Math.min(5, dataset.rows.length)} dari ${dataset.rows.length} baris yang disetujui`}</p></div>{!internal && request.download && <Action secondary disabled={!!busy} aria-label={`Unduh CSV ${researchDatasetTitle(dataset)}`} onClick={() => exportDataset(dataset)}><Download size={16} />{busy === dataset.id ? 'Mengunduh…' : 'Unduh CSV'}</Action>}</div>
    <div className="research-catalog-table-scroll" role="region" aria-label={`Isi dataset ${researchDatasetTitle(dataset)}`} tabIndex={0}><ResearchDatasetRecords dataset={dataset} rows={internal ? dataset.rows : dataset.rows.slice(0, 5)} /></div>
  </section>)}</div>;
}

export function CatalogRequestAccess({ request }: { request: Research }) {
  const { navigate } = useApp();
  return <>
    <Crumbs items={[{ label: 'Data yang Disetujui', path: '/peneliti/data' }, { label: request.id }]} navigate={navigate} />
    <PageHead title="Rincian Akses Data" subtitle={request.title} />
    <section className="panel panel-pad"><Metadata items={[["Keputusan permohonan", <Badge key="decision">{request.status}</Badge>], ["Status izin", <Badge key="access">{request.access === 'Aktif' && !accessActive(request) ? 'Berakhir' : request.access}</Badge>], ["Masa berlaku sampai", formatDate(request.accessEnd)], ["Hak unduh", request.download ? 'Diizinkan' : 'Belum diizinkan']]} /><div className="scope-box"><strong>Dataset dan tahun yang diminta</strong><ul className="research-request-selected">{request.catalog!.datasets.map(dataset => <li key={dataset.id}><span>{researchDatasetTitle(dataset)}</span><Badge>{approvedGroups(request).includes(dataset.id) ? 'Disetujui' : 'Menunggu keputusan Admin'}</Badge></li>)}</ul></div></section>
    {!accessActive(request) || !approvedGroups(request).length ? <Notice kind="warning">Akses belum aktif, telah berakhir, atau dicabut. Hanya Admin yang dapat menetapkan persetujuan.</Notice> : <><Notice>Pratinjau menampilkan maksimal 5 baris per dataset. Unduhan berisi seluruh baris sesuai dataset dan tahun yang disetujui Admin.</Notice><CatalogRequestTables request={request} /></>}
    {approvedGroups(request).length > 0 && <div className="form-footer"><Action onClick={() => navigate(`/peneliti/hasil/kirim/${request.id}`)}>Kirim Hasil Penelitian</Action></div>}
  </>;
}
