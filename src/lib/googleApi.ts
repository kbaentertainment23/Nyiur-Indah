import { 
  InventoryItem, 
  SpreadsheetInfo, 
  SalesTransaction, 
  PreOrder, 
  CatalogItem, 
  ConsignmentRecord, 
  ConsignmentItem, 
  ActivityLog, 
  Karyawan, 
  Absensi, 
  ProduksiBorongan, 
  Pinjaman, 
  GajiPembayaran, 
  KaryawanKategori, 
  ProdukBorongan 
} from '../types';

// ==============================================================================
// CONFIGURATION AND UTILITIES FOR APPS SCRIPT WEB APP
// ==============================================================================

/**
 * Get Google Apps Script Web App URL from localStorage or environment variable
 */
export function getAppsScriptUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzsSox4dab4AKDKiSuuhUnfjsXBpf_n9JUsqOrU59riQZnmaWtWE3OyUJctg4hJXAIF/exec';
  const localUrl = localStorage.getItem('apps_script_url');
  return localUrl || envUrl || '';
}

/**
 * Set Google Apps Script Web App URL to localStorage
 */
export function setAppsScriptUrl(url: string): void {
  if (url) {
    localStorage.setItem('apps_script_url', url.trim());
  } else {
    localStorage.removeItem('apps_script_url');
  }
}

// Global cached variables to optimize batch-loading and prevent double fetches
let appsScriptCache: any = null;
let appsScriptCachePromise: Promise<any> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3000; // 3 seconds cache to bundle parallel requests on Dashboard mount

/**
 * Fetch all sheets data from Apps Script at once to minimize round trips
 */
async function fetchAllFromAppsScript(force = false): Promise<any> {
  const url = getAppsScriptUrl();
  if (!url) {
    throw new Error('Google Apps Script URL belum dikonfigurasi.');
  }

  const now = Date.now();
  if (!force && appsScriptCache && (now - cacheTimestamp < CACHE_TTL)) {
    return appsScriptCache;
  }

  if (appsScriptCachePromise) {
    return appsScriptCachePromise;
  }

  appsScriptCachePromise = (async () => {
    try {
      const response = await fetch(`${url}?action=readAll`);
      if (!response.ok) {
        throw new Error(`Koneksi gagal: HTTP ${response.status}`);
      }
      const res = await response.json();
      if (!res.success) {
        throw new Error(res.error || 'Aplikasi Web Google Apps Script gagal membaca data');
      }
      
      const db = res.db || {};
      appsScriptCache = db;
      cacheTimestamp = Date.now();
      return db;
    } catch (err: any) {
      console.error('Error fetching from Apps Script:', err);
      throw err;
    } finally {
      appsScriptCachePromise = null;
    }
  })();

  return appsScriptCachePromise;
}

/**
 * Save values of a specific sheet to Apps Script Web App
 */
async function saveToAppsScript(sheetName: string, values: any[][]): Promise<void> {
  const url = getAppsScriptUrl();
  if (!url) return; // If offline/local fallback mode, only local storage is updated

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // Safer to bypass CORS preflight issues in Google Apps Script
      },
      body: JSON.stringify({
        action: 'saveSheet',
        sheetName,
        values
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const res = await response.json();
    if (!res.success) {
      throw new Error(res.error || 'Apps Script gagal menyimpan data.');
    }

    // Invalidate local in-memory cache to force refresh on next read
    appsScriptCache = null;
  } catch (err: any) {
    console.error(`Gagal menyimpan sheet ${sheetName} ke Apps Script:`, err);
    throw err;
  }
}

// ==============================================================================
// PARSERS FOR EACH SHEET (MAINTAINING PARSING ROBUSTNESS OF ORIGINAL CODE)
// ==============================================================================

const getVal = (row: any[], index: number, fallback: any = '') => {
  if (index === -1 || index >= row.length) return fallback;
  return row[index] !== undefined && row[index] !== null ? row[index] : fallback;
};

function parseInventaris(rows: any[][]): InventoryItem[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    kode: headers.indexOf('kode'),
    nama: headers.indexOf('nama'),
    jumlah: headers.indexOf('jumlah'),
    harga: headers.indexOf('harga satuan') !== -1 ? headers.indexOf('harga satuan') : headers.indexOf('harga'),
    foto: headers.indexOf('foto barang') !== -1 ? headers.indexOf('foto barang') : headers.indexOf('foto'),
    ambang: headers.indexOf('ambang batas') !== -1 ? headers.indexOf('ambang batas') : headers.indexOf('ambang'),
    kategori: headers.indexOf('kategori')
  };

  const list: InventoryItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const kode = String(getVal(row, colIdx.kode, '')).trim();
    const nama = String(getVal(row, colIdx.nama, '')).trim();
    if (!kode && !nama) continue;

    list.push({
      kode,
      nama,
      jumlah: Number(getVal(row, colIdx.jumlah, 0)) || 0,
      hargaSatuan: Number(getVal(row, colIdx.harga, 0)) || 0,
      fotoBarang: String(getVal(row, colIdx.foto, '')).trim(),
      ambangBatas: Number(getVal(row, colIdx.ambang, 5)) || 0,
      kategori: String(getVal(row, colIdx.kategori, '')).trim()
    });
  }
  return list;
}

