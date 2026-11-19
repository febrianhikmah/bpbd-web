import type { PoolClient } from 'pg';
import type { ResearchDataset, ResearchDatasetSummary } from '../bpbd/research-datasets.ts';

export async function installResearchDatasets(client: PoolClient, datasets: ResearchDataset[]) {
  await client.query('CREATE TABLE IF NOT EXISTS bpbd_research_datasets (id text PRIMARY KEY, data jsonb NOT NULL)');
  let inserted = 0;
  for (const dataset of datasets) {
    const result = await client.query('INSERT INTO bpbd_research_datasets (id,data) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id', [dataset.id, JSON.stringify(dataset)]);
    inserted += result.rowCount || 0;
  }
  return { inserted, retained: datasets.length - inserted };
}

export async function readResearchDatasets(client: PoolClient): Promise<ResearchDatasetSummary[]> {
  const result = await client.query("SELECT data - 'rows' AS data FROM bpbd_research_datasets WHERE data->>'field' IN ('PK','KL','RR') AND data->>'year' IS NOT NULL ORDER BY id");
  return result.rows.map(row => row.data as ResearchDatasetSummary);
}

export async function readResearchDataset(client: PoolClient, id: string): Promise<ResearchDataset | undefined> {
  const result = await client.query("SELECT data FROM bpbd_research_datasets WHERE id=$1 AND data->>'field' IN ('PK','KL','RR') AND data->>'year' IS NOT NULL", [id]);
  return result.rows[0]?.data as ResearchDataset | undefined;
}
