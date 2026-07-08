import React, { useState } from 'react';
import { InventoryItem, UserSession } from '../types';
import { Download, Loader2, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const translateOklch = (str: string): string => {
  if (!str || !str.includes('oklch')) return str;
  const oklchRegex = /oklch\(\s*([0-9.%]+)(?:\s+|,\s*)([0-9.%]+)(?:\s+|,\s*)([0-9.deg%]+)(?:\s*[\s/,\s]\s*([0-9.%]+))?\s*\)/gi;
  return str.replace(oklchRegex, (match, lStr, cStr, hStr, aStr) => {
    let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let c = cStr.endsWith('%') ? parseFloat(cStr) / 100 : parseFloat(cStr);
    let h = hStr.endsWith('%') ? parseFloat(hStr) / 100 : (hStr.endsWith('deg') ? parseFloat(hStr) : parseFloat(hStr));
    let a = 1;
    if (aStr) {
      a = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
    }

    if (c < 0.01) {
      const gray = Math.min(255, Math.max(0, Math.round(l * 255)));
      return `rgba(${gray}, ${gray}, ${gray}, ${a})`;
    }

    const hRad = (h * Math.PI) / 180;
    const a_ = c * Math.cos(hRad);
    const b_ = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
    const m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
    const s_ = l - 0.0894841775 * a_ - 1.2914855378 * b_;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const toSRGB = (val: number) => {
      if (val <= 0.0031308) return 12.92 * val;
      return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const r = Math.min(255, Math.max(0, Math.round(toSRGB(rLinear) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(toSRGB(gLinear) * 255)));
    const b = Math.min(255, Math.max(0, Math.round(toSRGB(bLinear) * 255)));

    return `rgba(${r}, ${g}, ${b}, ${a})`;
  });
};

interface PrintReportProps {
  items: InventoryItem[];
  session: UserSession;
  sheetName: string;
  onClose: () => void;
}

export default function PrintReport({ items, session, sheetName, onClose }: PrintReportProps) {
  const [downloading, setDownloading] = useState(false);
  const totalItems = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.jumlah, 0);
  const totalValue = items.reduce((sum, item) => sum + (item.jumlah * item.hargaSatuan), 0);
  const lowStockCount = items.filter(item => item.jumlah <= item.ambangBatas).length;

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-content');
    if (!element) return;
    
    setDownloading(true);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Crisp high-res rendering
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Disable all styles in the cloned document to prevent oklch parsing crashes
          const styleElements = Array.from(clonedDoc.querySelectorAll<HTMLStyleElement>('style'));
          const linkElements = Array.from(clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
          
          styleElements.forEach(el => {
            el.disabled = true;
          });
          linkElements.forEach(el => {
            el.disabled = true;
          });

          // Proxy the cloned document's window getComputedStyle to bypass any oklch color parsing errors
          const clonedWin = clonedDoc.defaultView || window;
          const originalGetComputedStyle = clonedWin.getComputedStyle;
          clonedWin.getComputedStyle = function (el, pseudoElt) {
            const style = originalGetComputedStyle(el, pseudoElt);
            return new Proxy(style, {
              get(target, prop) {
                if (prop === 'getPropertyValue') {
                  return function(propertyName: string) {
                    const val = target.getPropertyValue(propertyName);
                    if (typeof val === 'string' && val.includes('oklch')) {
                      return translateOklch(val);
                    }
                    return val;
                  };
                }
                const val = target[prop as keyof CSSStyleDeclaration];
                if (typeof val === 'string' && val.includes('oklch')) {
                  return translateOklch(val);
                }
                if (typeof val === 'function') {
                  return val.bind(target);
                }
                return val;
              }
            }) as any;
          };

          // Translate any inline style attributes in the cloned document that might contain oklch
          const allClonedElements = clonedDoc.querySelectorAll('*');
          allClonedElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              for (let i = 0; i < htmlEl.style.length; i++) {
                const prop = htmlEl.style[i];
                const val = htmlEl.style.getPropertyValue(prop);
                if (val && val.includes('oklch')) {
                  htmlEl.style.setProperty(prop, translateOklch(val));
                }
              }
            }
          });

          // Inject clean, standard styles for printing inside the cloned document
          const tempStyle = clonedDoc.createElement('style');
          tempStyle.id = 'temp-pdf-styles';
          tempStyle.textContent = `
            #print-content {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              padding: 32px;
              width: 800px;
              margin: 0 auto;
              box-sizing: border-box;
            }
            #print-content .header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            #print-content .header h1 {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              margin: 0 0 8px 0;
              color: #0f172a;
            }
            #print-content .header p {
              font-size: 11px;
              color: #64748b;
              margin: 2px 0;
            }
            #print-content .overview-grid {
              display: flex;
              gap: 16px;
              margin-bottom: 24px;
              width: 100%;
            }
            #print-content .overview-card {
              flex: 1;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
            }
            #print-content .overview-card-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #94a3b8;
              display: block;
              margin-bottom: 4px;
            }
            #print-content .overview-card-value {
              font-size: 18px;
              font-weight: 800;
              color: #1e293b;
            }
            #print-content .overview-card-value.blue {
              color: #1d4ed8;
            }
            #print-content .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              color: #1e293b;
              margin: 0 0 8px 0;
            }
            #print-content table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              table-layout: fixed;
            }
            #print-content th {
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              font-size: 10px;
              font-weight: 700;
              color: #334155;
              text-align: left;
            }
            #print-content td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              font-size: 10px;
              color: #334155;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            #print-content th.col-kode, #print-content td.col-kode { width: 14%; font-family: monospace; }
            #print-content th.col-nama, #print-content td.col-nama { width: 34%; }
            #print-content th.col-jumlah, #print-content td.col-jumlah { width: 12%; text-align: center; }
            #print-content th.col-harga, #print-content td.col-harga { width: 14%; text-align: right; font-family: monospace; }
            #print-content th.col-total, #print-content td.col-total { width: 14%; text-align: right; font-family: monospace; font-weight: bold; }
            #print-content th.col-status, #print-content td.col-status { width: 12%; text-align: center; }
            #print-content .text-center {
              text-align: center;
            }
            #print-content .text-right {
              text-align: right;
            }
            #print-content .font-mono {
              font-family: monospace;
            }
            #print-content .font-bold {
              font-weight: 700;
            }
            #print-content .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
            }
            #print-content .badge-danger {
              background-color: #fee2e2;
              color: #991b1b;
              border: 1px solid #fca5a5;
            }
            #print-content .badge-success {
              background-color: #dbeafe;
              color: #1e40af;
              border: 1px solid #bfdbfe;
            }
            #print-content .warning-box {
              background-color: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 24px;
            }
            #print-content .warning-box-title {
              font-size: 10px;
              font-weight: 700;
              color: #92400e;
              margin: 0 0 4px 0;
            }
            #print-content .warning-box-desc {
              font-size: 9px;
              color: #b45309;
              margin: 0;
              line-height: 1.4;
            }
            #print-content .signatures {
              display: flex;
              gap: 32px;
              margin-top: 40px;
              width: 100%;
            }
            #print-content .signature-col {
              flex: 1;
              text-align: center;
            }
            #print-content .signature-label {
              font-size: 10px;
              color: #64748b;
              margin-bottom: 48px;
            }
            #print-content .signature-name {
              font-size: 11px;
              font-weight: 700;
              color: #334155;
              margin: 0;
            }
            #print-content .signature-role {
              font-size: 9px;
              color: #94a3b8;
              text-transform: uppercase;
              font-weight: 700;
              margin: 2px 0 0 0;
            }
            #print-content .signature-line {
              border-top: 1px dashed #cbd5e1;
              width: 160px;
              margin: 8px auto 0 auto;
            }
          `;
          clonedDoc.head.appendChild(tempStyle);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      const formattedDate = new Date().toISOString().slice(0, 10);
      const cleanSheetName = sheetName.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Laporan_Stok_Inventaris_${cleanSheetName}_${formattedDate}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = () => {
    const d = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 overflow-y-auto flex flex-col items-center p-6 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible print-modal-overlay">
      
      {/* Top Control Bar (Hidden in Print) */}
      <div className="bg-slate-900 text-white w-full max-w-[210mm] rounded-2xl shadow-xl p-4 mb-6 flex items-center justify-between shrink-0 print:hidden z-10">
        <div>
          <h3 className="font-bold text-sm">Pratinjau Laporan Stok</h3>
          <p className="text-[10px] text-slate-400">Pastikan setelan printer sesuai untuk ukuran halaman A4.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="animate-spin w-3.5 h-3.5" />
                Mengunduh PDF...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Unduh Laporan (PDF)
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Manual
          </button>
        </div>
      </div>

      {/* The Printable Page Sheet (A4 Proportion) */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] rounded-xl shadow-2xl border border-slate-200/60 p-[20mm] print:p-0 print:my-0 print:shadow-none print:border-none print:rounded-none flex flex-col justify-between print-modal-content">
        
        {/* PRINT CONTENT AREA */}
        <div className="flex-1 space-y-8" id="print-content">
          {/* Document Header */}
          <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6 header">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
              Laporan Bulanan Stok Inventaris Barang
            </h1>
            <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
              Database: {sheetName} &bull; Periode: {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs text-slate-400">
              Dicetak otomatis dari Sistem Pelacakan Inventaris pada {formatDate()} pukul {new Date().toLocaleTimeString('id-ID')}
            </p>
          </div>

          {/* Quick Overview Bento Grid for Print */}
          <div className="grid grid-cols-4 gap-4 overview-grid">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center overview-card">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block overview-card-label">Jenis Barang</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 block overview-card-value">{totalItems}</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center overview-card">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block overview-card-label">Total Unit Stok</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 block overview-card-value">{totalQty}</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center col-span-2 overview-card">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block overview-card-label">Total Nilai Aset</span>
              <span className="text-xl font-extrabold text-blue-700 mt-1 block overview-card-value blue">{formatRupiah(totalValue)}</span>
            </div>
          </div>

          {/* Detailed Inventory Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide section-title">Rincian Stok Barang</h3>
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-kode">Kode</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-nama">Nama Barang</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-jumlah">Jumlah</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-harga">Harga Satuan</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-total">Total Nilai</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 col-status">Status Stok</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-medium">
                      Tidak ada data barang terdaftar.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isLow = item.jumlah <= item.ambangBatas;
                    const totalVal = item.jumlah * item.hargaSatuan;
                    return (
                      <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-xs font-mono font-bold text-slate-700 border-r border-slate-300 col-kode">{item.kode}</td>
                        <td className="py-2 px-3 text-xs font-semibold text-slate-800 border-r border-slate-300 col-nama">{item.nama}</td>
                        <td className="py-2 px-3 text-xs text-slate-700 border-r border-slate-300 col-jumlah">
                          {item.jumlah}
                          {isLow && <span className="text-[10px] text-red-600 block print:inline print:ml-1">(Min. {item.ambangBatas})</span>}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-700 border-r border-slate-300 col-harga">{formatRupiah(item.hargaSatuan)}</td>
                        <td className="py-2 px-3 text-xs text-slate-700 border-r border-slate-300 col-total">{formatRupiah(totalVal)}</td>
                        <td className="py-2 px-3 text-xs col-status">
                          {isLow ? (
                            <span className="text-red-700 bg-red-100/50 px-2 py-0.5 rounded-md text-[10px] uppercase border border-red-200 badge badge-danger">
                              Stok Menipis
                            </span>
                          ) : (
                            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[10px] uppercase border border-blue-200 badge badge-success">
                              Aman
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Low Stock Items Detailed Warnings */}
          {lowStockCount > 0 && (
            <div className="p-4 border border-red-200 bg-red-50/20 rounded-xl space-y-1 page-break-avoid warning-box">
              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide flex items-center space-x-1 warning-box-title">
                <span>⚠️ Perhatian: Terdapat {lowStockCount} Barang Membutuhkan Re-Stock Segera</span>
              </h4>
              <p className="text-[10px] text-red-700 leading-relaxed warning-box-desc">
                Barang-barang di atas telah mencapai atau berada di bawah ambang batas minimum yang dikonfigurasi. Disarankan untuk segera melakukan pemesanan ulang (re-order) stok baru ke pemasok demi menjaga kontinuitas operasional gudang.
              </p>
            </div>
          )}

          {/* Signatures Area */}
          <div className="grid grid-cols-2 gap-8 pt-12 page-break-avoid signatures">
            <div className="text-center space-y-16 signature-col">
              <div>
                <p className="text-xs text-slate-400 font-medium signature-label">Dibuat & Diverifikasi Oleh,</p>
                <p className="text-xs font-bold text-slate-700 mt-1 signature-name">{session.displayName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider signature-role">Peran: {session.role}</p>
              </div>
              <div className="border-t border-dashed border-slate-300 w-48 mx-auto signature-line"></div>
            </div>
            
            <div className="text-center space-y-16 signature-col">
              <div>
                <p className="text-xs text-slate-400 font-medium font-bold signature-label">Disetujui Oleh,</p>
                <p className="text-xs font-bold text-slate-700 mt-1 signature-name">Pimpinan Operasional</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider signature-role">Manager Logistik</p>
              </div>
              <div className="border-t border-dashed border-slate-300 w-48 mx-auto signature-line"></div>
            </div>
          </div>
        </div>

        {/* CSS styles to force page settings during printing */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* Override and unlock parent layouts for clean multi-page flow */
            html, body, #root, .flex.h-screen.w-screen {
              height: auto !important;
              width: auto !important;
              overflow: visible !important;
              position: static !important;
              display: block !important;
              background: white !important;
            }

            /* Hide everything that is NOT part of the PrintReport modal view */
            aside, main, .print-hidden, button, .no-print {
              display: none !important;
            }

            /* Force standard page-aligned printable styles on the modal overlays */
            .print-modal-overlay {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 100% !important;
              overflow: visible !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              z-index: 999999 !important;
              display: block !important;
            }

            .print-modal-content {
              background: white !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              display: block !important;
            }

            #print-content {
              display: block !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }

            .page-break-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}} />
      </div>
    </div>
  );
}