function parsePenjualan(rows: any[][]): SalesTransaction[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggal: headers.indexOf('tanggal'),
    kodeBarang: headers.indexOf('kode barang') !== -1 ? headers.indexOf('kode barang') : headers.indexOf('kode'),
    namaBarang: headers.indexOf('nama barang') !== -1 ? headers.indexOf('nama barang') : headers.indexOf('nama'),
    jumlah: headers.indexOf('jumlah'),
    hargaSatuan: headers.indexOf('harga satuan') !== -1 ? headers.indexOf('harga satuan') : headers.indexOf('harga'),
    total: headers.indexOf('total')
  };

  const list: SalesTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const kodeBarang = String(getVal(row, colIdx.kodeBarang, '')).trim();
    if (!id && !kodeBarang) continue;

    list.push({
      id,
      tanggal: String(getVal(row, colIdx.tanggal, '')).trim(),
      kodeBarang,
      namaBarang: String(getVal(row, colIdx.namaBarang, '')).trim(),
      jumlah: Number(getVal(row, colIdx.jumlah, 0)) || 0,
      hargaSatuan: Number(getVal(row, colIdx.hargaSatuan, 0)) || 0,
      total: Number(getVal(row, colIdx.total, 0)) || 0
    });
  }
  return list;
}

function parsePreOrder(rows: any[][]): PreOrder[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggalPemesanan: headers.indexOf('tanggal pemesanan') !== -1 ? headers.indexOf('tanggal pemesanan') : headers.indexOf('tanggal_pemesanan'),
    namaPengepul: headers.indexOf('nama pengepul') !== -1 ? headers.indexOf('nama pengepul') : headers.indexOf('nama_pengepul'),
    kontakPengepul: headers.indexOf('kontak pengepul') !== -1 ? headers.indexOf('kontak pengepul') : headers.indexOf('kontak_pengepul'),
    pesananDetail: headers.indexOf('pesanan detail') !== -1 ? headers.indexOf('pesanan detail') : headers.indexOf('pesanan_detail'),
    tanggalTargetSelesai: headers.indexOf('tanggal target selesai') !== -1 ? headers.indexOf('tanggal target selesai') : headers.indexOf('tanggal_target_selesai'),
    status: headers.indexOf('status'),
    totalBiaya: headers.indexOf('total biaya') !== -1 ? headers.indexOf('total biaya') : headers.indexOf('total_biaya'),
    nominalDp: headers.indexOf('nominal dp') !== -1 ? headers.indexOf('nominal dp') : headers.indexOf('nominal_dp'),
    sisaPembayaran: headers.indexOf('sisa pembayaran') !== -1 ? headers.indexOf('sisa pembayaran') : headers.indexOf('sisa_pembayaran'),
    tipeOrder: headers.indexOf('tipe order') !== -1 ? headers.indexOf('tipe order') : (headers.indexOf('tipe_order') !== -1 ? headers.indexOf('tipe_order') : headers.indexOf('is_reseller')),
    isiNama: headers.indexOf('isi nama') !== -1 ? headers.indexOf('isi nama') : headers.indexOf('isi_nama'),
    namaCustom: headers.indexOf('nama custom') !== -1 ? headers.indexOf('nama custom') : headers.indexOf('nama_custom')
  };

  const list: PreOrder[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const namaPengepul = String(getVal(row, colIdx.namaPengepul, '')).trim();
    if (!id && !namaPengepul) continue;

    const statusVal = String(getVal(row, colIdx.status, 'antrean')).toLowerCase().trim();
    let status: 'antrean' | 'proses' | 'siap' | 'selesai' | 'dibatalkan' = 'antrean';
    if (['antrean', 'proses', 'siap', 'selesai', 'dibatalkan'].includes(statusVal)) {
      status = statusVal as any;
    }

    const typeVal = String(getVal(row, colIdx.tipeOrder, 'Standard')).trim();
    let tipeOrder: 'Standard' | 'Reseller' = 'Standard';
    if (typeVal.toLowerCase() === 'reseller' || typeVal.toLowerCase() === 'true') {
      tipeOrder = 'Reseller';
    }

    const isiNamaVal = String(getVal(row, colIdx.isiNama, 'Tidak')).toLowerCase().trim();
    const isiNama = isiNamaVal === 'ya' || isiNamaVal === 'true';

    list.push({
      id,
      tanggalPemesanan: String(getVal(row, colIdx.tanggalPemesanan, '')).trim(),
      namaPengepul,
      kontakPengepul: String(getVal(row, colIdx.kontakPengepul, '')).trim(),
      pesananDetail: String(getVal(row, colIdx.pesananDetail, '')).trim(),
      tanggalTargetSelesai: String(getVal(row, colIdx.tanggalTargetSelesai, '')).trim(),
      status,
      totalBiaya: Number(getVal(row, colIdx.totalBiaya, 0)) || 0,
      nominalDp: Number(getVal(row, colIdx.nominalDp, 0)) || 0,
      sisaPembayaran: Number(getVal(row, colIdx.sisaPembayaran, 0)) || 0,
      tipeOrder,
      isiNama,
      namaCustom: String(getVal(row, colIdx.namaCustom, '')).trim()
    });
  }
  return list;
}

