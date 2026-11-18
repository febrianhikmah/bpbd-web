import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { request as playwrightRequest } from '@playwright/test';

const database = `bpbd_test_${randomBytes(6).toString('hex')}`;
const environment = { ...process.env, PGDATABASE: database, BPBD_INTEGRATION_TEST: '1', BPBD_RESEARCH_STATEMENT_ENABLED: 'true', NEXT_TELEMETRY_DISABLED: '1' };
let server, adminPool, testPool, baseURL, created = false;
let output = '';
const contexts = [];
async function context() {
  const value = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { 'X-BPBD-Request': '1' } });
  contexts.push(value); return value;
}
async function login(email) {
  const value = await context();
  const response = await value.post('/api/bpbd/login', { headers: { Origin: baseURL }, data: { email, password: 'BPBDdemo2026!' } });
  assert.equal(response.status(), 200, await response.text());
  return value;
}
async function state(ctx) { const res = await ctx.get('/api/bpbd/state'); assert.equal(res.status(),200,await res.text());return res.json(); }
async function save(ctx, snapshot, edit, status = 200) {
  const copy = structuredClone(snapshot); edit(copy.store);
  const res = await ctx.put('/api/bpbd/state', { data: { store: copy.store, revision: copy.revision, action: 'Uji integrasi', object: 'test' } });
  assert.equal(res.status(), status, await res.text()); return res.json();
}
before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Jalankan npm run build sampai berhasil sebelum test:postgres.');
  assert.ok(process.env.PGUSER && process.env.PGDATABASE, 'Lengkapi .env.local terlebih dahulu.');
  adminPool = new pg.Pool({ database: 'postgres', connectionTimeoutMillis: 5000 });
  await adminPool.query(`CREATE DATABASE "${database}"`); created = true;
  execFileSync(process.execPath, ['scripts/setup-db.ts'], { env: environment, stdio: 'pipe', timeout: 30000 });
  testPool = new pg.Pool({ database });
  const probe = createServer();await new Promise(resolve => probe.listen(0,'127.0.0.1',resolve));
  const port = probe.address().port;await new Promise(resolve => probe.close(resolve));
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)], { env: environment, stdio: ['ignore','pipe','pipe'], windowsHide: true });
  for (const stream of [server.stdout,server.stderr]) stream.on('data', chunk => {output=(output+chunk).slice(-20000);});
  let ready = false;
  for (let i=0;i<80;i++) {
    try { if ((await fetch(`${baseURL}/api/bpbd/state`)).status===401) {ready=true;break;} } catch {}
    if(server.exitCode!==null)break;
    await delay(250);
  }
  assert.ok(ready, `Server uji tidak siap. ${output}`);
}, { timeout: 60000 });
after(async () => {
  await Promise.all(contexts.map(ctx=>ctx.dispose()));
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]); }
  await testPool?.end();
  // Only the uniquely named database created by this test process is removed.
  if (created && /^bpbd_test_[a-f0-9]{12}$/.test(database)) {
    await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]);
    await adminPool.query(`DROP DATABASE "${database}"`);
  }
  await adminPool?.end();
});
test('API sessions, cookie flags, password hashing, CSRF and scope enforcement', async () => {
  const anon=await context();assert.equal((await anon.get('/api/bpbd/state')).status(),401);
  const missingHeader=await fetch(`${baseURL}/api/bpbd/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'adm@bpbd.example',password:'BPBDdemo2026!'})});
  assert.equal(missingHeader.status,403);
  const foreign=await anon.post('/api/bpbd/login',{headers:{Origin:'https://unrelated.example'},data:{email:'adm@bpbd.example',password:'BPBDdemo2026!'}});
  assert.equal(foreign.status(),403);
  const ctx=await login('kl@bpbd.example'),snapshot=await state(ctx);
  assert.ok(snapshot.store.entries.every(e=>['kejadian','korban','kebutuhan','logistik','distribusi'].includes(e.group)));
  assert.ok(snapshot.store.users.every(u=>u.demoPassword===''));
  const cookies=(await ctx.storageState()).cookies;assert.ok(cookies.some(c=>c.name==='bpbd_session'&&c.httpOnly&&c.sameSite==='Strict'));
  const hashes=await testPool.query('SELECT password_hash,data FROM bpbd_users');
  assert.ok(hashes.rows.every(r=>r.password_hash.startsWith('scrypt:')&&!JSON.stringify(r.data).includes('BPBDdemo2026!')));
  await save(ctx,snapshot,s=>{s.users.find(u=>u.id==='USER-KL').role='ADM';},403);
});
test('Two sessions share profile changes and reject stale snapshots',async()=>{
 const a=await login('kl@bpbd.example'),b=await login('kl@bpbd.example'),first=await state(a),stale=await state(b);
 await save(a,first,s=>{s.users.find(u=>u.id==='USER-KL').name='Petugas PostgreSQL';});
 assert.equal((await state(b)).store.users.find(u=>u.id==='USER-KL').name,'Petugas PostgreSQL');
 await save(b,stale,s=>{s.users.find(u=>u.id==='USER-KL').name='Perubahan lama';},409);
});

test('Uploaded documents persist in PostgreSQL and downloads enforce field access', async () => {
  const owner=await login('kl@bpbd.example'),peer=await login('kl@bpbd.example'),other=await login('pk@bpbd.example');
  const fileId='FILE-integration',document=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
  const upload=await owner.put(`/api/bpbd/files/${fileId}`,{headers:{'X-File-Name':'uji.pdf','Content-Type':'application/pdf'},data:document});
  assert.equal(upload.status(),201,await upload.text());
  // An unattached upload stays private to its owning account; operational file links use the new API.
  const download=await peer.get(`/api/bpbd/files/${fileId}`);assert.equal(download.status(),200);assert.deepEqual(await download.body(),document);
  assert.equal((await other.get(`/api/bpbd/files/${fileId}`)).status(),403);
  assert.equal((await testPool.query('SELECT octet_length(content)::int AS size FROM bpbd_files WHERE id=$1',[fileId])).rows[0].size,document.length);
});
test('Registration uses server identity and pending accounts cannot create operational data', async () => {
  const ctx=await context();
  const registration=await ctx.post('/api/bpbd/register',{multipart:{phone:'081234567890',name:'Peneliti Integrasi',email:'integration@contoh.test',institution:'Kampus Uji',password:'PenelitiUji123!',consent:'true',statement:{name:'surat.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')}}});
  assert.equal(registration.status(),201,await registration.text());
  const snapshot=await state(ctx);assert.equal(snapshot.store.users[0].status,'Menunggu Persetujuan');assert.equal(snapshot.store.entries.length,0);
  await save(ctx,snapshot,s=>{s.users[0].status='Aktif';},403);
  assert.equal(snapshot.store.users[0].note,'');
  assert.equal(snapshot.store.users[0].phone,'6281234567890');
  const registeredId=snapshot.userId;
  const beforeHash=(await testPool.query('SELECT password_hash FROM bpbd_users WHERE id=$1',[registeredId])).rows[0].password_hash;
  const admin=await login('adm@bpbd.example');
  await save(admin,await state(admin),s=>{s.users.find(u=>u.id===registeredId).status='Aktif';});
  assert.equal((await state(ctx)).store.users[0].status,'Aktif');
  assert.equal((await testPool.query('SELECT password_hash FROM bpbd_users WHERE id=$1',[registeredId])).rows[0].password_hash,beforeHash);
  await ctx.post('/api/bpbd/logout');assert.equal((await ctx.get('/api/bpbd/state')).status(),401);
});
test('Research CSV export checks owner, download permission and latest row validation on the server',async()=>{
  const researcher=await login('nadia@peneliti.example'),admin=await login('adm@bpbd.example');
  const exported=await researcher.get('/api/bpbd/research/RSET-001/csv');
  assert.equal(exported.status(),200,await exported.text());
  assert.match(exported.headers()['content-type'],/text\/csv/);
  assert.match(await exported.text(),/Kejadian Bencana/);
  assert.equal((await researcher.get('/api/bpbd/research/RSET-003/csv')).status(),403);
  assert.equal((await admin.get('/api/bpbd/research/RSET-001/csv')).status(),403);
  const original=(await testPool.query('SELECT data FROM bpbd_research WHERE id=$1',['RSET-001'])).rows[0].data;
  const rowId=original.decisions.ADM.validatedRows[0].id;
  const row=(await testPool.query('SELECT data FROM bpbd_entries WHERE id=$1',[rowId])).rows[0].data;
  try {
    await testPool.query('UPDATE bpbd_research SET data=$2 WHERE id=$1',['RSET-001',JSON.stringify({...original,download:false})]);
    assert.equal((await researcher.get('/api/bpbd/research/RSET-001/csv')).status(),403);
    await testPool.query('UPDATE bpbd_research SET data=$2 WHERE id=$1',['RSET-001',JSON.stringify({...original,access:'Dicabut'})]);
    assert.equal((await researcher.get('/api/bpbd/research/RSET-001/csv')).status(),403);
    await testPool.query('UPDATE bpbd_research SET data=$2 WHERE id=$1',['RSET-001',JSON.stringify(original)]);
    await testPool.query('UPDATE bpbd_entries SET data=$2 WHERE id=$1',[rowId,JSON.stringify({...row,version:row.version+1})]);
    assert.equal((await researcher.get('/api/bpbd/research/RSET-001/csv')).status(),409);
  }finally{
    await testPool.query('UPDATE bpbd_research SET data=$2 WHERE id=$1',['RSET-001',JSON.stringify(original)]);
    await testPool.query('UPDATE bpbd_entries SET data=$2 WHERE id=$1',[rowId,JSON.stringify(row)]);
  }
});

test('WhatsApp worker previews without sending and deduplicates accepted weekly dispatches in PostgreSQL', async () => {
  const { todayWib } = await import('../lib/bpbd/research-reminders.ts');
  const current = Date.parse(`${todayWib()}T00:00:00Z`);
  const deadline = new Date(current + 30 * 86400000).toISOString().slice(0,10);
  await testPool.query('UPDATE bpbd_users SET data=data || $1::jsonb WHERE id=$2',[JSON.stringify({phone:'6281234567890',whatsappConsent:true}),'PEN-001']);
  await testPool.query('UPDATE bpbd_research SET data=data || $1::jsonb WHERE id=$2',[JSON.stringify({deadline,versions:[]}),'RSET-001']);
  const workerEnv={...environment,WHATSAPP_ACCESS_TOKEN:'test-only-token',WHATSAPP_PHONE_NUMBER_ID:'12345',WHATSAPP_GRAPH_VERSION:'v1.0',WHATSAPP_TEMPLATE_NAME:'test_reminder',WHATSAPP_TEMPLATE_LANGUAGE:'id'};
  const run=(args=[])=>execFileSync(process.execPath,['--import','./tests/mock-whatsapp.mjs','scripts/research-reminders.ts',...args],{env:workerEnv,timeout:30000,encoding:'utf8',windowsHide:true});
  assert.match(run(),/PRATINJAU/);
  assert.equal((await testPool.query('SELECT count(*)::int AS count FROM bpbd_research_reminders')).rows[0].count,0);
  run(['--send']);
  const sent=(await testPool.query('SELECT count(*)::int AS count FROM bpbd_research_reminders')).rows[0].count;
  run(['--send']);
  assert.equal((await testPool.query('SELECT count(*)::int AS count FROM bpbd_research_reminders')).rows[0].count,sent);
  const rows=(await testPool.query('SELECT state,message_id FROM bpbd_research_reminders WHERE research_id=$1',['RSET-001'])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].state,'accepted');assert.equal(rows[0].message_id,'wamid.integration-test');
});

test('Global library shares result versions with active accounts but keeps supporting letters private',async()=>{
 const owner=await login('nadia@peneliti.example'),admin=await login('adm@bpbd.example');
 const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
 for(const id of ['RESULT-ARCHIVE-1','RESULT-ARCHIVE-2','PRIVATE-SUPPORT']){
  const uploaded=await owner.put(`/api/bpbd/files/${id}`,{headers:{'X-File-Name':id+'.pdf','Content-Type':'application/pdf'},data:bytes});assert.equal(uploaded.status(),201,await uploaded.text());
 }
 const before=await state(owner),request=before.store.research.find(r=>r.id==='RSET-001');
 // A missing upload cannot become a successful result or a Library entry.
 await save(owner,before,s=>{const r=s.research.find(r=>r.id===request.id);r.complete=true;r.versions.push({id:'INVALID',at:'',fileId:'FILE-MISSING',filename:'missing.pdf',summary:'Missing',feedback:'x',review:'Sudah',note:''});},403);
 for(const number of [1,2])await save(owner,await state(owner),s=>{const r=s.research.find(r=>r.id===request.id);r.complete=true;r.versions.push({id:`ARCHIVE-V${number}`,at:'',fileId:`RESULT-ARCHIVE-${number}`,filename:`hasil-${number}.pdf`,summary:`Ringkasan ${number}`,feedback:'PRIVATE FEEDBACK',review:'Sudah',note:''});});
 const readers=[];for(const email of ['adm@bpbd.example','pk@bpbd.example','kl@bpbd.example','rr@bpbd.example','sek@bpbd.example'])readers.push(await login(email));
 const anotherResearcher=await context();assert.equal((await anotherResearcher.post('/api/bpbd/login',{data:{email:'integration@contoh.test',password:'PenelitiUji123!'}})).status(),200);readers.push(anotherResearcher);
 for(const reader of readers){
  const list=await reader.get('/api/bpbd/library');assert.equal(list.status(),200);const archive=(await list.json()).find(r=>r.id===request.id);assert.deepEqual(archive.versions.map(v=>v.id),['ARCHIVE-V2','ARCHIVE-V1']);
  assert.ok(!JSON.stringify(archive).includes('PRIVATE'));assert.ok(!JSON.stringify(archive).includes('requestedGroups'));
  for(const version of ['ARCHIVE-V1','ARCHIVE-V2']){const file=await reader.get(`/api/bpbd/library/${request.id}/${version}/file`);assert.equal(file.status(),200);assert.deepEqual(await file.body(),bytes);}
  assert.equal((await reader.get(`/api/bpbd/library/${request.id}/PRIVATE-SUPPORT/file`)).status(),404);
 }
 assert.equal((await readers[1].get('/api/bpbd/files/PRIVATE-SUPPORT')).status(),403);
 assert.equal((await readers.at(-1).get(`/api/bpbd/research/${request.id}/csv`)).status(),403);
 assert.ok((await state(readers.at(-1))).store.research.every(r=>r.owner!==request.owner));
 const pending=await login('arif@peneliti.example');assert.equal((await pending.get('/api/bpbd/library')).status(),403);assert.equal((await pending.get(`/api/bpbd/library/${request.id}/ARCHIVE-V1/file`)).status(),403);
 const anon=await context();assert.equal((await anon.get(`/api/bpbd/library/${request.id}/ARCHIVE-V1/file`)).status(),401);
 const snapshot=await state(admin);await save(admin,snapshot,s=>{const r=s.research.find(r=>r.id===request.id);r.versions.at(-1).review='Perlu Perbaikan';r.versions.at(-1).note='Legacy review';},403);
});

test('Registration requires a private valid statement and stores account and letter together',async()=>{
 const anon=await context(),data={phone:'081234567890',name:'Peneliti Surat Demo',email:'surat@contoh.test',institution:'Institusi Demo',password:'SuratDemo123!',consent:true};
 const before=(await testPool.query('SELECT count(*)::int AS count FROM bpbd_users')).rows[0].count;
 const template=await anon.get('/api/bpbd/registration-statement');assert.equal(template.status(),200);const document=await template.body();
 assert.ok(document.subarray(0,2).equals(Buffer.from('PK')));assert.ok(document.toString().includes('PENYERAHAN HASIL PENELITIAN'));assert.ok(document.toString().includes('TEMPLATE DEMO'));
 assert.equal((await anon.post('/api/bpbd/register',{data})).status(),400);
 const multipart={...data,consent:'true'};
 assert.equal((await anon.post('/api/bpbd/register',{multipart:{...multipart,statement:{name:'surat.pdf',mimeType:'application/pdf',buffer:Buffer.from('file palsu')}}})).status(),400);
 const huge=Buffer.alloc(3*1024*1024+100000);Buffer.from('%PDF-').copy(huge);
 assert.equal((await anon.post('/api/bpbd/register',{multipart:{...multipart,statement:{name:'besar.pdf',mimeType:'application/pdf',buffer:huge}}})).status(),413);
 assert.equal((await testPool.query('SELECT count(*)::int AS count FROM bpbd_users')).rows[0].count,before);
 const registered=await anon.post('/api/bpbd/register',{multipart:{...multipart,statement:{name:'surat-dilengkapi.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:document}}});
 assert.equal(registered.status(),201,await registered.text());const snapshot=await registered.json(),id=snapshot.userId;
 assert.equal(snapshot.store.users[0].statement.filename,'surat-dilengkapi.docx');
 assert.deepEqual(await (await anon.get(`/api/bpbd/research-statement/${id}`)).body(),document);
 const admin=await login('adm@bpbd.example'),field=await login('sek@bpbd.example'),other=await login('nadia@peneliti.example');
 assert.equal((await admin.get(`/api/bpbd/research-statement/${id}`)).status(),200);
 for(const outsider of [field,other])assert.equal((await outsider.get(`/api/bpbd/research-statement/${id}`)).status(),403);
 const unsigned=await context();assert.equal((await unsigned.get(`/api/bpbd/research-statement/${id}`)).status(),401);
 await save(admin,await state(admin),s=>{s.users.find(u=>u.id===id).statement.filename='tampered.pdf';},403);
 await save(admin,await state(admin),s=>{const u=s.users.find(u=>u.id===id);u.status='Perlu Perbaikan';u.note='Lengkapi surat.';});
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
 const replaced=await anon.put('/api/bpbd/research-statement',{headers:{'X-File-Name':'surat-perbaikan.pdf'},data:pdf});assert.equal(replaced.status(),200,await replaced.text());
 assert.equal((await state(anon)).store.users[0].status,'Menunggu Persetujuan');
 assert.deepEqual(await (await anon.get(`/api/bpbd/research-statement/${id}`)).body(),pdf);
 const library=await (await admin.get('/api/bpbd/library')).json();assert.ok(!JSON.stringify(library).includes('surat-perbaikan.pdf'));
});

test('Disabling the demo feature permits registration without a letter',async()=>{
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...environment,BPBD_RESEARCH_STATEMENT_ENABLED:'false'},stdio:'ignore',windowsHide:true});
 const ctx=await playwrightRequest.newContext({baseURL:`http://127.0.0.1:${port}`,extraHTTPHeaders:{'X-BPBD-Request':'1'}});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await ctx.get('/api/bpbd/registration-options')).status()===200){ready=true;break;}}catch{}if(child.exitCode!==null)break;await delay(250);}
  assert.ok(ready);assert.equal((await (await ctx.get('/api/bpbd/registration-options')).json()).statementEnabled,false);
  assert.equal((await ctx.get('/api/bpbd/registration-statement')).status(),404);
  const registered=await ctx.post('/api/bpbd/register',{data:{phone:'081234567890',name:'Demo Tanpa Surat',email:'tanpasurat@contoh.test',institution:'Demo',password:'TanpaSurat123!',consent:true}});
  assert.equal(registered.status(),201,await registered.text());assert.equal((await registered.json()).store.users[0].statement,undefined);
 }finally{await ctx.dispose();child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);}
});

test('Browser workflows use PostgreSQL, including login, forms, import, reports and research', { timeout: 360000 }, async () => {
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{env:{...environment,PLAYWRIGHT_BASE_URL:baseURL},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let log='';
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;process.stdout.write(chunk);});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Browser tests failed (${code}). ${log.slice(-12000)}`)));
  });
});
