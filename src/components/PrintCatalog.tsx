import React, { useState } from 'react';
import { CatalogItem, UserSession } from '../types';
import { Download, Loader2, Printer, Image as ImageIcon } from 'lucide-react';
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

interface PrintCatalogProps {
  items: CatalogItem[];
  session: UserSession;
  sheetName: string;
  onClose: () => void;
}

export default function PrintCatalog({ items, session, sheetName, onClose }: PrintCatalogProps) {
  const [downloading, setDownloading] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [corsFailed, setCorsFailed] = useState<Record<string, boolean>>({});

  const totalItems = items.length;
  const uniqueCategories = new Set(items.map(i => i.kategori).filter(Boolean)).size;

  const getImageUrl = (url: string | undefined | null, useCdn = true): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    const driveRegExp = /(?:drive\.google\.com\/(?:uc\?export=view&id=|file\/d\/|open\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]{25,})/;
    const match = trimmed.match(driveRegExp);
    if (match && match[1]) {
      const fileId = match[1];
      if (useCdn) {
        // Use direct CDN endpoint which supports CORS headers
        return `https://lh3.googleusercontent.com/d/${fileId}`;
      } else {
        // Fallback to high-resolution thumbnail endpoint (does not require CORS)
        return `https://drive.google.com/thumbnail?sz=w600&id=${fileId}`;
      }
    }
    return trimmed;
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-catalog-content');
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
            #print-catalog-content {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              padding: 32px;
              width: 800px;
              margin: 0 auto;
              box-sizing: border-box;
            }
            #print-catalog-content .header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            #print-catalog-content .header h1 {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              margin: 0 0 8px 0;
              color: #0f172a;
            }
            #print-catalog-content .header p {
              font-size: 11px;
              color: #64748b;
              margin: 2px 0;
            }
            #print-catalog-content .overview-grid {
              display: flex;
              gap: 16px;
              margin-bottom: 24px;
              width: 100%;
            }
            #print-catalog-content .overview-card {
              flex: 1;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
            }
            #print-catalog-content .overview-card-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #94a3b8;
              display: block;
              margin-bottom: 4px;
            }
            #print-catalog-content .overview-card-value {
              font-size: 18px;
              font-weight: 800;
              color: #1e293b;
            }
            #print-catalog-content table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              table-layout: fixed;
            }
            #print-catalog-content th {
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 10px 12px;
              font-size: 10px;
              font-weight: bold;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            #print-catalog-content td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              font-size: 10px;
              color: #334155;
              word-wrap: break-word;
              overflow-wrap: break-word;
              vertical-align: middle;
            }
            #print-catalog-content th.col-no, #print-catalog-content td.col-no { width: 6%; text-align: center; }
            #print-catalog-content th.col-gambar, #print-catalog-content td.col-gambar { width: 14%; text-align: center; }
            #print-catalog-content th.col-kode, #print-catalog-content td.col-kode { width: 15%; font-family: monospace; }
            #print-catalog-content th.col-nama, #print-catalog-content td.col-nama { width: 33%; }
            #print-catalog-content th.col-kategori, #print-catalog-content td.col-kategori { width: 16%; }
            #print-catalog-content th.col-harga, #print-catalog-content td.col-harga { width: 16%; text-align: right; font-family: monospace; font-weight: bold; }
            
            #print-catalog-content .text-center {
              text-align: center;
            }
            #print-catalog-content .text-right {
              text-align: right;
            }
            #print-catalog-content .image-preview-box {
              width: 48px;
              height: 48px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
              overflow: hidden;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background-color: #f8fafc;
            }
            #print-catalog-content .image-preview-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            #print-catalog-content .badge-kategori {
              display: inline-block;
              background-color: #f1f5f9;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 9px;
              font-weight: bold;
              text-transform: uppercase;
              color: #475569;
            }
            #print-catalog-content .footer-info {
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              margin-top: 32px;
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
      pdf.save(`Katalog_Produk_${formattedDate}.pdf`);
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
          <h3 className="font-bold text-sm">Pratinjau Cetak Katalog</h3>
          <p className="text-[10px] text-slate-400">Pastikan foto produk terunduh sempurna sebelum mengeklik cetak.</p>
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
                Unduh Katalog (PDF)
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
        <div className="flex-1 space-y-8" id="print-catalog-content">
          {/* Document Header */}
          <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6 header">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
              Katalog Produk Penjualan Resmi
            </h1>
            <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
              Database: {sheetName} &bull; Klasifikasi: {uniqueCategories} Kategori Utama
            </p>
            <p className="text-xs text-slate-400">
              Dicetak otomatis dari Sistem Pelacakan Inventaris pada {formatDate()} pukul {new Date().toLocaleTimeString('id-ID')}
            </p>
          </div>

          {/* Quick Overview Bento Grid for Print */}
          <div className="grid grid-cols-2 gap-4 overview-grid">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center overview-card">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block overview-card-label">Jumlah Produk Terdaftar</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 block overview-card-value">{totalItems}</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center overview-card">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block overview-card-label">Kategori Utama</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 block overview-card-value">{uniqueCategories}</span>
            </div>
          </div>

          {/* Detailed Catalog Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide section-title">Daftar Produk Jualan</h3>
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-no">No</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-gambar">Gambar</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-kode">Kode Barang</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-nama">Nama Barang</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-kategori">Kategori</th>
                  <th className="py-2.5 px-3 text-xs font-bold text-slate-700 col-harga text-right">Harga Standar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const hasCorsFailed = corsFailed[item.kode];
                  const imageSrc = getImageUrl(item.foto, !hasCorsFailed);
                  const isImageFailed = failedImages[item.kode];

                  return (
                    <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-xs font-bold text-slate-700 border-r border-slate-300 col-no text-center">{idx + 1}</td>
                      <td className="py-2 px-3 text-xs text-slate-700 border-r border-slate-300 col-gambar text-center">
                        <div className="image-preview-box w-12 h-12 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 mx-auto">
                          {imageSrc && !isImageFailed ? (
                            <img
                              src={imageSrc}
                              alt={item.nama}
                              referrerPolicy="no-referrer"
                              crossOrigin={hasCorsFailed ? undefined : "anonymous"}
                              className="w-full h-full object-cover"
                              onError={() => {
                                if (!hasCorsFailed) {
                                  // First attempt failed (typically CORS restriction on the CDN URL).
                                  // Fall back to standard Google Drive thumbnail without crossOrigin.
                                  setCorsFailed(prev => ({ ...prev, [item.kode]: true }));
                                } else {
                                  // Second attempt also failed, show fallback icon.
                                  setFailedImages(prev => ({ ...prev, [item.kode]: true }));
                                }
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono font-bold text-slate-700 border-r border-slate-300 col-kode">{item.kode}</td>
                      <td className="py-2 px-3 text-xs font-semibold text-slate-800 border-r border-slate-300 col-nama">{item.nama}</td>
                      <td className="py-2 px-3 text-xs text-slate-700 border-r border-slate-300 col-kategori">
                        <span className="badge-kategori">{item.kategori || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-800 col-harga text-right font-bold font-mono">{formatRupiah(item.harga)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Area */}
        <div className="pt-12 text-center text-[10px] text-slate-400 border-t border-slate-100 mt-16 flex justify-between px-2 print:border-none print:mt-12 footer-info">
          <span>Katalog Produk Resmi &bull; Database: {sheetName}</span>
          <span>Dicetak oleh: {session.displayName}</span>
        </div>

      </div>
    </div>
  );
}