function parseKatalog(rows: any[][]): CatalogItem[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    kode: headers.indexOf('kode'),
    nama: headers.indexOf('nama'),
    kategori: headers.indexOf('kategori'),
    harga: headers.indexOf('harga'),
    foto: headers.indexOf('foto'),
    hargaReseller: headers.indexOf('harga reseller') !== -1 ? headers.indexOf('harga reseller') : headers.indexOf('harga_reseller'),
    jenis: headers.indexOf('jenis'),
    motif: headers.indexOf('motif'),
    warna: headers.indexOf('warna'),
    ukuran: headers.indexOf('ukuran'),
    ukuran2: headers.indexOf('ukuran 2') !== -1 ? headers.indexOf('ukuran 2') : headers.indexOf('ukuran2'),
    harga2: headers.indexOf('harga 2') !== -1 ? headers.indexOf('harga 2') : headers.indexOf('harga2'),
    hargaReseller2: headers.indexOf('harga reseller 2') !== -1 ? headers.indexOf('harga reseller 2') : headers.indexOf('harga_reseller2'),
    ukuran3: headers.indexOf('ukuran 3') !== -1 ? headers.indexOf('ukuran 3') : headers.indexOf('ukuran3'),
    harga3: headers.indexOf('harga 3') !== -1 ? headers.indexOf('harga 3') : headers.indexOf('harga3'),
    hargaReseller3: headers.indexOf('harga reseller 3') !== -1 ? headers.indexOf('harga reseller 3') : headers.indexOf('harga_reseller3'),
    nilaiBorongan: headers.indexOf('nilai borongan') !== -1 ? headers.indexOf('nilai borongan') : headers.indexOf('nilai_borongan')
  };

  const list: CatalogItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const kode = String(getVal(row, colIdx.kode, '')).trim();
    const nama = String(getVal(row, colIdx.nama, '')).trim();
    if (!kode && !nama) continue;

    list.push({
      kode,
      nama,
      kategori: String(getVal(row, colIdx.kategori, '')).trim(),
      harga: Number(getVal(row, colIdx.harga, 0)) || 0,
      foto: String(getVal(row, colIdx.foto, '')).trim(),
      hargaReseller: Number(getVal(row, colIdx.hargaReseller, 0)) || 0,
      jenis: String(getVal(row, colIdx.jenis, '')).trim(),
      motif: String(getVal(row, colIdx.motif, '')).trim(),
      warna: String(getVal(row, colIdx.warna, '')).trim(),
      ukuran: String(getVal(row, colIdx.ukuran, '')).trim(),
      ukuran2: colIdx.ukuran2 !== -1 ? String(getVal(row, colIdx.ukuran2, '')) || undefined : undefined,
      harga2: colIdx.harga2 !== -1 ? Number(getVal(row, colIdx.harga2, 0)) || undefined : undefined,
      hargaReseller2: colIdx.hargaReseller2 !== -1 ? Number(getVal(row, colIdx.hargaReseller2, 0)) || undefined : undefined,
      ukuran3: colIdx.ukuran3 !== -1 ? String(getVal(row, colIdx.ukuran3, '')) || undefined : undefined,
      harga3: colIdx.harga3 !== -1 ? Number(getVal(row, colIdx.harga3, 0)) || undefined : undefined,
      hargaReseller3: colIdx.hargaReseller3 !== -1 ? Number(getVal(row, colIdx.hargaReseller3, 0)) || undefined : undefined,
      nilaiBorongan: colIdx.nilaiBorongan !== -1 ? Number(getVal(row, colIdx.nilaiBorongan, 0)) || 0 : 0
    });
  }
  return list;
}

function parseConsignment(rows: any[][]): ConsignmentRecord[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggalAmbil: headers.indexOf('tanggal ambil'),
    tanggalSelesai: headers.indexOf('tanggal selesai'),
    namaMitra: headers.indexOf('nama mitra'),
    kontakMitra: headers.indexOf('kontak mitra'),
    detailBarang: headers.indexOf('detail barang'),
    status: headers.indexOf('status'),
    totalNilaiAmbil: headers.indexOf('total nilai ambil'),
    totalNilaiLaku: headers.indexOf('total nilai laku'),
    catatan: headers.indexOf('catatan')
  };

  const list: ConsignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const namaMitra = String(getVal(row, colIdx.namaMitra, '')).trim();
    if (!id && !namaMitra) continue;

    const detailStr = String(getVal(row, colIdx.detailBarang, '[]'));
    let itemsList: ConsignmentItem[] = [];
    try {
      itemsList = JSON.parse(detailStr);
    } catch (e) {
      console.warn('Gagal memproses JSON Detail Barang', detailStr, e);
    }

    const statusVal = String(getVal(row, colIdx.status, 'aktif')).toLowerCase().trim();
    let status: 'aktif' | 'selesai' | 'dibatalkan' = 'aktif';
    if (['aktif', 'selesai', 'dibatalkan'].includes(statusVal)) {
      status = statusVal as any;
    }

    list.push({
      id,
      tanggalAmbil: String(getVal(row, colIdx.tanggalAmbil, '')).trim(),
      tanggalSelesai: String(getVal(row, colIdx.tanggalSelesai, '')) || undefined,
      namaMitra,
      kontakMitra: String(getVal(row, colIdx.kontakMitra, '')).trim(),
      items: itemsList,
      status,
      totalNilaiAmbil: Number(getVal(row, colIdx.totalNilaiAmbil, 0)) || 0,
      totalNilaiLaku: Number(getVal(row, colIdx.totalNilaiLaku, 0)) || 0,
      catatan: String(getVal(row, colIdx.catatan, '')).trim()
    });
  }
  return list;
}

function parseActivityLogs(rows: any[][]): ActivityLog[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    timestamp: headers.indexOf('timestamp'),
    operator: headers.indexOf('operator'),
    aksi: headers.indexOf('aksi'),
    detail: headers.indexOf('detail')
  };

  const list: ActivityLog[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const aksi = String(getVal(row, colIdx.aksi, '')).trim();
    if (!id && !aksi) continue;

    list.push({
      id,
      timestamp: String(getVal(row, colIdx.timestamp, '')).trim(),
      operator: String(getVal(row, colIdx.operator, '')).trim(),
      aksi,
      detail: String(getVal(row, colIdx.detail, '')).trim()
    });
  }
  return list;
}

