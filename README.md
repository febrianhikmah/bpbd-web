# SIAGA — Sistem Data Kebencanaan BPBD Kota Semarang

Aplikasi gabungan Kelompok 1, 2, dan 3 dengan satu login akun individual dan PostgreSQL. Pengembangan terbaru dilakukan di **`bpbd-webv2`**: Dashboard Logistik mengikuti Kelompok 1, penelitian dikembangkan dari Kelompok 2, dan Operasional Bidang mempertahankan alur Kelompok 3.

Dokumentasi diperbarui **19 November 2026**. Runtime lokal menggunakan Next.js/Node.js dan PostgreSQL; aplikasi gabungan dapat dijalankan tanpa server Java atau Supabase.

## Fitur dan aturan saat ini

### Dashboard Logistik dan Operasional Bidang

- Seluruh fungsi **Logistik & Data** sudah digabung ke **Dashboard Logistik**, mengikuti tampilan dan alur transaksi Kelompok 1.
- Master barang, stok, barang masuk, dan barang keluar memakai ledger PostgreSQL yang sama. Transaksi memperbarui dashboard, tabel persediaan, grafik, dan riwayat.
- Ikhtisar Logistik menampilkan angka total. Grafik stok menampilkan seluruh jenis barang tanpa filter satuan.
- Transaksi beberapa barang disimpan sekaligus. Kegagalan satu baris membatalkan seluruh transaksi; pemeriksaan saldo dan penulisan bersamaan dilakukan di server.
- **Operasional Bidang** memakai alur Kelompok 3: input, impor, revisi/riwayat, lampiran, analisis, ekspor, dan cadangan. Catatan langsung tersimpan tanpa verifikasi Admin.
- Akun bidang hanya melihat bidangnya sendiri di ruang kerja operasional. Sekretariat dapat melihat bidang lain dan hanya mengubah data Sekretariat.

### Penelitian

1. Peneliti mendaftar, mengunduh template **Surat Pernyataan**, lalu mengunggah surat yang sudah diisi. Admin memeriksa pendaftaran. Fitur surat masih berupa demo dan dapat dinonaktifkan melalui environment.
2. Menu **Data** berupa dropdown tiga bidang. Setiap bidang menampilkan daftar tabel dengan filter tahun; klik judul untuk membuka isi dataset.
3. **Permohonan Data** memilih dataset tahunan melalui card per bidang dan matriks kolom 2026/2025. Tersedia pencarian, pilih semua per bidang, bagian yang dapat dilipat, serta ringkasan pilihan. Pilihan tetap tersimpan ketika filter tampilan berubah.
4. Admin menetapkan satu keputusan untuk seluruh dataset dalam permohonan. Persetujuan langsung mengaktifkan akses dan unduhan sesuai cakupan, versi sumber, serta masa berlaku. Penolakan menghentikan akses. Tenggat dan perpanjangan dikelola Admin.
5. Peneliti mengirim dokumen hasil, ringkasan, dan feedback. Status otomatis **Sudah** setelah pengiriman berhasil; sebelum ada hasil, status **Belum**. Pengiriman revisi menambah versi dokumen.
6. **Library Penelitian** dapat dilihat dan diunduh oleh semua akun aktif yang login. Surat pendaftaran, surat pendukung, dan dataset mentah permohonan tidak dibagikan melalui Library.

Seluruh keputusan/verifikasi penelitian berada pada Admin. Status hasil mengikuti unggahan yang berhasil, tanpa tahap review hasil terpisah.

## Hak akses

