// Included by postgres.test.mjs; uses only the isolated database owned by that harness.
export async function annualRequestsTest({assert,context,login,state,save,pool}) {
  const owner=await login('nadia@peneliti.example'),admin=await login('adm@bpbd.example'),field=await login('kl@bpbd.example');
  const input={id:'RSET-ANNUAL-INTEGRATION',title:'Analisis kejadian tahunan',institution:'Kampus Uji',purpose:'Perbandingan data per tahun.',deadline:'2099-12-31',datasetIds:['2_1_Kejadian_Bencana_2025','2_1_Kejadian_Bencana_2026','1_2_IRBI_2025'],consent:true};
  const anon=await context();assert.equal((await anon.post('/api/bpbd/catalog-requests',{data:input})).status(),401);
  assert.equal((await field.post('/api/bpbd/catalog-requests',{data:input})).status(),403);
  for(const datasetIds of [['REF_1_Wilayah'],['no-such-dataset'],[input.datasetIds[0],input.datasetIds[0]],[]]){
    assert.equal((await owner.post('/api/bpbd/catalog-requests',{data:{...input,id:'RSET-INVALID',datasetIds}})).status(),400);
  }
  assert.equal((await owner.post('/api/bpbd/catalog-requests',{data:{...input,status:'Disetujui'}})).status(),400);
  const created=await owner.post('/api/bpbd/catalog-requests',{data:input});assert.equal(created.status(),201,await created.text());
  assert.equal((await owner.post('/api/bpbd/catalog-requests',{data:input})).status(),200);
  let snapshot=await state(owner),request=snapshot.store.research.find(r=>r.id===input.id);
  assert.equal(request.owner,snapshot.userId);assert.equal(request.catalog.datasets.length,3);assert.equal(request.catalog.datasets.reduce((n,d)=>n+d.rowCount,0),45);
  assert.equal(request.status,'Diajukan');assert.equal(request.download,false);assert.ok(request.catalog.datasets.every(d=>d.version.length===64));
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog`)).status(),403);
  for(const forge of [r=>r.requestedGroups.push('2_2_Dampak_Bencana_2025'),r=>r.catalog.datasets[0].year=2026,r=>r.catalog.grant={at:'fake',datasets:r.catalog.datasets},r=>r.decisions.ADM={status:'Disetujui',note:'fake',groups:r.requestedGroups}]){
    await save(owner,snapshot,s=>forge(s.research.find(r=>r.id===input.id)),403);
  }
  const decision={status:'Disetujui',note:'Disetujui Admin',accessEnd:'2099-12-31'};
  assert.equal((await field.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:decision})).status(),403);
  assert.equal((await owner.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:decision})).status(),403);
  assert.equal((await admin.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:{...decision,groups:[input.datasetIds[0]]}})).status(),400);
  assert.equal((await admin.get(`/api/bpbd/research/${input.id}/catalog`)).status(),200);
  assert.equal((await field.get(`/api/bpbd/research/${input.id}/catalog`)).status(),403);
  const approved=await admin.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:decision});assert.equal(approved.status(),200,await approved.text());
  snapshot=await state(owner);request=snapshot.store.research.find(r=>r.id===input.id);
  assert.equal(request.catalog.grant.datasets.length,3);assert.equal(request.access,'Aktif');assert.equal(request.download,true);
  const granted=await owner.get(`/api/bpbd/research/${input.id}/catalog`);assert.equal(granted.status(),200);assert.equal((await granted.json()).datasets.length,3);
  for(const year of [2025,2026]){
    const exported=await owner.get(`/api/bpbd/research/${input.id}/catalog/2_1_Kejadian_Bencana_${year}/csv`);assert.equal(exported.status(),200);
    const text=await exported.text();assert.equal(text.split('\r\n').length,16);assert.ok(text.includes(`KJD-${year}-`));assert.ok(!text.includes(`KJD-${year===2025?2026:2025}-`));
  }
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog/REF_1_Wilayah/csv`)).status(),403);
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog/2_2_Dampak_Bencana_2025/csv`)).status(),403);
  const otherSnapshot=await state(admin),other=otherSnapshot.store.users.find(u=>u.email==='arif@peneliti.example');
  await save(admin,otherSnapshot,s=>{s.users.find(u=>u.id===other.id).status='Aktif';});
  const outsider=await login(other.email);
  assert.equal((await outsider.get(`/api/bpbd/research/${input.id}/catalog`)).status(),403);
  assert.equal((await outsider.get(`/api/bpbd/research/${input.id}/catalog/2_1_Kejadian_Bencana_2025/csv`)).status(),403);
  const original=(await pool.query('SELECT data FROM bpbd_research_datasets WHERE id=$1',[input.datasetIds[0]])).rows[0].data;
  try{
    const updated=structuredClone(original);updated.rows[0].nama_kejadian+=' [REVISI]';
    await pool.query('UPDATE bpbd_research_datasets SET data=$2 WHERE id=$1',[updated.id,updated]);
    assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog`)).status(),409);
    assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog/${updated.id}/csv`)).status(),409);
    assert.equal((await admin.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:decision})).status(),200);
    const latest=await owner.get(`/api/bpbd/research/${input.id}/catalog/${updated.id}/csv`);assert.equal(latest.status(),200);assert.ok((await latest.text()).includes('[REVISI]'));
  }finally{await pool.query('UPDATE bpbd_research_datasets SET data=$2 WHERE id=$1',[original.id,original]);}
  assert.equal((await admin.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:decision})).status(),200);
  await pool.query("UPDATE bpbd_research SET data=jsonb_set(data,'{accessEnd}','\"2000-01-01\"') WHERE id=$1",[input.id]);
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog`)).status(),403);
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog/2_1_Kejadian_Bencana_2025/csv`)).status(),403);
  assert.equal((await admin.post(`/api/bpbd/research/${input.id}/catalog-decision`,{data:{...decision,status:'Ditolak',note:'Ditolak setelah pemeriksaan'}})).status(),200);
  assert.equal((await owner.get(`/api/bpbd/research/${input.id}/catalog`)).status(),403);
  request=(await state(owner)).store.research.find(r=>r.id===input.id);assert.equal(request.catalog.grant,undefined);assert.equal(request.download,false);
}
