# Revisi penelitian — 17 November 2026

Acuan: **Perbaikan bagian penelitian.docx**, poin 2–4, dengan penjelasan pengguna: status hasil otomatis **Sudah** setelah unggahan berhasil; Library dapat dibaca dan diunduh oleh semua akun aktif yang login. Poin 1 (surat pernyataan saat pendaftaran) belum termasuk pengerjaan ini.

## Persetujuan sekali oleh Admin

Admin menetapkan satu keputusan untuk semua dataset dalam cakupan satu permohonan. Persetujuan sekaligus mengaktifkan akses dan unduhan; penolakan menghentikan akses. Checkbox hak unduh, menu Izin Data Peneliti, dan langkah aktivasi terpisah dihapus. Tautan lama `/admin/akses-riset` membuka daftar permohonan. API menolak manipulasi akses terpisah dari keputusan.

Persetujuan akun tetap terpisah dari keputusan permohonan data. Cakupan dataset, wilayah, periode, masa berlaku, kepemilikan permohonan, serta validasi versi data tetap diperiksa saat mengunduh. Pembaruan sumber yang membuat validasi tidak sesuai tetap perlu keputusan Admin diperbarui melalui permohonan.

## Hasil dan arsip penelitian

Halaman Hasil Penelitian milik peneliti maupun petugas menampilkan daftar, status **Sudah/Belum**, dan jumlah arsip dokumen. Status mengikuti keberadaan hasil yang berhasil disimpan. Review bertingkat dan pemeriksaan kelengkapan terpisah dihentikan di UI maupun backend.

Pengiriman baru tetap membutuhkan dokumen, ringkasan, dan feedback. Dokumen disimpan di PostgreSQL; status dan Library baru berubah setelah unggahan dihubungkan ke permohonan secara sah. Unggahan yang gagal atau berkas tanpa pengiriman hasil tidak masuk Library. Revisi menambah versi baru; ID, dokumen, riwayat dan catatan lama dipertahankan. Tenggat dan perpanjangan tetap dikelola Admin.

## Library Penelitian

Menu `/library-penelitian` tersedia bagi Admin, PK, KL, RR, Sekretariat, dan peneliti dengan akun aktif. Memuat judul, peneliti, institusi, ringkasan, tanggal unggah, serta seluruh versi dokumen hasil yang tersedia. Tersedia pencarian, filter tahun, dan unduh per versi. Akun menunggu persetujuan, nonaktif, serta pengunjung tanpa login tidak memiliki akses.

Library memakai endpoint khusus `/api/bpbd/library` dan `/api/bpbd/library/<researchId>/<versionId>/file`. Surat pendukung, isi permohonan, kontak, feedback internal, dan dataset mentah tidak disertakan. Akses terhadap permohonan dan endpoint berkas lama tetap mengikuti pembatasan sebelumnya.

Arsip historis yang sudah menjadi versi hasil di database langsung tampil tanpa menunggu status review lama. Berkas yang hanya berada di laptop atau arsip permintaan data K1 belum otomatis menjadi hasil penelitian: perlu dimasukkan melalui pengiriman hasil yang sesuai. Pemeriksaan database lokal saat pengerjaan menemukan tiga permohonan dengan nol versi hasil; Library awal karena itu kosong.

## Kompatibilitas data

Tidak ada tabel baru atau penghapusan data. Script berikut mengevaluasi persetujuan lama yang masih tertahan pada aktivasi terpisah:

```powershell
node --env-file-if-exists=.env.local scripts/migrate-research-access.ts
node --env-file-if-exists=.env.local scripts/migrate-research-access.ts --apply
```

Perintah pertama hanya dry-run. Perintah `--apply` membuat dump sebelum menulis jika ada perubahan. Script hanya menyesuaikan persetujuan Admin yang lengkap dan masih tervalidasi; izin dicabut/berakhir serta keputusan yang perlu diperbarui tetap dipertahankan. ID, cakupan, versi, dan masa berlaku tidak diubah. Dry-run database pengguna menghasilkan nol perubahan, sehingga tidak ada data pengguna yang perlu dimigrasikan saat revisi ini.

Catatan ini menggantikan uraian aktivasi terpisah, status review bertingkat, dan batas akses arsip dalam dokumentasi penelitian terdahulu. Perilaku operasional Kelompok 1/3 tetap mengikuti implementasi sebelumnya.

## Hasil pemeriksaan

Build berhasil; 32 tes unit serta 8 tes PostgreSQL (termasuk 13 skenario browser) lulus. Pengujian mencakup persetujuan langsung diikuti unduhan, status otomatis, riwayat dua versi hasil, akses Library semua role aktif, penolakan akun menunggu/anonim, perlindungan surat pendukung dan permohonan pribadi, serta tampilan ponsel. Pengujian memakai database sementara; database pengguna tidak diisi data tes.
