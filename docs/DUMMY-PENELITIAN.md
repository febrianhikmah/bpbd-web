# Dummy aktivitas peneliti — 19 November 2026

Enam permohonan dummy lama diganti dengan enam permohonan yang memakai katalog dataset tahunan terbaru. Semua pengajuan dimiliki akun aktif Nadia Pramesti (Demo), `PEN-001`. Sandi, status akun, dan surat pernyataan pendaftaran tetap dipertahankan.

Setiap pilihan merujuk satu dataset untuk satu tahun. Seluruh skenario memakai tabel 2025 dan 2026 secara terpisah, mencakup ketiga bidang dan seluruh 28 dataset tahunan. Referensi wilayah dan jenis bencana tetap digunakan di belakang layar.

## Skenario demo

| ID | Permohonan | Dataset tahunan | Keputusan | Hasil | PDF |
| --- | --- | ---: | --- | --- | ---: |
| RSET-DUMMY-001 | Pemetaan risiko dan kesiapsiagaan masyarakat 2025–2026 | 4 | Diajukan | Belum | 0 |
| RSET-DUMMY-002 | Perbandingan kejadian dan dampak bencana 2025–2026 | 4 | Disetujui | Belum | 0 |
| RSET-DUMMY-003 | Permohonan data bantuan rumah di luar tujuan penelitian | 2 | Ditolak | Belum | 0 |
| RSET-DUMMY-004 | Evaluasi logistik, posko, dan tanggap darurat 2025–2026 | 6 | Disetujui | Sudah | 1 |
| RSET-DUMMY-005 | Kajian rehabilitasi dan pemulihan pascabencana 2025–2026 | 8 | Disetujui | Sudah | 2 |
| RSET-DUMMY-006 | Kesiapan EWS dan dokumen kontinjensi lintas bidang 2025–2026 | 6 | Diajukan | Belum | 0 |

Semua judul diberi awalan `[DUMMY]`. Beberapa dataset dipakai oleh lebih dari satu penelitian; sumber dataset tidak diduplikasi. Setiap tabel tahunan berisi 15 baris.

001 dan 006 dapat dipakai untuk demo pemeriksaan Admin. 002 sudah memiliki izin akses dan unduh, tetapi belum mengirim hasil sehingga bisa dipakai mencoba unggah. 003 menunjukkan penolakan karena data yang diminta tidak sesuai tujuan. 004 dan 005 menyediakan contoh Library serta dua versi hasil pada penelitian yang sama.

Persetujuan hanya oleh Admin dan berlaku untuk seluruh dataset dalam permohonan. Permohonan diajukan/ditolak tidak memperoleh akses unduh. Saat diakses, ID dan versi sumber diperiksa melalui backend yang sama dengan aplikasi. Tenggat dibuat 60 hari dan masa akses 90 hari dari tanggal reset agar contoh masih dapat dipakai saat demo.

Hasil otomatis berstatus **Sudah** setelah pengunggahan yang sah. Library memuat dua penelitian dan tiga versi PDF yang bisa dilihat serta diunduh semua akun aktif yang login. Seluruh PDF sintetis berlabel DUMMY, bukan laporan resmi.

## Cadangan dan data yang dipertahankan

Reset lokal berhasil pada database `bpbd_local_integrasi`. Cadangan lengkap PostgreSQL ada di `backups/reset-penelitian-2026-11-18T21-23-13-596Z/before.dump`, disertai `before-research.json` dan `report.json`. Folder cadangan diabaikan Git. Nama folder memakai waktu UTC; tanggal lokal reset adalah 19 November 2026.

Pemeriksaan hash sebelum dan setelah transaksi memastikan akun, data operasional/logistik, seluruh arsip sumber Kelompok 1/3, dan 30 dataset penelitian berisi total 602 baris tidak berubah. Berkas surat pendaftaran dan lampiran yang dirujuk data operasional/laporan dilindungi dari penghapusan. Audit lama dipertahankan dan ditambah riwayat reset. Enam permohonan lama beserta lima dokumen penelitiannya diganti dengan enam permohonan dan tiga PDF baru.

Instalasi lain yang menunjuk database lokal yang sama juga akan membaca permohonan baru ini. Reset tidak mengirim pesan WhatsApp.

## Mengulang penggantian

```powershell
npm run research:reset-demo
npm run research:reset-demo -- --apply
```

Perintah pertama hanya menampilkan rencana tanpa menyimpan perubahan. `--apply` membuat cadangan lalu mengganti aktivitas penelitian saat itu, termasuk hasil/revisi yang dibuat setelah demo. Script menolak perubahan jika ada permohonan tanpa awalan `[DUMMY]`, membatasi target pada PostgreSQL lokal, dan membatalkan transaksi bila data yang dilindungi berubah. Jangan jalankan ulang apabila ingin mempertahankan aktivitas demo yang sudah dicoba.

Generator menggunakan layanan pengajuan, keputusan Admin, dan pengiriman hasil yang sama dengan aplikasi. Uji PostgreSQL terpisah memeriksa keenam skenario, cakupan seluruh dataset tahunan, izin akses, PDF/Library, serta kemampuan unggah hasil pada permohonan yang disetujui.
