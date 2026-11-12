# Revisi Dashboard Logistik — 11 November 2026

Pengerjaan langsung di `bpbd-webv2`. Keputusan pemisahan menu sebelumnya digantikan: seluruh fungsi logistik kini berada pada **Dashboard Logistik**. URL lama `/logistik` membuka dashboard yang sama, tanpa menu kedua.

## Tampilan dan alur Kelompok 1

CSS diambil dari `Kelompok1/src/main/java/id/bpbd/BpbdApplication.java`. Susunan header biru-oranye, empat kartu ringkasan, tiga grafik, tabel persediaan, log enam transaksi terakhir, pilihan Barang Masuk/Keluar, serta formulir beberapa barang mengikuti sumber tersebut. Antarmuka berada di `integration/kelompok1` dan dilayani melalui sesi login K2; runtime cukup Next.js dan PostgreSQL.

Alur: Dashboard → Transaksi Logistik → Barang Masuk atau Barang Keluar → pilih satu atau beberapa barang → Simpan Transaksi → Dashboard dengan saldo terbaru. Sumber bantuan wajib untuk masuk; kecamatan dan tujuan penggunaan wajib untuk keluar. Form mempertahankan isian saat validasi gagal. Pada ponsel sempit, pilihan nama barang memenuhi satu baris agar tetap terbaca.

Penyesuaian untuk sistem gabungan: tombol input tersedia hanya untuk KL. PK, RR, dan SEK dapat membaca seluruh rincian logistik. Sesuai revisi lanjutan, setiap kartu Ikhtisar Logistik menampilkan satu angka total tanpa rincian satuan: jumlah jenis barang, total stok, total barang masuk, dan total barang keluar. Filter satuan grafik dihapus sesuai revisi lanjutan. Grafik stok menampilkan seluruh jenis barang, tanpa batas enam barang, dan tinggi grafik mengikuti jumlah barang. Grafik tren menjumlahkan barang masuk/keluar dari seluruh satuan; rincian satuan tetap terlihat pada tabel persediaan dan tooltip stok. Tambahan Lihat semua transaksi dan rincian catatan menjaga akses lengkap ke data yang sebelumnya berada pada menu Logistik & Data.

## Satu ledger persediaan

Master barang, masuk, keluar, dan stok tetap menggunakan `bpbd_op_records` yang juga dibaca modul Operasional Bidang. Dashboard, tabel, pilihan barang, grafik, dan rincian transaksi dihitung dari satu snapshot database. Master dengan nama/kategori/satuan sama digabung dalam tampilan mengikuti aturan K1, sementara ID dan relasi asal tetap tersimpan.

Seluruh barang dalam satu formulir disimpan dalam satu transaksi PostgreSQL. Bila satu barang tidak cukup, tidak ada baris yang disimpan. Pengiriman ulang dengan identitas transaksi yang sama tidak menggandakan data. Advisory lock mencegah dua permintaan menghabiskan stok yang sama.

Form K1 tidak memiliki pilihan sumber anggaran. Penerimaan baru menggunakan bucket `Saldo gabungan K1` dengan donor tetap pada `sumber_barang`. Pengeluaran mengambil saldo dari bucket tersedia secara deterministik menurut ID barang dan sumber; rincian sumber tetap tersimpan. Bila transaksi harus dibagi ke beberapa bucket, dashboard menampilkannya sebagai satu baris barang pada transaksi tersebut. Ini merupakan alokasi stok teknis, bukan penetapan aturan prioritas sumber anggaran BPBD.

## Data sumber yang disalin

Snapshot terbaru dari sumber yang digunakan proyek lokal K1: 3 master barang dan 22 transaksi. Database gabungan sudah mempunyai 19 transaksi; migrasi menambahkan ID 20, 21, dan 22 tanpa mengulang data lama. Saldo hasil rekonsiliasi:

| Barang | Saldo |
| --- | ---: |
| Selimut | 229 pcs |
| Air mineral | 37 dus |
| Makanan siap saji | 56 paket |

Data akun, penelitian, dataset penelitian, dan catatan operasional K3 dipertahankan. Data K1 diambil satu kali ke PostgreSQL lokal, tidak tersinkron otomatis dua arah dengan Supabase.

Snapshot privat ada di `backups/revisi-k1-20261111/source.json`. Dump sebelum migrasi, arsip sumber sebelumnya, dan laporan perubahan berada dalam folder `backups/revisi-k1-<timestamp>/`. Folder backups diabaikan Git. Database lokal saat revisi: `bpbd_local_integrasi` (juga digunakan instalasi lama yang menunjuk nama database tersebut).

## Mengambil pembaruan sumber berikutnya

```powershell
node scripts/export-k1-logistics.mjs "C:\path\Github\Kelompok1"
node --env-file-if-exists=.env.local scripts/sync-k1-logistics.ts "backups\k1-export-<timestamp>\source.json"
node --env-file-if-exists=.env.local scripts/sync-k1-logistics.ts "backups\k1-export-<timestamp>\source.json" --apply
```

Perintah kedua hanya dry-run. `--apply` membuat dump sebelum menulis. Script menolak perubahan yang menimpa catatan yang sudah direvisi lokal, penghapusan dari sumber, stok negatif, dan saldo awal yang belum dipetakan. Pengulangan snapshot yang sama tidak membuat duplikat. Simpan hasil dry-run dan backup sebelum mengganti sumber.

## Pemeriksaan

`npm.cmd run test:integration` mencakup hubungan dashboard dengan ledger K3, beberapa barang sekaligus, pembatalan batch, stok lintas sumber, pengiriman ulang, transaksi bersamaan, dan pembatasan bidang. `npm.cmd run test:postgres` menguji alur browser K1 pada desktop/ponsel beserta regresi login dan penelitian melalui database sementara terpisah.

Hasil pemeriksaan revisi: build berhasil; 29 tes unit, 5 tes integrasi operasional, 7 tes PostgreSQL (termasuk 13 skenario browser) lulus. Lint tanpa error, dengan 29 peringatan yang sudah ada di berkas lain. Pemeriksaan akun KL/PK/RR/SEK pada database lokal memberikan saldo dan 22 transaksi yang sama; hanya KL bisa input. Snapshot yang sama diuji ulang dan menghasilkan nol perubahan.
