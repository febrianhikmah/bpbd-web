import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const sourceRoot=process.argv[2];if(!sourceRoot)throw new Error('Berikan path folder Kelompok1.');
const configuration=await readFile(join(sourceRoot,'src/main/resources/application.properties'),'utf8');
const props=Object.fromEntries(configuration.split(/\r?\n/).filter(l=>l&&!l.trimStart().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const url=process.env.SUPABASE_URL||props['supabase.url'],key=process.env.SUPABASE_KEY||props['supabase.key'];
if(!url||!key)throw new Error('Konfigurasi baca sumber belum tersedia.');
const snapshot={};
for(const [table,id] of [['master_barang','barang_id'],['logistik_transaksi','transaksi_id']]){
 const rows=[];
 for(let offset=0;;offset+=1000){
  const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}?select=*&order=${id}.asc&offset=${offset}&limit=1000`,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Ekspor ${table}: HTTP ${response.status}`);
  const batch=await response.json();if(!Array.isArray(batch))throw new Error('Format sumber tidak valid.');rows.push(...batch);if(batch.length<1000)break;if(offset>=100000)throw new Error('Batas ekspor tercapai.');
 }
 snapshot[table]=rows;
}
const directory=join('backups','k1-export-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(directory,{recursive:true});
const output=join(directory,'source.json');await writeFile(output,JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({output,counts:Object.fromEntries(Object.entries(snapshot).map(([k,v])=>[k,v.length]))}));
