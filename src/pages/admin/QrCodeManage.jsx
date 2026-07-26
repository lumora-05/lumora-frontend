import { useEffect, useState } from 'react';
import { tableApi } from '../../api/tableApi';
import DataTable from '../../components/common/Table';
import { API_BASE_URL } from '../../api/axiosClient';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';

function qrSrc(r){
  const src = r.anhQr || r.qrCodeUrl || r.duongDanQr || r.maQrUrl || r.qrImage || r.qrCode || '';
  if (!src) return '';
  return src.startsWith('http') ? src : `${API_BASE_URL}${src.startsWith('/') ? src : `/${src}`}`;
}
function customerTableKey(row){return row?.qrToken || row?.tokenQr || row?.qrTokenValue || row?.maBan || row?.id}
function customerPath(row){return `/table/${encodeURIComponent(String(customerTableKey(row) ?? ''))}`}
function customerUrl(row){return `${window.location.origin}${customerPath(row)}`}
async function downloadQr(row, toast){
  const src = qrSrc(row);
  if(!src){ toast.error('Bàn này chưa có mã QR. Hãy bấm Tạo lại QR trước.'); return; }
  try{
    const res = await fetch(src);
    if(!res.ok) throw new Error('Không tải được ảnh QR');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (row.tenBan || `ban-${row.maBan}`).toString().trim().replace(/\s+/g,'-').replace(/[\\/:*?"<>|]/g,'');
    a.href = url;
    a.download = `qr-${safeName || row.maBan}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Tải mã QR thành công');
  }catch(e){
    const a = document.createElement('a');
    a.href = src;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    toast.info('Đã mở ảnh QR trong tab mới');
  }
}

export default function QrCodeManage(){
  const toast=useToast();
  const [rows,setRows]=useState([]);
  async function load(){const r=await tableApi.getAll();setRows(r.data||r||[])}
  useEffect(()=>{load()},[]);
  async function generate(id){try{const res=await tableApi.generateQr(id);toast.success(messageOf(res,'Tạo mã QR thành công'));load()}catch(err){toast.error(errorMessageOf(err,'Tạo mã QR thất bại'))}}
  function printQr(row){
    const src=qrSrc(row);
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>QR ${row.tenBan}</title><style>body{font-family:Arial;text-align:center;padding:40px}img{width:260px;height:260px;object-fit:contain}.box{border:1px solid #ddd;border-radius:20px;padding:30px;display:inline-block}</style></head><body><div class="box"><h2>${row.tenBan}</h2>${src?`<img src="${src}"/>`:'<p>Chưa có QR</p>'}<p>${customerUrl(row)}</p></div><script>window.print()</script></body></html>`);
    w.document.close();
  }
  return <section className="page"><div className="panel"><h3>Cấu hình QR Code</h3><p>Tạo, xem, mở link khách hàng và in mã QR cho từng bàn.</p><DataTable data={rows} columns={[
    {key:'tenBan',title:'Bàn'},
    {key:'qr',title:'QR',render:r=>qrSrc(r)?<img className="qr-thumb" src={qrSrc(r)}/>:<span>Chưa tạo</span>},
    {key:'link',title:'Link khách',render:r=><a href={customerPath(r)} target="_blank">{customerUrl(r)}</a>},
    {key:'action',title:'Thao tác',render:r=><div className="row-actions"><button className="btn" onClick={()=>generate(r.maBan)}>Tạo lại QR</button><button className="btn" onClick={()=>printQr(r)}>In QR</button><button className="btn" onClick={()=>downloadQr(r,toast)}>Tải QR</button><a className="btn" href={customerPath(r)} target="_blank">Xem menu</a></div>}
  ]}/></div></section>
}