| Role | Operasional Bidang | Dashboard Logistik | Penelitian |
| --- | --- | --- | --- |
| PK — Pencegahan dan Kesiapsiagaan | Baca/tulis bidang sendiri | Baca seluruh rincian bersama | Tanpa kewenangan verifikasi |
| KL — Kedaruratan dan Logistik | Baca/tulis bidang sendiri | Baca/tulis dan transaksi | Tanpa kewenangan verifikasi |
| RR — Rehabilitasi dan Rekonstruksi | Baca/tulis bidang sendiri | Baca seluruh rincian bersama | Tanpa kewenangan verifikasi |
| SEK — Sekretariat | Baca seluruh bidang; tulis bidang SEK | Baca seluruh rincian bersama | Baca permohonan, tanpa keputusan |
| ADM — Admin | Tidak diberikan | Tidak diberikan | Akun, keputusan permohonan, tenggat/perpanjangan, dan pengelolaan penelitian |
| PEN — Peneliti | Tidak diberikan | Tidak diberikan | Pengajuan/hasil sendiri dan akses dataset sesuai izin |

Library tersedia untuk seluruh role dengan akun aktif. Catatan privat bidang, termasuk rincian kejadian pada sumber logistik, tetap dibatasi oleh backend meskipun dirujuk melalui menu bersama, ekspor, atau lampiran.

## Dataset penelitian

Dataset penelitian disimpan terpisah dari data operasional/logistik Kelompok 1 dan 3. Perubahan operasional tidak otomatis menjadi pembaruan katalog penelitian; pemilihan data yang akan dibagikan tetap mengikuti keputusan tim BPBD.

| Bidang | Jenis dataset | Tabel tahunan 2025 dan 2026 | Baris |
| --- | ---: | ---: | ---: |
| Pencegahan dan Kesiapsiagaan | 4 | 8 | 120 |
| Kedaruratan dan Logistik | 5 | 10 | 150 |
| Rehabilitasi dan Rekonstruksi | 5 | 10 | 150 |
| **Total yang tampil di katalog** | **14** | **28** | **420** |

**Satu dataset untuk satu tahun**, masing-masing berisi 15 baris. REF.1 berisi 177 kelurahan Kota Semarang dalam 16 kecamatan dan REF.2 berisi 5 jenis bencana. Kedua referensi dipakai di belakang layar, sehingga keseluruhan sumber berjumlah **30 dataset dan 602 baris**.

Salinan dataset dan kamus kolom ada di `data/research/datasets.json`, relasi ada di `data/research/relations.json`, dan penyimpanan aplikasi memakai tabel `bpbd_research_datasets`. Catatan penelitian bersifat dummy; skor/peringkat IRBI merupakan simulasi. Penjelasan katalog dan izin akses ada di [Dataset Penelitian](docs/DATASET-PENELITIAN.md).

## Menjalankan di Windows

Prasyarat:

- **Node.js 24 atau lebih baru** dan npm, sesuai `package.json`.
- PostgreSQL aktif; integrasi lokal telah diperiksa dengan **PostgreSQL 18**.
- Akun PostgreSQL yang dapat mengakses database tujuan. Setup membutuhkan hak membuat database bila database belum ada.

### Pemasangan pertama

Dari root `Github`, masuk ke proyek terbaru, pasang dependensi, dan salin template environment hanya jika `.env.local` belum ada:

```powershell
cd .\bpbd-webv2
npm.cmd ci
if (!(Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
```

