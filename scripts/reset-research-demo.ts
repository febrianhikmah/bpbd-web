import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getPool } from '../db/index.ts';
import { readStore, writeStore } from '../lib/server/repository.ts';
import { createAnnualResearchDemo } from '../lib/server/research-catalog-demo.ts';
import { todayWib } from '../lib/bpbd/research-reminders.ts';

if (process.env.DATABASE_URL) throw new Error('Reset ini hanya untuk PostgreSQL lokal.');
const apply = process.argv.includes('--apply'), pool = getPool(), client = await pool.connect();
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function protectedTables() {
  const tables = ['bpbd_users','bpbd_entries','bpbd_reports','bpbd_imports','bpbd_op_records','bpbd_op_links','bpbd_op_files','bpbd_op_imports','bpbd_source_files','bpbd_source_map','bpbd_source_links','bpbd_source_records','bpbd_research_datasets'];
  const values: Record<string,string> = {};
  for (const table of tables) values[table] = hash((await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows);
  return values;
}
try {
  await client.query('BEGIN');
  const db = (await client.query('SELECT current_database() AS name,host(inet_server_addr()) AS address')).rows[0];
  if (!['127.0.0.1','::1',null].includes(db.address)) throw new Error('Target bukan PostgreSQL lokal.');
  const {store,revision} = await readStore(client,true);
  if (apply && store.research.some(request => !request.title.startsWith('[DUMMY]'))) throw new Error('Ada permohonan yang tidak ditandai DUMMY; penggantian dibatalkan agar data tersebut tetap aman.');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-operasional'))");
  const originalIds = store.research.map(r => r.id), protectedIds = new Set(store.entries.flatMap(e => e.fileId ? [e.fileId] : []));
  for (const user of store.users) if (user.statement) protectedIds.add(user.statement.fileId);
  for (const report of store.reports) for (const entry of report.rows) if (entry.fileId) protectedIds.add(entry.fileId);
  const researcherIds = store.users.filter(u => u.role === 'PEN').map(u => u.id);
  const references = store.research.flatMap(r => [r.supportingId,...r.versions.map(v => v.fileId)]).filter((id): id is string => !!id);
  const candidates = (await client.query('SELECT id FROM bpbd_files WHERE owner_id=ANY($1::text[]) OR id=ANY($2::text[])',[researcherIds,references])).rows.map(r => r.id as string);
  const removeFiles = candidates.filter(id => !protectedIds.has(id));
  const {next,files,scenarios,ownerId,ownerName} = await createAnnualResearchDemo(client,store,todayWib());
  const report = {applied:apply,database:db.name,previousRevision:revision,removedResearch:originalIds.length,removedFiles:removeFiles.length,ownerId,ownerName,newResearch:next.research.length,newFiles:files.length,scenarios};
  if (!apply) { await client.query('ROLLBACK'); console.log(JSON.stringify(report)); }
  else {
    const directory = join('backups','reset-penelitian-'+new Date().toISOString().replace(/[:.]/g,'-')); await mkdir(directory,{recursive:true});
    const backup = spawnSync(join(process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin','pg_dump.exe'),['--format=custom','--no-owner','--file',join(directory,'before.dump')],{env:{...process.env,PGDATABASE:db.name},windowsHide:true,timeout:60000});
    if (backup.status !== 0) throw new Error('Cadangan database gagal; reset dibatalkan.');
    await writeFile(join(directory,'before-research.json'),JSON.stringify(store.research));
    const before = await protectedTables();
    // Only research requests, their reminders, and unprotected research documents are replaced.
    await client.query('DELETE FROM bpbd_research_reminders WHERE research_id=ANY($1::text[])',[originalIds]);
    await client.query('DELETE FROM bpbd_research WHERE id=ANY($1::text[])',[originalIds]);
    await client.query('DELETE FROM bpbd_files WHERE id=ANY($1::text[])',[removeFiles]);
    for (const file of files) await client.query('INSERT INTO bpbd_files(id,owner_id,name,mime,content) VALUES($1,$2,$3,$4,$5)',[file.id,file.owner,file.name,'application/pdf',file.content]);
    await writeStore(client,{...store,research:[]},next);
    const saved = await readStore(client), actual = saved.store.research;
    if (hash(before) !== hash(await protectedTables())) throw new Error('Data akun atau operasional berubah; reset dibatalkan.');
    if (hash(actual.map(r=>r.id).sort()) !== hash(next.research.map(r=>r.id).sort())) throw new Error('Daftar penelitian tidak sesuai; reset dibatalkan.');
    next.audit.unshift({id:'AUD-RESET-PENELITIAN-'+Date.now(),at:new Date().toISOString(),actor:'Sistem',role:'ADM',action:'Data penelitian diganti dengan dummy sesuai aturan terbaru',object:'penelitian'});
    // Audit is appended separately so the module revision advances only once.
    await client.query('INSERT INTO bpbd_audit(id,data) VALUES($1,$2)',[next.audit[0].id,JSON.stringify(next.audit[0])]);
    await writeFile(join(directory,'report.json'),JSON.stringify({...report,protectedDataUnchanged:true,backup:directory},null,2));
    await client.query('COMMIT');console.log(JSON.stringify({...report,protectedDataUnchanged:true,backup:directory}));
  }
} catch (e) { await client.query('ROLLBACK'); throw e; }
finally {client.release();await pool.end();}
