"use client";

import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { roles, formatDate } from '@/lib/bpbd/model';
import { api, RequestError } from '@/lib/bpbd/api';
import { fieldResearchDatasets, researchCellText, researchDatasetTitle, type ResearchDataset, type ResearchDatasetSummary } from '@/lib/bpbd/research-datasets';
import { useApp } from './context';
import { Action, Choice, Crumbs, Notice, PageHead } from './shared';
import { SystemPage } from './operations';

export const researchFields = (['PK', 'KL', 'RR'] as const).map(code => ({ code, name: roles[code].name, slug: roles[code].slug }));
type ResearchField = typeof researchFields[number];
const sizes = ['10', '20', '50', '100'];
const years = ['2025', '2026'];
function pageNumber(value: string | null) { return value && /^\d{1,6}$/.test(value) ? Math.max(1, Number(value)) : 1; }
function catalogOptions(query: URLSearchParams) {
  return { year: years.includes(query.get('tahun') || '') ? query.get('tahun')! : 'all', size: sizes.includes(query.get('jumlah') || '') ? query.get('jumlah')! : '20', page: pageNumber(query.get('halaman')) };
}
function catalogUrl(field: ResearchField, options: ReturnType<typeof catalogOptions>) {
  const params = new URLSearchParams();
  if (options.year !== 'all') params.set('tahun', options.year);
  if (options.size !== '20') params.set('jumlah', options.size);
  if (options.page > 1) params.set('halaman', String(options.page));
  return `/peneliti/show-data/${field.slug}${params.size ? '?' + params : ''}`;
}
export function useResearchResource<T>(endpoint: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ endpoint: string; data?: T; error?: Error }>({ endpoint });
  useEffect(() => {
    let cancelled = false;
    api<T>(endpoint).then(data => { if (!cancelled) setResult({ endpoint, data }); })
      .catch((error: Error) => { if (!cancelled) setResult({ endpoint, error }); });
    return () => { cancelled = true; };
  }, [endpoint, attempt]);
  return { ...(result.endpoint === endpoint ? result : { endpoint }), retry: () => { setResult({ endpoint }); setAttempt(value => value + 1); } };
}
function followLink(event: MouseEvent<HTMLAnchorElement>, navigate: (path: string) => void, path: string) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); navigate(path);
}
function CatalogPager({ page, pages, total, pageSize, unit, onPage }: { page: number; pages: number; total: number; pageSize: number; unit: string; onPage: (page: number) => void }) {
  return <div className="research-catalog-pagination">
    <span>Menampilkan {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} dari {total} {unit}</span>
    <div><Action secondary aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</Action><span>Halaman {page} dari {pages}</span><Action secondary aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya</Action></div>
  </div>;
}
function ResourceStatus({ error, retry }: { error?: Error; retry: () => void }) {
  return error ? <><Notice kind="danger">{error.message}</Notice><Action secondary onClick={retry}>Coba lagi</Action></> : <p className="research-catalog-loading" role="status">Memuat dataset penelitian…</p>;
}

export function ShowResearchData({ fieldSlug, datasetId }: { fieldSlug?: string; datasetId?: string }) {
  const field = researchFields.find(item => item.slug === fieldSlug);
  if (!field) return <><PageHead title="Data" subtitle="Pilih bidang melalui menu Data di sidebar." /><section className="panel panel-pad research-catalog"><div className="research-catalog-empty"><FolderOpen size={32} aria-hidden="true" /><h2>Pilih bidang</h2><p>Buka menu Data, lalu pilih salah satu bidang.</p></div></section></>;
  return datasetId ? <ResearchDatasetPage field={field} datasetId={datasetId} /> : <ResearchCatalog field={field} />;
}

function ResearchCatalog({ field }: { field: ResearchField }) {
  const { query, navigate } = useApp();
  const resource = useResearchResource<ResearchDatasetSummary[]>('research-datasets');
  const options = catalogOptions(query);
  const filtered = fieldResearchDatasets(resource.data || [], field.code, options.year);
  const limit = Number(options.size), pages = Math.max(1, Math.ceil(filtered.length / limit)), page = Math.min(options.page, pages);
  const shown = filtered.slice((page - 1) * limit, page * limit);
  const change = (patch: Partial<typeof options>) => navigate(catalogUrl(field, { ...options, page: 1, ...patch }));
  const listQuery = catalogUrl(field, { ...options, page }).split('?')[1];
  const datasetUrl = (dataset: ResearchDatasetSummary) => `/peneliti/show-data/${field.slug}/${dataset.id}${listQuery ? '?' + listQuery : ''}`;

  return <>
    <PageHead title={field.name} subtitle="Data dummy penelitian berdasarkan bidang dan tahun." />
    <section className="panel panel-pad research-catalog" aria-label="Data penelitian per bidang">
      <div className="research-catalog-toolbar">
        <div className="research-catalog-count"><label htmlFor="research-table-page-size">Menampilkan</label><Choice id="research-table-page-size" label="Jumlah tabel per halaman" value={options.size} onChange={size => change({ size })} options={sizes} /><span>Tabel</span></div>
        <div className="research-catalog-year"><label htmlFor="research-table-year">Tahun</label><Choice id="research-table-year" label="Tahun" value={options.year} onChange={year => change({ year })} options={[{ value: 'all', label: 'Semua tahun' }, ...years]} /></div>
      </div>
      {!resource.data ? <ResourceStatus error={resource.error} retry={resource.retry} /> : <>
        <div className="research-catalog-table-scroll" role="region" aria-label="Daftar tabel penelitian" tabIndex={0}>
          <table className="research-catalog-table" aria-label={`Tabel penelitian ${field.name}`}>
            <thead><tr><th scope="col" className="research-catalog-number">No.</th><th scope="col">Tabel menurut Subjek</th><th scope="col" className="research-catalog-updated">Terakhir Diperbarui</th></tr></thead>
            <tbody>{shown.length ? shown.map((dataset, index) => <tr key={dataset.id}>
              <td>{(page - 1) * limit + index + 1}</td>
              <td><a className="research-catalog-link" href={datasetUrl(dataset)} onClick={event => followLink(event, navigate, datasetUrl(dataset))}>{researchDatasetTitle(dataset)}</a></td>
              <td><time dateTime={dataset.updatedAt}>{formatDate(dataset.updatedAt)}</time></td>
            </tr>) : <tr><td colSpan={3}><div className="research-catalog-empty" role="status"><FolderOpen size={30} aria-hidden="true" /><p>Belum ada tabel untuk tahun ini.</p></div></td></tr>}</tbody>
          </table>
        </div>
        <CatalogPager page={page} pages={pages} total={filtered.length} pageSize={limit} unit="tabel" onPage={page => change({ page })} />
      </>}
    </section>
  </>;
}

