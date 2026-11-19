import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { approvedGroups, accessActive, timestamp, uid, type Research, type Store, type User } from '../bpbd/model.ts';
import { catalogToday, type ResearchDataset, type ResearchDatasetScope } from '../bpbd/research-datasets.ts';
import { requireThat } from './policy.ts';
import { readResearchDataset } from './research-datasets.ts';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export function catalogDatasetVersion(dataset: ResearchDataset) {
  return createHash('sha256').update(stableJson(dataset)).digest('hex');
}
export function catalogDatasetScope(dataset: ResearchDataset): ResearchDatasetScope {
  requireThat(dataset.field !== null && dataset.year !== null, 'Referensi internal tidak dapat diminta.', 400);
  return { id: dataset.id, code: dataset.code, title: dataset.title, field: dataset.field, year: dataset.year, rowCount: dataset.rows.length, version: catalogDatasetVersion(dataset) };
}
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const date = z.string().refine(validDate, 'Tanggal tidak valid.');
const identifier = z.string().max(120).regex(/^[\w-]+$/);
const submission = z.object({ id: identifier.regex(/^RSET-/), title: z.string().trim().min(1).max(500), institution: z.string().trim().min(1).max(300), purpose: z.string().trim().min(1).max(5000), deadline: date, datasetIds: z.array(identifier).min(1).max(28), consent: z.literal(true), supportingId: identifier.optional() }).strict();

async function selectedDatasets(client: PoolClient, ids: string[]) {
  const datasets: ResearchDataset[] = [];
  for (const id of ids) {
    const dataset = await readResearchDataset(client, id);
    requireThat(dataset && dataset.field !== null && dataset.year !== null, 'Pilih dataset tahunan yang tersedia; referensi internal tidak dapat diajukan.', 400);
    datasets.push(dataset);
  }
  return datasets;
}
function recordAudit(store: Store, actor: User, object: string, action: string) {
  store.audit.unshift({ id: uid('AUD'), at: timestamp(), actor: actor.name, role: actor.role, object, action });
}

export async function submitCatalogRequest(client: PoolClient, store: Store, actor: User, raw: unknown) {
  requireThat(actor.role === 'PEN' && actor.status === 'Aktif', 'Hanya peneliti aktif yang dapat mengajukan permohonan.');
  const input = submission.parse(raw);
  requireThat(new Set(input.datasetIds).size === input.datasetIds.length, 'Dataset yang sama tidak boleh dipilih dua kali.', 400);
  requireThat(input.deadline >= catalogToday(), 'Tenggat penelitian harus hari ini atau sesudahnya.', 400);
  const ids = [...input.datasetIds].sort();
  const existing = store.research.find(request => request.id === input.id);
  if (existing) {
    requireThat(existing.owner === actor.id && existing.catalog && existing.title === input.title && existing.institution === input.institution && existing.purpose === input.purpose && existing.deadline === input.deadline && existing.supportingId === input.supportingId && isDeepStrictEqual([...existing.requestedGroups].sort(), ids), 'ID permohonan sudah digunakan.', 409);
    return { next: store, request: existing, created: false };
  }
  const datasets = await selectedDatasets(client, ids);
  let supportingName: string | undefined;
  if (input.supportingId) {
    const file = await client.query('SELECT name FROM bpbd_files WHERE id=$1 AND owner_id=$2', [input.supportingId, actor.id]);
    requireThat(file.rows[0], 'Dokumen pendukung tidak tersedia atau bukan milik akun ini.');
    supportingName = file.rows[0].name;
  }
  const scopes = datasets.map(catalogDatasetScope), years = scopes.map(dataset => dataset.year), at = timestamp();
  const request: Research = {
    id: input.id, owner: actor.id, title: input.title, institution: input.institution, purpose: input.purpose,
    requestedGroups: ids, area: 'all', start: Math.min(...years) + '-01-01', end: Math.max(...years) + '-12-31', deadline: input.deadline,
    status: 'Diajukan', access: 'Belum Aktif', accessEnd: input.deadline, download: false, decisions: {}, versions: [],
    catalog: { datasets: scopes, validatedAt: at },
    history: [{ at, actor: actor.name, action: 'Permohonan dataset tahunan diajukan' }, { at, actor: 'Sistem', action: 'Seluruh baris dataset tahunan divalidasi otomatis', note: `${scopes.reduce((sum, dataset) => sum + dataset.rowCount, 0)} baris dari ${scopes.length} dataset sesuai tahun yang dipilih.` }],
    ...(input.supportingId ? { supportingId: input.supportingId, supportingName } : {}),
  };
  const next = structuredClone(store); next.research.unshift(request);
  recordAudit(next, actor, request.id, 'Permohonan dataset tahunan diajukan');
  return { next, request, created: true };
}

