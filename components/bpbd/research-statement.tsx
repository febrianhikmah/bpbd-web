"use client";
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/bpbd/api';
import { download, validateDocument } from '@/lib/bpbd/files';
import type { User } from '@/lib/bpbd/model';
import { useApp } from './context';
import { Action, Field, Notice } from './shared';

export function useRegistrationOptions(enabled = true) {
  const [options,setOptions] = useState({statementEnabled:false,maxUploadMb:3,ready:false,error:''});
  useEffect(()=>{
    if(!enabled)return;let active=true;
    void api<{statementEnabled:boolean;maxUploadMb:number}>('registration-options')
      .then(value=>{if(active)setOptions({...value,ready:true,error:''});})
      .catch(e=>{if(active)setOptions(value=>({...value,error:(e as Error).message}));});
    return()=>{active=false;};
  },[enabled]);
  return options;
}

export function StatementRegistration({maxUploadMb,file,onChange}:{maxUploadMb:number;file:File|null;onChange:(file:File|null)=>void}) {
  return <section className="scope-box" aria-label="Surat Pernyataan" style={{margin:'0 0 24px',overflowWrap:'anywhere'}}>
    <h3>Surat Pernyataan</h3>
    <p>Unduh template, lengkapi identitas dan tanda tangan, lalu unggah kembali suratnya.</p>
    <p className="small muted">Template demo; format resmi menunggu persetujuan BPBD.</p>
    <a className="text-button" href="/api/bpbd/registration-statement" download style={{display:'inline-flex',gap:8,alignItems:'center',margin:'12px 0'}}><Download size={16}/>Unduh template Surat Pernyataan (.docx)</a>
    <Field label="Surat Pernyataan yang sudah dilengkapi" required htmlFor="register-statement" help={`Word (.docx) atau PDF, maksimal ${maxUploadMb} MB.`}>
      <input id="register-statement" type="file" accept=".docx,.pdf" required onChange={e=>onChange(e.target.files?.[0]||null)} style={{maxWidth:'100%'}}/>
    </Field>
    {file&&<p className="small">Dipilih: {file.name}</p>}
  </section>;
}

export function ResearchStatementCard({account,editable=false}:{account:User;editable?:boolean}) {
  const {refresh}=useApp(),options=useRegistrationOptions(editable);
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const canUpload=editable&&['Menunggu Persetujuan','Perlu Perbaikan','Ditolak'].includes(account.status)&&options.ready&&options.statementEnabled;
  async function open(){
    try{
      const response=await fetch('/api/bpbd/research-statement/'+encodeURIComponent(account.id),{cache:'no-store',credentials:'same-origin'});
      if(!response.ok){const body=await response.json() as {error?:string};throw new Error(body.error||'Surat tidak dapat dibuka.');}
      download(await response.blob(),account.statement!.filename);
    }catch(e){toast.error((e as Error).message);}
  }
  async function upload(){
    if(!file||busy)return;setBusy(true);setError('');
    try{
      await validateDocument(file,options.maxUploadMb);
      const response=await fetch('/api/bpbd/research-statement',{method:'PUT',credentials:'same-origin',headers:{'X-BPBD-Request':'1','X-File-Name':encodeURIComponent(file.name)},body:file});
      if(!response.ok){const body=await response.json() as {error?:string};throw new Error(body.error||'Surat belum tersimpan.');}
      await refresh();setFile(null);toast.success('Surat tersimpan. Pendaftaran menunggu pemeriksaan Admin.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="scope-box" aria-label="Dokumen Surat Pernyataan" style={{overflowWrap:'anywhere'}}>
    <h3>Surat Pernyataan</h3>
    {account.statement?<><p>{account.statement.filename}</p><Action type="button" secondary onClick={open}><Download/>Unduh Surat Pernyataan</Action></>:<p className="small muted">Belum ada surat yang diunggah. Akun lama tetap mengikuti keputusan pendaftaran yang sudah ada.</p>}
    {canUpload&&<div style={{marginTop:16}}><Field label="Unggah ulang Surat Pernyataan" htmlFor="replace-statement" help={`Word (.docx) / PDF, maksimal ${options.maxUploadMb} MB. Surat baru dikirim kembali ke Admin untuk diperiksa.`}><input id="replace-statement" type="file" accept=".docx,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></Field><Action type="button" disabled={busy||!file} onClick={upload}>{busy?'Mengunggah…':'Simpan Surat Pernyataan'}</Action></div>}
    {error&&<Notice kind="danger">{error}</Notice>}
  </section>;
}
