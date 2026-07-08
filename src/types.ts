export type UserRole = 'admin' | 'staff';

export interface UserSession {
  role: UserRole;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface InventoryItem {
  kode: string;
  nama: string;
  jumlah: number;
  hargaSatuan: number;
  fotoBarang: string; // URL of image (Drive link or base64)
  ambangBatas: number; // minimum stock threshold
  kategori?: string; // category of the item
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface SalesTransaction {
  id: string;
  tanggal: string; // YYYY-MM-DD atau ISO String
  kodeBarang: string;
  namaBarang: string;
  jumlah: number;
  hargaSatuan: number;
  total: number;
  ukuran?: string;
  tipePelanggan?: string;
  catatan?: string;
}

export interface PreOrder {
  id: string;
  tanggalPemesanan: string; // YYYY-MM-DD
  namaPengepul: string;
  kontakPengepul: string;
  pesananDetail: string; // Deskripsi detail pesanan (nama barang, jumlah, dsb)
  tanggalTargetSelesai: string; // Kapan barang pesanan harus jadi / akan diambil
  status: 'antrean' | 'proses' | 'siap' | 'selesai' | 'dibatalkan';
  totalBiaya: number;
  nominalDp?: number;
  sisaPembayaran?: number;
  tipeOrder?: 'Standard' | 'Reseller';
  isiNama?: boolean;
  namaCustom?: string;
}

export interface CatalogItem {
  kode: string; // Kode barang unik
  nama: string;
  kategori: string;
  harga: number;
  hargaReseller?: number;
  foto: string; // URL foto / link google drive
  jenis?: string;
  motif?: string;
  warna?: string;
  ukuran?: string;
  nilaiBorongan?: number; // Piece-rate wage per item for piece-rate workers
  
  // Additional size & pricing slots
  ukuran2?: string;
  harga2?: number;
  hargaReseller2?: number;
  ukuran3?: string;
  harga3?: number;
  hargaReseller3?: number;
}

export type KaryawanKategori = 'Harian' | 'Borongan';

export interface Karyawan {
  id: string;
  nama: string;
  kategori: KaryawanKategori;
  gajiHarian: number; // Daily salary rate for 'Harian'
  tanggalMasuk: string; // YYYY-MM-DD
  statusAktif: boolean;
}

export interface Absensi {
  id: string;
  tanggal: string; // YYYY-MM-DD
  idKaryawan: string;
  namaKaryawan: string;
  statusKerja: 'Hadir' | 'Hadir 1/2 Hari' | 'Tidak Hadir';
  keterangan?: string;
}

export interface ProduksiBorongan {
  id: string;
  tanggal: string; // YYYY-MM-DD
  idKaryawan: string;
  namaKaryawan: string;
  kodeProduk: string;
  namaProduk: string;
  jumlah: number;
  nilaiPerPcs: number;
  totalNilai: number; // jumlah * nilaiPerPcs
}

export interface ProdukBorongan {
  id: string;
  nama: string;
  nilaiPerPcs: number;
}

export interface Pinjaman {
  id: string;
  tanggal: string; // YYYY-MM-DD
  idKaryawan: string;
  namaKaryawan: string;
  jumlahPinjaman: number;
  status: 'Belum Lunas' | 'Lunas';
  catatan?: string;
}

export interface GajiPembayaran {
  id: string;
  tanggalGajian: string; // YYYY-MM-DD
  bulanTahun: string; // MM-YYYY or YYYY-MM
  idKaryawan: string;
  namaKaryawan: string;
  kategori: KaryawanKategori;
  totalHariKerja: number; // for Harian
  gajiHarianRate: number; // for Harian
  gajiPokok: number; // totalHariKerja * gajiHarianRate for Harian
  totalBorongan: number; // sum of totalNilai of ProduksiBorongan in that month for Borongan
  potonganPinjaman: number; // amount deducted from loans
  totalBersih: number; // (gajiPokok or totalBorongan) - potonganPinjaman
  catatan?: string;
}

export interface ConsignmentItem {
  kodeBarang: string;
  namaBarang: string;
  jumlahAmbil: number;
  jumlahLaku: number;
  jumlahKembali: number;
  hargaSatuan: number;
  namaCustom?: string;
  ukuran?: string;
}

export interface ConsignmentRecord {
  id: string;
  tanggalAmbil: string;
  tanggalSelesai?: string;
  namaMitra: string;
  kontakMitra: string;
  items: ConsignmentItem[];
  status: 'aktif' | 'selesai' | 'dibatalkan';
  totalNilaiAmbil: number;
  totalNilaiLaku: number;
  catatan?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  operator: string;
  aksi: string;
  detail: string;
}