const decisionInput = z.object({ status: z.enum(['Disetujui','Ditolak']), note: z.string().trim().min(1).max(5000), accessEnd: date }).strict();
export async function decideCatalogRequest(client: PoolClient, store: Store, actor: User, id: string, raw: unknown) {
  requireThat(actor.role === 'ADM' && actor.status === 'Aktif', 'Seluruh verifikasi penelitian hanya dapat dilakukan Admin.');
  const input = decisionInput.parse(raw), old = store.research.find(request => request.id === id);
  requireThat(old?.catalog, 'Permohonan dataset tahunan tidak ditemukan.', 404);
  requireThat(input.status !== 'Disetujui' || input.accessEnd >= catalogToday(), 'Pilih masa akses yang belum berakhir.', 400);
  const next = structuredClone(store), request = next.research.find(request => request.id === id)!;
  const at = timestamp();
  if (input.status === 'Disetujui') {
    const datasets = await selectedDatasets(client, old.requestedGroups);
    for (const dataset of datasets) {
      const selected = old.catalog.datasets.find(item => item.id === dataset.id);
      requireThat(selected && selected.year === dataset.year && selected.field === dataset.field, 'Identitas dataset berubah. Periksa kembali cakupan permohonan.', 409);
    }
    request.catalog!.grant = { at, datasets: datasets.map(catalogDatasetScope) };
  } else delete request.catalog!.grant;
  request.status = input.status; request.access = input.status === 'Disetujui' ? 'Aktif' : 'Belum Aktif';
  request.download = input.status === 'Disetujui'; request.accessEnd = input.accessEnd;
  request.decisions = { ADM: { status: input.status, note: input.note, groups: input.status === 'Disetujui' ? [...request.requestedGroups] : [], download: request.download, accessEnd: input.accessEnd } };
  request.history.push({ at, actor: actor.name, action: `Keputusan Admin: ${input.status}`, note: input.note });
  recordAudit(next, actor, id, `Permohonan dataset tahunan ${input.status.toLowerCase()}`);
  return next;
}

export async function catalogRequestData(client: PoolClient, store: Store, actor: User, id: string, download = false) {
  const request = store.research.find(request => request.id === id);
  requireThat(actor.status === 'Aktif' && request?.catalog, 'Permohonan tidak ditemukan.', 404);
  const reviewer = actor.role === 'ADM';
  requireThat(reviewer || actor.role === 'PEN' && request.owner === actor.id, 'Permohonan berada di luar akses akun.');
  if (!reviewer || download) requireThat(actor.role === 'PEN' && request.owner === actor.id && approvedGroups(request).length === request.requestedGroups.length && accessActive(request) && (!download || request.download), 'Akses dataset belum disetujui, berakhir, atau dicabut.');
  const datasets = await selectedDatasets(client, request.requestedGroups);
  if (!reviewer || download) for (const dataset of datasets) {
    const granted = request.catalog.grant?.datasets.find(scope => scope.id === dataset.id);
    requireThat(granted && granted.version === catalogDatasetVersion(dataset), 'Dataset telah diperbarui. Admin perlu memeriksa dan menyetujui kembali versi data terbaru.', 409);
  }
  return { request, datasets };
}

export function catalogDatasetCsv(dataset: ResearchDataset) {
  const rows = [dataset.columns.map(column => column.name), ...dataset.rows.map(row => dataset.columns.map(column => row[column.name]))];
  return '\ufeff' + rows.map(row => row.map(value => {
    const text = value === null ? '' : String(value);
    const safe = typeof value === 'string' && /^[=+@\-]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
