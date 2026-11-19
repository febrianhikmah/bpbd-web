import { readFile } from 'node:fs/promises';
import { getPool } from '../db/index.ts';
import { installResearchDatasets } from '../lib/server/research-datasets.ts';
import type { ResearchDataset } from '../lib/bpbd/research-datasets.ts';

const client = await getPool().connect();
async function existingDataSignatures() {
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'bpbd_%' AND tablename<>'bpbd_research_datasets' ORDER BY tablename");
  const signatures: Record<string, string> = {};
  for (const { tablename } of tables.rows) {
    if (!/^bpbd_[a-z_]+$/.test(tablename)) throw new Error('Nama tabel tidak valid.');
    const result = await client.query(`SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text), ',' ORDER BY md5(row_to_json(t)::text)), '')) AS signature FROM "${tablename}" t`);
    signatures[tablename] = result.rows[0].signature;
  }
  return JSON.stringify(signatures);
}

try {
  const source = JSON.parse(await readFile(new URL('../data/research/datasets.json', import.meta.url), 'utf8')) as { datasets: ResearchDataset[] };
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  const before = await existingDataSignatures();
  await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-research-catalog-import'))");
  const result = await installResearchDatasets(client, source.datasets);
  if (before !== await existingDataSignatures()) throw new Error('Data di luar katalog berubah; impor dibatalkan.');
  await client.query('COMMIT');
  console.log(JSON.stringify({ ...result, existingDataUnchanged: true, datasets: source.datasets.length, rows: source.datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0) }));
} catch (error) { await client.query('ROLLBACK'); console.error((error as Error).message); process.exitCode = 1; }
finally { client.release(); await getPool().end(); }
