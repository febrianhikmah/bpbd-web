# Surat Pernyataan pendaftaran peneliti — demo

Implementasi poin 1 dari `Perbaikan bagian penelitian.docx` sesuai arahan pengguna pada 17 November 2026. Format sementara untuk demonstrasi; belum merupakan surat resmi BPBD.

## Alur

1. Pada bagian teratas formulir Daftar Peneliti, unduh template **Surat Pernyataan (.docx)**.
2. Lengkapi identitas dan tanda tangan. Unggah kembali dalam Word (.docx) atau PDF, maksimal **3 MB**, atau batas unggahan sistem bila lebih kecil.
3. Kirim pendaftaran. Akun, metadata surat, isi berkas, dan sesi pendaftaran disimpan dalam satu transaksi PostgreSQL. Pendaftaran baru wajib menyertakan surat ketika fitur aktif.
4. Pemohon bisa mengunduh suratnya dari Status Akun/Profil meskipun belum aktif. Admin membuka surat melalui Persetujuan Akun → Tinjau, atau Pengguna → Kelola.
5. Jika perlu perbaikan, pemohon mengunggah ulang lewat Status Akun atau Profil. Status kembali Menunggu Persetujuan. Setelah akun aktif, surat tidak dapat diganti melalui endpoint pendaftaran.

Template mencakup identitas peneliti, penggunaan data sesuai cakupan persetujuan, kerahasiaan, penyerahan dokumen hasil/ringkasan/feedback sesuai tenggat yang disepakati, dan tempat tanda tangan. Isi dan tanda tangan diperiksa manusia oleh Admin; sistem memeriksa format/ukuran berkas.

## Akses dan kompatibilitas

Surat hanya dibuka oleh pemilik akun atau Admin aktif. Surat tidak masuk Library Penelitian, tidak dibagikan ke bidang/Sekretariat, dan metadata dokumen tidak dibuka pada daftar peneliti milik pengguna lain. Metadata surat tidak bisa dipalsukan lewat penyimpanan profil/state; unggah memakai endpoint khusus yang terikat sesi.

Akun lama tanpa surat tetap bisa dipakai dengan status sebelumnya. Tidak ada tabel baru dan tidak ada perubahan password, akun lama, dummy penelitian, atau operasional. Surat memakai metadata opsional `users.data.statement` dan isi di `bpbd_files`. Script reset dummy penelitian mempertahankan semua berkas Surat Pernyataan milik akun.

## Menonaktifkan demo

Tambahkan pada environment server, lalu restart/deploy ulang:

```dotenv
BPBD_RESEARCH_STATEMENT_ENABLED=false
```

Bagian surat pada pendaftaran dan kewajibannya akan hilang; pendaftaran kembali berjalan tanpa surat. Dokumen yang sudah tersimpan tetap dapat dibuka pemilik/Admin. Tanpa variabel ini atau dengan nilai `true`, fitur aktif. Konfigurasi berlaku pada backend dan formulir, tanpa variabel publik terpisah.

## Endpoint

- `GET /api/bpbd/registration-options`: konfigurasi publik formulir.
- `GET /api/bpbd/registration-statement`: unduh template Word demo tanpa login, jika fitur aktif.
- `POST /api/bpbd/register`: identitas dan berkas surat melalui multipart; validasi seluruhnya sebelum menyimpan akun.
- `GET /api/bpbd/research-statement/<userId>`: unduh surat milik akun, memerlukan sesi pemilik atau Admin aktif.
- `PUT /api/bpbd/research-statement`: unggah pengganti oleh pemohon yang masih menunggu/perlu perbaikan/ditolak; masuk pemeriksaan lagi.

Pengujian menggunakan database sementara. Mencakup unduh template, registrasi lewat ponsel, pemohon belum aktif dan Admin mengunduh surat, unggah ulang, penolakan berkas palsu/terlalu besar/tanpa surat, perlindungan akses lintas akun, serta mode fitur dinonaktifkan.

Pemeriksaan: build berhasil, 34 tes unit lulus, serta pengujian PostgreSQL dan browser mencakup alur pendaftaran, unduhan dan privasi surat, perbaikan surat, mode nonaktif, dan regresi penelitian/logistik. Tidak ada pendaftaran uji yang dibuat di database pengguna.
