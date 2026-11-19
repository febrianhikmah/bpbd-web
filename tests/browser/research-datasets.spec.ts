import { test, expect } from './fixtures';
import type { ResearchDatasetSummary } from '../../lib/bpbd/research-datasets';

test('all annual research datasets open tables while shared references stay internal',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/masuk');
  await page.locator('#auth-email').fill('nadia@peneliti.example');
  await page.locator('#auth-password').fill('BPBDdemo2026!');
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Beranda Peneliti',exact:true})).toBeVisible();
  const response=await page.request.get('/api/bpbd/research-datasets');
  expect(response.status()).toBe(200);
  const datasets=await response.json() as ResearchDatasetSummary[];
  expect(datasets).toHaveLength(28);
  expect(datasets.every(dataset=>dataset.field!==null)).toBe(true);
  const fields=[{code:'PK',slug:'pencegahan'},{code:'KL',slug:'kedaruratan'},{code:'RR',slug:'rehabilitasi'}];
  const visited=new Set<string>();
  for(const field of fields){
    for(const year of [2025,2026]){
      await page.goto(`/peneliti/show-data/${field.slug}?tahun=${year}`);
      await expect(page.getByRole('combobox',{name:'Tahun',exact:true})).toHaveText(String(year));
      for(const dataset of datasets.filter(item=>item.field===field.code&&item.year===year)){
        const title=`${dataset.title} — ${year}`;
        await page.getByRole('link',{name:title,exact:true}).click();
        await expect(page).toHaveURL(url=>url.pathname.endsWith('/'+dataset.id)&&url.searchParams.get('tahun')===String(year));
        await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
        const table=page.getByRole('table',{name:`Isi ${title}`,exact:true});
        await expect(table.getByRole('columnheader')).toHaveCount(dataset.columns.length+1);
        await expect(table.locator('tbody tr')).toHaveCount(15);
        const dataColumn=await table.getByRole('columnheader').nth(1).boundingBox();
        expect(dataColumn?.width).toBeGreaterThanOrEqual(180);
        await expect(table.locator('tbody tr').first().locator('td').nth(1)).toContainText(String(year));
        if(dataset.id==='1_2_IRBI_2025'){
          await page.getByRole('combobox',{name:'Jumlah baris per halaman',exact:true}).click();
          await page.getByRole('option',{name:'10',exact:true}).click();
          await expect(table.locator('tbody tr')).toHaveCount(10);
          await page.getByRole('button',{name:'Halaman berikutnya',exact:true}).click();
          await expect(table.locator('tbody tr')).toHaveCount(5);
          await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('11');
          await page.reload();
          await expect(table.locator('tbody tr')).toHaveCount(5);
          await page.screenshot({path:test.info().outputPath('research-dataset-desktop.png'),fullPage:true});
        }
        visited.add(dataset.id);
        await page.getByRole('button',{name:'Kembali ke daftar tabel',exact:true}).click();
        await expect(page.getByRole('combobox',{name:'Tahun',exact:true})).toHaveText(String(year));
      }
    }
  }
  expect(visited.size).toBe(28);
  for(const id of ['REF_1_Wilayah','REF_2_Jenis_Bencana']){
    await page.goto(`/peneliti/show-data/pencegahan/${id}`);
    await expect(page.getByRole('heading',{name:'Halaman tidak ditemukan',exact:true})).toBeVisible();
  }
  await page.goto('/peneliti/show-data/pencegahan/1_2_IRBI_2026?tahun=2026');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(15);
  await page.setViewportSize({width:390,height:844});
  const sizeValue=page.getByRole('combobox',{name:'Jumlah baris per halaman',exact:true}).locator('[data-slot="select-value"]');
  await expect(sizeValue).toHaveText('20');
  const sizeValueBox=await sizeValue.boundingBox();
  expect(sizeValueBox?.width).toBeGreaterThanOrEqual(14);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const scrolling=page.getByRole('region',{name:'Isi tabel dataset',exact:true});
  expect(await scrolling.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('research-dataset-mobile.png'),fullPage:true});
  await page.goto('/peneliti/show-data/pencegahan/2_1_Kejadian_Bencana_2025');
  await expect(page.getByRole('heading',{name:'Halaman tidak ditemukan',exact:true})).toBeVisible();
  await page.goto('/peneliti/show-data/pencegahan/dataset-tidak-ada');
  await expect(page.getByRole('heading',{name:'Halaman tidak ditemukan',exact:true})).toBeVisible();
});
