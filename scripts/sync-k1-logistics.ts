import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {getPool} from '../db/index.ts';
import {saveRecord,readRecords} from '../lib/operations/repository.ts';
import {checkStock,stockOf,type Row} from '../lib/operations/domain.ts';

const sourceFile=process.argv[2];
if(!sourceFile)throw new Error('Berikan snapshot JSON Kelompok 1. Tambahkan --apply untuk menyimpan.');
const apply=process.argv.includes('--apply');
const source=JSON.parse(await readFile(sourceFile,'utf8')) as Record<string,Row[]>;
for(const entity of ['master_barang','logistik_transaksi'])if(!Array.isArray(source[entity]))throw new Error('Snapshot sumber tidak lengkap.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const directory=join('backups','revisi-k1-'+stamp);await mkdir(directory,{recursive:true});
if(apply){
 if(process.env.DATABASE_URL)throw new Error('Migrasi ini ditujukan untuk PostgreSQL lokal.');
 const result=spawnSync(join(process.env.PG_BIN||'C:/Program Files/PostgreSQL/18/bin','pg_dump.exe'),['--format=custom','--no-owner','--file',join(directory,'before.dump')],{env:process.env,windowsHide:true});
 if(result.status!==0)throw new Error('Cadangan gagal; migrasi dibatalkan.');
}
const canonical=(v:unknown):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(canonical(x))])):v);
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const client=await getPool().connect();
try{
 await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('bpbd-operasional'))");
 const protectedQuery="SELECT 'users' AS t,id,data FROM bpbd_users UNION ALL SELECT 'research',id,data FROM bpbd_research UNION ALL SELECT 'entries',id,data FROM bpbd_entries ORDER BY t,id";
 const before=(await client.query(protectedQuery)).rows;
 const records=await readRecords(client),changes:unknown[]=[];
 const oldSources=(await client.query("SELECT entity,source_id,data FROM bpbd_source_records WHERE source='K1' AND entity IN ('master_barang','logistik_transaksi')")).rows;
 await writeFile(join(directory,'before-source.json'),JSON.stringify(oldSources));
 const aliases=new Map((await client.query("SELECT entity,source_id,record_id FROM bpbd_source_map WHERE source='K1'")).rows.map(r=>[r.entity+'/'+r.source_id,r.record_id]));
 for(const [entity,rows] of Object.entries(source)){
  if(!['master_barang','logistik_transaksi'].includes(entity))continue;
  const idField=entity==='master_barang'?'barang_id':'transaksi_id';
  if(new Set(rows.map(r=>String(r[idField]))).size!==rows.length)throw new Error('ID sumber duplikat.');
  for(const old of oldSources.filter(r=>r.entity===entity))if(!rows.some(r=>String(r[idField])===old.source_id))throw new Error(`Sumber menghapus ${entity}/${old.source_id}; rekonsiliasi diperlukan.`);
  for(const raw of rows){
   const original=String(raw[idField]??'');if(!original)throw new Error('ID sumber kosong.');
   const oldSource=oldSources.find(r=>r.entity===entity&&r.source_id===original);
   if(oldSource&&canonical(oldSource.data)===canonical(raw))continue;
   const direction=String(raw.jenis||'').toLowerCase();
   const moduleCode=entity==='master_barang'?'barang':direction;
   if(entity==='logistik_transaksi'&&oldSource&&String(oldSource.data.jenis).toLowerCase()!==direction)throw new Error('Jenis transaksi sumber berubah; rekonsiliasi diperlukan.');
   if(!['barang','masuk','keluar'].includes(moduleCode))throw new Error('Arah transaksi sumber tidak valid.');
   let id=aliases.get(entity+'/'+original)||original;
   if(!aliases.has(entity+'/'+original)&&records[moduleCode].some(r=>r.id===id))id=`K1-${entity}-${original}`;
   const old=records[moduleCode].find(r=>r.id===id);
   if(old&&((old.revision||1)>1||old.created_by||old.updated_by))throw new Error(`Catatan ${moduleCode}/${id} sudah diperbarui lokal; rekonsiliasi diperlukan.`);
   let row:Row;
   if(moduleCode==='barang'){
    const opening=Number(raw.stok_awal??raw.saldo_awal??raw.jumlah_stok??raw.stok_tersedia??raw.jumlah_barang??raw.stock??raw.stok??0);
    if(opening!==0)throw new Error('Saldo awal sumber memerlukan pemetaan ledger eksplisit.');
    row={...raw,id,nama:raw.nama_barang,satuan:raw.satuan,kategori:raw.kategori,minimum:old?.minimum??null,catatan:raw.deskripsi,tracking_expired:raw.tracking_expired?'Ya':'Tidak'};
   }else{
    const barang=aliases.get('master_barang/'+raw.barang_id);if(!barang)throw new Error('Relasi barang sumber tidak tersedia.');
    const amount=Number(raw.jumlah);if(!Number.isFinite(amount)||amount<=0)throw new Error('Jumlah transaksi sumber tidak valid.');
    row={...raw,id,barang,jumlah:amount,sumber:'Saldo gabungan K1',jenis:moduleCode==='masuk'?'Penerimaan':raw.jenis,tujuan:raw.tujuan_penggunaan??raw.penerima,catatan:raw.keterangan};
   }
   row={...row,revision:old?.revision||1,source_system:'K1',source_entity:entity,source_id:original};
   if(old)row.history=[...(Array.isArray(old.history)?old.history:[]),{...old,history:undefined}];
   await client.query('INSERT INTO bpbd_source_records(source,entity,source_id,data,sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source,entity,source_id) DO UPDATE SET data=$4,sha256=$5',['K1',entity,original,JSON.stringify(raw),createHash('sha256').update(JSON.stringify(raw)).digest('hex')]);
   await saveRecord(client,moduleCode,row);
   if(old)records[moduleCode]=records[moduleCode].map(r=>r.id===id?row:r);else records[moduleCode].push(row);
   await client.query('INSERT INTO bpbd_source_map(source,entity,source_id,module,record_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',['K1',entity,original,moduleCode,id]);
   aliases.set(entity+'/'+original,id);
   if(moduleCode!=='barang')await client.query("INSERT INTO bpbd_source_links(source,entity,source_id,field,target_entity,target_id) VALUES('K1',$1,$2,'barang_id','master_barang',$3) ON CONFLICT(source,entity,source_id,field) DO UPDATE SET target_id=$3",[entity,original,String(raw.barang_id)]);
   changes.push({entity,original,id,action:old?'update':'insert'});
  }
 }
 checkStock(records);
 const after=(await client.query(protectedQuery)).rows;if(hash(before)!==hash(after))throw new Error('Data akun/penelitian berubah; transaksi dibatalkan.');
 const report={at:new Date().toISOString(),applied:apply,changes,sourceCount:source.logistik_transaksi.length,stock:stockOf(records).map(s=>({barang:s.barang,sumber:s.sumber,saldo:s.saldo,satuan:s.satuan})),researchUnchanged:true};
 await client.query(apply?'COMMIT':'ROLLBACK');await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await getPool().end();}