function parseSimpleList(rows: any[][]): string[] {
  if (!rows || rows.length <= 1) return [];
  const list: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] !== undefined && row[0] !== null) {
      const val = String(row[0]).trim();
      if (val) list.push(val);
    }
  }
  return list;
}

function parseKaryawan(rows: any[][]): Karyawan[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    nama: headers.indexOf('nama'),
    kategori: headers.indexOf('kategori'),
    gajiHarian: headers.indexOf('gaji harian') !== -1 ? headers.indexOf('gaji harian') : headers.indexOf('gaji_harian'),
    tanggalMasuk: headers.indexOf('tanggal masuk') !== -1 ? headers.indexOf('tanggal masuk') : headers.indexOf('tanggal_masuk'),
    statusAktif: headers.indexOf('status aktif') !== -1 ? headers.indexOf('status aktif') : headers.indexOf('status_aktif'),
  };

  const list: Karyawan[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const nama = String(getVal(row, colIdx.nama, '')).trim();
    if (!id || !nama) continue;

    const savedRole = String(getVal(row, colIdx.kategori, 'Harian')) as KaryawanKategori;
    const statusVal = String(getVal(row, colIdx.statusAktif, 'true')).toLowerCase().trim();
    const statusAktif = statusVal === 'true' || statusVal === 'aktif' || statusVal === '1';

    list.push({
      id,
      nama,
      kategori: savedRole,
      gajiHarian: Number(getVal(row, colIdx.gajiHarian, 0)) || 0,
      tanggalMasuk: String(getVal(row, colIdx.tanggalMasuk, '')).trim(),
      statusAktif
    });
  }
  return list;
}

function parseAbsensi(rows: any[][]): Absensi[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggal: headers.indexOf('tanggal'),
    idKaryawan: headers.indexOf('id karyawan') !== -1 ? headers.indexOf('id karyawan') : headers.indexOf('id_karyawan'),
    namaKaryawan: headers.indexOf('nama karyawan') !== -1 ? headers.indexOf('nama karyawan') : headers.indexOf('nama_karyawan'),
    statusKerja: headers.indexOf('status kerja') !== -1 ? headers.indexOf('status kerja') : headers.indexOf('status_kerja'),
    keterangan: headers.indexOf('keterangan')
  };

  const list: Absensi[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const tanggal = String(getVal(row, colIdx.tanggal, '')).trim();
    const idKaryawan = String(getVal(row, colIdx.idKaryawan, '')).trim();
    if (!id || !tanggal || !idKaryawan) continue;

    list.push({
      id,
      tanggal,
      idKaryawan,
      namaKaryawan: String(getVal(row, colIdx.namaKaryawan, '')).trim(),
      statusKerja: String(getVal(row, colIdx.statusKerja, 'Hadir')) as any,
      keterangan: String(getVal(row, colIdx.keterangan, '')).trim()
    });
  }
  return list;
}

function parseProduksiBorongan(rows: any[][]): ProduksiBorongan[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggal: headers.indexOf('tanggal'),
    idKaryawan: headers.indexOf('id karyawan') !== -1 ? headers.indexOf('id karyawan') : headers.indexOf('id_karyawan'),
    namaKaryawan: headers.indexOf('nama karyawan') !== -1 ? headers.indexOf('nama karyawan') : headers.indexOf('nama_karyawan'),
    kodeProduk: headers.indexOf('kode produk') !== -1 ? headers.indexOf('kode produk') : headers.indexOf('kode_produk'),
    namaProduk: headers.indexOf('nama produk') !== -1 ? headers.indexOf('nama produk') : headers.indexOf('nama_produk'),
    jumlah: headers.indexOf('jumlah'),
    nilaiPerPcs: headers.indexOf('nilai per pcs') !== -1 ? headers.indexOf('nilai per pcs') : headers.indexOf('nilai_per_pcs'),
    totalNilai: headers.indexOf('total nilai') !== -1 ? headers.indexOf('total nilai') : headers.indexOf('total_nilai')
  };

  const list: ProduksiBorongan[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const tanggal = String(getVal(row, colIdx.tanggal, '')).trim();
    const idKaryawan = String(getVal(row, colIdx.idKaryawan, '')).trim();
    if (!id || !tanggal || !idKaryawan) continue;

    list.push({
      id,
      tanggal,
      idKaryawan,
      namaKaryawan: String(getVal(row, colIdx.namaKaryawan, '')).trim(),
      kodeProduk: String(getVal(row, colIdx.kodeProduk, '')).trim(),
      namaProduk: String(getVal(row, colIdx.namaProduk, '')).trim(),
      jumlah: Number(getVal(row, colIdx.jumlah, 0)) || 0,
      nilaiPerPcs: Number(getVal(row, colIdx.nilaiPerPcs, 0)) || 0,
      totalNilai: Number(getVal(row, colIdx.totalNilai, 0)) || 0
    });
  }
  return list;
}

