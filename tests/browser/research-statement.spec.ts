import {test,expect} from './fixtures';

test('Researcher downloads the demo template, registers with a letter, and Admin reviews it',async({page})=>{
 await page.goto('/daftar-peneliti');
 const section=page.getByRole('region',{name:'Surat Pernyataan',exact:true});await expect(section).toBeVisible();
 const top=await section.boundingBox(),phone=await page.locator('#register-phone').boundingBox();expect(top!.y).toBeLessThan(phone!.y);
 const ready=page.waitForEvent('download');await page.getByRole('link',{name:'Unduh template Surat Pernyataan (.docx)',exact:true}).click();expect((await ready).suggestedFilename()).toBe('Surat-Pernyataan-Peneliti-DEMO.docx');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#register-statement').setInputFiles({name:'surat-yang-sudah-dilengkapi.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')});
 await page.locator('#register-phone').fill('081234567890');await page.locator('#register-name').fill('Peneliti Surat Browser');await page.locator('#register-institution').fill('Universitas Demo');await page.locator('#auth-email').fill('surat-browser@contoh.test');await page.locator('#auth-password').fill('SuratBrowser123!');await page.getByRole('checkbox').check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('statement-registration-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Kirim Pendaftaran',exact:true}).click();await expect(page.getByRole('heading',{name:'Status Akun Peneliti',exact:true})).toBeVisible();
 const ownDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh Surat Pernyataan',exact:true}).click();expect((await ownDownload).suggestedFilename()).toBe('surat-yang-sudah-dilengkapi.pdf');
 await page.goto('/profil');await expect(page.getByRole('region',{name:'Dokumen Surat Pernyataan',exact:true})).toContainText('surat-yang-sudah-dilengkapi.pdf');
 const headers={'X-BPBD-Request':'1'};await page.request.post('/api/bpbd/logout',{headers});await page.request.post('/api/bpbd/login',{headers,data:{email:'adm@bpbd.example',password:'BPBDdemo2026!'}});
 await page.setViewportSize({width:1440,height:1050});await page.goto('/admin/pendaftaran');await page.getByRole('row').filter({hasText:'Peneliti Surat Browser'}).getByRole('button',{name:'Tinjau',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('surat-yang-sudah-dilengkapi.pdf');
 const adminDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh Surat Pernyataan',exact:true}).click();await adminDownload;
 await page.screenshot({path:test.info().outputPath('statement-admin-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Setujui Akun',exact:true}).click();await expect(page.getByText('Keputusan akun tersimpan.',{exact:true})).toBeVisible();
});
