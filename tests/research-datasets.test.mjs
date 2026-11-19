import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fieldResearchDatasets, researchDatasetTitle, researchCellText } from '../lib/bpbd/research-datasets.ts';

const {datasets}=JSON.parse(readFileSync(new URL('../data/research/datasets.json',import.meta.url),'utf8'));
const relations=JSON.parse(readFileSync(new URL('../data/research/relations.json',import.meta.url),'utf8'));
test('Research catalog preserves 28 separate annual datasets, 2 shared references and 602 records',()=>{
  assert.equal(datasets.length,30);assert.equal(new Set(datasets.map(d=>d.id)).size,30);
  assert.equal(datasets.reduce((sum,d)=>sum+d.rowCount,0),602);
  for(const [field,count] of [['PK',8],['KL',10],['RR',10]]){
    assert.equal(fieldResearchDatasets(datasets,field).length,count);
    for(const year of ['2025','2026'])assert.equal(fieldResearchDatasets(datasets,field,year).length,count/2);
  }
  const yearColumn={'1.2':'tahun','1.4':'tahun_pemasangan','1.6':'tanggal_mulai','1.7':'tahun_penyusunan','2.1':'tanggal_kejadian','2.2':'tanggal_update','2.3':'tanggal_buka','2.4':'tanggal_distribusi','2.7':'tanggal_sk','3.1':'tanggal_asesmen','3.3':'tanggal_mulai','3.4':'tahun_anggaran','3.5':'tanggal_mulai'};
  for(const dataset of datasets){
    assert.equal(dataset.rows.length,dataset.rowCount);
    assert.equal(new Set(dataset.rows.map(row=>row[dataset.columns[0].name])).size,dataset.rowCount);
    assert.equal(dataset.rowCount,dataset.code==='REF.1'?177:dataset.code==='REF.2'?5:15);
    if(dataset.year!==null)for(const row of dataset.rows){
      assert.equal(dataset.code==='3.2'?Number(row.id_kejadian.split('-')[1]):Number(String(row[yearColumn[dataset.code]]).slice(0,4)),dataset.year);
    }
  }
  for(const year of [2025,2026])for(const rel of relations){
    const from=datasets.find(d=>d.code===rel.from&&d.year===year);
    const to=datasets.find(d=>d.code===rel.to&&(d.year===year||d.year===null));
    const allowed=new Set(to.rows.map(row=>row[rel.target_field]));
    for(const row of from.rows)assert.ok(allowed.has(row[rel.field])||rel.optional&&row[rel.field]===null,`${year} ${rel.from}.${rel.field}`);
  }
});
test('Dataset names identify their year and cells preserve codes, nulls and booleans',()=>{
  const dataset=datasets.find(d=>d.year===2025),column=dataset.columns[0];
  assert.match(researchDatasetTitle(dataset),/2025$/);
  assert.equal(researchCellText('33.74.01.1001',column),'33.74.01.1001');
  assert.equal(researchCellText(2025,{...column,name:'tahun'}),'2025');
  assert.equal(researchCellText(null,column),'—');assert.equal(researchCellText(false,column),'Tidak');
});