function parsePinjaman(rows: any[][]): Pinjaman[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggal: headers.indexOf('tanggal'),
    idKaryawan: headers.indexOf('id karyawan') !== -1 ? headers.indexOf('id karyawan') : headers.indexOf('id_karyawan'),
    namaKaryawan: headers.indexOf('nama karyawan') !== -1 ? headers.indexOf('nama karyawan') : headers.indexOf('nama_karyawan'),
    jumlahPinjaman: headers.indexOf('jumlah pinjaman') !== -1 ? headers.indexOf('jumlah pinjaman') : headers.indexOf('jumlah_pinjaman'),
    status: headers.indexOf('status'),
    catatan: headers.indexOf('catatan')
  };

  const list: Pinjaman[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const idKaryawan = String(getVal(row, colIdx.idKaryawan, '')).trim();
    if (!id || !idKaryawan) continue;

    list.push({
      id,
      tanggal: String(getVal(row, colIdx.tanggal, '')).trim(),
      idKaryawan,
      namaKaryawan: String(getVal(row, colIdx.namaKaryawan, '')).trim(),
      jumlahPinjaman: Number(getVal(row, colIdx.jumlahPinjaman, 0)) || 0,
      status: String(getVal(row, colIdx.status, 'Belum Lunas')) as any,
      catatan: String(getVal(row, colIdx.catatan, '')).trim()
    });
  }
  return list;
}

function parseGajiPembayaran(rows: any[][]): GajiPembayaran[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    tanggalGajian: headers.indexOf('tanggal gajian') !== -1 ? headers.indexOf('tanggal gajian') : headers.indexOf('tanggal_gajian'),
    bulanTahun: headers.indexOf('bulan tahun') !== -1 ? headers.indexOf('bulan tahun') : headers.indexOf('bulan_tahun'),
    idKaryawan: headers.indexOf('id karyawan') !== -1 ? headers.indexOf('id karyawan') : headers.indexOf('id_karyawan'),
    namaKaryawan: headers.indexOf('nama karyawan') !== -1 ? headers.indexOf('nama karyawan') : headers.indexOf('nama_karyawan'),
    kategori: headers.indexOf('kategori'),
    totalHariKerja: headers.indexOf('total hari kerja') !== -1 ? headers.indexOf('total hari kerja') : headers.indexOf('total_hari_kerja'),
    gajiHarianRate: headers.indexOf('gaji harian rate') !== -1 ? headers.indexOf('gaji harian rate') : headers.indexOf('gaji_harian_rate'),
    gajiPokok: headers.indexOf('gaji pokok') !== -1 ? headers.indexOf('gaji pokok') : headers.indexOf('gaji_pokok'),
    totalBorongan: headers.indexOf('total borongan') !== -1 ? headers.indexOf('total borongan') : headers.indexOf('total_borongan'),
    potonganPinjaman: headers.indexOf('potongan pinjaman') !== -1 ? headers.indexOf('potongan pinjaman') : headers.indexOf('potongan_pinjaman'),
    totalBersih: headers.indexOf('total bersih') !== -1 ? headers.indexOf('total bersih') : headers.indexOf('total_bersih'),
    catatan: headers.indexOf('catatan')
  };

  const list: GajiPembayaran[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const idKaryawan = String(getVal(row, colIdx.idKaryawan, '')).trim();
    if (!id || !idKaryawan) continue;

    list.push({
      id,
      tanggalGajian: String(getVal(row, colIdx.tanggalGajian, '')).trim(),
      bulanTahun: String(getVal(row, colIdx.bulanTahun, '')).trim(),
      idKaryawan,
      namaKaryawan: String(getVal(row, colIdx.namaKaryawan, '')).trim(),
      kategori: String(getVal(row, colIdx.kategori, 'Harian')) as KaryawanKategori,
      totalHariKerja: Number(getVal(row, colIdx.totalHariKerja, 0)) || 0,
      gajiHarianRate: Number(getVal(row, colIdx.gajiHarianRate, 0)) || 0,
      gajiPokok: Number(getVal(row, colIdx.gajiPokok, 0)) || 0,
      totalBorongan: Number(getVal(row, colIdx.totalBorongan, 0)) || 0,
      potonganPinjaman: Number(getVal(row, colIdx.potonganPinjaman, 0)) || 0,
      totalBersih: Number(getVal(row, colIdx.totalBersih, 0)) || 0,
      catatan: String(getVal(row, colIdx.catatan, '')).trim()
    });
  }
  return list;
}

function parseProdukBorongan(rows: any[][]): ProdukBorongan[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const colIdx = {
    id: headers.indexOf('id'),
    nama: headers.indexOf('nama'),
    nilaiPerPcs: headers.indexOf('nilai per pcs') !== -1 ? headers.indexOf('nilai per pcs') : headers.indexOf('nilai_per_pcs')
  };

  const list: ProdukBorongan[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const id = String(getVal(row, colIdx.id, '')).trim();
    const nama = String(getVal(row, colIdx.nama, '')).trim();
    if (!id || !nama) continue;

    list.push({
      id,
      nama,
      nilaiPerPcs: Number(getVal(row, colIdx.nilaiPerPcs, 0)) || 0
    });
  }
  return list;
}

// ==============================================================================
// EXPORTED CORE API FUNCTIONS (PRESERVING ALL SIGNATURES PERFECTLY)
// ==============================================================================

export async function getSpreadsheetSheetTitles(token: string, spreadsheetId: string): Promise<string[]> {
  return [
    'Sheet1', 'Penjualan', 'PreOrder', 'Katalog', 'TitipJual', 'LogAktivitas',
    'Kategori', 'Jenis', 'Motif', 'Warna', 'Ukuran', 'Karyawan', 'Absensi',
    'ProduksiBorongan', 'Pinjaman', 'GajiPembayaran', 'ProdukBorongan'
  ];
}