Isi koneksi PostgreSQL di `.env.local` sebelum menjalankan setup. Contoh nilai template:

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=isi_password_postgresql
PGDATABASE=bpbd_local
```

Instalasi integrasi lokal yang telah digunakan memakai **`bpbd_local_integrasi`**. Gunakan nama database pada konfigurasi yang sudah berjalan untuk mempertahankan akses ke data terbaru. `.env.example` memakai `bpbd_local` sebagai nama awal; password PostgreSQL berbeda dari password login website.

Setelah environment siap:

```powershell
npm.cmd run db:setup
npm.cmd run db:check
npm.cmd run dev
```

Buka **http://127.0.0.1:5173**. `db:setup` menerapkan skema/migrasi, mengisi seed awal hanya saat database belum diinisialisasi, serta menambahkan dataset katalog yang belum tersedia. Menjalankannya kembali mempertahankan data yang sudah ada.

### Pemakaian harian dan build

Jalankan dari folder `bpbd-webv2`:

```powershell
npm.cmd run dev
```

Hentikan server dengan `Ctrl+C`. Untuk menjalankan hasil build lokal:

```powershell
npm.cmd run build
npm.cmd start
```

Alamat tetap **http://127.0.0.1:5173**; hentikan server lain yang memakai port tersebut terlebih dahulu. `npm.cmd ci` diperlukan saat pemasangan atau pembaruan dependensi dan dijalankan ketika server berhenti. Pada Linux/macOS gunakan `npm` sebagai pengganti `npm.cmd`.

## Konfigurasi environment

| Variabel | Kegunaan |
| --- | --- |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Koneksi PostgreSQL lokal. |
| `DATABASE_URL` | Koneksi PostgreSQL online; jika diisi, digunakan sebagai pengganti konfigurasi koneksi lokal. |
| `BPBD_RESEARCH_STATEMENT_ENABLED` | `true` atau tidak diisi: Surat Pernyataan aktif. `false`: menyembunyikan form surat dan meniadakan kewajiban surat pada pendaftaran baru. Restart server setelah perubahan. |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` | Konfigurasi opsional pengingat WhatsApp. Dapat dikosongkan untuk demo tanpa pengiriman pesan. |
| `PG_BIN` | Opsional: folder executable PostgreSQL untuk cadangan pada script reset dummy; default `C:/Program Files/PostgreSQL/18/bin`. |

`.env.local`, dump database, dan folder `backups/` diabaikan Git. Dokumen Surat Pernyataan yang sudah tersimpan tetap tersedia bagi pemilik/Admin setelah fitur pendaftaran surat dinonaktifkan. Lihat [Surat Pernyataan Demo](docs/SURAT-PERNYATAAN-DEMO.md).

## Akun seed pengembangan

Sandi awal akun dummy adalah **`BPBDdemo2026!`**. Akun pada database yang sudah dipakai tetap mengikuti kredensial dan status tersimpannya; setup tidak mengatur ulang password.

| Role / akun | Email | Status seed |
| --- | --- | --- |
| Admin | `adm@bpbd.example` | Aktif |
| Pencegahan dan Kesiapsiagaan | `pk@bpbd.example` | Aktif |
| Kedaruratan dan Logistik | `kl@bpbd.example` | Aktif |
| Rehabilitasi dan Rekonstruksi | `rr@bpbd.example` | Aktif |
| Sekretariat | `sek@bpbd.example` | Aktif |
| Peneliti — Nadia | `nadia@peneliti.example` | Aktif |
| Peneliti — Arif | `arif@peneliti.example` | Menunggu Persetujuan |

Tab pada profil browser yang sama berbagi sesi. Gunakan profil berbeda atau jendela privat untuk mencoba beberapa role bersamaan.

## Data dummy aktivitas peneliti

Kondisi demo lokal per **19 November 2026** memuat enam permohonan tahunan milik Nadia (`PEN-001`):

| ID | Topik | Status | Hasil / PDF |
| --- | --- | --- | --- |
| RSET-DUMMY-001 | Risiko dan kesiapsiagaan masyarakat | Diajukan | Belum / 0 |
| RSET-DUMMY-002 | Kejadian dan dampak bencana | Disetujui | Belum / 0 |
| RSET-DUMMY-003 | Bantuan rumah di luar tujuan penelitian | Ditolak | Belum / 0 |
| RSET-DUMMY-004 | Logistik, posko, dan tanggap darurat | Disetujui | Sudah / 1 |
| RSET-DUMMY-005 | Rehabilitasi dan pemulihan pascabencana | Disetujui | Sudah / 2 versi |
| RSET-DUMMY-006 | EWS dan dokumen kontinjensi lintas bidang | Diajukan | Belum / 0 |

