"use client";
import { useState } from 'react';
import { ChevronDown, HardHat, Search, ShieldCheck, Waves } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ResearchDatasetSummary, ResearchFieldCode } from '@/lib/bpbd/research-datasets';
import { researchFields } from './research-catalog';

type DatasetRow = { code: string; title: string; datasets: ResearchDatasetSummary[] };
const years = [2026, 2025];
export function ResearchDatasetPicker({ datasets, selectedIds, onChange }: { datasets: ResearchDatasetSummary[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [year, setYear] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Partial<Record<ResearchFieldCode, boolean>>>({});
  const shownYears = years.filter(value => year === 'all' || String(value) === year);
  const words = search.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const visible = datasets.filter(dataset => shownYears.includes(dataset.year || 0) && words.every(word => `${dataset.title} ${dataset.code} ${researchFields.find(field => field.code === dataset.field)?.name || ''}`.toLocaleLowerCase('id').includes(word)));
  const visibleIds = new Set(visible.map(dataset => dataset.id));
  const hiddenSelected = selectedIds.filter(id => !visibleIds.has(id)).length;
  const changeMany = (ids: string[], checked: boolean) => onChange(checked ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter(id => !ids.includes(id)));
  const groups = researchFields.map(field => {
    const options = visible.filter(dataset => dataset.field === field.code);
    const rows = new Map<string, DatasetRow>();
    for (const dataset of options) {
      const row = rows.get(dataset.code) || { code: dataset.code, title: dataset.title, datasets: [] };
      row.datasets.push(dataset); rows.set(dataset.code, row);
    }
    return { ...field, options, rows: [...rows.values()].sort((a,b) => a.code.localeCompare(b.code, 'id', { numeric: true })), selected: datasets.filter(dataset => dataset.field === field.code && selectedIds.includes(dataset.id)).length };
  }).filter(field => field.options.length > 0);

  return <div className="research-picker">
    <div className="research-picker-tools">
      <div className="research-picker-search"><label htmlFor="research-dataset-search">Cari dataset</label><div><Search size={18} aria-hidden="true" /><input id="research-dataset-search" type="search" value={search} placeholder="Cari nama atau kode dataset…" onChange={event => { setSearch(event.target.value); setExpanded({}); }} /></div></div>
      <div className="research-picker-year"><span>Tahun dataset</span><div role="group" aria-label="Tahun dataset" className="research-picker-segments">{[{ value: 'all', label: 'Semua' }, { value: '2026', label: '2026' }, { value: '2025', label: '2025' }].map(option => <button key={option.value} type="button" aria-pressed={year === option.value} onClick={() => setYear(option.value)}>{option.label}</button>)}</div></div>
    </div>
    <div className="research-picker-help"><p>Klik nama dataset untuk memilih semua tahun yang ditampilkan.</p>{hiddenSelected > 0 && <span role="status">{hiddenSelected} pilihan di luar filter tetap tersimpan</span>}</div>
    <div className="research-picker-cards">{groups.map((field, index) => {
      const ids = field.options.map(dataset => dataset.id);
      const picked = ids.filter(id => selectedIds.includes(id)).length;
      const checked = picked === ids.length ? true : picked > 0 ? 'indeterminate' : false;
      const open = expanded[field.code] ?? (words.length > 0 || (selectedIds.length > 0 ? field.selected > 0 : index === 0));
      const Icon = field.code === 'PK' ? ShieldCheck : field.code === 'KL' ? Waves : HardHat;
      const titleId = `research-picker-title-${field.code}`;
      return <Collapsible asChild open={open} onOpenChange={value => setExpanded(previous => ({ ...previous, [field.code]: value }))} key={field.code}>
        <section className="research-picker-card" data-field={field.code} aria-labelledby={titleId}>
          <h3><CollapsibleTrigger asChild><button type="button" className="research-picker-card-trigger" aria-label={field.name}>
            <span className="research-picker-field-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="research-picker-field-heading"><span className="research-picker-field-title" id={titleId}>{field.name}</span><span className="research-picker-field-meta">{field.rows.length} jenis dataset · {field.options.length} pilihan tahun</span></span>
            {field.selected > 0 && <span className="research-picker-selected-count">{field.selected} dipilih</span>}
            <ChevronDown className="research-picker-chevron" size={18} aria-hidden="true" />
          </button></CollapsibleTrigger></h3>
          <CollapsibleContent>
            <div className="research-picker-bulk"><label><Checkbox checked={checked} onCheckedChange={value => changeMany(ids, value === true)} aria-label={`Pilih semua ${field.name}`} /><span>Pilih semua <small>yang ditampilkan</small></span></label><span>{field.options.length} dataset</span></div>
            <div className="research-picker-matrix-wrap"><table className="research-picker-matrix" aria-labelledby={titleId}>
              <colgroup><col />{shownYears.map(value => <col key={value} className="research-picker-year-column" />)}</colgroup>
              <thead><tr><th scope="col">Nama dataset</th>{shownYears.map(value => <th scope="col" key={value}>{value}</th>)}</tr></thead>
              <tbody>{field.rows.map(row => {
                const rowIds = row.datasets.map(dataset => dataset.id), all = rowIds.every(id => selectedIds.includes(id)), any = rowIds.some(id => selectedIds.includes(id));
                return <tr key={row.code} data-selected={any}>
                  <th scope="row"><button className="research-picker-row-name" type="button" aria-label={`${all ? 'Batalkan pilihan' : 'Pilih'} semua tahun untuk ${row.title}`} aria-pressed={all ? true : any ? 'mixed' : false} onClick={() => changeMany(rowIds, !all)}>{row.title}</button></th>
                  {shownYears.map(value => {
                    const dataset = row.datasets.find(dataset => dataset.year === value);
                    return <td key={value}>{dataset ? <label className="research-picker-choice" data-checked={selectedIds.includes(dataset.id)}><Checkbox aria-label={`${dataset.title} — ${value}`} checked={selectedIds.includes(dataset.id)} onCheckedChange={checked => changeMany([dataset.id], checked === true)} /><span className="research-picker-row-count">{dataset.rowCount} baris</span></label> : <span className="research-picker-unavailable">—</span>}</td>;
                  })}
                </tr>;
              })}</tbody>
            </table></div>
          </CollapsibleContent>
        </section>
      </Collapsible>;
    })}</div>
    {!groups.length && <div className="research-picker-empty" role="status"><Search size={26} aria-hidden="true" /><strong>Dataset tidak ditemukan</strong><p>Coba kata kunci lain atau ubah tahun.</p><button className="text-button" type="button" onClick={() => { setSearch(''); setYear('all'); setExpanded({}); }}>Hapus filter</button></div>}
  </div>;
}