function ResearchDatasetPage({ field, datasetId }: { field: ResearchField; datasetId: string }) {
  const { query, navigate } = useApp();
  const resource = useResearchResource<ResearchDataset>(`research-datasets/${encodeURIComponent(datasetId)}`);
  const dataset = resource.data;
  const backPath = catalogUrl(field, catalogOptions(query));
  const size = sizes.includes(query.get('baris') || '') ? query.get('baris')! : '20';
  const limit = Number(size), total = dataset?.rows.length || 0, pages = Math.max(1, Math.ceil(total / limit)), page = Math.min(pageNumber(query.get('halaman_data')), pages);
  const change = (nextSize: string, nextPage: number) => {
    const params = new URLSearchParams(backPath.split('?')[1]);
    if (nextSize !== '20') params.set('baris', nextSize);
    if (nextPage > 1) params.set('halaman_data', String(nextPage));
    navigate(`/peneliti/show-data/${field.slug}/${datasetId}${params.size ? '?' + params : ''}`);
  };
  if (resource.error instanceof RequestError && resource.error.status === 404 || dataset && (dataset.field !== field.code || dataset.year === null)) return <SystemPage code="404" />;
  if (!dataset) return <><PageHead title="Tabel penelitian" /><ResourceStatus error={resource.error} retry={resource.retry} /><Action secondary onClick={() => navigate(backPath)}>Kembali ke daftar tabel</Action></>;

  const shown = dataset.rows.slice((page - 1) * limit, page * limit);
  return <>
    <Crumbs items={[{ label: field.name, path: backPath }, { label: researchDatasetTitle(dataset) }]} navigate={navigate} />
    <PageHead title={researchDatasetTitle(dataset)} subtitle={`${field.name} · Tahun ${dataset.year} · ${dataset.rowCount} baris`} actions={<Action secondary onClick={() => navigate(backPath)}><ArrowLeft size={16} />Kembali ke daftar tabel</Action>} />
    <Notice>Data dummy untuk demonstrasi penelitian. {dataset.code === '1.2' ? 'Nilai dan peringkat IRBI merupakan simulasi, bukan IRBI resmi.' : 'Catatan ini terpisah dari data operasional BPBD.'}</Notice>
    <section className="panel panel-pad research-catalog" aria-label="Isi dataset penelitian">
      <div className="research-dataset-toolbar"><div className="research-catalog-count"><label htmlFor="research-data-page-size">Menampilkan</label><Choice id="research-data-page-size" label="Jumlah baris per halaman" value={size} onChange={value => change(value, 1)} options={sizes} /><span>Baris</span></div><p>Terakhir diperbarui: <time dateTime={dataset.updatedAt}>{formatDate(dataset.updatedAt)}</time></p></div>
      <p className="research-dataset-hint">Geser tabel ke samping untuk melihat seluruh kolom.</p>
      <div className="research-catalog-table-scroll" role="region" aria-label="Isi tabel dataset" tabIndex={0}>
        <ResearchDatasetRecords dataset={dataset} rows={shown} offset={(page - 1) * limit} />
      </div>
      <CatalogPager page={page} pages={pages} total={total} pageSize={limit} unit="baris" onPage={nextPage => change(size, nextPage)} />
    </section>
  </>;
}

export function ResearchDatasetRecords({ dataset, rows, offset = 0 }: { dataset: ResearchDataset; rows: ResearchDataset['rows']; offset?: number }) {
  return <table className="research-dataset-table" aria-label={`Isi ${researchDatasetTitle(dataset)}`}>
    <thead><tr><th scope="col" className="research-dataset-row-number">No.</th>{dataset.columns.map(column => <th scope="col" key={column.name} title={`${column.name}: ${column.description}`}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={String(row[dataset.columns[0].name])}><td className="research-dataset-row-number">{offset + index + 1}</td>{dataset.columns.map(column => <td key={column.name} className={column.name.startsWith('id_') || column.name.startsWith('kode_') ? 'research-dataset-code' : undefined}>{researchCellText(row[column.name], column)}</td>)}</tr>)}</tbody>
  </table>;
}
