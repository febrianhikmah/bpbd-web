export type ResearchFieldCode = 'PK' | 'KL' | 'RR';
export type ResearchCell = string | number | boolean | null;
export type ResearchRow = Record<string, ResearchCell>;
export type ResearchColumn = { name: string; type: string; label: string; description: string };
export type ResearchDatasetSummary = {
  id: string; code: string; title: string; field: ResearchFieldCode | null;
  year: number | null; updatedAt: string; rowCount: number; isDummy: boolean; columns: ResearchColumn[];
};
export type ResearchDataset = ResearchDatasetSummary & { rows: ResearchRow[] };

export function researchDatasetTitle(dataset: Pick<ResearchDatasetSummary, 'title' | 'year'>) {
  return dataset.year === null ? dataset.title : `${dataset.title} — ${dataset.year}`;
}

export function fieldResearchDatasets(datasets: ResearchDatasetSummary[], field: ResearchFieldCode, year = 'all') {
  return datasets.filter(dataset => dataset.field === field && (year === 'all' || String(dataset.year) === year))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.code.localeCompare(b.code, 'id', { numeric: true }));
}

export function researchCellText(value: ResearchCell, column: ResearchColumn) {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') {
    if (column.name === 'tahun' || column.name.startsWith('tahun_')) return String(value);
    if (column.name.endsWith('_rp')) return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: column.name.startsWith('latitude') || column.name.startsWith('longitude') ? 6 : 2 }).format(value);
  }
  return value;
}

export type ResearchDatasetScope = { id: string; code: string; title: string; field: ResearchFieldCode; year: number; rowCount: number; version: string };
export type ResearchCatalogRequest = { datasets: ResearchDatasetScope[]; validatedAt: string; grant?: { at: string; datasets: ResearchDatasetScope[] } };
export function catalogToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
