import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedStore, approvedGroups, authorizedResearchEntries, accessActive } from '../lib/bpbd/model.ts';
import { catalogDatasetScope, catalogDatasetVersion, catalogDatasetCsv } from '../lib/server/research-catalog-requests.ts';
import { scopeStore, mergeStore } from '../lib/server/policy.ts';

const {datasets}=JSON.parse(readFileSync(new URL('../data/research/datasets.json',import.meta.url),'utf8'));
test('Catalog versions are stable across JSON object order and detect changed rows',()=>{
  const dataset=datasets.find(dataset=>dataset.id==='2_1_Kejadian_Bencana_2025');
  const reordered=JSON.parse(JSON.stringify(dataset,(key,value)=>value&&!Array.isArray(value)&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse()):value));
  assert.equal(catalogDatasetVersion(dataset),catalogDatasetVersion(reordered));
  reordered.rows[0].nama_kejadian+=' revised';
  assert.notEqual(catalogDatasetVersion(dataset),catalogDatasetVersion(reordered));
  assert.throws(()=>catalogDatasetScope(datasets.find(dataset=>dataset.field===null)),/Referensi internal/);
});
test('CSV keeps each annual table and raw numeric coordinates while escaping text formulas',()=>{
  const dataset=structuredClone(datasets.find(dataset=>dataset.id==='2_1_Kejadian_Bencana_2025'));
  dataset.rows[0].nama_kejadian='=UNTRUSTED';
  const exported=catalogDatasetCsv(dataset);
  assert.equal(exported.split('\r\n').length,16);
  assert.ok(exported.includes('KJD-2025-001'));assert.ok(!exported.includes('KJD-2026-'));
  assert.ok(exported.includes("'=UNTRUSTED"));assert.ok(exported.includes('"'+dataset.rows[0].latitude+'"'));
});
test('Annual grants support results and deadlines, while scopes and grants cannot be forged through snapshots',()=>{
  const store=seedStore(),actor=store.users.find(user=>user.id==='PEN-001'),dataset=datasets.find(dataset=>dataset.id==='2_1_Kejadian_Bencana_2025');
  const scope=catalogDatasetScope(dataset),request={...structuredClone(store.research[0]),id:'RSET-CATALOG-UNIT',requestedGroups:[dataset.id],status:'Disetujui',access:'Aktif',accessEnd:'2099-12-31',catalog:{datasets:[scope],validatedAt:new Date().toISOString(),grant:{at:new Date().toISOString(),datasets:[scope]}},decisions:{ADM:{status:'Disetujui',note:'OK',groups:[dataset.id],download:true,accessEnd:'2099-12-31'}},versions:[],history:[]};
  delete request.validation;store.research.push(request);
  assert.deepEqual(approvedGroups(request),[dataset.id]);assert.equal(accessActive(request),true);
  assert.deepEqual(authorizedResearchEntries(store,request,actor.id),[]);
  for(const forge of [r=>r.catalog.datasets[0].year=2026,r=>r.catalog.grant.datasets[0].version='0'.repeat(64),r=>r.requestedGroups.push('2_1_Kejadian_Bencana_2026'),r=>r.decisions.ADM.note='forged',r=>r.accessEnd='2100-12-31']){
    const snapshot=scopeStore(store,actor);forge(snapshot.research.find(r=>r.id===request.id));
    assert.throws(()=>mergeStore(store,snapshot,actor,'Forged',request.id));
  }
  const uploaded=scopeStore(store,actor),next=uploaded.research.find(r=>r.id===request.id);
  next.versions.push({id:'VER-CATALOG',at:'fake',fileId:'FILE-CATALOG',filename:'hasil.pdf',summary:'Ringkasan',feedback:'Saran',review:'Sudah',note:''});next.complete=true;
  const saved=mergeStore(store,uploaded,actor,'Hasil',request.id).research.find(r=>r.id===request.id);
  assert.equal(saved.versions.length,1);assert.equal(saved.complete,true);assert.deepEqual(saved.catalog,request.catalog);
  const admin=store.users.find(user=>user.role==='ADM'),coordinated=scopeStore(store,admin);
  coordinated.research.find(r=>r.id===request.id).deadline='2099-12-31';
  assert.equal(mergeStore(store,coordinated,admin,'Tenggat',request.id).research.find(r=>r.id===request.id).deadline,'2099-12-31');
});