Semua skenario memakai tabel 2025 dan 2026 secara terpisah. Gunakan 001/006 untuk demo keputusan Admin, 002 untuk mencoba unggah hasil, serta 004/005 untuk Library dan riwayat versi. Library berisi dua penelitian dengan tiga PDF dummy.

Enam skenario ini merupakan hasil reset lokal, **tidak otomatis dibuat oleh `db:setup` pada database baru**. Rincian data dan cadangan ada di [Dummy Penelitian](docs/DUMMY-PENELITIAN.md).

Perintah berikut hanya memperlihatkan rencana reset:

```powershell
npm.cmd run research:reset-demo
```

Menambahkan `-- --apply` membuat cadangan dan **mengganti aktivitas penelitian saat itu**, termasuk dokumen hasilnya. Script hanya menerima PostgreSQL lokal dan menolak penggantian bila ada permohonan tanpa awalan `[DUMMY]`. Akun, Surat Pernyataan, data operasional, arsip sumber, serta katalog dilindungi. Gunakan hanya saat memang hendak mengulang demo; executable `pg_dump` harus tersedia pada folder `PG_BIN` atau lokasi default.

## Perintah tambahan

| Perintah | Fungsi |
| --- | --- |
| `npm.cmd run db:check` | Memeriksa koneksi dan jumlah data utama. |
| `npm.cmd run research:import-catalog` | Menambahkan ID katalog yang belum ada tanpa menimpa dataset yang sudah tersimpan. |
| `npm.cmd run db:seed-demo` | Menambahkan 31 catatan operasional simulasi pada database operasional kosong atau berisi dataset demo yang sama. |
| `npm.cmd run research:reminders` | Pratinjau jadwal pengingat penelitian; tidak mengirim pesan. |

Seed operasional menolak data operasional di luar dataset demonya. Seed ini tidak memulihkan riwayat asli Kelompok 1/3 dan tidak menggantikan cadangan database hasil integrasi. Pengingat WhatsApp membutuhkan konfigurasi penyedia dan proses pengiriman terpisah; menjalankan web tidak otomatis menjalankan pengirim pesan.