export async function getActualSheetName(
  token: string,
  spreadsheetId: string,
  defaultName: string,
  possibleNames: string[]
): Promise<{ exists: boolean; name: string }> {
  return { exists: true, name: defaultName };
}

export async function listSpreadsheets(token: string): Promise<SpreadsheetInfo[]> {
  return [{
    id: 'apps_script_db',
    name: 'Database Inventaris Utama (Apps Script)',
    webViewLink: '#'
  }];
}

export async function createInventorySpreadsheet(token: string, name: string): Promise<SpreadsheetInfo> {
  return {
    id: 'apps_script_db',
    name: name || 'Database Inventaris Utama (Apps Script)',
    webViewLink: '#'
  };
}

export async function getOrCreatePhotoFolder(token: string): Promise<string> {
  return 'apps_script_photos_folder';
}

/**
 * Upload Base64 Photo to Google Drive using Google Apps Script Web App
 */
export async function uploadImageToDrive(token: string, folderId: string, file: File): Promise<string> {
  const url = getAppsScriptUrl();
  if (!url) {
    // Elegant local fallback: convert to base64 data url directly so the app works offline!
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'uploadImage',
            name: file.name,
            type: file.type,
            base64Data: base64String
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const res = await response.json();
        if (res.success && res.url) {
          resolve(res.url);
        } else {
          reject(new Error(res.error || 'Aplikasi Web Google Apps Script gagal mengunggah gambar'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

// ----------------------------------------------------------------------------
// DATA READING OPERATIONS WITH PARALLEL-TO-BATCH FETCHING CACHE MECHANISM
// ----------------------------------------------------------------------------

export interface BatchDataResult {
  items: InventoryItem[];
  sales: SalesTransaction[];
  preOrders: PreOrder[];
  catalogItems: CatalogItem[];
  consignments: ConsignmentRecord[];
  activityLogs: ActivityLog[];
  categories: string[];
  jenisList: string[];
  motifList: string[];
  warnaList: string[];
  ukuranList: string[];
}

export async function getBatchSpreadsheetData(token: string, spreadsheetId: string): Promise<BatchDataResult> {
  const url = getAppsScriptUrl();
  if (!url) {
    // Offline / Local Storage fallback
    const getCached = <T,>(key: string, def: T): T => {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : def;
    };
    return {
      items: getCached(`items_${spreadsheetId}`, []),
      sales: getCached(`sales_${spreadsheetId}`, []),
      preOrders: getCached(`preorders_${spreadsheetId}`, []),
      catalogItems: getCached(`catalog_${spreadsheetId}`, []),
      consignments: getCached(`consignments_${spreadsheetId}`, []),
      activityLogs: getCached(`activity_${spreadsheetId}`, []),
      categories: getCached(`categories_${spreadsheetId}`, ['Bokor', 'Dulang', 'Furnitur']),
      jenisList: getCached(`jenis_${spreadsheetId}`, ['Tumpuk', 'Lebong']),
      motifList: getCached(`motif_${spreadsheetId}`, ['Batok Kayu', 'Polos']),
      warnaList: getCached(`warna_${spreadsheetId}`, ['Cat Maron', 'Natural']),
      ukuranList: getCached(`ukuran_${spreadsheetId}`, ['D25', 'D30'])
    };
  }

  const db = await fetchAllFromAppsScript();
  return {
    items: parseInventaris(db.inventaris),
    sales: parsePenjualan(db.penjualan),
    preOrders: parsePreOrder(db.preorder),
    catalogItems: parseKatalog(db.katalog),
    consignments: parseConsignment(db.consignment),
    activityLogs: parseActivityLogs(db.logs),
    categories: parseSimpleList(db.kategori),
    jenisList: parseSimpleList(db.jenisList),
    motifList: parseSimpleList(db.motifList),
    warnaList: parseSimpleList(db.warnaList),
    ukuranList: parseSimpleList(db.ukuranList)
  };
}

export async function getSpreadsheetData(token: string, spreadsheetId: string): Promise<InventoryItem[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.items;
}

export async function getSalesData(token: string, spreadsheetId: string): Promise<SalesTransaction[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.sales;
}

export async function getPreOrdersData(token: string, spreadsheetId: string): Promise<PreOrder[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.preOrders;
}

export async function getCatalogData(token: string, spreadsheetId: string): Promise<CatalogItem[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.catalogItems;
}

export async function getConsignmentData(token: string, spreadsheetId: string): Promise<ConsignmentRecord[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.consignments;
}

export async function getActivityLogsData(token: string, spreadsheetId: string): Promise<ActivityLog[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.activityLogs;
}

export async function getCategoriesData(token: string, spreadsheetId: string): Promise<string[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.categories;
}

export async function getJenisData(token: string, spreadsheetId: string): Promise<string[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.jenisList;
}

export async function getMotifData(token: string, spreadsheetId: string): Promise<string[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.motifList;
}

export async function getWarnaData(token: string, spreadsheetId: string): Promise<string[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.warnaList;
}

export async function getUkuranData(token: string, spreadsheetId: string): Promise<string[]> {
  const batch = await getBatchSpreadsheetData(token, spreadsheetId);
  return batch.ukuranList;
}

// ----------------------------------------------------------------------------
// EMPLOYEE MODULE READS
// ----------------------------------------------------------------------------

export async function getKaryawanData(token: string, spreadsheetId: string): Promise<Karyawan[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`karyawan_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parseKaryawan(db.karyawan);
}

export async function getAbsensiData(token: string, spreadsheetId: string): Promise<Absensi[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`absensi_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parseAbsensi(db.absensi);
}

export async function getProduksiBoronganData(token: string, spreadsheetId: string): Promise<ProduksiBorongan[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`produksiborongan_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parseProduksiBorongan(db.produksiBorongan);
}

export async function getPinjamanData(token: string, spreadsheetId: string): Promise<Pinjaman[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`pinjaman_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parsePinjaman(db.pinjaman);
}

export async function getGajiPembayaranData(token: string, spreadsheetId: string): Promise<GajiPembayaran[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`gajipembayaran_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parseGajiPembayaran(db.gajiPembayaran);
}

export async function getProdukBoronganData(token: string, spreadsheetId: string): Promise<ProdukBorongan[]> {
  const url = getAppsScriptUrl();
  if (!url) {
    const saved = localStorage.getItem(`produkborongan_${spreadsheetId}`);
    return saved ? JSON.parse(saved) : [];
  }
  const db = await fetchAllFromAppsScript();
  return parseProdukBorongan(db.produkBorongan);
}

// ----------------------------------------------------------------------------
// DATA WRITING OPERATIONS (SYNCHRONIZES BOTH APPS SCRIPT AND LOCAL STORAGE)
// ----------------------------------------------------------------------------

export async function saveSpreadsheetData(token: string, spreadsheetId: string, items: InventoryItem[]): Promise<void> {
  const headers = ['Kode', 'Nama', 'Jumlah', 'Harga Satuan', 'Foto Barang', 'Ambang Batas', 'Kategori'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([item.kode, item.nama, item.jumlah, item.hargaSatuan, item.fotoBarang, item.ambangBatas, item.kategori]);
  });

  localStorage.setItem(`items_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Sheet1', values);
}

export async function saveSalesData(token: string, spreadsheetId: string, sales: SalesTransaction[]): Promise<void> {
  const headers = ['ID', 'Tanggal', 'Kode Barang', 'Nama Barang', 'Jumlah', 'Harga Satuan', 'Total'];
  const values: any[][] = [headers];
  sales.forEach(sale => {
    values.push([sale.id, sale.tanggal, sale.kodeBarang, sale.namaBarang, sale.jumlah, sale.hargaSatuan, sale.total]);
  });

  localStorage.setItem(`sales_${spreadsheetId}`, JSON.stringify(sales));
  await saveToAppsScript('Penjualan', values);
}

export async function savePreOrdersData(token: string, spreadsheetId: string, preOrders: PreOrder[]): Promise<void> {
  const headers = ['ID', 'Tanggal Pemesanan', 'Nama Pengepul', 'Kontak Pengepul', 'Pesanan Detail', 'Tanggal Target Selesai', 'Status', 'Total Biaya', 'Nominal DP', 'Sisa Pembayaran', 'Tipe Order', 'Isi Nama', 'Nama Custom'];
  const values: any[][] = [headers];
  preOrders.forEach(po => {
    values.push([po.id, po.tanggalPemesanan, po.namaPengepul, po.kontakPengepul, po.pesananDetail, po.tanggalTargetSelesai, po.status, po.totalBiaya, po.nominalDp, po.sisaPembayaran, po.tipeOrder, po.isiNama ? 'Ya' : 'Tidak', po.namaCustom]);
  });

  localStorage.setItem(`preorders_${spreadsheetId}`, JSON.stringify(preOrders));
  await saveToAppsScript('PreOrder', values);
}

export async function saveCatalogData(token: string, spreadsheetId: string, items: CatalogItem[]): Promise<void> {
  const headers = ['Kode', 'Nama', 'Kategori', 'Harga', 'Foto', 'Harga Reseller', 'Jenis', 'Motif', 'Warna', 'Ukuran', 'Ukuran 2', 'Harga 2', 'Harga Reseller 2', 'Ukuran 3', 'Harga 3', 'Harga Reseller 3', 'Nilai Borongan'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([
      item.kode, item.nama, item.kategori, item.harga, item.foto, item.hargaReseller, item.jenis, item.motif, item.warna, item.ukuran,
      item.ukuran2 || '', item.harga2 || '', item.hargaReseller2 || '',
      item.ukuran3 || '', item.harga3 || '', item.hargaReseller3 || '',
      item.nilaiBorongan || 0
    ]);
  });

  localStorage.setItem(`catalog_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Katalog', values);
}

export async function saveConsignmentData(token: string, spreadsheetId: string, consignments: ConsignmentRecord[]): Promise<void> {
  const headers = ['ID', 'Tanggal Ambil', 'Tanggal Selesai', 'Nama Mitra', 'Kontak Mitra', 'Detail Barang', 'Status', 'Total Nilai Ambil', 'Total Nilai Laku', 'Catatan'];
  const values: any[][] = [headers];
  consignments.forEach(c => {
    values.push([c.id, c.tanggalAmbil, c.tanggalSelesai || '', c.namaMitra, c.kontakMitra, JSON.stringify(c.items), c.status, c.totalNilaiAmbil, c.totalNilaiLaku, c.catatan]);
  });

  localStorage.setItem(`consignments_${spreadsheetId}`, JSON.stringify(consignments));
  await saveToAppsScript('TitipJual', values);
}

export async function saveActivityLogsData(token: string, spreadsheetId: string, logs: ActivityLog[]): Promise<void> {
  const headers = ['ID', 'Timestamp', 'Operator', 'Aksi', 'Detail'];
  const values: any[][] = [headers];
  logs.forEach(log => {
    values.push([log.id, log.timestamp, log.operator, log.aksi, log.detail]);
  });

  localStorage.setItem(`activity_${spreadsheetId}`, JSON.stringify(logs));
  await saveToAppsScript('LogAktivitas', values);
}

export async function saveCategoriesData(token: string, spreadsheetId: string, categories: string[]): Promise<void> {
  const headers = ['Nama Kategori'];
  const values: any[][] = [headers];
  categories.forEach(cat => {
    values.push([cat]);
  });

  localStorage.setItem(`categories_${spreadsheetId}`, JSON.stringify(categories));
  await saveToAppsScript('Kategori', values);
}

export async function saveJenisData(token: string, spreadsheetId: string, items: string[]): Promise<void> {
  const headers = ['Jenis'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([item]);
  });

  localStorage.setItem(`jenis_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Jenis', values);
}

export async function saveMotifData(token: string, spreadsheetId: string, items: string[]): Promise<void> {
  const headers = ['Motif'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([item]);
  });

  localStorage.setItem(`motif_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Motif', values);
}

export async function saveWarnaData(token: string, spreadsheetId: string, items: string[]): Promise<void> {
  const headers = ['Warna'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([item]);
  });

  localStorage.setItem(`warna_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Warna', values);
}

export async function saveUkuranData(token: string, spreadsheetId: string, items: string[]): Promise<void> {
  const headers = ['Ukuran'];
  const values: any[][] = [headers];
  items.forEach(item => {
    values.push([item]);
  });

  localStorage.setItem(`ukuran_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Ukuran', values);
}

// ----------------------------------------------------------------------------
// EMPLOYEE MODULE WRITES
// ----------------------------------------------------------------------------

export async function saveKaryawanData(token: string, spreadsheetId: string, items: Karyawan[]): Promise<void> {
  const headers = ['ID', 'Nama', 'Kategori', 'Gaji Harian', 'Tanggal Masuk', 'Status Aktif'];
  const values: any[][] = [headers];
  items.forEach(k => {
    values.push([k.id, k.nama, k.kategori, k.gajiHarian, k.tanggalMasuk, k.statusAktif ? 'true' : 'false']);
  });

  localStorage.setItem(`karyawan_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Karyawan', values);
}

export async function saveAbsensiData(token: string, spreadsheetId: string, items: Absensi[]): Promise<void> {
  const headers = ['ID', 'Tanggal', 'ID Karyawan', 'Nama Karyawan', 'Status Kerja', 'Keterangan'];
  const values: any[][] = [headers];
  items.forEach(a => {
    values.push([a.id, a.tanggal, a.idKaryawan, a.namaKaryawan, a.statusKerja, a.keterangan || '']);
  });

  localStorage.setItem(`absensi_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Absensi', values);
}

export async function saveProduksiBoronganData(token: string, spreadsheetId: string, items: ProduksiBorongan[]): Promise<void> {
  const headers = ['ID', 'Tanggal', 'ID Karyawan', 'Nama Karyawan', 'Kode Produk', 'Nama Produk', 'Jumlah', 'Nilai Per Pcs', 'Total Nilai'];
  const values: any[][] = [headers];
  items.forEach(p => {
    values.push([p.id, p.tanggal, p.idKaryawan, p.namaKaryawan, p.kodeProduk, p.namaProduk, p.jumlah, p.nilaiPerPcs, p.totalNilai]);
  });

  localStorage.setItem(`produksiborongan_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('ProduksiBorongan', values);
}

export async function savePinjamanData(token: string, spreadsheetId: string, items: Pinjaman[]): Promise<void> {
  const headers = ['ID', 'Tanggal', 'ID Karyawan', 'Nama Karyawan', 'Jumlah Pinjaman', 'Status', 'Catatan'];
  const values: any[][] = [headers];
  items.forEach(p => {
    values.push([p.id, p.tanggal, p.idKaryawan, p.namaKaryawan, p.jumlahPinjaman, p.status, p.catatan || '']);
  });

  localStorage.setItem(`pinjaman_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('Pinjaman', values);
}

export async function saveGajiPembayaranData(token: string, spreadsheetId: string, items: GajiPembayaran[]): Promise<void> {
  const headers = ['ID', 'Tanggal Gajian', 'Bulan Tahun', 'ID Karyawan', 'Nama Karyawan', 'Kategori', 'Total Hari Kerja', 'Gaji Harian Rate', 'Gaji Pokok', 'Total Borongan', 'Potongan Pinjaman', 'Total Bersih', 'Catatan'];
  const values: any[][] = [headers];
  items.forEach(p => {
    values.push([p.id, p.tanggalGajian, p.bulanTahun, p.idKaryawan, p.namaKaryawan, p.kategori, p.totalHariKerja, p.gajiHarianRate, p.gajiPokok, p.totalBorongan, p.potonganPinjaman, p.totalBersih, p.catatan || '']);
  });

  localStorage.setItem(`gajipembayaran_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('GajiPembayaran', values);
}

export async function saveProdukBoronganData(token: string, spreadsheetId: string, items: ProdukBorongan[]): Promise<void> {
  const headers = ['ID', 'Nama', 'Nilai Per Pcs'];
  const values: any[][] = [headers];
  items.forEach(p => {
    values.push([p.id, p.nama, p.nilaiPerPcs]);
  });

  localStorage.setItem(`produkborongan_${spreadsheetId}`, JSON.stringify(items));
  await saveToAppsScript('ProdukBorongan', values);
}
