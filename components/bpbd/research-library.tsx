"use client";
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/bpbd/api';
import { download } from '@/lib/bpbd/files';
import { formatDate } from '@/lib/bpbd/model';
import type { LibraryResearch, LibraryVersion } from '@/lib/bpbd/research-library';
import { Action, Choice, DataTable, Field, Metadata, Modal, Notice, PageHead } from './shared';

export function ResearchLibrary() {
  const [rows, setRows] = useState<LibraryResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [selected, setSelected] = useState<LibraryResearch | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api<LibraryResearch[]>('library');
        if (active) { setRows(data); setError(''); }
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const years = [...new Set(rows.flatMap(r => r.versions.map(v => v.at.slice(0, 4))))].sort().reverse();
  const visible = rows.filter(r => `${r.title} ${r.author} ${r.institution}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')) && (year === 'all' || r.versions.some(v => v.at.startsWith(year))));
  const detail = rows.find(r => r.id === selected?.id);
  async function getDocument(r: LibraryResearch, v: LibraryVersion) {
    if (busy) return;
    setBusy(v.id);
    try {
      const response = await fetch(`/api/bpbd/library/${encodeURIComponent(r.id)}/${encodeURIComponent(v.id)}/file`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error || 'Dokumen tidak dapat diunduh.'); }
      download(await response.blob(), v.filename);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }
  return <>
    <PageHead title="Library Penelitian" subtitle="Arsip hasil penelitian dari seluruh peneliti, termasuk versi dokumen sebelumnya."/>
    <Notice>Seluruh akun aktif yang login dapat membaca ringkasan dan mengunduh dokumen hasil penelitian di sini.</Notice>
    <div className="filter-bar">
      <Field label="Pencarian" htmlFor="library-search"><input id="library-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Judul, peneliti, atau institusi…"/></Field>
      <Field label="Tahun unggah"><Choice label="Tahun unggah" value={year} onChange={setYear} options={[{ value: 'all', label: 'Semua tahun' }, ...years.map(value => ({ value, label: value }))]}/></Field>
      <Action secondary onClick={() => { setSearch(''); setYear('all'); }}>Reset</Action>
    </div>
    {error && <Notice kind="danger">{error}</Notice>}
    {loading ? <Notice>Memuat arsip penelitian…</Notice> : <section className="panel"><DataTable rows={visible} emptyTitle="Belum ada arsip penelitian" emptyDescription="Arsip muncul setelah dokumen hasil penelitian berhasil dikirim. Jika memakai pencarian, coba ubah kata kunci." columns={[
      { label: 'Penelitian', render: r => <><button className="table-link" onClick={() => setSelected(r)}>{r.title}</button><small>{r.author} · {r.institution}</small></> },
      { label: 'Unggahan terakhir', render: r => formatDate(r.versions[0].at) },
      { label: 'Arsip', render: r => `${r.versions.length} dokumen` },
      { label: 'Tindakan', render: r => <button className="text-button" onClick={() => setSelected(r)}>Buka arsip</button> },
    ]}/></section>}
    <Modal open={!!selected} onOpenChange={open => !open && setSelected(null)} title="Arsip Penelitian">
      {detail && <><h3 style={{ overflowWrap: 'anywhere' }}>{detail.title}</h3><Metadata items={[["Peneliti", detail.author], ["Institusi", detail.institution]]}/>
        {detail.versions.map(v => <section className="scope-box" key={v.id} style={{ overflowWrap: 'anywhere' }}>
          <h4>Versi {v.number} · {formatDate(v.at)}</h4><p>{v.filename}</p><p style={{ whiteSpace: 'pre-wrap' }}>{v.summary}</p>
          <Action secondary disabled={!!busy} onClick={() => getDocument(detail, v)}><Download/>{busy === v.id ? 'Mengunduh…' : `Unduh versi ${v.number}`}</Action>
        </section>)}
      </>}
    </Modal>
  </>;
}
