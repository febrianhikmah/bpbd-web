import {test,expect} from './fixtures';
test('Result upload immediately appears in personal archives and the global library, including old versions',async({page})=>{
 const headers={'X-BPBD-Request':'1'};
 async function login(email:string){await page.request.post('/api/bpbd/logout',{headers});expect((await page.request.post('/api/bpbd/login',{headers,data:{email,password:'BPBDdemo2026!'}})).status()).toBe(200);}
 await login('nadia@peneliti.example');await page.goto('/peneliti/hasil');
 await expect(page.getByRole('columnheader',{name:'Status hasil',exact:true})).toBeVisible();
 const original=page.getByRole('row').filter({hasText:'Kajian kerentanan banjir di Kecamatan Genuk'});await expect(original).toContainText('Belum');
 for(const version of [1,2]){
  await page.goto('/peneliti/hasil/kirim/RSET-001');
  await page.getByLabel('Dokumen hasil penelitian',{exact:true}).setInputFiles({name:`hasil-${version}.pdf`,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')});
  await page.locator('#result-summary').fill(`Ringkasan hasil versi ${version}`);await page.locator('#result-feedback').fill('Feedback internal BPBD');
  await page.getByRole('button',{name:'Tinjau Hasil',exact:true}).click();await page.getByRole('button',{name:'Kirim Hasil Penelitian',exact:true}).click();
  await expect(page.locator('.badge').filter({hasText:/^Sudah$/})).toBeVisible();
 }
 await page.goto('/peneliti/hasil');await expect(original).toContainText('2 dokumen');await expect(original).toContainText('Sudah');
 await login('adm@bpbd.example');await page.goto('/riset/hasil/RSET-001');
 await expect(page.locator('.badge').filter({hasText:/^Sudah$/})).toBeVisible();await expect(page.getByRole('combobox',{name:'Status review',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Tandai Kelengkapan Diperiksa',exact:true})).toHaveCount(0);
 await login('pk@bpbd.example');await page.goto('/library-penelitian');await page.getByRole('button',{name:'Buka arsip',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Ringkasan hasil versi 1');await expect(page.getByRole('dialog')).not.toContainText('Feedback internal BPBD');
 await page.screenshot({path:test.info().outputPath('library-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh versi 1',exact:true}).click();expect((await ready).suggestedFilename()).toBe('hasil-1.pdf');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath('library-mobile.png'),fullPage:true});
 await login('arif@peneliti.example');expect((await page.request.get('/api/bpbd/library')).status()).toBe(403);
 await page.request.post('/api/bpbd/logout',{headers});expect((await page.request.get('/api/bpbd/library')).status()).toBe(401);
});