## Pemeriksaan proyek

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:postgres
```

`test:integration` memeriksa operasional, ledger stok, izin bidang, impor/ekspor, dan penulisan bersamaan. `test:postgres` menguji API serta alur browser, termasuk pendaftaran, permohonan tahunan, akses/unduh, hasil, Library, dan logistik. `test:browser` menjalankan rangkaian yang sama dengan `test:postgres`.

Tes database memakai PostgreSQL lokal dengan variabel `PG*` dan **tanpa `DATABASE_URL`**, membuat database sementara terpisah, lalu menghapus database uji setelah selesai. Akun PostgreSQL pengujian perlu hak membuat/menghapus database. `test:postgres` juga memerlukan build yang berhasil dan Microsoft Edge terpasang. Pemeriksaan tidak memerlukan reset data demo pengguna.

## Struktur dan penyimpanan

| Lokasi | Isi |
| --- | --- |
| `app/`, `app/api/bpbd/`, `app/api/operasional/` | Halaman serta endpoint akun, penelitian, dokumen, dan operasional. |
| `components/bpbd/integrated.tsx` | Dashboard dan ruang kerja hasil integrasi. |
| `components/bpbd/research.tsx`, `research-catalog.tsx`, `research-catalog-requests.tsx`, `research-dataset-picker.tsx` | Tampilan penelitian, daftar/isi dataset, pengajuan, dan pemilihan dataset tahunan. |
| `integration/kelompok1/`, `integration/kelompok3/` | Antarmuka kelompok yang diadaptasi dan dilayani melalui sesi login. |
| `lib/operations/` | Validasi, izin bidang, stok, transaksi, revisi, dan impor/ekspor operasional. |
| `lib/server/`, `lib/bpbd/` | Layanan backend, kebijakan akses, model, dan aturan penelitian. |
| `data/research/` | Sumber dummy dataset tahunan, kamus kolom, dan relasi. |
| `db/`, `drizzle/postgresql/`, `sql/integrasi.sql` | Koneksi, skema, dan migrasi PostgreSQL. |
| `scripts/`, `tests/` | Setup, migrasi, pengelolaan demo, serta pengujian domain/API/browser. |
| `docs/` | Catatan integrasi, revisi, database, dan hosting. |

Data utama dan isi berkas disimpan di PostgreSQL. Password memakai hash scrypt; sesi memakai cookie HttpOnly. Operasional menggunakan tabel `bpbd_op_*`, arsip/relasi sumber memakai `bpbd_source_*`, permohonan di `bpbd_research`, dan dataset tahunan di `bpbd_research_datasets`. ID/relasi asal dan checksum berkas sumber dipertahankan.

Impor operasional menerima CSV/XLSX maksimal 5.000 baris/15 MB; lampiran operasional PDF/JPG/PNG maksimal 10 MB. Surat Pernyataan menerima DOCX/PDF maksimal 3 MB atau batas unggahan sistem bila lebih kecil. Dokumen hasil penelitian mengikuti validasi dan batas unggahan penelitian pada aplikasi.

## Cadangan, pemindahan, dan hosting

Menyalin folder proyek tidak memindahkan isi PostgreSQL. Untuk membawa akun, data, dan berkas terbaru ke mesin lain, gunakan cadangan penuh `pg_dump` dan pulihkan dengan `pg_restore`, kemudian arahkan environment aplikasi ke database hasil pemulihan. Seed awal hanya menyediakan contoh dari kode.

Panduan lokal dan pemulihan tersedia di [PostgreSQL Lokal](docs/POSTGRESQL-LOKAL.md). Panduan konfigurasi demo online tersedia di [Hosting Vercel + Neon](docs/HOSTING-VERCEL.md). Runtime lokal menggunakan profil `portable` melalui `dev`, `build`, dan `start`; konfigurasi Vinext/Vite/Sites yang masih ada merupakan jalur runtime terpisah.

Stack utama: **Next.js 16, React 19, TypeScript, Node.js, PostgreSQL, pg, Drizzle, Tailwind CSS, Shadcn/Radix, Recharts, dan ExcelJS**. Data demo tetap sintetis. Pemulihan password/email, SSO, pemindaian malware, penjadwalan backup produksi, dan pengujian beban belum disediakan.

## Dokumentasi lanjutan

| Dokumen | Bahasan |
| --- | --- |
| [Dataset Penelitian](docs/DATASET-PENELITIAN.md) | Tabel per tahun, referensi internal, endpoint, dan izin dataset. |
| [Dummy Penelitian](docs/DUMMY-PENELITIAN.md) | Enam skenario aktivitas terbaru, PDF, reset, dan cadangan. |
| [Revisi Penelitian 17 November 2026](docs/REVISI-PENELITIAN-2026-11-17.md) | Persetujuan sekali, status hasil otomatis, dan Library. |
| [Surat Pernyataan Demo](docs/SURAT-PERNYATAAN-DEMO.md) | Pendaftaran, unggah ulang, privasi, dan konfigurasi fitur surat. |
| [Revisi Dashboard Logistik](docs/REVISI-KELOMPOK1.md) | Penggabungan menu, alur Kelompok 1, dan rekonsiliasi stok. |
| [Integrasi Kelompok 1–3](docs/INTEGRASI-KELOMPOK.md) | Migrasi awal, relasi sumber, izin operasional, dan pemulihan. |
| [PostgreSQL Lokal](docs/POSTGRESQL-LOKAL.md) | Setup, penyimpanan, sesi, cadangan, dan pemindahan server. |
| [Hosting Vercel + Neon](docs/HOSTING-VERCEL.md) | Konfigurasi deployment demo online. |

Dokumen bertanggal mencatat kondisi saat revisi tersebut dibuat. Untuk alur penelitian dan logistik terkini, gunakan uraian README ini bersama catatan dataset, dummy, Surat Pernyataan, serta revisi terbaru di atas.
