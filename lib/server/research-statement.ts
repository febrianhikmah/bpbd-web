import { zip, validateDocument } from '../bpbd/files';
import { ApiError, requireThat } from './policy.ts';

export const statementEnabled = () => process.env.BPBD_RESEARCH_STATEMENT_ENABLED !== 'false';
export const statementLimitMb = (setting: number) => Math.min(setting, 3);

export async function checkStatement(file: File, limitMb: number) {
  requireThat(file.name.length <= 255 && !/[\/\\\x00-\x1f]/.test(file.name), 'Nama surat tidak valid.', 400);
  try { await validateDocument(file, limitMb); }
  catch (e) { throw new ApiError(400, (e as Error).message); }
  return /\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

export function statementTemplate() {
  const lines = [
    'SURAT PERNYATAAN PENYERAHAN HASIL PENELITIAN',
    'TEMPLATE DEMO - Format sementara, menunggu persetujuan BPBD', '',
    'Saya yang bertanda tangan di bawah ini:',
    'Nama lengkap               : ................................................',
    'Institusi / program studi  : ................................................',
    'Email                     : ................................................',
    'Nomor WhatsApp            : ................................................',
    'Rencana topik penelitian  : ................................................', '',
    'Dalam menggunakan layanan penelitian BPBD Kota Semarang, saya menyatakan:',
    '1. Menggunakan data sesuai cakupan, tujuan, dan masa akses yang disetujui Admin.',
    '2. Menjaga kerahasiaan informasi yang diperoleh sesuai ketentuan yang disepakati.',
    '3. Menyerahkan dokumen hasil penelitian, ringkasan, dan feedback / rekomendasi melalui aplikasi sesuai tenggat yang disepakati pada permohonan penelitian.',
    '4. Mengajukan perpanjangan melalui aplikasi apabila memerlukan perubahan tenggat.',
    '5. Memastikan informasi identitas dan dokumen yang saya unggah sesuai keadaan sebenarnya.', '',
    'Demikian surat pernyataan ini saya buat untuk melengkapi pendaftaran peneliti.', '',
    'Tempat, tanggal : ................................................',
    'Yang menyatakan,', '', '', '',
    '(................................................)',
    'Tanda tangan dan nama lengkap', '',
    'Catatan: dokumen ini merupakan contoh untuk demonstrasi aplikasi. Format resmi akan mengikuti keputusan BPBD.',
  ];
  const xml = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  const body = lines.map((line,i)=>`<w:p><w:pPr>${i<2?'<w:jc w:val="center"/>':''}<w:spacing w:after="140"/></w:pPr><w:r>${i<2?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join('');
  return zip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1134" w:bottom="1000" w:left="1134"/></w:sectPr></w:body></w:document>`,
  });
}
