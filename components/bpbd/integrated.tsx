"use client";
import { useEffect, useState, useRef } from 'react';
import { useApp } from './context';
import { Action, Notice, PageHead } from './shared';

const fmt = (v: unknown) => v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/operasional/' + path, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BPBD-Request': '1' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(data.error || 'Permintaan gagal.'); return data;
}
export function OperationalWorkspace() {
  return <><PageHead title="Operasional Bidang" subtitle="Pencatatan, impor, revisi, dokumentasi, dan analisis kegiatan bidang."/>
    <iframe title="Ruang kerja operasional BPBD" src="/api/operasional/assets/index.html?embed=1" style={{ width: '100%', minHeight: 360, height: 'calc(100dvh - 210px)', border: '1px solid #dce3ea', borderRadius: 12, background: '#fff' }}/></>;
}
export function ResearchAdminDashboard() {
  const { store, navigate } = useApp();
  const [legacy, setLegacy] = useState<{ source_id: string; data: Record<string, unknown> }[]>([]);
  const [legacyError, setLegacyError] = useState('');
  useEffect(() => { let active = true; void request<typeof legacy>('legacy-research').then(rows => { if (active) setLegacy(rows); }).catch(e => { if (active) setLegacyError(e.message); }); return () => { active = false; }; }, []);
  const stats = [['Pendaftaran menunggu', store.users.filter(u => u.role === 'PEN' && u.status === 'Menunggu Persetujuan').length], ['Permohonan diajukan', store.research.filter(r => r.status === 'Diajukan').length], ['Hasil perlu diperiksa', store.research.filter(r => r.versions.length && !r.complete).length], ['Perpanjangan diajukan', store.research.filter(r => r.extension).length]];
  return <><PageHead title="Dashboard Penelitian" subtitle="Pemeriksaan akun, permohonan, izin akses, dan hasil penelitian oleh Admin."/>
    <div className="stats-grid">{stats.map(([label, count]) => <section className="panel panel-pad" key={label}><p>{label}</p><strong style={{ fontSize: 28 }}>{count}</strong></section>)}</div>
    <section className="panel panel-pad" style={{ marginTop: 20 }}><h2>Tindak lanjut penelitian</h2><div className="page-actions" style={{ marginTop: 16 }}><Action onClick={() => navigate('/admin/pendaftaran')}>Verifikasi Akun</Action><Action onClick={() => navigate('/riset/permohonan')}>Periksa Permohonan</Action><Action onClick={() => navigate('/riset/hasil')}>Tinjau Hasil</Action><Action onClick={() => navigate('/admin/akses-riset')}>Kelola Izin Data</Action></div></section>
    <section className="panel panel-pad" style={{ marginTop: 20 }}><h2>Arsip permintaan data sebelumnya</h2><p>Identitas pemohon pada arsip perlu dicocokkan dengan akun penelitian sebelum menjadi permohonan aktif. Izin akses tidak diberikan otomatis.</p>{legacyError && <Notice kind="danger">{legacyError}</Notice>}{legacy.map(r => <details key={r.source_id} style={{ padding: 12 }}><summary>Permintaan {r.source_id}</summary><RecordDetails row={r.data}/></details>)}{!legacy.length && !legacyError && <p>Belum ada arsip permintaan.</p>}</section></>;
}
export function LogisticsDashboard() {
  const frame=useRef<HTMLIFrameElement>(null);
  const [height,setHeight]=useState(1200);
  useEffect(()=>{
    function onMessage(e:MessageEvent){if(e.origin===window.location.origin&&e.source===frame.current?.contentWindow&&e.data?.type==='bpbd-k1-height'&&Number.isFinite(e.data.height))setHeight(Math.min(15000,Math.max(500,e.data.height)));}
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[]);
  return <section aria-label="Dashboard Logistik"><h1 className="sr-only">Dashboard Logistik</h1><iframe ref={frame} title="Dashboard Logistik Kelompok 1" src="/api/operasional/k1/index.html" style={{width:'100%',height,border:0,borderRadius:16}}/></section>;
}
function RecordDetails({ row }: { row: Record<string, unknown> }) {
  return <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 3fr', gap: 8, padding: '16px 0', overflowWrap: 'anywhere' }}>{Object.entries(row).filter(([k]) => k !== 'history').map(([key, v]) => <div key={key} style={{ display: 'contents' }}><dt style={{ fontWeight: 600 }}>{key.replaceAll('_',' ')}</dt><dd>{fmt(v)}</dd></div>)}</dl>;
}
