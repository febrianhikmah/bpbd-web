import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getPool } from '../db/index.ts';
import { readStore, writeStore } from '../lib/server/repository.ts';
import { upgradeResearchAccess } from '../lib/bpbd/research-access-migration.ts';

const apply = process.argv.includes('--apply'), pool = getPool(), client = await pool.connect();
try {
  await client.query('BEGIN');
  const { store } = await readStore(client, true);
  const { next, changed, skipped } = upgradeResearchAccess(store);
  const report = { apply, changed, skipped, research: store.research.length, resultVersions: store.research.reduce((n,r)=>n+r.versions.length,0) };
  if (apply && changed.length) {
    if (process.env.DATABASE_URL) throw new Error('Script ini ditujukan untuk PostgreSQL lokal.');
    const directory = join('backups','revisi-penelitian-'+new Date().toISOString().replace(/[:.]/g,'-'));
    await mkdir(directory,{recursive:true});
    const backup = spawnSync(join(process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin','pg_dump.exe'),['--format=custom','--no-owner','--file',join(directory,'before.dump')],{env:process.env,windowsHide:true});
    if (backup.status !== 0) throw new Error('Cadangan gagal; perubahan dibatalkan.');
    await writeFile(join(directory,'before-research.json'),JSON.stringify(store.research));
    await writeStore(client,store,next);
    await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));
  }
  await client.query(apply?'COMMIT':'ROLLBACK');
  console.log(JSON.stringify(report));
} catch (e) { await client.query('ROLLBACK'); throw e; }
finally { client.release(); await pool.end(); }
