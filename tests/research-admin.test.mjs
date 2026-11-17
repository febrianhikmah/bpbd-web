import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, canVisit } from '../lib/bpbd/model.ts';
import { scopeStore, mergeStore } from '../lib/server/policy.ts';
import { researchLibrary } from '../lib/bpbd/research-library.ts';
import { upgradeResearchAccess } from '../lib/bpbd/research-access-migration.ts';

test('Successful result submission becomes Sudah and preserves every previous version',()=>{
 const store=seedStore(),actor=store.users.find(u=>u.id==='PEN-001'),snapshot=scopeStore(store,actor),r=snapshot.research.find(r=>r.id==='RSET-001');
 const version={id:'VERSION-1',at:'forged',filename:'hasil.pdf',fileId:'FILE-1',summary:'Hasil',feedback:'Rekomendasi internal',review:'Sudah',note:''};
 r.versions.push(version);r.complete=true;
 const saved=mergeStore(store,snapshot,actor,'Kirim hasil',r.id),result=saved.research.find(r=>r.id==='RSET-001');
 assert.equal(result.complete,true);assert.equal(result.versions[0].review,'Sudah');assert.notEqual(result.versions[0].at,'forged');
 const revision=scopeStore(saved,actor),next=revision.research.find(r=>r.id===result.id);
 next.versions.push({...version,id:'VERSION-2',fileId:'FILE-2'});
 const updated=mergeStore(saved,revision,actor,'Revisi',r.id).research.find(x=>x.id===r.id);
 assert.equal(updated.versions.length,2);assert.deepEqual(updated.versions[0],result.versions[0]);
 next.versions[0].summary='overwrite';assert.throws(()=>mergeStore(saved,revision,actor,'Overwrite',r.id));
});
test('Manual review and completeness overrides are retired; only Admin manages deadlines',()=>{
 const store=seedStore(),request=store.research[0];
 request.versions=[{id:'VERSION-1',at:new Date().toISOString(),filename:'hasil.pdf',fileId:'FILE-1',summary:'Hasil',feedback:'Rekomendasi',review:'Belum Ditinjau',note:''}];
 request.extension={date:'2026-12-30',reason:'Perpanjangan'};
 for(const role of ['ADM','SEK','KL','PK','RR']){
  const actor=store.users.find(u=>u.role===role),snapshot=scopeStore(store,actor);
  if(!snapshot.research.some(r=>r.id===request.id))snapshot.research.push(structuredClone(request));
  const next=snapshot.research.find(r=>r.id===request.id);next.versions[0].review='Perlu Perbaikan';next.versions[0].note='Catatan';
  assert.throws(()=>mergeStore(store,snapshot,actor,'Review',request.id));
  if(role==='ADM'){
   const completion=scopeStore(store,actor);completion.research.find(r=>r.id===request.id).complete=true;
   assert.throws(()=>mergeStore(store,completion,actor,'Kelengkapan',request.id));
   const extended=scopeStore(store,actor),r=extended.research.find(r=>r.id===request.id);r.deadline=r.extension.date;delete r.extension;
   assert.equal(mergeStore(store,extended,actor,'Tenggat',r.id).research.find(x=>x.id===r.id).deadline,'2026-12-30');
  }
 }
});
test('Library includes all existing result versions and exposes only archive fields',()=>{
 const store=seedStore(),r=store.research[0];r.supportingId='PRIVATE';r.purpose='PRIVATE PURPOSE';
 r.versions=[{id:'V1',at:'2026-01-01',fileId:'F1',filename:'old.pdf',summary:'Old',feedback:'PRIVATE FEEDBACK',review:'Perlu Perbaikan',note:'PRIVATE NOTE'}, {id:'V2',at:'2026-02-01',fileId:'MISSING',filename:'missing.pdf',summary:'Missing',feedback:'',review:'',note:''}, {id:'V3',at:'2026-03-01',fileId:'F3',filename:'new.pdf',summary:'New',feedback:'',review:'Sudah',note:''}];
 const library=researchLibrary(store,new Set(['F1','F3','PRIVATE']));
 assert.equal(library.length,1);assert.deepEqual(library[0].versions.map(v=>v.id),['V3','V1']);assert.deepEqual(library[0].versions.map(v=>v.number),[3,1]);
 assert.ok(!JSON.stringify(library).includes('PRIVATE'));assert.ok(!JSON.stringify(library).includes('fileId'));
 assert.equal(researchLibrary(store,new Set()).length,0);
 for(const actor of store.users)assert.equal(canVisit(store,actor.role,'/library-penelitian',actor.id),actor.status==='Aktif');
});
test('Existing full Admin approvals upgrade once without reviving revoked or stale grants',()=>{
 const store=seedStore(),r=store.research[0];r.access='Belum Aktif';r.download=false;r.decisions.ADM.download=false;
 const upgrade=upgradeResearchAccess(store);
 assert.deepEqual(upgrade.changed,[r.id]);assert.equal(upgrade.next.research[0].access,'Aktif');assert.equal(upgrade.next.research[0].download,true);
 assert.deepEqual(upgrade.next.entries,store.entries);assert.deepEqual(upgrade.next.users,store.users);assert.deepEqual(upgrade.next.research[0].versions,r.versions);
 assert.equal(upgradeResearchAccess(upgrade.next).changed.length,0);
 r.access='Dicabut';assert.equal(upgradeResearchAccess(store).changed.length,0);
 r.access='Belum Aktif';delete r.decisions.ADM.validatedRows;assert.equal(upgradeResearchAccess(store).changed.length,0);
});
