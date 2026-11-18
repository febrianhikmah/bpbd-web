# Dummy penelitian terbaru — 17 November 2026

Data permohonan, hasil, lampiran penelitian, dan arsip permintaan lama K1 di PostgreSQL lokal telah diganti sesuai permintaan pengguna. Akun/login, dataset penelitian, dan seluruh data operasional/logistik dipertahankan. Pemeriksaan hash sebelum dan setelah transaksi memastikan data tersebut tidak berubah. Audit lama dipertahankan sebagai riwayat, dengan tambahan catatan reset.

Cadangan sebelum reset ada di `backups/reset-penelitian-2026-11-17T07-50-51-102Z/before.dump`, beserta salinan penelitian sebelumnya dan laporan penggantian. Folder backups diabaikan Git.

## Skenario yang tersedia

Seluruh permohonan baru dimiliki peneliti aktif yang sudah ada (`nadia@peneliti.example` pada database saat penggantian). Sandi dan status akun tidak diubah. Judul ditandai **[DUMMY]**. Dokumen hasil adalah PDF sintetis yang diberi label DUMMY, bukan laporan resmi.

| ID | Contoh | Keputusan | Hasil | Dokumen |
| --- | --- | --- | --- | ---: |
| RSET-DUMMY-001 | Edukasi dan kesiapsiagaan masyarakat | Diajukan | Belum | 0 |
| RSET-DUMMY-002 | Kejadian dan korban banjir di Genuk | Disetujui | Belum | 0 |
| RSET-DUMMY-003 | Kajian risiko di luar kebutuhan | Ditolak | Belum | 0 |
| RSET-DUMMY-004 | Distribusi bantuan dan persediaan logistik | Disetujui | Sudah | 1 |
| RSET-DUMMY-005 | Mitigasi banjir dan wilayah rawan | Disetujui | Sudah | 2 |
| RSET-DUMMY-006 | Kerusakan dan pemulihan fasilitas | Diajukan | Belum | 0 |

Persetujuan mengikuti satu keputusan ADM untuk seluruh dataset dan langsung memberi akses unduh. Permohonan diajukan/ditolak tidak dapat mengunduh. Hasil otomatis berstatus Sudah setelah pengiriman sah. Library menampilkan dua penelitian dan tiga versi PDF, tersedia bagi semua akun aktif yang login. RSET-DUMMY-002 bisa dipakai untuk mencoba mengirim hasil sendiri; 001 dan 006 untuk mencoba persetujuan/penolakan Admin.

Data dibuat melalui validasi backend yang sama dengan aplikasi, termasuk ID/versi dataset yang diizinkan. Tanggal akses dan tenggat dibuat relatif saat reset. Contoh ini tidak memerlukan perubahan sandi atau pengiriman WhatsApp.

## Mengulang penggantian

```powershell
node --env-file-if-exists=.env.local scripts/reset-research-demo.ts
node --env-file-if-exists=.env.local scripts/reset-research-demo.ts --apply
```

Perintah pertama hanya memperlihatkan rencana. `--apply` kembali mengganti seluruh data penelitian saat itu setelah membuat cadangan; jalankan hanya bila memang hendak menghapus hasil/perubahan penelitian yang sudah dibuat. Script membatasi target ke PostgreSQL lokal, mempertahankan berkas yang dirujuk dataset/laporan operasional, dan membatalkan transaksi bila data di luar penelitian berubah.

Database saat reset adalah `bpbd_local_integrasi`. Instalasi lain yang menunjuk database yang sama juga membaca data penelitian yang baru ini.
