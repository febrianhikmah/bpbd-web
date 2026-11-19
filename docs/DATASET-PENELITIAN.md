# Katalog dataset penelitian per tahun

Katalog pada menu Data peneliti sekarang memuat 28 dataset tahunan (14 jenis x 2025/2026), masing-masing 15 baris. Bidang PK memiliki 8 entri, KL 10, dan RR 10. REF.1 (177 wilayah) serta REF.2 (5 jenis bencana) disimpan sebagai referensi internal untuk relasi data. Keduanya tidak ditampilkan pada daftar atau halaman dataset dan tidak dikirim oleh endpoint katalog. Total tetap 602 baris unik.

Sumber data: paket `Dataset_Dummy_Penelitian_Per_Tahun` di root GitHub. Salinan data dan kamus kolom yang dipakai aplikasi berada di `data/research/datasets.json`; relasi di `data/research/relations.json`. Semua ID dan nilai dipertahankan. Catatan utama sintetis; kode/nama wilayah dan jenis bencana mengikuti referensi dalam paket sumber. Skor/peringkat IRBI merupakan simulasi, bukan nilai resmi.

Data disimpan di tabel PostgreSQL `bpbd_research_datasets`, terpisah dari catatan operasional serta permohonan penelitian lama. Permohonan baru memilih dataset tahunan dari katalog yang sama. Referensi internal tidak dapat dipilih atau diunduh sebagai dataset permohonan.

Klik judul dataset untuk membuka halaman tabel seluruh kolom. Daftar mendukung filter tahun dan jumlah tabel; halaman isi mendukung jumlah baris, paginasi dan gulir horizontal. URL menyimpan filter/paginasi sehingga tombol kembali dan refresh mempertahankan pilihan.

## Menyiapkan database

Database baru mengikuti `npm run db:setup`. Pada database yang sudah ada, jalankan:

```powershell
npm run research:import-catalog
```

Impor hanya membuat tabel katalog jika belum ada dan menambahkan ID yang belum ada. ID katalog yang sudah tersimpan tidak ditimpa. Data operasional, akun, surat dan permohonan penelitian tidak diubah.

Endpoint baca `GET /api/bpbd/research-datasets` dan `GET /api/bpbd/research-datasets/:id` memerlukan sesi akun aktif. Katalog hanya mengirim metadata/kolom; isi baris diambil saat membuka detail. Tidak ada endpoint ubah atau hapus katalog dari browser.

Hanya 28 dataset tahunan yang dapat dibuka melalui katalog; URL langsung ke referensi internal memberikan 404. Seluruh 30 dataset dan 602 baris tetap tersimpan di PostgreSQL.

## Permohonan dataset tahunan

Form Permohonan Data memakai 28 dataset katalog, dikelompokkan berdasarkan bidang dan tahun. Setiap pilihan meminta satu tabel tahunan secara utuh; tidak memakai filter tanggal/kecamatan dari dataset lama. Pilihan 2025 tetap terpilih jika pengguna mengganti filter tampilan ke 2026. Tenggat penelitian merupakan jadwal penyerahan hasil, terpisah dari tahun dataset.

Pengajuan disimpan melalui `POST /api/bpbd/catalog-requests`. Server mengambil sendiri nama, bidang, tahun, jumlah baris, dan hash versi dari PostgreSQL. Payload tambahan untuk mengatur pemilik, status, jumlah baris, referensi internal, atau persetujuan ditolak. ID pengajuan bersifat idempoten untuk mencegah pengiriman ganda saat jaringan terputus.

Keputusan hanya dapat ditetapkan Admin melalui `POST /api/bpbd/research/:id/catalog-decision`; berlaku untuk seluruh dataset yang diminta. Persetujuan mengaktifkan akses dan unduhan sekaligus. Versi dataset diperiksa kembali saat akses/unduhan; jika berubah, Admin harus memeriksa dan menyetujui versi terbaru. Penolakan menghapus grant akses; masa berlaku mengikuti tanggal WIB.

`GET /api/bpbd/research/:id/catalog` digunakan untuk pemeriksaan Admin atau akses oleh pemilik yang sudah disetujui. `GET /api/bpbd/research/:id/catalog/:datasetId/csv` hanya untuk pemilik dengan izin unduh aktif dan cakupan yang sesuai. Setiap CSV tetap satu dataset untuk satu tahun. Pratinjau pemilik menampilkan 5 baris, unduhan berisi seluruh baris yang disetujui.

Permohonan lama tetap tersimpan dan dapat diproses dengan cakupan aslinya; tidak dipetakan secara otomatis ke tabel baru karena struktur dan relasinya berbeda. Pembuatan permohonan lama melalui browser dihentikan. Generator demo lama tetap tersedia sebagai alat pemeliharaan internal. Pengiriman hasil, status otomatis Sudah, arsip versi, Library, dan koordinasi tenggat/perpanjangan tetap mengikuti aturan penelitian yang ada.
