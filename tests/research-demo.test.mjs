import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, authorizedResearchEntries, researchStatuses } from '../lib/bpbd/model.ts';
import { scopeStore, mergeStore } from '../lib/server/policy.ts';
import { researchLibrary } from '../lib/bpbd/research-library.ts';
import { createResearchDemo } from '../lib/bpbd/research-demo.ts';

test('Research dummy scenarios follow the current decisions, downloads, results and library rules',()=>{
 const store=seedStore(),before=structuredClone(store),{next,files}=createResearchDemo(store,'2026-11-17');
 assert.deepEqual(store,before);assert.deepEqual(next.users,store.users);assert.deepEqual(next.entries,store.entries);
 assert.equal(next.research.length,6);assert.equal(next.research.filter(r=>r.status==='Diajukan').length,2);assert.equal(next.research.filter(r=>r.status==='Disetujui').length,3);assert.equal(next.research.filter(r=>r.status==='Ditolak').length,1);
 assert.ok(next.research.every(r=>researchStatuses.includes(r.status)&&r.title.startsWith('[DUMMY]')&&r.validation.rows.length));
 for(const r of next.research){
  const rows=authorizedResearchEntries(next,r,r.owner);
  if(r.status==='Disetujui'){assert.equal(r.access,'Aktif');assert.equal(r.download,true);assert.deepEqual(r.decisions.ADM.groups,r.requestedGroups);assert.ok(rows.length);}
  else {assert.equal(r.access,'Belum Aktif');assert.equal(r.download,false);assert.equal(rows.length,0);}
 }
 assert.equal(files.length,3);assert.ok(files.every(f=>f.content.subarray(0,5).toString()==='%PDF-'&&f.content.toString().includes('DUMMY')));
 const library=researchLibrary(next,new Set(files.map(f=>f.id)));assert.equal(library.length,2);assert.equal(library.flatMap(r=>r.versions).length,3);
 const r=next.research.find(r=>r.status==='Disetujui'&&!r.versions.length),actor=next.users.find(u=>u.id===r.owner),snapshot=scopeStore(next,actor),updated=snapshot.research.find(x=>x.id===r.id);
 updated.versions.push({id:'VER-CHECK',at:'',filename:'hasil.pdf',fileId:'FILE-CHECK',summary:'Hasil',feedback:'Rekomendasi',review:'Sudah',note:''});updated.complete=true;
 assert.equal(mergeStore(next,snapshot,actor,'Kirim hasil',r.id).research.find(x=>x.id===r.id).versions.length,1);
});
