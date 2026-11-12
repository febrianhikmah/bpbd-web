import { randomUUID, createHash } from 'node:crypto';
import type { Role, User } from '../bpbd/model.ts';
import { requireThat } from '../server/policy.ts';
import { stockOf, visibleRow, prepareBatch, type Row } from './domain.ts';

export const districts = ['Banyumanik','Candisari','Gajahmungkur','Gayamsari','Genuk','Gunungpati','Mijen','Ngaliyan','Pedurungan','Semarang Barat','Semarang Selatan','Semarang Tengah','Semarang Timur','Semarang Utara','Tembalang','Tugu'];
const key = (r: Row) => [r.nama,r.kategori,r.satuan].map(v=>String(v??'').trim().toLowerCase()).join('|');
export function logisticsView(records: Record<string,Row[]>, role: Role) {
  // Same logical master grouping as K1; all original IDs and references remain stored.
  const groups = new Map<string, Row & { aliases: string[]; saldo: number }>();
  for (const row of [...records.barang].sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}))) {
    const k=key(row), old=groups.get(k);
    if(old) old.aliases.push(row.id); else groups.set(k,{...visibleRow(role,row),aliases:[row.id],saldo:0});
  }
  const barang=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,r])=>r);
  const byId=new Map(barang.flatMap(r=>r.aliases.map(id=>[id,r] as const)));
  for(const s of stockOf(records)) byId.get(s.barang)!.saldo+=s.saldo;
  const merged = new Map<string,Row>();
  for(const direction of ['masuk','keluar']) for(const raw of records[direction]) {
    const row=visibleRow(role,raw), item=byId.get(String(row.barang));
    const id=row.transaction_id ? `${row.transaction_id}/${row.transaction_item}` : `${direction}/${row.id}`;
    const previous=merged.get(id);
    if(previous) { previous.jumlah=Number(previous.jumlah)+Number(row.jumlah); (previous.parts as Row[]).push(row); }
    else merged.set(id,{...row,id,arah:direction,nama:item?.nama,satuan:item?.satuan,barang:item?.id,parts:[row]});
  }
  const transactions=[...merged.values()].sort((a,b)=>String(b.tanggal||'').localeCompare(String(a.tanggal||'')) || String(b.created_at||'').localeCompare(String(a.created_at||'')) || b.id.localeCompare(a.id,'en',{numeric:true}));
  const units=[...new Set(barang.map(r=>String(r.satuan||'')))].sort();
  const totals=units.map(satuan=>({satuan,saldo:barang.filter(r=>r.satuan===satuan).reduce((n,r)=>n+r.saldo,0),
    masuk:transactions.filter(r=>r.satuan===satuan&&r.arah==='masuk'&&r.jenis!=='Saldo awal').reduce((n,r)=>n+Number(r.jumlah),0),
    keluar:transactions.filter(r=>r.satuan===satuan&&r.arah==='keluar').reduce((n,r)=>n+Number(r.jumlah),0)}));
  return {barang,transactions,totals,units,districts,writable:role==='KL'};
}

export function prepareLogisticsTransaction(body: Record<string,unknown>, records: Record<string,Row[]>, actor: User) {
  requireThat(actor.role==='KL','Hanya KL yang dapat mencatat transaksi.');
  requireThat(body && typeof body==='object','Transaksi tidak valid.',400);
  const direction=String(body.jenis||'').toLowerCase();
  requireThat(['masuk','keluar'].includes(direction),'Jenis transaksi tidak valid.',400);
  const token=String(body.requestId||'');
  requireThat(/^[a-f0-9-]{36}$/.test(token),'Identitas transaksi tidak valid.',400);
  const rows=body.items as {barang:string;jumlah:number}[];
  requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=100,'Pilih 1–100 barang.',400);
  requireThat(new Set(rows.map(r=>r?.barang)).size===rows.length,'Barang yang sama dipilih dua kali. Gabungkan kuantitasnya.',400);
  const text=(field:string)=>String(body[field]??'').trim();
  requireThat(direction==='masuk'?!!text('sumber_barang'):!!text('tujuan_penggunaan'),'Sumber barang atau tujuan penggunaan wajib diisi.',400);
  if(direction==='keluar')requireThat(districts.includes(text('kecamatan')),'Kecamatan tujuan tidak valid.',400);
  const requestHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const previous=[...records.masuk,...records.keluar].filter(r=>r.transaction_id===token);
  if(previous.length){requireThat(previous.every(r=>r.request_hash===requestHash&&r.created_by===actor.id),'Identitas transaksi sudah digunakan.',409);return {direction,rows:[],duplicate:true};}
  const view=logisticsView(records,actor.role), balances=stockOf(records);
  const incoming: Row[]=[];
  for(const [index,item] of rows.entries()) {
    const master=view.barang.find(r=>r.id===String(item?.barang));
    requireThat(master&&Number.isSafeInteger(item.jumlah)&&item.jumlah>0,'Pilih barang dan kuantitas bulat minimal 1.',400);
    const base={tanggal:text('tanggal'),jenis:direction==='masuk'?'Penerimaan':null,tujuan:text('tujuan_penggunaan'),tujuan_penggunaan:text('tujuan_penggunaan'),
      sumber_barang:text('sumber_barang'),penerima:text('penerima'),kecamatan:text('kecamatan'),kondisi:'Baik',catatan:text('keterangan')};
    const split: {barang:string;sumber:string;jumlah:number}[]=[];
    if(direction==='masuk')split.push({barang:master.id,sumber:'Saldo gabungan K1',jumlah:item.jumlah});
    else {
      let remaining=item.jumlah;
      // Deplete existing source buckets deterministically; never lose their provenance.
      for(const stock of balances.filter(s=>master.aliases.includes(s.barang)&&s.saldo>0).sort((a,b)=>a.barang.localeCompare(b.barang)||a.sumber.localeCompare(b.sumber))){
        const amount=Math.min(stock.saldo,remaining);if(amount>0)split.push({barang:stock.barang,sumber:stock.sumber,jumlah:amount});remaining-=amount;if(!remaining)break;
      }
      requireThat(remaining===0,`Stok tidak cukup untuk ${master.nama}. Seluruh transaksi belum disimpan.`,409);
    }
    for(const part of split)incoming.push({...base,...part,id:`K1-${randomUUID()}`,transaction_id:token,transaction_item:index,request_hash:requestHash} as Row);
  }
  const validated=prepareBatch(direction,incoming,records);
  return {direction,duplicate:false,rows:validated.map((row,i)=>({...row,transaction_id:token,transaction_item:incoming[i].transaction_item,request_hash:requestHash,revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:actor.id}))};
}
