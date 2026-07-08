import React, { useEffect, useState, useRef } from 'react';
import { 
  getSpreadsheetData, 
  saveSpreadsheetData, 
  getOrCreatePhotoFolder, 
  uploadImageToDrive,
  getSalesData,
  saveSalesData,
  getPreOrdersData,
  savePreOrdersData,
  getCatalogData,
  saveCatalogData,
  getConsignmentData,
  saveConsignmentData,
  getActivityLogsData,
  saveActivityLogsData,
  getCategoriesData,
  saveCategoriesData,
  getJenisData,
  saveJenisData,
  getMotifData,
  saveMotifData,
  getWarnaData,
  saveWarnaData,
  getUkuranData,
  saveUkuranData,
  getBatchSpreadsheetData,
  getKaryawanData,
  saveKaryawanData,
  getAbsensiData,
  saveAbsensiData,
  getProduksiBoronganData,
  saveProduksiBoronganData,
  getPinjamanData,
  savePinjamanData,
  getGajiPembayaranData,
  saveGajiPembayaranData,
  getProdukBoronganData,
  saveProdukBoronganData,
  getAppsScriptUrl,
  setAppsScriptUrl
} from '../lib/googleApi';
import { InventoryItem, SpreadsheetInfo, UserSession, SalesTransaction, PreOrder, CatalogItem, ConsignmentRecord, ConsignmentItem, ActivityLog, Karyawan, Absensi, ProduksiBorongan, Pinjaman, GajiPembayaran, KaryawanKategori, ProdukBorongan } from '../types';
import PrintReport from './PrintReport';
import PrintCatalog from './PrintCatalog';
import EmployeeManager from './EmployeeManager';
import { jsPDF } from 'jspdf';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Database, 
  TrendingDown, 
  TrendingUp, 
  Layers, 
  CircleAlert, 
  Edit, 
  Trash2, 
  Upload, 
  Image, 
  Printer, 
  LogOut, 
  CheckCircle, 
  Check, 
  X, 
  ArrowUpDown, 
  FileSpreadsheet,
  Settings,
  HelpCircle,
  TrendingUp as TrendingUpIcon,
  ShoppingCart,
  Calendar,
  Sparkles,
  BarChart3,
  History,
  Tag,
  MinusCircle,
  User,
  ClipboardList,
  Clock,
  Phone,
  Download,
  Menu,
  Users
} from 'lucide-react';

interface DashboardProps {
  session: UserSession;
  token: string;
  spreadsheet: SpreadsheetInfo;
  onLogout: () => void;
  onChangeSpreadsheet: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomChartTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formatRp = (val: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
    };

    return (
      <div className="bg-white p-3.5 border border-slate-150 rounded-xl shadow-lg font-sans text-xs">
        <p className="font-bold text-slate-800 mb-1.5">{data.fullName || label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between space-x-6">
            <span className="text-slate-500 font-medium flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mr-2"></span>
              Pendapatan:
            </span>
            <span className="font-bold font-mono text-slate-800">{formatRp(data.revenue)}</span>
          </div>
          <div className="flex items-center justify-between space-x-6 border-t border-slate-100 pt-1 mt-1">
            <span className="text-slate-500 font-medium flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2"></span>
              Volume Terjual:
            </span>
            <span className="font-bold font-mono text-slate-800">{data.quantity} Pcs</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface SizeBreakdown {
  [size: string]: number;
}

function parseInventoryItemName(fullName: string): { baseName: string; breakdown: SizeBreakdown } {
  const regex = /\s*\[(.*?)\]\s*$/;
  const match = fullName.match(regex);
  
  if (!match) {
    return { baseName: fullName, breakdown: {} };
  }
  
  const baseName = fullName.replace(regex, '').trim();
  const breakdownStr = match[1];
  const breakdown: SizeBreakdown = {};
  
  breakdownStr.split(',').forEach(part => {
    const [size, qty] = part.split(':');
    if (size) {
      breakdown[size.trim()] = Number(qty?.trim()) || 0;
    }
  });
  
  return { baseName, breakdown };
}

function buildInventoryItemName(baseName: string, breakdown: SizeBreakdown): string {
  const parts = Object.entries(breakdown)
    .map(([size, qty]) => `${size}: ${qty}`);
    
  if (parts.length === 0) {
    return baseName;
  }
  return `${baseName} [${parts.join(', ')}]`;
}

function extractSoldUkuran(namaBarang: string): string {
  const match = namaBarang.match(/\[Ukuran:\s*(.*?)\]/);
  return match ? match[1].trim() : '';
}

export default function Dashboard({ session, token, spreadsheet, onLogout, onChangeSpreadsheet }: DashboardProps) {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`items_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [sales, setSales] = useState<SalesTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(`sales_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [preOrders, setPreOrders] = useState<PreOrder[]>(() => {
    try {
      const saved = localStorage.getItem(`preorders_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSynced, setLastSynced] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Employee Management States
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>(() => {
    try {
      const saved = localStorage.getItem(`karyawan_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [absensiList, setAbsensiList] = useState<Absensi[]>(() => {
    try {
      const saved = localStorage.getItem(`absensi_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [produksiBoronganList, setProduksiBoronganList] = useState<ProduksiBorongan[]>(() => {
    try {
      const saved = localStorage.getItem(`produksiborongan_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [pinjamanList, setPinjamanList] = useState<Pinjaman[]>(() => {
    try {
      const saved = localStorage.getItem(`pinjaman_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [gajiPembayaranList, setGajiPembayaranList] = useState<GajiPembayaran[]>(() => {
    try {
      const saved = localStorage.getItem(`gajipembayaran_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [produkBoronganList, setProdukBoronganList] = useState<ProdukBorongan[]>(() => {
    try {
      const saved = localStorage.getItem(`produkborongan_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Active Menu View State
  const [activeView, setActiveView] = useState<'dashboard' | 'sales' | 'preorder' | 'inventory' | 'catalog' | 'consignment' | 'employee'>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Consignment (Titip Jual) states
  const [consignments, setConsignments] = useState<ConsignmentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`consignments_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [formTjNamaMitra, setFormTjNamaMitra] = useState('');
  const [formTjKontakMitra, setFormTjKontakMitra] = useState('');
  const [formTjCatatan, setFormTjCatatan] = useState('');
  const [formTjItems, setFormTjItems] = useState<ConsignmentItem[]>([]);
  const [isTjModalOpen, setIsTjModalOpen] = useState(false);
  const [tjSearch, setTjSearch] = useState('');
  const [tjFilterStatus, setTjFilterStatus] = useState<string>('all');
  const [tjError, setTjError] = useState<string | null>(null);
  const [tjSuccess, setTjSuccess] = useState<string | null>(null);
  const [savingTj, setSavingTj] = useState(false);

  // Settle/Calculate Modal states
  const [isTjSettleModalOpen, setIsTjSettleModalOpen] = useState(false);
  const [settlingTj, setSettlingTj] = useState<ConsignmentRecord | null>(null);
  const [settleItems, setSettleItems] = useState<ConsignmentItem[]>([]);

  // Selected catalog item for consignment form
  const [selectedTjCatCode, setSelectedTjCatCode] = useState('');
  const [formTjCatUkuran, setFormTjCatUkuran] = useState('');
  const [formTjCatQty, setFormTjCatQty] = useState(1);
  const [tjItemIsiNama, setTjItemIsiNama] = useState(false);
  const [tjItemNamaCustom, setTjItemNamaCustom] = useState('');

  // State to track consignment being deleted (cancelled)
  const [deletingTjItem, setDeletingTjItem] = useState<ConsignmentRecord | null>(null);
  const [hardDeletingTj, setHardDeletingTj] = useState<ConsignmentRecord | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);

  // Edit Consignment (Titip Jual) states
  const [isTjEditModalOpen, setIsTjEditModalOpen] = useState(false);
  const [editingTj, setEditingTj] = useState<ConsignmentRecord | null>(null);
  const [formTjEditNamaMitra, setFormTjEditNamaMitra] = useState('');
  const [formTjEditKontakMitra, setFormTjEditKontakMitra] = useState('');
  const [formTjEditCatatan, setFormTjEditCatatan] = useState('');
  const [formTjEditItems, setFormTjEditItems] = useState<ConsignmentItem[]>([]);
  const [selectedTjEditCatCode, setSelectedTjEditCatCode] = useState('');
  const [formTjEditCatUkuran, setFormTjEditCatUkuran] = useState('');
  const [formTjEditCatQty, setFormTjEditCatQty] = useState(1);
  const [tjEditItemIsiNama, setTjEditItemIsiNama] = useState(false);
  const [tjEditItemNamaCustom, setTjEditItemNamaCustom] = useState('');
  const [tjEditError, setTjEditError] = useState<string | null>(null);
  const [tjEditSuccess, setTjEditSuccess] = useState<string | null>(null);
  const [savingTjEdit, setSavingTjEdit] = useState(false);
  const [itemsBackup, setItemsBackup] = useState<InventoryItem[] | null>(null);

  // Derived state variables for consignment add/edit duplicate warnings
  const isAlreadyInTjList = !!(selectedTjCatCode && formTjCatUkuran && formTjItems.some(
    i => i.kodeBarang.toUpperCase() === selectedTjCatCode.toUpperCase() && i.ukuran === formTjCatUkuran
  ));
  const isTjBypassed = !!(isAlreadyInTjList && tjItemIsiNama && tjItemNamaCustom.trim() !== '');

  const isAlreadyInTjEditList = !!(selectedTjEditCatCode && formTjEditCatUkuran && formTjEditItems.some(
    i => i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && i.ukuran === formTjEditCatUkuran
  ));
  const isTjEditBypassed = !!(isAlreadyInTjEditList && tjEditItemIsiNama && tjEditItemNamaCustom.trim() !== '');

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'safe'>('all');
  const [sortField, setSortField] = useState<keyof InventoryItem>('kode');
  const [sortAsc, setSortAsc] = useState(true);

  // Product Catalog states
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(`catalog_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilterCategory, setCatalogFilterCategory] = useState('all');
  
  // Catalog Modal states
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState<string | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);

  // Catalog Form states
  const [formCatKode, setFormCatKode] = useState('');
  const [formCatNama, setFormCatNama] = useState('');
  const [isAutoCatNama, setIsAutoCatNama] = useState(true);
  const [formCatKategori, setFormCatKategori] = useState('');
  const [formCatHarga, setFormCatHarga] = useState(0);
  const [formCatHargaReseller, setFormCatHargaReseller] = useState<number>(0);
  const [formCatFoto, setFormCatFoto] = useState('');
  const [formCatJenis, setFormCatJenis] = useState('');
  const [formCatMotif, setFormCatMotif] = useState('');
  const [formCatWarna, setFormCatWarna] = useState('');
  const [formCatUkuran, setFormCatUkuran] = useState('');
  const [formCatUkuran2, setFormCatUkuran2] = useState('');
  const [formCatHarga2, setFormCatHarga2] = useState(0);
  const [formCatHargaReseller2, setFormCatHargaReseller2] = useState<number>(0);
  const [formCatUkuran3, setFormCatUkuran3] = useState('');
  const [formCatHarga3, setFormCatHarga3] = useState(0);
  const [formCatHargaReseller3, setFormCatHargaReseller3] = useState<number>(0);
  const [uploadingCatalogPhoto, setUploadingCatalogPhoto] = useState(false);
  const [catDragActive, setCatDragActive] = useState(false);

  // Memo to check if catalog item with same Kategori + Jenis + Motif + Warna already exists
  const duplicateCatalogItem = React.useMemo(() => {
    const cleanKategori = formCatKategori.trim().toLowerCase();
    const cleanJenis = formCatJenis.trim().toLowerCase();
    const cleanMotif = formCatMotif.trim().toLowerCase();
    const cleanWarna = formCatWarna.trim().toLowerCase();
    
    if (!cleanKategori || !cleanJenis || !cleanMotif || !cleanWarna) {
      return null;
    }
    
    return catalogItems.find(item => {
      if (editingCatalogItem && item.kode === editingCatalogItem.kode) return false;
      
      const itemKategori = (item.kategori || '').trim().toLowerCase();
      const itemJenis = (item.jenis || '').trim().toLowerCase();
      const itemMotif = (item.motif || '').trim().toLowerCase();
      const itemWarna = (item.warna || '').trim().toLowerCase();
      
      return itemKategori === cleanKategori &&
             itemJenis === cleanJenis &&
             itemMotif === cleanMotif &&
             itemWarna === cleanWarna;
    });
  }, [catalogItems, formCatKategori, formCatJenis, formCatMotif, formCatWarna, editingCatalogItem]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isPrintCatalogOpen, setIsPrintCatalogOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<InventoryItem | null>(null);

  // Item Form states
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJumlah, setFormJumlah] = useState(0);
  const [formHarga, setFormHarga] = useState(0);
  const [formAmbang, setFormAmbang] = useState(5);
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formSizesStock, setFormSizesStock] = useState<Record<string, number>>({});

  // Collision Dialog states
  const [catalogCollisionItem, setCatalogCollisionItem] = useState<CatalogItem | null>(null);
  const [inventoryCollisionItem, setInventoryCollisionItem] = useState<InventoryItem | null>(null);

  // Form Pencatatan Penjualan (New Sales form states)
  const [formSaleKode, setFormSaleKode] = useState('');
  const [formSaleUkuran, setFormSaleUkuran] = useState('');
  const [formSaleJumlah, setFormSaleJumlah] = useState(1);
  const [formSaleHarga, setFormSaleHarga] = useState(0);
  const [formSaleTanggal, setFormSaleTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formSaleTipePelanggan, setFormSaleTipePelanggan] = useState<'Standard' | 'Reseller'>('Standard');
  const [formSaleCatatan, setFormSaleCatatan] = useState('');
  const [recordingSale, setRecordingSale] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesSuccess, setSalesSuccess] = useState<string | null>(null);

  // Form PreOrder states
  const [formPoNamaPengepul, setFormPoNamaPengepul] = useState('');
  const [formPoKontak, setFormPoKontak] = useState('');
  const [formPoDetail, setFormPoDetail] = useState('');
  const [formPoTargetTanggal, setFormPoTargetTanggal] = useState('');
  const [formPoBiaya, setFormPoBiaya] = useState(0);
  const [formPoStatus, setFormPoStatus] = useState<'antrean' | 'proses' | 'siap' | 'selesai' | 'dibatalkan'>('antrean');
  const [formPoNominalDp, setFormPoNominalDp] = useState<number>(0);
  const [formPoSisaPembayaran, setFormPoSisaPembayaran] = useState<number>(0);
  const [formPoTipeOrder, setFormPoTipeOrder] = useState<'Standard' | 'Reseller'>('Standard');
  const [formPoIsiNama, setFormPoIsiNama] = useState(false);
  const [formPoNamaCustom, setFormPoNamaCustom] = useState('');
  const [savingPo, setSavingPo] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [poSuccess, setPoSuccess] = useState<string | null>(null);
  
  // Selected PO for editing
  const [selectedPoCatCode, setSelectedPoCatCode] = useState('');
  const [selectedPoSize, setSelectedPoSize] = useState<'1' | '2' | '3'>('1');
  const [formPoCatQty, setFormPoCatQty] = useState(1);
  const [itemIsiNama, setItemIsiNama] = useState(false);
  const [itemNamaCustom, setItemNamaCustom] = useState('');
  const [deletingPoItem, setDeletingPoItem] = useState<PreOrder | null>(null);
  const [editingPo, setEditingPo] = useState<PreOrder | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [poFilterStatus, setPoFilterStatus] = useState<string>('all');

  // Chart configuration states
  const [chartTimeframe, setChartTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'quantity'>('revenue');
  const [chartSelectedYear, setChartSelectedYear] = useState<string>(new Date().getFullYear().toString());

  // Categories states
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`categories_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load categories from localStorage", e);
    }
    return ['Bokor', 'Dulang', 'Furnitur'];
  });

  const [jenisList, setJenisList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`jenis_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['Tumpuk', 'Lebong'];
  });

  const [motifList, setMotifList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`motif_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['Batok Kayu', 'Polos'];
  });

  const [warnaList, setWarnaList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`warna_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['Cat Maron', 'Natural'];
  });

  const [ukuranList, setUkuranList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`ukuran_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['D25', 'D30'];
  });

  const [formKategori, setFormKategori] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Settings view states
  const [settingsTab, setSettingsTab] = useState<'jenis' | 'motif' | 'warna' | 'ukuran' | 'database'>('database');
  const [settingsNewValue, setSettingsNewValue] = useState('');
  const [settingsEditingIndex, setSettingsEditingIndex] = useState<number | null>(null);
  const [settingsEditingValue, setSettingsEditingValue] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(() => getAppsScriptUrl());

  const handleSaveAppsScriptUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const url = appsScriptUrlInput.trim();
      if (url && !url.startsWith('https://script.google.com/')) {
        throw new Error('Format URL tidak valid. URL harus diawali dengan https://script.google.com/');
      }
      setAppsScriptUrl(url);
      setSettingsSuccess('URL Google Apps Script berhasil disimpan dan disinkronkan!');
      // Force a sync to verify and load data
      await syncData(false);
    } catch (err: any) {
      setSettingsError(err.message || 'Gagal menyimpan URL atau menyinkronkan data.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`categories_${spreadsheet.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    }
    setCategories(['Bokor', 'Dulang', 'Furnitur']);
  }, [spreadsheet.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`categories_${spreadsheet.id}`, JSON.stringify(categories));
    } catch (e) {
      console.error("Failed to save categories", e);
    }
  }, [categories, spreadsheet.id]);

  // Auto-calculate remaining payment (Sisa Pembayaran) for Pre-orders
  useEffect(() => {
    const sisa = Math.max(0, formPoBiaya - formPoNominalDp);
    setFormPoSisaPembayaran(sisa);
  }, [formPoBiaya, formPoNominalDp]);

  // Auto-calculate formJumlah from formSizesStock
  useEffect(() => {
    const total = (Object.values(formSizesStock) as number[]).reduce((sum, qty) => sum + qty, 0);
    if (total > 0 || Object.keys(formSizesStock).length > 0) {
      setFormJumlah(total);
    }
  }, [formSizesStock]);

  // Load existing size breakdown when formKode changes (when in ADD mode)
  useEffect(() => {
    if (!isModalOpen || editingItem) return;
    
    const cleanKode = formKode.trim().toUpperCase();
    const existing = items.find(i => i.kode.toUpperCase() === cleanKode);
    const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === cleanKode);
    
    if (existing) {
      const { baseName, breakdown } = parseInventoryItemName(existing.nama);
      setFormNama(baseName);
      
      const finalBreakdown = { ...breakdown };
      const catSizes = matchedCatalog
        ? [
            matchedCatalog.ukuran || 'Standard',
            matchedCatalog.ukuran2,
            matchedCatalog.ukuran3
          ].filter(Boolean) as string[]
        : (ukuranList.length > 0 ? ukuranList : ['Standard']);
      catSizes.forEach(size => {
        if (finalBreakdown[size] === undefined) {
          finalBreakdown[size] = 0;
        }
      });
      setFormSizesStock(finalBreakdown);
      
      setFormHarga(existing.hargaSatuan);
      setFormFotoUrl(existing.fotoBarang || '');
      setFormKategori(existing.kategori || '');
      setFormAmbang(existing.ambangBatas);
    } else if (matchedCatalog) {
      setFormNama(matchedCatalog.nama);
      setFormHarga(matchedCatalog.harga);
      setFormFotoUrl(matchedCatalog.foto || '');
      setFormKategori(matchedCatalog.kategori || '');
      
      const finalBreakdown: SizeBreakdown = {};
      const catSizes = [
        matchedCatalog.ukuran || 'Standard',
        matchedCatalog.ukuran2,
        matchedCatalog.ukuran3
      ].filter(Boolean) as string[];
      catSizes.forEach(size => {
        finalBreakdown[size] = 0;
      });
      setFormSizesStock(finalBreakdown);
    } else {
      const finalBreakdown: SizeBreakdown = {};
      const catSizes = ukuranList.length > 0 ? ukuranList : ['Standard'];
      catSizes.forEach(size => {
        finalBreakdown[size] = 0;
      });
      setFormSizesStock(finalBreakdown);
    }
  }, [formKode, isModalOpen, editingItem, items, catalogItems, ukuranList]);

  // Auto-generate Catalog Item Name from selection (Kategori + Jenis + Motif + Warna)
  useEffect(() => {
    if (isAutoCatNama) {
      const parts = [
        formCatKategori,
        formCatJenis,
        formCatMotif,
        formCatWarna
      ].map(p => p?.trim() || '').filter(Boolean);
      const generatedName = parts.join(' ');
      setFormCatNama(generatedName);
    }
  }, [isAutoCatNama, formCatKategori, formCatJenis, formCatMotif, formCatWarna]);

  // Track failed image URLs or item codes to render beautiful placeholders instead of broken tags or Unsplash placeholders
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // State to track activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(`activity_${spreadsheet.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State to track the sales transaction being deleted
  const [deletingSaleItem, setDeletingSaleItem] = useState<SalesTransaction | null>(null);

  // State to track the inventory item being deleted
  const [deletingInventoryItem, setDeletingInventoryItem] = useState<InventoryItem | null>(null);

  // State to track the category name being deleted
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  // State to track the catalog item being deleted
  const [deletingCatalogItem, setDeletingCatalogItem] = useState<CatalogItem | null>(null);

  // State to track the settings attribute item being deleted
  const [deletingSettingsItem, setDeletingSettingsItem] = useState<{ index: number; value: string } | null>(null);

  // Inline form and modal error messages to replace window.alert()
  const [duplicateCodeError, setDuplicateCodeError] = useState<string | null>(null);
  const [duplicateCategoryError, setDuplicateCategoryError] = useState<string | null>(null);

  // Helper function to get clean and reliable image URLs from Google Drive
  const getImageUrl = (url: string | undefined | null): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Match Google Drive sharing, open, or view links
    // e.g., https://drive.google.com/uc?export=view&id=FILE_ID
    // e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // e.g., https://drive.google.com/open?id=FILE_ID
    const driveRegExp = /(?:drive\.google\.com\/(?:uc\?export=view&id=|file\/d\/|open\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]{25,})/;
    const match = trimmed.match(driveRegExp);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/thumbnail?sz=w600&id=${fileId}`;
    }
    return trimmed;
  };

  // File Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Items on component mount & set up polling
  const syncData = async (silent = false) => {
    if (!silent) setLoading(true);
    setSyncStatus('syncing');
    
    let hasQuotaError = false;
    try {
      const [
        data,
        karyawanRes,
        absensiRes,
        produksiRes,
        pinjamanRes,
        gajiRes,
        produkBoronganRes
      ] = await Promise.all([
        getBatchSpreadsheetData(token, spreadsheet.id),
        getKaryawanData(token, spreadsheet.id),
        getAbsensiData(token, spreadsheet.id),
        getProduksiBoronganData(token, spreadsheet.id),
        getPinjamanData(token, spreadsheet.id),
        getGajiPembayaranData(token, spreadsheet.id),
        getProdukBoronganData(token, spreadsheet.id)
      ]);
      
      // Save to localStorage for cache/offline fallback
      localStorage.setItem(`items_${spreadsheet.id}`, JSON.stringify(data.items));
      localStorage.setItem(`sales_${spreadsheet.id}`, JSON.stringify(data.sales));
      localStorage.setItem(`preorders_${spreadsheet.id}`, JSON.stringify(data.preOrders));
      localStorage.setItem(`catalog_${spreadsheet.id}`, JSON.stringify(data.catalogItems));
      localStorage.setItem(`consignments_${spreadsheet.id}`, JSON.stringify(data.consignments));
      localStorage.setItem(`activity_${spreadsheet.id}`, JSON.stringify(data.activityLogs));
      localStorage.setItem(`categories_${spreadsheet.id}`, JSON.stringify(data.categories));
      localStorage.setItem(`jenis_${spreadsheet.id}`, JSON.stringify(data.jenisList));
      localStorage.setItem(`motif_${spreadsheet.id}`, JSON.stringify(data.motifList));
      localStorage.setItem(`warna_${spreadsheet.id}`, JSON.stringify(data.warnaList));
      localStorage.setItem(`ukuran_${spreadsheet.id}`, JSON.stringify(data.ukuranList));
      localStorage.setItem(`karyawan_${spreadsheet.id}`, JSON.stringify(karyawanRes));
      localStorage.setItem(`absensi_${spreadsheet.id}`, JSON.stringify(absensiRes));
      localStorage.setItem(`produksiborongan_${spreadsheet.id}`, JSON.stringify(produksiRes));
      localStorage.setItem(`pinjaman_${spreadsheet.id}`, JSON.stringify(pinjamanRes));
      localStorage.setItem(`gajipembayaran_${spreadsheet.id}`, JSON.stringify(gajiRes));
      localStorage.setItem(`produkborongan_${spreadsheet.id}`, JSON.stringify(produkBoronganRes));

      setItems(data.items);
      setSales(data.sales);
      setPreOrders(data.preOrders);
      setCatalogItems(data.catalogItems);
      setConsignments(data.consignments);
      setActivityLogs(data.activityLogs);
      setCategories(data.categories);
      setJenisList(data.jenisList);
      setMotifList(data.motifList);
      setWarnaList(data.warnaList);
      setUkuranList(data.ukuranList);
      setKaryawanList(karyawanRes);
      setAbsensiList(absensiRes);
      setProduksiBoronganList(produksiRes);
      setPinjamanList(pinjamanRes);
      setGajiPembayaranList(gajiRes);
      setProdukBoronganList(produkBoronganRes);

      setFailedImages({}); // Clear failed images to retry rendering
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setSyncStatus('synced');
      setError(null);
    } catch (e: any) {
      console.error("Batch sync failed:", e);
      const errMsg = String(e.message || e).toLowerCase();
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('rate_limit')) {
        hasQuotaError = true;
      }
      
      // Load fallback from localStorage
      const getCached = <T,>(key: string, fallback: T): T => {
        const cached = localStorage.getItem(key);
        if (cached) {
          try { return JSON.parse(cached) as T; } catch { return fallback; }
        }
        return fallback;
      };

      setItems(getCached(`items_${spreadsheet.id}`, items));
      setSales(getCached(`sales_${spreadsheet.id}`, sales));
      setPreOrders(getCached(`preorders_${spreadsheet.id}`, preOrders));
      setCatalogItems(getCached(`catalog_${spreadsheet.id}`, catalogItems));
      setConsignments(getCached(`consignments_${spreadsheet.id}`, consignments));
      setActivityLogs(getCached(`activity_${spreadsheet.id}`, activityLogs));
      setCategories(getCached(`categories_${spreadsheet.id}`, categories));
      setJenisList(getCached(`jenis_${spreadsheet.id}`, jenisList));
      setMotifList(getCached(`motif_${spreadsheet.id}`, motifList));
      setWarnaList(getCached(`warna_${spreadsheet.id}`, warnaList));
      setUkuranList(getCached(`ukuran_${spreadsheet.id}`, ukuranList));
      setKaryawanList(getCached(`karyawan_${spreadsheet.id}`, karyawanList));
      setAbsensiList(getCached(`absensi_${spreadsheet.id}`, absensiList));
      setProduksiBoronganList(getCached(`produksiborongan_${spreadsheet.id}`, produksiBoronganList));
      setPinjamanList(getCached(`pinjaman_${spreadsheet.id}`, pinjamanList));
      setGajiPembayaranList(getCached(`gajipembayaran_${spreadsheet.id}`, gajiPembayaranList));
      setProdukBoronganList(getCached(`produkborongan_${spreadsheet.id}`, produkBoronganList));

      setSyncStatus('error');
      if (hasQuotaError) {
        setError('Kuota API Google Sheets terlampaui. Menggunakan data cadangan lokal. Beberapa pembaruan mungkin tertunda.');
      } else {
        setError('Gagal menyinkronkan data dengan Google Sheets. Menggunakan data cadangan lokal.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial data synchronization when token or spreadsheet changes
  useEffect(() => {
    syncData();
  }, [token, spreadsheet.id]);

  // Polling every 45 seconds for real-time synchronization across devices
  // Suspended when any modal is open (e.g. adding/editing orders or inventory items) to prevent overwriting unsaved inputs or stocks
  useEffect(() => {
    if (isTjModalOpen || isTjEditModalOpen || isPoModalOpen || isTjSettleModalOpen || isModalOpen) {
      return;
    }

    const interval = setInterval(() => {
      syncData(true);
    }, 45000);

    return () => clearInterval(interval);
  }, [token, spreadsheet.id, isTjModalOpen, isTjEditModalOpen, isPoModalOpen, isTjSettleModalOpen, isModalOpen]);

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some(cat => cat.toLowerCase() === trimmed.toLowerCase())) {
      setDuplicateCategoryError('Kategori ini sudah terdaftar!');
      return;
    }

    setSyncStatus('syncing');
    const updatedCategories = [...categories, trimmed];
    setCategories(updatedCategories);
    setNewCategoryName('');
    setDuplicateCategoryError(null);

    // Log Aktivitas
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Tambah Kategori',
      detail: `Menambah kategori barang baru "${trimmed}" ke sistem.`
    };
    const updatedLogs = [newLog, ...activityLogs];
    setActivityLogs(updatedLogs);

    try {
      await Promise.all([
        saveCategoriesData(token, spreadsheet.id, updatedCategories),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to sync added category', err);
      setSyncStatus('error');
      setError('Gagal menyimpan penambahan kategori ke spreadsheet.');
    }
  };

  const handleConfirmDeleteCategory = async (catToDelete: string) => {
    setSyncStatus('syncing');
    const updatedCategories = categories.filter(c => c !== catToDelete);
    setCategories(updatedCategories);

    // Log Aktivitas
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Hapus Kategori',
      detail: `Menghapus kategori barang "${catToDelete}" dari sistem.`
    };
    const updatedLogs = [newLog, ...activityLogs];
    setActivityLogs(updatedLogs);

    try {
      await Promise.all([
        saveCategoriesData(token, spreadsheet.id, updatedCategories),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to sync deleted category', err);
      setSyncStatus('error');
      setError('Gagal menghapus kategori dari spreadsheet.');
    }
  };

  // Handle Sort
  const handleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Format IDR Currency
  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  // Helper to generate next NI-xxx product code
  const generateNextProductCode = () => {
    const allCodes = [
      ...items.map(i => i.kode),
      ...catalogItems.map(c => c.kode)
    ];
    let maxNum = 0;
    allCodes.forEach(code => {
      if (code && code.toUpperCase().startsWith('NI-')) {
        const numPart = code.substring(3).trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    return `NI-${formattedNum}`;
  };

  // Helper to validate and format custom product code
  const formatProductCode = (input: string): string | null => {
    let clean = input.trim().toUpperCase();
    if (!clean) return null;
    
    // If it's just a number, prepend 'NI-' and pad
    if (/^\d+$/.test(clean)) {
      const num = parseInt(clean, 10);
      return `NI-${String(num).padStart(3, '0')}`;
    }
    
    // If it starts with 'NI-'
    if (clean.startsWith('NI-')) {
      const numPart = clean.substring(3).trim();
      if (/^\d+$/.test(numPart)) {
        const num = parseInt(numPart, 10);
        return `NI-${String(num).padStart(3, '0')}`;
      }
      return clean;
    } else if (clean.startsWith('NI')) {
      // Handles 'NI001' or 'NI1'
      const numPart = clean.substring(2).trim();
      if (/^\d+$/.test(numPart)) {
        const num = parseInt(numPart, 10);
        return `NI-${String(num).padStart(3, '0')}`;
      }
      return `NI-${clean.substring(2)}`;
    }
    
    // For anything else, prepend 'NI-'
    return `NI-${clean}`;
  };

  // CRUD Operations
  const openAddModal = () => {
    setEditingItem(null);
    setDuplicateCodeError(null);
    setFormKode(generateNextProductCode()); // Auto generate code
    setFormNama('');
    setFormJumlah(0);
    setFormHarga(50000);
    setFormAmbang(5);
    setFormFotoUrl('');
    setFormKategori(categories[0] || '');
    setFormSizesStock({});
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setDuplicateCodeError(null);
    setFormKode(item.kode);
    
    const { baseName, breakdown } = parseInventoryItemName(item.nama);
    setFormNama(baseName);
    
    const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === item.kode.toUpperCase());
    const finalBreakdown = { ...breakdown };
    const catSizes = matchedCatalog
      ? [
          matchedCatalog.ukuran || 'Standard',
          matchedCatalog.ukuran2,
          matchedCatalog.ukuran3
        ].filter(Boolean) as string[]
      : (ukuranList.length > 0 ? ukuranList : ['Standard']);
    catSizes.forEach(size => {
      if (finalBreakdown[size] === undefined) {
        finalBreakdown[size] = 0;
      }
    });
    setFormSizesStock(finalBreakdown);
    
    setFormJumlah(item.jumlah);
    setFormHarga(item.hargaSatuan);
    setFormAmbang(item.ambangBatas);
    setFormFotoUrl(item.fotoBarang);
    setFormKategori(item.kategori || '');
    setIsModalOpen(true);
  };

  // Drive Photo Upload handler
  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    setError(null);
    try {
      // 1. Get photo folder ID or create it
      const folderId = await getOrCreatePhotoFolder(token);
      // 2. Upload file to Drive
      const fileUrl = await uploadImageToDrive(token, folderId, file);
      setFormFotoUrl(fileUrl);
    } catch (err: any) {
      console.error(err);
      setError('Gagal mengunggah gambar ke Google Drive. Coba ukuran file lebih kecil atau format JPEG/PNG.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoUpload(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const executeCatalogSaveWithOverride = async () => {
    if (!catalogCollisionItem) return;
    setSavingCatalog(true);
    setSyncStatus('syncing');

    const oldCollisionCode = catalogCollisionItem.kode;
    const newUniqueCode = generateNextProductCode();

    // 1. Update the colliding catalog item to the new unique code
    let updatedCatalog = catalogItems.map(item => {
      if (item.kode === oldCollisionCode) {
        return { ...item, kode: newUniqueCode };
      }
      return item;
    });

    // Also update any matching inventory item to the new unique code
    let updatedItems = items.map(item => {
      if (item.kode === oldCollisionCode) {
        return { ...item, kode: newUniqueCode };
      }
      return item;
    });

    const finalCatKode = formatProductCode(formCatKode) || formCatKode.trim().toUpperCase();

    // 2. Prepare our new/edited catalog item
    const newCatalogItem: CatalogItem = {
      kode: finalCatKode,
      nama: formCatNama.trim(),
      kategori: formCatKategori.trim(),
      harga: Number(formCatHarga) || 0,
      foto: formCatFoto.trim(),
      hargaReseller: Number(formCatHargaReseller) || 0,
      jenis: formCatJenis.trim(),
      motif: formCatMotif.trim(),
      warna: formCatWarna.trim(),
      ukuran: formCatUkuran.trim(),
      ukuran2: formCatUkuran2.trim() || undefined,
      harga2: formCatUkuran2.trim() ? (Number(formCatHarga2) || undefined) : undefined,
      hargaReseller2: formCatUkuran2.trim() ? (Number(formCatHargaReseller2) || undefined) : undefined,
      ukuran3: formCatUkuran3.trim() || undefined,
      harga3: formCatUkuran3.trim() ? (Number(formCatHarga3) || undefined) : undefined,
      hargaReseller3: formCatUkuran3.trim() ? (Number(formCatHargaReseller3) || undefined) : undefined,
    };

    // 3. Put our new/edited catalog item into the list
    if (editingCatalogItem) {
      updatedCatalog = updatedCatalog.map(item =>
        item.kode === editingCatalogItem.kode ? newCatalogItem : item
      );
    } else {
      updatedCatalog.push(newCatalogItem);
    }

    const logAksi = editingCatalogItem ? 'Edit Katalog (Resolusi Tabrakan)' : 'Tambah Katalog (Resolusi Tabrakan)';
    const logDetail = `Menggunakan kode "${newCatalogItem.kode}" untuk "${newCatalogItem.nama}". Mengubah kode produk lama "${oldCollisionCode}" ("${catalogCollisionItem.nama}") menjadi "${newUniqueCode}".`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveCatalogData(token, spreadsheet.id, updatedCatalog),
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setCatalogItems(updatedCatalog);
      setItems(updatedItems);
      setActivityLogs(updatedLogs);
      setCatalogCollisionItem(null);
      setIsCatalogModalOpen(false);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setCatalogError('Gagal menyimpan data katalog ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingCatalog(false);
    }
  };

  const executeInventorySaveWithOverride = async () => {
    if (!inventoryCollisionItem) return;
    setLoading(true);
    setSyncStatus('syncing');

    const oldCollisionCode = inventoryCollisionItem.kode;
    const newUniqueCode = generateNextProductCode();

    // 1. Update colliding inventory item to the new unique code
    let updatedItems = items.map(item => {
      if (item.kode === oldCollisionCode) {
        return { ...item, kode: newUniqueCode };
      }
      return item;
    });

    // Also update any matching catalog item to the new unique code to maintain sync
    let updatedCatalog = catalogItems.map(item => {
      if (item.kode === oldCollisionCode) {
        return { ...item, kode: newUniqueCode };
      }
      return item;
    });

    const finalKode = formatProductCode(formKode) || formKode.trim().toUpperCase();

    // 2. Prepare our new/edited inventory item
    const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === finalKode);
    const finalHarga = matchedCatalog ? matchedCatalog.harga : (Number(formHarga) || 0);
    const finalFoto = matchedCatalog ? (matchedCatalog.foto || '') : formFotoUrl.trim();

    let finalNama = formNama.trim();
    if (Object.keys(formSizesStock).length > 0) {
      finalNama = buildInventoryItemName(formNama.trim(), formSizesStock);
    }

    const newItem: InventoryItem = {
      kode: finalKode,
      nama: finalNama,
      jumlah: Number(formJumlah) || 0,
      hargaSatuan: finalHarga,
      fotoBarang: finalFoto,
      ambangBatas: Number(formAmbang) || 0,
      kategori: formKategori
    };

    // 3. Put our new/edited inventory item into the list
    if (editingItem) {
      updatedItems = updatedItems.map(item =>
        item.kode === editingItem.kode ? newItem : item
      );
    } else {
      const existingIdx = updatedItems.findIndex(item => item.kode.toUpperCase() === newItem.kode);
      if (existingIdx !== -1) {
        updatedItems[existingIdx] = newItem;
      } else {
        updatedItems.push(newItem);
      }
    }

    const logAksi = editingItem ? 'Edit Barang (Resolusi Tabrakan)' : 'Tambah Barang (Resolusi Tabrakan)';
    const logDetail = `Menggunakan kode "${newItem.kode}" untuk "${newItem.nama}". Mengubah kode barang lama "${oldCollisionCode}" ("${inventoryCollisionItem.nama}") menjadi "${newUniqueCode}".`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveCatalogData(token, spreadsheet.id, updatedCatalog),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setItems(updatedItems);
      setCatalogItems(updatedCatalog);
      setActivityLogs(updatedLogs);
      setInventoryCollisionItem(null);
      setIsModalOpen(false);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setDuplicateCodeError('Gagal menyimpan data ke Google Sheets. Silakan coba kembali.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Form Submit (Save / Add)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateCodeError(null);

    if (!formKode.trim() || !formNama.trim()) {
      setDuplicateCodeError('Kode dan Nama barang wajib diisi!');
      return;
    }

    setLoading(true);
    setSyncStatus('syncing');

    const formattedCode = formatProductCode(formKode);
    if (!formattedCode) {
      setDuplicateCodeError("Format kode produk tidak valid! Kode produk harus diawali dengan 'NI-' diikuti oleh angka (contoh: NI-001).");
      setLoading(false);
      setSyncStatus('synced');
      return;
    }
    
    const finalKode = formattedCode;
    
    // Create new copy of current list
    let updatedItems = [...items];
    
    // Auto-retrieve photo and price from catalog database if matched by code
    const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === finalKode);
    const finalHarga = matchedCatalog ? matchedCatalog.harga : (Number(formHarga) || 0);
    const finalFoto = matchedCatalog ? (matchedCatalog.foto || '') : formFotoUrl.trim();

    // Rebuild name based on sizes stock breakdown if we have a breakdown
    let finalNama = formNama.trim();
    if (Object.keys(formSizesStock).length > 0) {
      finalNama = buildInventoryItemName(formNama.trim(), formSizesStock);
    }

    const newItem: InventoryItem = {
      kode: finalKode,
      nama: finalNama,
      jumlah: Number(formJumlah) || 0,
      hargaSatuan: finalHarga,
      fotoBarang: finalFoto,
      ambangBatas: Number(formAmbang) || 0,
      kategori: formKategori
    };

    // Check for product code collision
    const collidingItem = items.find(
      item => item.kode.toUpperCase() === newItem.kode && 
      (!editingItem || item.kode !== editingItem.kode)
    );
    if (collidingItem) {
      setInventoryCollisionItem(collidingItem);
      setLoading(false);
      setSyncStatus('synced');
      return;
    }

    if (editingItem) {
      // Edit existing
      updatedItems = updatedItems.map(item => 
        item.kode === editingItem.kode ? newItem : item
      );
    } else {
      // Add new - if already exists in inventory, overwrite/merge!
      const existingIdx = items.findIndex(item => item.kode.toUpperCase() === newItem.kode);
      if (existingIdx !== -1) {
        updatedItems[existingIdx] = newItem;
      } else {
        updatedItems.push(newItem);
      }
    }

    const logAksi = editingItem ? 'Edit Barang' : 'Tambah Barang';
    const logDetail = editingItem 
      ? `Mengubah data barang "${newItem.nama}" (${newItem.kode}).`
      : `Menambah barang baru "${newItem.nama}" (${newItem.kode}) dengan stok ${newItem.jumlah} Pcs.`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setItems(updatedItems);
      setActivityLogs(updatedLogs);
      setIsModalOpen(false);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setError('Gagal menyimpan data ke Google Sheets. Silakan coba kembali.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Item (MANDATORY User Confirmation for destructive ops)
  const executeDeleteItem = async (itemToDelete: InventoryItem) => {
    setLoading(true);
    setSyncStatus('syncing');
    
    const updatedItems = items.filter(i => i.kode !== itemToDelete.kode);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Hapus Barang',
      detail: `Menghapus barang "${itemToDelete.nama}" (${itemToDelete.kode}) dari inventaris.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setItems(updatedItems);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setError('Gagal menghapus data di Google Sheets. Silakan coba kembali.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setDeletingInventoryItem(null);
    }
  };

  // Fast adjust stock quantity directly from the table (Great staff/quick flow)
  const handleQuickAdjustStock = async (item: InventoryItem, delta: number) => {
    const newQty = item.jumlah + delta;
    if (newQty < 0) return;

    setSyncStatus('syncing');
    
    let newNama = item.nama;
    const updatedItems = items.map(i => {
      if (i.kode === item.kode) {
        const { baseName, breakdown } = parseInventoryItemName(i.nama);
        if (Object.keys(breakdown).length > 0) {
          const updatedBreakdown = { ...breakdown };
          const keys = Object.keys(updatedBreakdown);
          if (delta > 0) {
            const firstKey = keys[0];
            updatedBreakdown[firstKey] = (updatedBreakdown[firstKey] || 0) + delta;
          } else {
            const keyToDecrement = keys.find(k => (updatedBreakdown[k] || 0) > 0) || keys[0];
            updatedBreakdown[keyToDecrement] = Math.max(0, (updatedBreakdown[keyToDecrement] || 0) + delta);
          }
          newNama = buildInventoryItemName(baseName, updatedBreakdown);
          const newTotal = (Object.values(updatedBreakdown) as number[]).reduce((sum, qty) => sum + qty, 0);
          return { ...i, nama: newNama, jumlah: newTotal };
        } else {
          return { ...i, jumlah: newQty };
        }
      }
      return i;
    });

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Ubah Stok',
      detail: `Menyesuaikan stok "${item.nama}" (${item.kode}) dari ${item.jumlah} menjadi ${newQty} Pcs (Selisih: ${delta > 0 ? '+' : ''}${delta}).`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setItems(updatedItems);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setError('Gagal memperbarui jumlah stok di spreadsheet.');
      setSyncStatus('error');
    }
  };

  const getPricesForSize = (cat: CatalogItem | undefined, sizeName: string, tipePelanggan: 'Standard' | 'Reseller') => {
    if (!cat) return 0;
    const sName = sizeName.trim().toUpperCase();
    const s1 = (cat.ukuran || 'Standard').trim().toUpperCase();
    const s2 = (cat.ukuran2 || '').trim().toUpperCase();
    const s3 = (cat.ukuran3 || '').trim().toUpperCase();

    if (sName === s1) {
      return tipePelanggan === 'Reseller' && cat.hargaReseller && cat.hargaReseller > 0 
        ? cat.hargaReseller 
        : cat.harga;
    }
    if (s2 && sName === s2) {
      return tipePelanggan === 'Reseller' && cat.hargaReseller2 && cat.hargaReseller2 > 0 
        ? cat.hargaReseller2 
        : (cat.harga2 || cat.harga);
    }
    if (s3 && sName === s3) {
      return tipePelanggan === 'Reseller' && cat.hargaReseller3 && cat.hargaReseller3 > 0 
        ? cat.hargaReseller3 
        : (cat.harga3 || cat.harga);
    }

    return tipePelanggan === 'Reseller' && cat.hargaReseller && cat.hargaReseller > 0 
      ? cat.hargaReseller 
      : cat.harga;
  };

  // Record a sales transaction
  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalesError(null);
    setSalesSuccess(null);

    if (!formSaleKode) {
      setSalesError('Silakan pilih produk terlebih dahulu.');
      return;
    }

    const item = items.find(i => i.kode === formSaleKode);
    if (!item) {
      setSalesError('Produk tidak ditemukan.');
      return;
    }

    if (formSaleJumlah <= 0) {
      setSalesError('Jumlah penjualan harus lebih besar dari 0.');
      return;
    }

    const { baseName, breakdown } = parseInventoryItemName(item.nama);
    const hasBreakdown = Object.keys(breakdown).length > 0;
    if (hasBreakdown && !formSaleUkuran) {
      setSalesError('Silakan pilih ukuran terlebih dahulu.');
      return;
    }

    const availableSizeStock = (formSaleUkuran && breakdown[formSaleUkuran] !== undefined)
      ? (breakdown[formSaleUkuran] || 0)
      : item.jumlah;

    if (formSaleJumlah > availableSizeStock) {
      setSalesError(`Stok untuk ukuran "${formSaleUkuran || 'Standard'}" tidak mencukupi. Tersedia: ${availableSizeStock} unit.`);
      return;
    }

    setRecordingSale(true);
    setSyncStatus('syncing');

    // Prepare updated item and new sales transaction
    let newNama = item.nama;
    let updatedQty = item.jumlah - formSaleJumlah;

    if (formSaleUkuran) {
      const updatedBreakdown = { ...breakdown };
      
      // If we have catalog sizes, populate them with 0 first if they don't exist in the breakdown
      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === item.kode.toUpperCase());
      if (matchedCat) {
        const catSizes = [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[];
        catSizes.forEach(sz => {
          if (updatedBreakdown[sz] === undefined) {
            updatedBreakdown[sz] = Object.keys(breakdown).length === 0 && sz === formSaleUkuran ? item.jumlah : 0;
          }
        });
      }

      // Ensure formSaleUkuran exists in updatedBreakdown
      if (updatedBreakdown[formSaleUkuran] === undefined) {
        updatedBreakdown[formSaleUkuran] = item.jumlah;
      }

      updatedBreakdown[formSaleUkuran] = Math.max(0, (updatedBreakdown[formSaleUkuran] || 0) - formSaleJumlah);
      newNama = buildInventoryItemName(baseName, updatedBreakdown);
      updatedQty = (Object.values(updatedBreakdown) as number[]).reduce((sum, qty) => sum + qty, 0);
    }

    const updatedItems = items.map(i => {
      if (i.kode === item.kode) {
        return { ...i, nama: newNama, jumlah: updatedQty };
      }
      return i;
    });

    const transactionNama = formSaleUkuran 
      ? `${baseName} [Ukuran: ${formSaleUkuran}]` 
      : item.nama;

    const newTransaction: SalesTransaction = {
      id: `TRX-${Date.now()}`,
      tanggal: formSaleTanggal,
      kodeBarang: item.kode,
      namaBarang: transactionNama,
      jumlah: formSaleJumlah,
      hargaSatuan: formSaleHarga || item.hargaSatuan,
      total: formSaleJumlah * (formSaleHarga || item.hargaSatuan),
      ukuran: formSaleUkuran || 'Standard',
      tipePelanggan: formSaleTipePelanggan,
      catatan: formSaleCatatan
    };

    const updatedSales = [newTransaction, ...sales];

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Penjualan',
      detail: `Mencatat penjualan "${transactionNama}" (${item.kode}) sebanyak ${formSaleJumlah} Pcs. Catatan: ${formSaleCatatan || '-'}. Stok berkurang dari ${item.jumlah} menjadi ${updatedQty} Pcs.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      // Save both to Spreadsheet!
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveSalesData(token, spreadsheet.id, updatedSales),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      // Update local state
      setItems(updatedItems);
      setSales(updatedSales);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setSalesSuccess(`Penjualan berhasil disimpan ke tab "Penjualan" di Google Sheets! Stok "${transactionNama}" berkurang menjadi ${updatedQty} unit.`);
      
      // Reset form fields
      setFormSaleKode('');
      setFormSaleUkuran('');
      setFormSaleJumlah(1);
      setFormSaleHarga(0);
      setFormSaleTipePelanggan('Standard');
      setFormSaleCatatan('');
    } catch (err: any) {
      console.error(err);
      setSalesError('Gagal menyimpan transaksi penjualan ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setRecordingSale(false);
    }
  };

  const handleProductSelection = (code: string) => {
    setFormSaleKode(code);
    const selectedItem = syncedItems.find(i => i.kode === code);
    if (selectedItem) {
      setFormSaleUkuran('');
      setFormSaleHarga(0);
      setFormSaleJumlah(1);
    } else {
      setFormSaleHarga(0);
      setFormSaleUkuran('');
    }
  };

  const changeTipePelanggan = (tipe: 'Standard' | 'Reseller') => {
    setFormSaleTipePelanggan(tipe);
    if (formSaleKode && formSaleUkuran) {
      const selectedItem = syncedItems.find(i => i.kode === formSaleKode);
      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === formSaleKode.toUpperCase());
      if (matchedCat) {
        const price = getPricesForSize(matchedCat, formSaleUkuran, tipe) || selectedItem?.hargaSatuan || 0;
        setFormSaleHarga(price);
      } else if (selectedItem) {
        setFormSaleHarga(selectedItem.hargaSatuan);
      }
    }
  };

  // Revert/Delete a sales transaction (restores inventory stock)
  const handleDeleteSale = async (saleToDelete: SalesTransaction) => {
    setLoading(true);
    setSyncStatus('syncing');

    const soldUkuran = saleToDelete.ukuran || extractSoldUkuran(saleToDelete.namaBarang);

    // Restore stock in inventory
    const updatedItems = items.map(i => {
      if (i.kode === saleToDelete.kodeBarang) {
        const { baseName, breakdown } = parseInventoryItemName(i.nama);
        if (soldUkuran) {
          const updatedBreakdown = { ...breakdown };
          
          // Let's check catalog sizes to see if we should initialize them if breakdown is empty or missing this size
          const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === i.kode.toUpperCase());
          if (matchedCat) {
            const catSizes = [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[];
            catSizes.forEach(sz => {
              if (updatedBreakdown[sz] === undefined) {
                updatedBreakdown[sz] = 0;
              }
            });
          }

          // Ensure the sold size exists in the breakdown
          if (updatedBreakdown[soldUkuran] === undefined) {
            updatedBreakdown[soldUkuran] = 0;
          }

          updatedBreakdown[soldUkuran] = (updatedBreakdown[soldUkuran] || 0) + saleToDelete.jumlah;
          const newNama = buildInventoryItemName(baseName, updatedBreakdown);
          const newTotal = (Object.values(updatedBreakdown) as number[]).reduce((sum, qty) => sum + qty, 0);
          return { ...i, nama: newNama, jumlah: newTotal };
        } else {
          return { ...i, jumlah: i.jumlah + saleToDelete.jumlah };
        }
      }
      return i;
    });

    // Remove sale transaction
    const updatedSales = sales.filter(s => s.id !== saleToDelete.id);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Batalkan Penjualan',
      detail: `Membatalkan transaksi penjualan "${saleToDelete.namaBarang}" (${saleToDelete.kodeBarang}) sebanyak ${saleToDelete.jumlah} Pcs. Stok dikembalikan.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveSalesData(token, spreadsheet.id, updatedSales),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      setItems(updatedItems);
      setSales(updatedSales);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setSalesSuccess('Transaksi berhasil dibatalkan dan dihapus dari tab "Penjualan" di Google Sheets. Stok telah dipulihkan.');
    } catch (err: any) {
      console.error(err);
      setSalesError('Gagal membatalkan transaksi di Google Sheets.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setDeletingSaleItem(null);
    }
  };

  // Helper to record finished PreOrder to Sales tab in Google Sheets
  const recordPoAsSale = async (po: PreOrder, currentSales: SalesTransaction[]) => {
    const saleId = `TRX-${po.id}`;
    // Check if this pre-order has already been recorded in sales to prevent duplicate logging
    if (currentSales.some(s => s.id === saleId)) {
      return currentSales;
    }

    const newSale: SalesTransaction = {
      id: saleId,
      tanggal: new Date().toISOString().split('T')[0],
      kodeBarang: po.id,
      namaBarang: `PreOrder: ${po.namaPengepul} - ${po.pesananDetail.replace(/\n/g, '; ').slice(0, 100)}`,
      jumlah: 1,
      hargaSatuan: po.totalBiaya,
      total: po.totalBiaya
    };

    const updatedSales = [newSale, ...currentSales];
    await saveSalesData(token, spreadsheet.id, updatedSales);
    setSales(updatedSales);
    return updatedSales;
  };

  // Submit/Add or Edit PreOrder
  const handlePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPoNamaPengepul.trim()) {
      setPoError('Nama pengepul wajib diisi.');
      return;
    }
    if (!formPoDetail.trim()) {
      setPoError('Detail pesanan wajib diisi.');
      return;
    }
    if (!formPoTargetTanggal) {
      setPoError('Tanggal target selesai wajib diisi.');
      return;
    }

    setSavingPo(true);
    setSyncStatus('syncing');
    setPoError(null);
    setPoSuccess(null);

    let updatedPos: PreOrder[] = [];
    let savedPo: PreOrder;

    const finalTotalBiaya = formPoBiaya || 0;

    if (editingPo) {
      // Editing Mode
      const updatedPoItem: PreOrder = {
        ...editingPo,
        namaPengepul: formPoNamaPengepul.trim(),
        kontakPengepul: formPoKontak.trim(),
        pesananDetail: formPoDetail.trim(),
        tanggalTargetSelesai: formPoTargetTanggal,
        status: formPoStatus,
        totalBiaya: finalTotalBiaya,
        nominalDp: formPoNominalDp || 0,
        sisaPembayaran: formPoSisaPembayaran || 0,
        tipeOrder: formPoTipeOrder || 'Standard',
        isiNama: formPoIsiNama,
        namaCustom: formPoNamaCustom.trim()
      };
      savedPo = updatedPoItem;
      updatedPos = preOrders.map(p => p.id === editingPo.id ? updatedPoItem : p);
    } else {
      // Creating Mode
      const newPoItem: PreOrder = {
        id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        tanggalPemesanan: new Date().toISOString().split('T')[0],
        namaPengepul: formPoNamaPengepul.trim(),
        kontakPengepul: formPoKontak.trim(),
        pesananDetail: formPoDetail.trim(),
        tanggalTargetSelesai: formPoTargetTanggal,
        status: formPoStatus,
        totalBiaya: finalTotalBiaya,
        nominalDp: formPoNominalDp || 0,
        sisaPembayaran: formPoSisaPembayaran || 0,
        tipeOrder: formPoTipeOrder || 'Standard',
        isiNama: formPoIsiNama,
        namaCustom: formPoNamaCustom.trim()
      };
      savedPo = newPoItem;
      updatedPos = [newPoItem, ...preOrders];
    }

    const logAksi = editingPo ? 'Edit PreOrder' : 'Tambah PreOrder';
    const logDetail = editingPo 
      ? `Mengubah pesanan PreOrder dari "${savedPo.namaPengepul}" (ID: ${savedPo.id}).`
      : `Membuat pesanan PreOrder baru dari "${savedPo.namaPengepul}" (ID: ${savedPo.id}) sebesar ${formatRupiah(savedPo.totalBiaya)}.`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    let updatedLogs = [newLog, ...activityLogs];

    if (formPoStatus === 'selesai') {
      const saleLog: ActivityLog = {
        id: `LOG-${Date.now() + 1}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString(),
        operator: session.displayName || session.email || 'Sistem',
        aksi: 'Penjualan PreOrder',
        detail: `PreOrder ${savedPo.id} selesai, otomatis mencatat penjualan senilai ${formatRupiah(savedPo.totalBiaya)}.`
      };
      updatedLogs = [saleLog, ...updatedLogs];
    }

    try {
      await savePreOrdersData(token, spreadsheet.id, updatedPos);
      setPreOrders(updatedPos);

      // Automatically record as sales transaction if status is selesai
      if (formPoStatus === 'selesai') {
        await recordPoAsSale(savedPo, sales);
      }

      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);

      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setPoSuccess(
        formPoStatus === 'selesai'
          ? 'Pesanan PreOrder berhasil disimpan dan otomatis dicatat ke data Penjualan!'
          : editingPo 
            ? 'Pesanan PreOrder berhasil diperbarui di Google Sheets!' 
            : 'Pesanan PreOrder baru berhasil didata di Google Sheets!'
      );
      
      // Reset form fields
      setFormPoNamaPengepul('');
      setFormPoKontak('');
      setFormPoDetail('');
      setFormPoTargetTanggal('');
      setFormPoBiaya(0);
      setFormPoStatus('antrean');
      setFormPoNominalDp(0);
      setFormPoSisaPembayaran(0);
      setFormPoTipeOrder('Standard');
      setFormPoIsiNama(false);
      setFormPoNamaCustom('');
      setItemIsiNama(false);
      setItemNamaCustom('');
      setEditingPo(null);
      setIsPoModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setPoError('Gagal menyimpan data PreOrder ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingPo(false);
    }
  };

  // Open Edit Modal for PreOrder
  const openEditPoModal = (po: PreOrder) => {
    setEditingPo(po);
    setFormPoNamaPengepul(po.namaPengepul);
    setFormPoKontak(po.kontakPengepul || '');
    setFormPoDetail(po.pesananDetail);
    setFormPoTargetTanggal(po.tanggalTargetSelesai);
    
    setFormPoBiaya(po.totalBiaya);
    
    setFormPoStatus(po.status);
    setFormPoNominalDp(po.nominalDp || 0);
    setFormPoSisaPembayaran(po.sisaPembayaran || 0);
    setFormPoTipeOrder(po.tipeOrder || 'Standard');
    setFormPoIsiNama(po.isiNama || false);
    setFormPoNamaCustom(po.namaCustom || '');
    setItemIsiNama(false);
    setItemNamaCustom('');
    setPoError(null);
    setPoSuccess(null);
    setIsPoModalOpen(true);
  };

  // Open Add Modal for PreOrder
  const openAddPoModal = () => {
    setEditingPo(null);
    setFormPoNamaPengepul('');
    setFormPoKontak('');
    setFormPoDetail('');
    setFormPoTargetTanggal('');
    setFormPoBiaya(0);
    setFormPoStatus('antrean');
    setFormPoNominalDp(0);
    setFormPoSisaPembayaran(0);
    setFormPoTipeOrder('Standard');
    setFormPoIsiNama(false);
    setFormPoNamaCustom('');
    setItemIsiNama(false);
    setItemNamaCustom('');
    setPoError(null);
    setPoSuccess(null);
    setIsPoModalOpen(true);
  };

  // Quick Change Status PreOrder
  const handlePoStatusChange = async (poId: string, newStatus: 'antrean' | 'proses' | 'siap' | 'selesai' | 'dibatalkan') => {
    setSyncStatus('syncing');
    const updatedPos = preOrders.map(p => {
      if (p.id === poId) {
        return { ...p, status: newStatus };
      }
      return p;
    });

    const po = preOrders.find(p => p.id === poId);
    const originalStatusName = po ? po.status : '';
    const namePengepul = po ? po.namaPengepul : '';
    const logAksi = 'Ubah Status PreOrder';
    const logDetail = `Mengubah status PreOrder "${namePengepul}" (ID: ${poId}) dari "${originalStatusName}" menjadi "${newStatus}".`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    let updatedLogs = [newLog, ...activityLogs];

    if (newStatus === 'selesai' && po) {
      const saleLog: ActivityLog = {
        id: `LOG-${Date.now() + 1}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString(),
        operator: session.displayName || session.email || 'Sistem',
        aksi: 'Penjualan PreOrder',
        detail: `PreOrder ${poId} selesai, otomatis mencatat penjualan senilai ${formatRupiah(po.totalBiaya)}.`
      };
      updatedLogs = [saleLog, ...updatedLogs];
    }

    try {
      await savePreOrdersData(token, spreadsheet.id, updatedPos);
      setPreOrders(updatedPos);

      // Automatically record as sales transaction if status is selesai
      if (newStatus === 'selesai') {
        if (po) {
          await recordPoAsSale({ ...po, status: 'selesai' }, sales);
          setPoSuccess(`PreOrder ${po.id} berhasil diselesaikan dan dicatat secara otomatis ke data Penjualan!`);
        }
      }

      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);

      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  // Delete PreOrder (Trigger custom confirmation modal)
  const handleDeletePo = (poToDelete: PreOrder) => {
    setDeletingPoItem(poToDelete);
  };

  // Execute actual deletion of PreOrder from Google Sheets
  const executeDeletePo = async (poToDelete: PreOrder) => {
    setLoading(true);
    setSyncStatus('syncing');
    const updatedPos = preOrders.filter(p => p.id !== poToDelete.id);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Hapus PreOrder',
      detail: `Menghapus pesanan PreOrder dari "${poToDelete.namaPengepul}" (ID: ${poToDelete.id}).`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        savePreOrdersData(token, spreadsheet.id, updatedPos),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setPreOrders(updatedPos);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setPoSuccess(`Pesanan PreOrder ${poToDelete.id} berhasil dihapus.`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setDeletingPoItem(null);
    }
  };

  // Handle PDF Download for single PreOrder as production slip
  const handleDownloadPoPDF = (po: PreOrder) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5' // A5 is perfect for an Order Slip / SPK!
      });

      // Header Banner (Dark Slate background)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 148, 25, 'F'); // A5 is 148mm wide

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SURAT PERINTAH KERJA PRODUKSI (SPK)", 10, 11);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Nyiur Indah Inventaris & PreOrder System", 10, 16);
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 10, 21);

      // Section: Order Info
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("INFORMASI PESANAN", 10, 34);

      const readableStatus = 
        po.status === 'antrean' ? 'Mulai' :
        po.status === 'proses' ? 'Sedang Proses Pengerjaan' :
        po.status === 'siap' ? 'Siap Diambil / Produk Sudah Selesai' :
        po.status === 'selesai' ? 'Selesai & Produk Sudah Diambil' : 'Batalkan';

      const readableIsiNama = po.isiNama ? 'YA (+Rp 5.000/Huruf)' : 'TIDAK';
      const readableNamaCustom = po.isiNama ? `"${po.namaCustom || ''}" (${(po.namaCustom || '').replace(/[^a-zA-Z0-9]/g, '').length} Huruf)` : '-';

      const infoItems = [
        { label: "ID PreOrder", value: po.id },
        { label: "Tipe PreOrder", value: po.tipeOrder === 'Reseller' ? 'RESELLER' : 'STANDARD / RETAIL' },
        { label: "Nama Pengepul", value: po.namaPengepul },
        { label: "Kontak/HP", value: po.kontakPengepul || '-' },
        { label: "Tanggal Pemesanan", value: po.tanggalPemesanan },
        { label: "Target Selesai", value: po.tanggalTargetSelesai },
        { label: "Status", value: readableStatus.toUpperCase() },
        { label: "Custom Isi Nama", value: readableIsiNama },
        { label: "Custom Nama", value: readableNamaCustom }
      ];

      // Calculate info card height dynamically based on value line counts
      let cardHeight = 6; // padding top and bottom
      const itemRowHeights = infoItems.map(item => {
        const splitVal = doc.splitTextToSize(item.value, 88);
        return Math.max(1, splitVal.length) * 4.5;
      });
      const totalRowsHeight = itemRowHeights.reduce((sum, h) => sum + h, 0);
      cardHeight += totalRowsHeight + 2;

      // Draw light background card for info
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(8, 37, 132, cardHeight, 'F');
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(8, 37, 132, cardHeight, 'S');

      // Now draw the content of the info card
      let textY = 42;
      infoItems.forEach((item, idx) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(item.label, 12, textY);
        
        doc.setFont("helvetica", "normal");
        doc.text(":", 43, textY);
        
        const splitVal = doc.splitTextToSize(item.value, 88);
        splitVal.forEach((line, lineIdx) => {
          doc.text(line, 45, textY + (lineIdx * 4.5));
        });
        
        textY += itemRowHeights[idx];
      });

      // Section: Pesanan Detail starting dynamically below info card
      const detailSectionY = 37 + cardHeight + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("DETAIL BARANG PRODUKSI", 10, detailSectionY);

      const detailBoxY = detailSectionY + 3;
      
      // Wrap text for pesananDetail with robust dynamic size calculations
      const detailLines = doc.splitTextToSize(po.pesananDetail, 124);
      const detailBoxHeight = Math.max(15, detailLines.length * 5 + 6);

      // Draw dynamic box for detail
      doc.setFillColor(255, 255, 255);
      doc.rect(8, detailBoxY, 132, detailBoxHeight, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(8, detailBoxY, 132, detailBoxHeight, 'S');

      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      
      let detailTextY = detailBoxY + 6;
      detailLines.forEach((line) => {
        doc.text(line, 12, detailTextY);
        detailTextY += 5;
      });

      // Total Biaya Box (Highlighted) placed dynamically below details box
      const totalBoxY = detailBoxY + detailBoxHeight + 4;
      doc.setFillColor(239, 246, 255); // blue-50
      doc.rect(8, totalBoxY, 132, 22, 'F');
      doc.setDrawColor(191, 219, 254); // blue-200
      doc.rect(8, totalBoxY, 132, 22, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // slate-700
      
      doc.text("ESTIMASI TOTAL BIAYA:", 12, totalBoxY + 6.5);
      const totalText = 'Rp ' + po.totalBiaya.toLocaleString('id-ID');
      doc.text(totalText, 140 - doc.getTextWidth(totalText), totalBoxY + 6.5);

      doc.setTextColor(51, 65, 85);
      doc.text("NOMINAL DP DIBAYAR:", 12, totalBoxY + 11.5);
      const dpText = 'Rp ' + (po.nominalDp || 0).toLocaleString('id-ID');
      doc.text(dpText, 140 - doc.getTextWidth(dpText), totalBoxY + 11.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text("SISA TAGIHAN / SISA BAYAR:", 12, totalBoxY + 17);
      const sisaText = 'Rp ' + (Math.max(0, po.totalBiaya - (po.nominalDp || 0))).toLocaleString('id-ID');
      doc.text(sisaText, 140 - doc.getTextWidth(sisaText), totalBoxY + 17);

      // Signature Area placed dynamically, adding a page if near the bottom boundary
      let signatureY = totalBoxY + 22 + 8;
      if (signatureY + 22 > 200) {
        doc.addPage();
        // Draw continuation header on the second page
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 148, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`SPK PRODUKSI - ${po.id} (Lanjutan)`, 10, 8);
        
        signatureY = 25; // Reset to top margin on page 2
      }

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Disiapkan Oleh,", 12, signatureY);
      doc.text("Diterima Produksi,", 100, signatureY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(session.displayName, 12, signatureY + 18);
      doc.text("(......................................)", 100, signatureY + 18);

      // Save PDF
      doc.save(`SPK_PreOrder_${po.id}_${po.namaPengepul.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error("Gagal membuat PDF SPK:", err);
    }
  };

  // Catalog Operations
  const openAddCatalogModal = () => {
    setEditingCatalogItem(null);
    setCatalogError(null);
    setCatalogSuccess(null);
    setFormCatKode(generateNextProductCode()); // Auto-generate code
    setFormCatNama('');
    setIsAutoCatNama(true);
    setFormCatKategori(categories[0] || '');
    setFormCatHarga(50000);
    setFormCatHargaReseller(0);
    setFormCatFoto('');
    setFormCatJenis(jenisList[0] || '');
    setFormCatMotif(motifList[0] || '');
    setFormCatWarna(warnaList[0] || '');
    setFormCatUkuran(ukuranList[0] || '');
    setFormCatUkuran2('');
    setFormCatHarga2(0);
    setFormCatHargaReseller2(0);
    setFormCatUkuran3('');
    setFormCatHarga3(0);
    setFormCatHargaReseller3(0);
    setIsCatalogModalOpen(true);
  };

  const openEditCatalogModal = (item: CatalogItem) => {
    setEditingCatalogItem(item);
    setCatalogError(null);
    setCatalogSuccess(null);
    setFormCatKode(item.kode);
    setFormCatNama(item.nama);
    
    // Always check the auto name checkbox by default when editing or adding
    setIsAutoCatNama(true);

    setFormCatKategori(item.kategori || '');
    setFormCatHarga(item.harga);
    setFormCatHargaReseller(item.hargaReseller || 0);
    setFormCatFoto(item.foto);
    setFormCatJenis(item.jenis || jenisList[0] || '');
    setFormCatMotif(item.motif || motifList[0] || '');
    setFormCatWarna(item.warna || warnaList[0] || '');
    setFormCatUkuran(item.ukuran || ukuranList[0] || '');
    setFormCatUkuran2(item.ukuran2 || '');
    setFormCatHarga2(item.harga2 || 0);
    setFormCatHargaReseller2(item.hargaReseller2 || 0);
    setFormCatUkuran3(item.ukuran3 || '');
    setFormCatHarga3(item.harga3 || 0);
    setFormCatHargaReseller3(item.hargaReseller3 || 0);
    setIsCatalogModalOpen(true);
  };

  const handleCatalogPhotoUpload = async (file: File) => {
    setUploadingCatalogPhoto(true);
    setCatalogError(null);
    try {
      const folderId = await getOrCreatePhotoFolder(token);
      const fileUrl = await uploadImageToDrive(token, folderId, file);
      setFormCatFoto(fileUrl);
    } catch (err: any) {
      console.error(err);
      setCatalogError('Gagal mengunggah foto ke Google Drive. Coba file yang lebih kecil.');
    } finally {
      setUploadingCatalogPhoto(false);
    }
  };

  const handleCatalogFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCatalogPhotoUpload(e.target.files[0]);
    }
  };

  const handleCatalogDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setCatDragActive(true);
    } else if (e.type === 'dragleave') {
      setCatDragActive(false);
    }
  };

  const handleCatalogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCatDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCatalogPhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogError(null);

    if (!formCatKode.trim() || !formCatNama.trim()) {
      setCatalogError('Kode dan Nama produk wajib diisi!');
      return;
    }

    setSavingCatalog(true);
    setSyncStatus('syncing');

    const formattedCode = formatProductCode(formCatKode);
    if (!formattedCode) {
      setCatalogError("Format kode produk tidak valid! Kode produk harus diawali dengan 'NI-' diikuti oleh angka (contoh: NI-001).");
      setSavingCatalog(false);
      setSyncStatus('synced');
      return;
    }

    const finalCatKode = formattedCode;

    let updatedCatalog = [...catalogItems];
    const newCatalogItem: CatalogItem = {
      kode: finalCatKode,
      nama: formCatNama.trim(),
      kategori: formCatKategori.trim(),
      harga: Number(formCatHarga) || 0,
      foto: formCatFoto.trim(),
      hargaReseller: Number(formCatHargaReseller) || 0,
      jenis: formCatJenis.trim(),
      motif: formCatMotif.trim(),
      warna: formCatWarna.trim(),
      ukuran: formCatUkuran.trim(),
      ukuran2: formCatUkuran2.trim() || undefined,
      harga2: formCatUkuran2.trim() ? (Number(formCatHarga2) || undefined) : undefined,
      hargaReseller2: formCatUkuran2.trim() ? (Number(formCatHargaReseller2) || undefined) : undefined,
      ukuran3: formCatUkuran3.trim() || undefined,
      harga3: formCatUkuran3.trim() ? (Number(formCatHarga3) || undefined) : undefined,
      hargaReseller3: formCatUkuran3.trim() ? (Number(formCatHargaReseller3) || undefined) : undefined,
    };

    if (duplicateCatalogItem) {
      setCatalogError(`Peringatan: Produk dengan kombinasi Kategori, Jenis, Motif, dan Warna tersebut sudah ada di katalog! (Kode: ${duplicateCatalogItem.kode} - ${duplicateCatalogItem.nama})`);
      setSavingCatalog(false);
      setSyncStatus('synced');
      return;
    }

    // Check for product code collision in Catalog Items
    const collidingCat = catalogItems.find(
      item => item.kode.toUpperCase() === newCatalogItem.kode &&
      (!editingCatalogItem || item.kode !== editingCatalogItem.kode)
    );
    if (collidingCat) {
      setCatalogCollisionItem(collidingCat);
      setSavingCatalog(false);
      setSyncStatus('synced');
      return;
    }

    if (editingCatalogItem) {
      updatedCatalog = updatedCatalog.map(item =>
        item.kode === editingCatalogItem.kode ? newCatalogItem : item
      );
    } else {
      updatedCatalog.push(newCatalogItem);
    }

    const logAksi = editingCatalogItem ? 'Edit Katalog' : 'Tambah Katalog';
    const logDetail = editingCatalogItem
      ? `Mengubah data katalog barang "${newCatalogItem.nama}" (${newCatalogItem.kode}).`
      : `Menambah barang baru "${newCatalogItem.nama}" (${newCatalogItem.kode}) ke Katalog.`;
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: logAksi,
      detail: logDetail
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveCatalogData(token, spreadsheet.id, updatedCatalog),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setCatalogItems(updatedCatalog);
      setActivityLogs(updatedLogs);
      setIsCatalogModalOpen(false);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setCatalogError('Gagal menyimpan data katalog ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingCatalog(false);
    }
  };

  // Custom Settings (Jenis, Motif, Warna, Ukuran) CRUD Handlers
  const handleAddSettingsItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);
    if (!settingsNewValue.trim()) {
      setSettingsError('Nama atribut tidak boleh kosong!');
      return;
    }

    const valueToAdd = settingsNewValue.trim();
    setSettingsLoading(true);
    setSyncStatus('syncing');

    let currentList: string[] = [];
    if (settingsTab === 'jenis') currentList = [...jenisList];
    else if (settingsTab === 'motif') currentList = [...motifList];
    else if (settingsTab === 'warna') currentList = [...warnaList];
    else if (settingsTab === 'ukuran') currentList = [...ukuranList];

    if (currentList.some(item => item.toLowerCase() === valueToAdd.toLowerCase())) {
      setSettingsError(`Atribut "${valueToAdd}" sudah terdaftar!`);
      setSettingsLoading(false);
      setSyncStatus('synced');
      return;
    }

    const newList = [...currentList, valueToAdd];

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: `Tambah ${settingsTab.toUpperCase()}`,
      detail: `Menambah atribut ${settingsTab} baru "${valueToAdd}" ke database.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      if (settingsTab === 'jenis') {
        await saveJenisData(token, spreadsheet.id, newList);
        setJenisList(newList);
        localStorage.setItem(`jenis_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'motif') {
        await saveMotifData(token, spreadsheet.id, newList);
        setMotifList(newList);
        localStorage.setItem(`motif_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'warna') {
        await saveWarnaData(token, spreadsheet.id, newList);
        setWarnaList(newList);
        localStorage.setItem(`warna_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'ukuran') {
        await saveUkuranData(token, spreadsheet.id, newList);
        setUkuranList(newList);
        localStorage.setItem(`ukuran_${spreadsheet.id}`, JSON.stringify(newList));
      }

      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);

      setSettingsNewValue('');
      setSettingsSuccess(`Berhasil menambah atribut ${settingsTab}: "${valueToAdd}"`);
      setSyncStatus('synced');
    } catch (err) {
      console.error(err);
      setSettingsError('Gagal menyimpan perubahan ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleEditSettingsItem = async (index: number) => {
    setSettingsError(null);
    setSettingsSuccess(null);
    if (!settingsEditingValue.trim()) {
      setSettingsError('Nama atribut tidak boleh kosong!');
      return;
    }

    const valueToSet = settingsEditingValue.trim();
    setSettingsLoading(true);
    setSyncStatus('syncing');

    let currentList: string[] = [];
    if (settingsTab === 'jenis') currentList = [...jenisList];
    else if (settingsTab === 'motif') currentList = [...motifList];
    else if (settingsTab === 'warna') currentList = [...warnaList];
    else if (settingsTab === 'ukuran') currentList = [...ukuranList];

    const oldValue = currentList[index];
    if (currentList.some((item, idx) => idx !== index && item.toLowerCase() === valueToSet.toLowerCase())) {
      setSettingsError(`Atribut "${valueToSet}" sudah terdaftar!`);
      setSettingsLoading(false);
      setSyncStatus('synced');
      return;
    }

    const newList = currentList.map((item, idx) => idx === index ? valueToSet : item);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: `Edit ${settingsTab.toUpperCase()}`,
      detail: `Mengubah atribut ${settingsTab} dari "${oldValue}" menjadi "${valueToSet}".`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      if (settingsTab === 'jenis') {
        await saveJenisData(token, spreadsheet.id, newList);
        setJenisList(newList);
        localStorage.setItem(`jenis_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'motif') {
        await saveMotifData(token, spreadsheet.id, newList);
        setMotifList(newList);
        localStorage.setItem(`motif_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'warna') {
        await saveWarnaData(token, spreadsheet.id, newList);
        setWarnaList(newList);
        localStorage.setItem(`warna_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'ukuran') {
        await saveUkuranData(token, spreadsheet.id, newList);
        setUkuranList(newList);
        localStorage.setItem(`ukuran_${spreadsheet.id}`, JSON.stringify(newList));
      }

      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);

      setSettingsEditingIndex(null);
      setSettingsEditingValue('');
      setSettingsSuccess(`Berhasil mengubah atribut ${settingsTab}: "${valueToSet}"`);
      setSyncStatus('synced');
    } catch (err) {
      console.error(err);
      setSettingsError('Gagal menyimpan perubahan ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteSettingsItem = (index: number) => {
    let currentList: string[] = [];
    if (settingsTab === 'jenis') currentList = jenisList;
    else if (settingsTab === 'motif') currentList = motifList;
    else if (settingsTab === 'warna') currentList = warnaList;
    else if (settingsTab === 'ukuran') currentList = ukuranList;

    setDeletingSettingsItem({ index, value: currentList[index] });
  };

  const executeDeleteSettingsItem = async (index: number) => {
    setSettingsError(null);
    setSettingsSuccess(null);
    setSettingsLoading(true);
    setSyncStatus('syncing');

    let currentList: string[] = [];
    if (settingsTab === 'jenis') currentList = [...jenisList];
    else if (settingsTab === 'motif') currentList = [...motifList];
    else if (settingsTab === 'warna') currentList = [...warnaList];
    else if (settingsTab === 'ukuran') currentList = [...ukuranList];

    if (index < 0 || index >= currentList.length) {
      setSettingsLoading(false);
      setSyncStatus('synced');
      return;
    }

    const valueToRemove = currentList[index];
    const newList = currentList.filter((_, idx) => idx !== index);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: `Hapus ${settingsTab.toUpperCase()}`,
      detail: `Menghapus atribut ${settingsTab} "${valueToRemove}" dari database.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      if (settingsTab === 'jenis') {
        await saveJenisData(token, spreadsheet.id, newList);
        setJenisList(newList);
        localStorage.setItem(`jenis_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'motif') {
        await saveMotifData(token, spreadsheet.id, newList);
        setMotifList(newList);
        localStorage.setItem(`motif_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'warna') {
        await saveWarnaData(token, spreadsheet.id, newList);
        setWarnaList(newList);
        localStorage.setItem(`warna_${spreadsheet.id}`, JSON.stringify(newList));
      } else if (settingsTab === 'ukuran') {
        await saveUkuranData(token, spreadsheet.id, newList);
        setUkuranList(newList);
        localStorage.setItem(`ukuran_${spreadsheet.id}`, JSON.stringify(newList));
      }

      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);

      setSettingsSuccess(`Berhasil menghapus atribut ${settingsTab}: "${valueToRemove}"`);
      setSyncStatus('synced');
    } catch (err) {
      console.error(err);
      setSettingsError('Gagal menghapus data dari Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteCatalog = (itemToDelete: CatalogItem) => {
    setDeletingCatalogItem(itemToDelete);
  };

  const executeDeleteCatalog = async (itemToDelete: CatalogItem) => {
    setLoading(true);
    setSyncStatus('syncing');
    const updatedCatalog = catalogItems.filter(item => item.kode !== itemToDelete.kode);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Hapus Katalog',
      detail: `Menghapus barang "${itemToDelete.nama}" (${itemToDelete.kode}) dari Katalog.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveCatalogData(token, spreadsheet.id, updatedCatalog),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);
      setCatalogItems(updatedCatalog);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      console.error(err);
      setError('Gagal menghapus produk dari katalog Google Sheets.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setDeletingCatalogItem(null);
    }
  };

  // Consignment (Titip Jual) Operations
  const deductItemStock = (currentItems: InventoryItem[], itemKode: string, qty: number, size?: string) => {
    return currentItems.map(i => {
      if (i.kode.toUpperCase() === itemKode.toUpperCase()) {
        const { baseName, breakdown } = parseInventoryItemName(i.nama);
        if (size) {
          const updatedBreakdown = { ...breakdown };
          const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === i.kode.toUpperCase());
          if (matchedCat) {
            const catSizes = [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[];
            catSizes.forEach(sz => {
              if (updatedBreakdown[sz] === undefined) {
                updatedBreakdown[sz] = Object.keys(breakdown).length === 0 && sz === size ? i.jumlah : 0;
              }
            });
          }
          if (updatedBreakdown[size] === undefined) {
            updatedBreakdown[size] = i.jumlah;
          }
          updatedBreakdown[size] = Math.max(0, (updatedBreakdown[size] || 0) - qty);
          const newNama = buildInventoryItemName(baseName, updatedBreakdown);
          const newTotal = (Object.values(updatedBreakdown) as number[]).reduce((sum, q) => sum + q, 0);
          return { ...i, nama: newNama, jumlah: newTotal };
        } else {
          return { ...i, jumlah: Math.max(0, i.jumlah - qty) };
        }
      }
      return i;
    });
  };

  const restoreItemStock = (currentItems: InventoryItem[], itemKode: string, qty: number, size?: string) => {
    return currentItems.map(i => {
      if (i.kode.toUpperCase() === itemKode.toUpperCase()) {
        const { baseName, breakdown } = parseInventoryItemName(i.nama);
        if (size) {
          const updatedBreakdown = { ...breakdown };
          const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === i.kode.toUpperCase());
          if (matchedCat) {
            const catSizes = [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[];
            catSizes.forEach(sz => {
              if (updatedBreakdown[sz] === undefined) {
                updatedBreakdown[sz] = 0;
              }
            });
          }
          if (updatedBreakdown[size] === undefined) {
            updatedBreakdown[size] = 0;
          }
          updatedBreakdown[size] = (updatedBreakdown[size] || 0) + qty;
          const newNama = buildInventoryItemName(baseName, updatedBreakdown);
          const newTotal = (Object.values(updatedBreakdown) as number[]).reduce((sum, q) => sum + q, 0);
          return { ...i, nama: newNama, jumlah: newTotal };
        } else {
          return { ...i, jumlah: i.jumlah + qty };
        }
      }
      return i;
    });
  };

  const handleCancelTjModal = () => {
    if (itemsBackup) {
      setItems(itemsBackup);
      setItemsBackup(null);
    }
    setFormTjItems([]);
    setIsTjModalOpen(false);
    setTjError(null);
  };

  const handleCancelTjEditModal = () => {
    if (itemsBackup) {
      setItems(itemsBackup);
      setItemsBackup(null);
    }
    setEditingTj(null);
    setFormTjEditItems([]);
    setIsTjEditModalOpen(false);
    setTjEditError(null);
  };

  const handleTjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTjNamaMitra.trim()) {
      setTjError('Nama mitra/penjual wajib diisi.');
      return;
    }
    if (formTjItems.length === 0) {
      setTjError('Silakan pilih minimal 1 produk dari katalog.');
      return;
    }

    setSavingTj(true);
    setSyncStatus('syncing');
    setTjError(null);
    setTjSuccess(null);

    const tjId = `TJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalNilaiAmbil = formTjItems.reduce((sum, item) => sum + (item.jumlahAmbil * item.hargaSatuan), 0);

    const newTj: ConsignmentRecord = {
      id: tjId,
      tanggalAmbil: new Date().toISOString().split('T')[0],
      namaMitra: formTjNamaMitra.trim(),
      kontakMitra: formTjKontakMitra.trim(),
      items: formTjItems,
      status: 'aktif',
      totalNilaiAmbil,
      totalNilaiLaku: 0,
      catatan: formTjCatatan.trim()
    };

    const updatedTjs = [newTj, ...consignments];

    const totalPcs = formTjItems.reduce((sum, item) => sum + item.jumlahAmbil, 0);
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Titip Jual',
      detail: `Membuat transaksi titip jual ke "${newTj.namaMitra}" (ID: ${newTj.id}) sebanyak ${totalPcs} Pcs barang. Stok inventaris berkurang.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, items),
        saveConsignmentData(token, spreadsheet.id, updatedTjs),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      setConsignments(updatedTjs);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setTjSuccess(`Transaksi Titip Jual ${tjId} berhasil dicatat dan stok inventaris otomatis dikurangi!`);

      // Reset form & clear backup
      setFormTjNamaMitra('');
      setFormTjKontakMitra('');
      setFormTjCatatan('');
      setFormTjItems([]);
      setItemsBackup(null);
      setIsTjModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setTjError('Gagal menyimpan data Titip Jual ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingTj(false);
    }
  };

  const handleTjEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTj) return;
    if (!formTjEditNamaMitra.trim()) {
      setTjEditError('Nama mitra/penjual wajib diisi.');
      return;
    }
    if (formTjEditItems.length === 0) {
      setTjEditError('Silakan pilih minimal 1 produk dari katalog.');
      return;
    }

    setSavingTjEdit(true);
    setSyncStatus('syncing');
    setTjEditError(null);
    setTjEditSuccess(null);

    // Construct updated ConsignmentRecord
    const totalNilaiAmbil = formTjEditItems.reduce((sum, item) => sum + (item.jumlahAmbil * item.hargaSatuan), 0);
    const totalNilaiLaku = formTjEditItems.reduce((sum, item) => sum + ((item.jumlahLaku || 0) * item.hargaSatuan), 0);

    const updatedTj: ConsignmentRecord = {
      ...editingTj,
      namaMitra: formTjEditNamaMitra.trim(),
      kontakMitra: formTjEditKontakMitra.trim(),
      catatan: formTjEditCatatan.trim(),
      items: formTjEditItems,
      totalNilaiAmbil,
      totalNilaiLaku
    };

    const updatedTjs = consignments.map(c => c.id === editingTj.id ? updatedTj : c);

    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Edit Titip Jual',
      detail: `Mengubah transaksi titip jual "${editingTj.namaMitra}" (ID: ${editingTj.id}). Stok disesuaikan.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, items),
        saveConsignmentData(token, spreadsheet.id, updatedTjs),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      setConsignments(updatedTjs);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setTjSuccess(`Transaksi Titip Jual ${editingTj.id} berhasil diperbarui!`);

      // Reset form & close
      setItemsBackup(null);
      setEditingTj(null);
      setIsTjEditModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setTjEditError('Gagal memperbarui data Titip Jual ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingTjEdit(false);
    }
  };

  const handleTjSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingTj) return;

    setSavingTj(true);
    setSyncStatus('syncing');
    setTjError(null);
    setTjSuccess(null);

    const totalNilaiLaku = settleItems.reduce((sum, item) => sum + (item.jumlahLaku * item.hargaSatuan), 0);

    const updatedTj: ConsignmentRecord = {
      ...settlingTj,
      items: settleItems,
      status: 'selesai',
      tanggalSelesai: new Date().toISOString().split('T')[0],
      totalNilaiLaku
    };

    // 1. Return unsold items back to inventory stock with size awareness
    let updatedItems = [...items];
    for (const item of settleItems) {
      if (item.jumlahKembali > 0) {
        updatedItems = restoreItemStock(updatedItems, item.kodeBarang, item.jumlahKembali, item.ukuran);
      }
    }

    // 2. Add sales transactions for sold items
    const currentSales = [...sales];
    const newSalesToRecord: SalesTransaction[] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    for (const item of settleItems) {
      if (item.jumlahLaku > 0) {
        const saleId = `TJ-SALE-${Math.floor(1000 + Math.random() * 9000)}`;
        newSalesToRecord.push({
          id: saleId,
          tanggal: dateStr,
          kodeBarang: item.kodeBarang,
          namaBarang: `[Konsinyasi] ${item.namaBarang}${item.ukuran ? ` [Ukuran: ${item.ukuran}]` : ''} (Mitra: ${settlingTj.namaMitra})`,
          jumlah: item.jumlahLaku,
          hargaSatuan: item.hargaSatuan,
          total: item.jumlahLaku * item.hargaSatuan,
          ukuran: item.ukuran || 'Standard'
        });
      }
    }

    const updatedSales = [...newSalesToRecord, ...currentSales];
    const updatedTjs = consignments.map(c => c.id === settlingTj.id ? updatedTj : c);

    const totalKembali = settleItems.reduce((sum, item) => sum + item.jumlahKembali, 0);
    const totalLaku = settleItems.reduce((sum, item) => sum + item.jumlahLaku, 0);
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Selesai Titip Jual',
      detail: `Menyelesaikan Titip Jual "${settlingTj.namaMitra}" (ID: ${settlingTj.id}). Terjual: ${totalLaku} Pcs, dikembalikan ke stok: ${totalKembali} Pcs.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveSalesData(token, spreadsheet.id, updatedSales),
        saveConsignmentData(token, spreadsheet.id, updatedTjs),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      setItems(updatedItems);
      setSales(updatedSales);
      setConsignments(updatedTjs);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      
      setTjSuccess(`Titip Jual ${settlingTj.id} berhasil diselesaikan! ${newSalesToRecord.length} transaksi laku dicatat di Sistem Penjualan dan sisa barang dikembalikan ke stok.`);
      setIsTjSettleModalOpen(false);
      setSettlingTj(null);
    } catch (err: any) {
      console.error(err);
      setTjError('Gagal menyimpan penyelesaian Titip Jual ke Google Sheets.');
      setSyncStatus('error');
    } finally {
      setSavingTj(false);
    }
  };

  const executeCancelTj = async (tj: ConsignmentRecord) => {
    setLoading(true);
    setSyncStatus('syncing');
    setTjError(null);
    setTjSuccess(null);

    const updatedTj: ConsignmentRecord = {
      ...tj,
      status: 'dibatalkan'
    };

    // Return all items initially taken back to inventory with size awareness
    let updatedItems = [...items];
    for (const item of tj.items) {
      updatedItems = restoreItemStock(updatedItems, item.kodeBarang, item.jumlahAmbil, item.ukuran);
    }

    const updatedTjs = consignments.map(c => c.id === tj.id ? updatedTj : c);

    const totalPcs = tj.items.reduce((sum, item) => sum + item.jumlahAmbil, 0);
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      operator: session.displayName || session.email || 'Sistem',
      aksi: 'Batalkan Titip Jual',
      detail: `Membatalkan Titip Jual "${tj.namaMitra}" (ID: ${tj.id}). Semua (${totalPcs} Pcs) barang dikembalikan ke stok.`
    };
    const updatedLogs = [newLog, ...activityLogs];

    try {
      await Promise.all([
        saveSpreadsheetData(token, spreadsheet.id, updatedItems),
        saveConsignmentData(token, spreadsheet.id, updatedTjs),
        saveActivityLogsData(token, spreadsheet.id, updatedLogs)
      ]);

      setItems(updatedItems);
      setConsignments(updatedTjs);
      setActivityLogs(updatedLogs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setTjSuccess(`Titip Jual ${tj.id} berhasil dibatalkan dan semua produk dikembalikan ke stok.`);
    } catch (err: any) {
      console.error(err);
      setTjError('Gagal membatalkan Titip Jual di Google Sheets.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setDeletingTjItem(null);
    }
  };

  const executeDeleteTjData = async (tj: ConsignmentRecord, restoreStock: boolean) => {
    setLoading(true);
    setSyncStatus('syncing');
    setTjError(null);
    setTjSuccess(null);

    let updatedItems = [...items];
    const shouldRestore = tj.status === 'aktif' || tj.status === 'selesai';
    
    if (shouldRestore) {
      if (tj.status === 'aktif') {
        // Return all items initially taken back to inventory with size awareness
        for (const item of tj.items) {
          updatedItems = restoreItemStock(updatedItems, item.kodeBarang, item.jumlahAmbil, item.ukuran);
        }
      } else if (tj.status === 'selesai') {
        // Return only sold items because unsold items were already returned during settlement
        for (const item of tj.items) {
          if (item.jumlahLaku > 0) {
            updatedItems = restoreItemStock(updatedItems, item.kodeBarang, item.jumlahLaku, item.ukuran);
          }
        }
      }
    }

    const updatedTjs = consignments.filter(c => c.id !== tj.id);

    try {
      if (shouldRestore) {
        await Promise.all([
          saveSpreadsheetData(token, spreadsheet.id, updatedItems),
          saveConsignmentData(token, spreadsheet.id, updatedTjs)
        ]);
        setItems(updatedItems);
      } else {
        await saveConsignmentData(token, spreadsheet.id, updatedTjs);
      }

      setConsignments(updatedTjs);
      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString('id-ID'));
      setTjSuccess(`Transaksi Titip Jual ${tj.id} berhasil dihapus secara permanen.`);
    } catch (err: any) {
      console.error(err);
      setTjError('Gagal menghapus data Titip Jual di Google Sheets.');
      setSyncStatus('error');
    } finally {
      setLoading(false);
      setHardDeletingTj(null);
    }
  };

  const handleDownloadTjInvoice = (tj: ConsignmentRecord) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });

      // Header Banner (Slate-900)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 148, 25, 'F');

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SURAT JALAN & INVOICE TITIP JUAL", 10, 11);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Sistem Inventaris Barang Nyiur Indah", 10, 16);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 10, 21);

      // Section: Invoice Info
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("INFORMASI KONSINYASI", 10, 33);

      // Light background card for info
      doc.setFillColor(248, 250, 252);
      doc.rect(8, 36, 132, 38, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(8, 36, 132, 38, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("ID Titip Jual", 12, 41);
      doc.text("Nama Mitra/Penjual", 12, 46);
      doc.text("Kontak/HP", 12, 51);
      doc.text("Tanggal Pengambilan", 12, 56);
      doc.text("Status", 12, 61);
      doc.text("Tanggal Penyelesaian", 12, 66);

      const statusText = 
        tj.status === 'aktif' ? 'AKTIF (BARANG DI MITRA)' :
        tj.status === 'selesai' ? 'SELESAI / SUDAH DIHITUNG' : 'DIBATALKAN';

      doc.setFont("helvetica", "normal");
      doc.text(`:  ${tj.id}`, 45, 41);
      doc.text(`:  ${tj.namaMitra}`, 45, 46);
      doc.text(`:  ${tj.kontakMitra || '-'}`, 45, 51);
      doc.text(`:  ${tj.tanggalAmbil}`, 45, 56);
      doc.text(`:  ${statusText}`, 45, 61);
      doc.text(`:  ${tj.tanggalSelesai || '-'}`, 45, 66);

      // Section: Items Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("DAFTAR PRODUK YANG DIAMBIL", 10, 81);

      // Table Headers
      doc.setFillColor(241, 245, 249);
      doc.rect(8, 84, 132, 6, 'F');
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("No", 10, 88);
      doc.text("Nama Produk (Kode)", 18, 88);
      doc.text("Harga Satuan", 70, 88);
      doc.text("Ambil", 95, 88);
      if (tj.status === 'selesai') {
        doc.text("Laku", 110, 88);
        doc.text("Subtotal", 123, 88);
      } else {
        doc.text("Total Estimasi", 115, 88);
      }

      // Draw table rows
      doc.setFont("helvetica", "normal");
      let y = 94;
      tj.items.forEach((item, idx) => {
        // Prevent layout overflow if y is too close to bottom signature / page end
        if (y > 175) {
          doc.addPage();
          // Draw continuation header
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, 148, 12, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(`TITIP JUAL - ${tj.id} (Lanjutan)`, 10, 8);
          
          // Re-draw table headers for the second page
          doc.setFillColor(241, 245, 249);
          doc.rect(8, 18, 132, 6, 'F');
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text("No", 10, 22);
          doc.text("Nama Produk (Kode)", 18, 22);
          doc.text("Harga Satuan", 70, 22);
          doc.text("Ambil", 95, 22);
          if (tj.status === 'selesai') {
            doc.text("Laku", 110, 22);
            doc.text("Subtotal", 123, 22);
          } else {
            doc.text("Total Estimasi", 115, 22);
          }
          
          doc.setFont("helvetica", "normal");
          y = 28;
        }

        const nameWithCode = item.namaCustom
          ? `${item.namaBarang} (${item.kodeBarang}) - Custom: "${item.namaCustom}"`
          : `${item.namaBarang} (${item.kodeBarang})`;
        const splitName = doc.splitTextToSize(nameWithCode, 50);
        const rowHeight = Math.max(splitName.length * 4.5, 5.5);

        // Print No
        doc.text(String(idx + 1), 10, y + 3.5);

        // Print Nama Produk line-by-line
        splitName.forEach((line, lineIdx) => {
          doc.text(line, 18, y + 3.5 + (lineIdx * 4.5));
        });

        // Print other columns aligned to first line of the row
        doc.text(formatRupiah(item.hargaSatuan), 70, y + 3.5);
        doc.text(`${item.jumlahAmbil} pcs`, 95, y + 3.5);
        if (tj.status === 'selesai') {
          doc.text(`${item.jumlahLaku} pcs`, 110, y + 3.5);
          doc.text(formatRupiah(item.jumlahLaku * item.hargaSatuan), 123, y + 3.5);
        } else {
          doc.text(formatRupiah(item.jumlahAmbil * item.hargaSatuan), 115, y + 3.5);
        }

        y += rowHeight + 1.5;
      });

      // Total Summaries Box
      y += 1.5;
      if (y > 175) {
        doc.addPage();
        // Draw continuation header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 148, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`TITIP JUAL - ${tj.id} (Lanjutan)`, 10, 8);
        y = 18;
      }

      doc.setFillColor(239, 246, 255);
      doc.rect(8, y, 132, 16, 'F');
      doc.setDrawColor(191, 219, 254);
      doc.rect(8, y, 132, 16, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text("TOTAL NILAI BARANG DIAMBIL:", 12, y + 6);
      const totalAmbilText = formatRupiah(tj.totalNilaiAmbil);
      doc.text(totalAmbilText, 138 - doc.getTextWidth(totalAmbilText), y + 6);

      if (tj.status === 'selesai') {
        doc.text("TOTAL NILAI LAKU (YANG HARUS DIBAYAR):", 12, y + 11);
        const totalLakuText = formatRupiah(tj.totalNilaiLaku);
        doc.setTextColor(220, 38, 38);
        doc.text(totalLakuText, 138 - doc.getTextWidth(totalLakuText), y + 11);
      } else {
        doc.setTextColor(71, 85, 105);
        doc.text("ESTIMASI NILAI JUAL KONSINYASI:", 12, y + 11);
        doc.text(totalAmbilText, 138 - doc.getTextWidth(totalAmbilText), y + 11);
      }

      // Notes
      if (tj.catatan) {
        y += 20;
        if (y > 180) {
          doc.addPage();
          // Draw continuation header
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, 148, 12, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(`TITIP JUAL - ${tj.id} (Lanjutan)`, 10, 8);
          y = 18;
        }
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Catatan:", 10, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(tj.catatan, 128);
        doc.text(lines, 10, y + 4.5);
        y += lines.length * 4.5;
      }

      // Signature Area
      y = Math.max(y + 12, 175);
      if (y > 185) {
        doc.addPage();
        // Draw continuation header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 148, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`TITIP JUAL - ${tj.id} (Lanjutan)`, 10, 8);
        y = 25;
      }
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Mitra / Penerima Barang,", 12, y);
      doc.text("Staff Inventaris (Pengirim),", 95, y);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`( ${tj.namaMitra} )`, 12, y + 15);
      doc.text(`( ${session.displayName} )`, 95, y + 15);

      // Save PDF
      doc.save(`Invoice_TitipJual_${tj.id}_${tj.namaMitra.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error("Gagal membuat PDF Invoice Titip Jual:", err);
    }
  };

  // Dynamic real-time synchronization of items' fotoBarang and hargaSatuan with the Product Catalog (Katalog)
  const syncedItems = React.useMemo(() => {
    return items.map(item => {
      const matched = catalogItems.find(c => c.kode.toUpperCase() === item.kode.toUpperCase());
      if (matched) {
        return {
          ...item,
          hargaSatuan: matched.harga,
          fotoBarang: matched.foto,
          kategori: matched.kategori || item.kategori
        };
      }
      return item;
    });
  }, [items, catalogItems]);

  // Helper to extract catalog product images for pre-order details
  const getCatalogImagesForPo = React.useCallback((poDetail: string): { kode: string; foto: string; nama: string }[] => {
    if (!poDetail) return [];
    const results: { kode: string; foto: string; nama: string }[] = [];
    const seen = new Set<string>();
    
    // Find any matched catalog items whose code is mentioned in poDetail
    catalogItems.forEach(cat => {
      const codeUpper = cat.kode.toUpperCase();
      if (poDetail.toUpperCase().includes(codeUpper)) {
        if (cat.foto && !seen.has(codeUpper)) {
          seen.add(codeUpper);
          results.push({
            kode: cat.kode,
            foto: cat.foto,
            nama: cat.nama
          });
        }
      }
    });
    
    // Fallback to searching syncedItems if not in catalogItems
    syncedItems.forEach(item => {
      const codeUpper = item.kode.toUpperCase();
      if (poDetail.toUpperCase().includes(codeUpper)) {
        if (item.fotoBarang && !seen.has(codeUpper)) {
          seen.add(codeUpper);
          results.push({
            kode: item.kode,
            foto: item.fotoBarang,
            nama: item.nama
          });
        }
      }
    });
    
    return results;
  }, [catalogItems, syncedItems]);

  // Calculations for Bento Cards
  const totalUniqueItems = syncedItems.length;
  const totalStockQty = syncedItems.reduce((sum, item) => sum + item.jumlah, 0);
  const totalAssetsValue = syncedItems.reduce((sum, item) => sum + (item.jumlah * item.hargaSatuan), 0);
  const lowStockItems = syncedItems.filter(item => item.jumlah <= item.ambangBatas);
  const lowStockCount = lowStockItems.length;

  // Sales and Analytics calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.tanggal === todayStr);
  const todaySalesRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todaySalesQty = todaySales.reduce((sum, s) => sum + s.jumlah, 0);

  const currentYearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const monthlySales = sales.filter(s => s.tanggal.startsWith(currentYearMonth));
  const monthlySalesRevenue = monthlySales.reduce((sum, s) => sum + s.total, 0);
  const monthlySalesQty = monthlySales.reduce((sum, s) => sum + s.jumlah, 0);

  // Available Years list from sales transactions
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    sales.forEach(s => {
      if (s.tanggal) {
        const parts = s.tanggal.split('-');
        if (parts.length >= 1 && /^\d{4}$/.test(parts[0])) {
          years.add(parts[0]);
        }
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [sales]);

  // Chart data calculations
  const chartData = React.useMemo(() => {
    if (chartTimeframe === 'monthly') {
      const months = [
        { name: 'Jan', revenue: 0, quantity: 0, fullName: 'Januari' },
        { name: 'Feb', revenue: 0, quantity: 0, fullName: 'Februari' },
        { name: 'Mar', revenue: 0, quantity: 0, fullName: 'Maret' },
        { name: 'Apr', revenue: 0, quantity: 0, fullName: 'April' },
        { name: 'Mei', revenue: 0, quantity: 0, fullName: 'Mei' },
        { name: 'Jun', revenue: 0, quantity: 0, fullName: 'Juni' },
        { name: 'Jul', revenue: 0, quantity: 0, fullName: 'Juli' },
        { name: 'Agu', revenue: 0, quantity: 0, fullName: 'Agustus' },
        { name: 'Sep', revenue: 0, quantity: 0, fullName: 'September' },
        { name: 'Okt', revenue: 0, quantity: 0, fullName: 'Oktober' },
        { name: 'Nov', revenue: 0, quantity: 0, fullName: 'November' },
        { name: 'Des', revenue: 0, quantity: 0, fullName: 'Desember' },
      ];

      const filteredSales = sales.filter(s => {
        if (!s.tanggal) return false;
        return s.tanggal.startsWith(chartSelectedYear);
      });

      filteredSales.forEach(s => {
        const parts = s.tanggal.split('-');
        if (parts.length >= 2) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            months[monthIdx].revenue += s.total || 0;
            months[monthIdx].quantity += s.jumlah || 0;
          }
        }
      });

      return months;
    } else {
      const yearMap: { [year: string]: { name: string; revenue: number; quantity: number } } = {};
      
      sales.forEach(s => {
        if (!s.tanggal) return;
        const parts = s.tanggal.split('-');
        if (parts.length >= 1) {
          const year = parts[0];
          if (/^\d{4}$/.test(year)) {
            if (!yearMap[year]) {
              yearMap[year] = { name: year, revenue: 0, quantity: 0 };
            }
            yearMap[year].revenue += s.total || 0;
            yearMap[year].quantity += s.jumlah || 0;
          }
        }
      });

      return Object.values(yearMap).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [sales, chartTimeframe, chartSelectedYear]);

  const formatCompactRupiah = (value: number) => {
    if (value >= 1_000_000_000) {
      return `Rp ${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}Jt`;
    }
    if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)}Rb`;
    }
    return `Rp ${value}`;
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Top 5 Best-Selling Products
  const bestSellers = React.useMemo(() => {
    const soldMap: { [kode: string]: { kode: string; nama: string; qty: number; total: number; foto: string } } = {};
    
    sales.forEach(sale => {
      const kodeUpper = sale.kodeBarang.trim().toUpperCase();
      const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === kodeUpper);
      const itemInfo = syncedItems.find(i => i.kode.toUpperCase() === kodeUpper);
      
      const realKode = matchedCatalog?.kode || itemInfo?.kode || kodeUpper;
      const realNama = matchedCatalog?.nama || itemInfo?.nama || sale.namaBarang;
      
      let foto = matchedCatalog?.foto || itemInfo?.fotoBarang || '';
      if (!foto && realKode.toUpperCase().startsWith("PO-")) {
        const matchedPo = preOrders.find(p => p.id.toUpperCase() === realKode.toUpperCase());
        if (matchedPo) {
          const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
          if (poImages.length > 0) {
            foto = poImages[0].foto;
          }
        }
      }
      
      if (!soldMap[realKode]) {
        soldMap[realKode] = {
          kode: realKode,
          nama: realNama,
          qty: 0,
          total: 0,
          foto: foto
        };
      }
      soldMap[realKode].qty += sale.jumlah;
      soldMap[realKode].total += sale.total;
    });

    return Object.values(soldMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales, syncedItems, catalogItems, preOrders, getCatalogImagesForPo]);

  // Filtered & Sorted items to display
  const processedItems = syncedItems
    .filter(item => {
      const matchSearch = item.kode.toLowerCase().includes(search.toLowerCase()) || 
                          item.nama.toLowerCase().includes(search.toLowerCase());
      
      const matchCategory = selectedCategoryFilter === 'all' || 
                            (item.kategori || '').toLowerCase() === selectedCategoryFilter.toLowerCase();
      
      if (filterType === 'low') {
        return matchSearch && matchCategory && item.jumlah <= item.ambangBatas;
      }
      if (filterType === 'safe') {
        return matchSearch && matchCategory && item.jumlah > item.ambangBatas;
      }
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const handleAddActivityLog = async (aksi: string, detail: string) => {
    try {
      const newLog: ActivityLog = {
        id: `LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString(),
        operator: session.displayName || session.email || 'Sistem',
        aksi,
        detail
      };
      const updatedLogs = [newLog, ...activityLogs];
      await saveActivityLogsData(token, spreadsheet.id, updatedLogs);
      setActivityLogs(updatedLogs);
    } catch (err) {
      console.error('Failed to save activity log:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      
      {/* Sidebar Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transform transition-transform duration-300 md:relative md:translate-x-0 md:z-auto ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xl">NI</div>
            <span className="text-xl font-bold tracking-tight text-white">
              Nyiur <span className="text-blue-500">Indah</span>
            </span>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Menu Utama</div>
          
          <button 
            onClick={() => {
              setActiveView('dashboard');
              setSalesError(null);
              setSalesSuccess(null);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard & Analitik
          </button>

          <button 
            onClick={() => {
              setActiveView('sales');
              setSalesError(null);
              setSalesSuccess(null);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'sales'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Sistem Penjualan
          </button>

          <button 
            onClick={() => {
              setActiveView('preorder');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'preorder'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Pesanan PreOrder
          </button>

          <button 
            onClick={() => {
              setActiveView('consignment');
              setTjError(null);
              setTjSuccess(null);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'consignment'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Titip Jual (Konsinyasi)
          </button>

          <button 
            onClick={() => {
              setActiveView('inventory');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'inventory'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Database Inventaris
          </button>

          <button 
            onClick={() => {
              setActiveView('catalog');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeView === 'catalog'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Tag className="w-4 h-4" />
            Katalog Produk
          </button>

          {session.role === 'admin' && (
            <>
              <button 
                onClick={() => {
                  setActiveView('employee');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
                  activeView === 'employee'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 text-slate-400" />
              Gaji Karyawan
              </button>

              <button 
                onClick={() => {
                  setActiveView('settings');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
                  activeView === 'settings'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/15' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Pengaturan Atribut
              </button>
            </>
          )}

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button 
              onClick={() => {
                setIsPrintOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl transition-colors text-left text-sm text-slate-300 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              Cetak Laporan Bulanan
            </button>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-2">Status Sistem</div>
          <div className="px-3 py-3 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-white font-medium">
                {syncStatus === 'synced' ? 'Google Sheets Terhubung' : syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Koneksi Terputus'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono" title={spreadsheet.name}>
              DB: {spreadsheet.name}
            </div>
            {lastSynced && (
              <div className="text-[9px] text-slate-500 font-medium">
                Aktif: {lastSynced}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200">
            {session.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{session.displayName}</div>
            <div className="text-xs text-slate-400 truncate uppercase font-bold text-[9px] tracking-wide">Role: {session.role}</div>
          </div>
          <button 
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-850 rounded-md transition-colors cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Buka Menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 truncate">
              {activeView === 'dashboard' && 'Dashboard & Analitik Penjualan'}
              {activeView === 'sales' && 'Sistem Pencatatan Penjualan'}
              {activeView === 'preorder' && 'Sistem PreOrder (Pesanan Pengepul)'}
              {activeView === 'inventory' && 'Database Inventaris Barang'}
              {activeView === 'catalog' && 'Katalog Produk Penjualan'}
              {activeView === 'consignment' && 'Sistem Titip Jual (Konsinyasi)'}
              {activeView === 'settings' && 'Pengaturan Atribut Produk'}
              {activeView === 'employee' && 'Manajemen Karyawan & Payroll'}
            </h1>
            {lowStockCount > 0 && activeView === 'inventory' && (
              <div className="bg-red-50 text-red-700 text-[10px] px-2.5 py-1 rounded-full border border-red-100 flex items-center gap-1 font-semibold animate-pulse">
                <CircleAlert className="w-3.5 h-3.5 text-red-600" />
                {lowStockCount} Items Low Stock
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => syncData()}
              disabled={loading}
              className="bg-white border border-slate-300 p-2 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>
            {(activeView === 'inventory' || activeView === 'dashboard') && (
              <button 
                onClick={() => setIsPrintOpen(true)}
                className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-700"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                Cetak Laporan
              </button>
            )}
            {activeView === 'inventory' && (
              <button 
                onClick={openAddModal}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-600/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Barang Baru
              </button>
            )}
             {activeView === 'catalog' && (
              <>
                <button 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-slate-700"
                >
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  Kelola Kategori
                </button>
                <button 
                  onClick={openAddCatalogModal}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Produk Baru
                </button>
              </>
            )}
            {activeView === 'consignment' && (
              <button 
                onClick={() => {
                  setFormTjNamaMitra('');
                  setFormTjKontakMitra('');
                  setFormTjCatatan('');
                  setFormTjItems([]);
                  setTjError(null);
                  setTjSuccess(null);
                  setItemsBackup(items);
                  setIsTjModalOpen(true);
                }}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-600/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Titip Jual
              </button>
            )}
          </div>
        </header>

        {/* Workspace body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl font-semibold shadow-sm flex items-start space-x-2">
              <CircleAlert size={16} className="text-red-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeView === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Sales Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Daily Revenue Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUpIcon size={20} />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Penjualan Hari Ini</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{formatRupiah(todaySalesRevenue)}</span>
                    <span className="text-[9px] text-blue-600 font-semibold">{todaySales.length} Transaksi harian</span>
                  </div>
                </div>

                {/* Daily Units Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Produk Terjual (Hari)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block">{todaySalesQty} Unit</span>
                    <span className="text-[9px] text-slate-400 font-medium">Hari ini ({todayStr})</span>
                  </div>
                </div>

                {/* Monthly Revenue Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Sparkles size={20} />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Penjualan Bulan Ini</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{formatRupiah(monthlySalesRevenue)}</span>
                    <span className="text-[9px] text-emerald-600 font-semibold">{monthlySales.length} Transaksi bulanan</span>
                  </div>
                </div>

                {/* Monthly Units Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Produk Terjual (Bulan)</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block">{monthlySalesQty} Unit</span>
                    <span className="text-[9px] text-slate-400 font-medium">Bulan aktif ({currentYearMonth})</span>
                  </div>
                </div>
              </div>

              {/* Grafik Perkembangan Penjualan Section */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <BarChart3 size={16} className="text-blue-600" />
                      Grafik Perkembangan Penjualan
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Visualisasi dinamika pendapatan dan volume penjualan barang</p>
                  </div>
                  
                  {/* Controls Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Timeframe selector (Bulanan / Tahunan) */}
                    <div className="bg-slate-100 p-0.5 rounded-lg flex text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setChartTimeframe('monthly')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          chartTimeframe === 'monthly'
                            ? 'bg-white text-blue-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Bulanan
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartTimeframe('yearly')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          chartTimeframe === 'yearly'
                            ? 'bg-white text-blue-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Tahunan
                      </button>
                    </div>

                    {/* Metric selector (Pendapatan / Kuantitas) */}
                    <div className="bg-slate-100 p-0.5 rounded-lg flex text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setChartMetric('revenue')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          chartMetric === 'revenue'
                            ? 'bg-white text-emerald-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Pendapatan (Rp)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartMetric('quantity')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          chartMetric === 'quantity'
                            ? 'bg-white text-blue-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Kuantitas (Pcs)
                      </button>
                    </div>

                    {/* Year Selector Dropdown (only for monthly) */}
                    {chartTimeframe === 'monthly' && (
                      <select
                        value={chartSelectedYear}
                        onChange={(e) => setChartSelectedYear(e.target.value)}
                        className="text-[10px] font-bold py-1 px-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {availableYears.map(yr => (
                          <option key={yr} value={yr}>Tahun {yr}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight={500}
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight={500}
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => chartMetric === 'revenue' ? formatCompactRupiah(value) : `${value} pcs`} 
                      />
                      <Tooltip content={<CustomChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar 
                        dataKey={chartMetric === 'revenue' ? 'revenue' : 'quantity'} 
                        fill={chartMetric === 'revenue' ? '#10b981' : '#3b82f6'} 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={45}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
                  <span>* Total transaksi terdaftar: <strong className="font-bold font-mono text-slate-600">{sales.length}</strong></span>
                  <span>Menampilkan filter: <strong className="font-bold text-blue-600">{chartTimeframe === 'monthly' ? `Bulanan (${chartSelectedYear})` : 'Tahunan'}</strong></span>
                </div>
              </div>

              {/* Best Sellers and Recent Sales Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Produk Terlaris (Top 5 Best Sellers) */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Produk Paling Banyak Laku</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Daftar produk dengan kuantitas penjualan tertinggi</p>
                    </div>
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={11} /> Top 5
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    {bestSellers.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                        <ShoppingCart size={32} className="text-slate-300 stroke-1" />
                        <span className="text-xs font-semibold">Belum ada data penjualan tercatat.</span>
                        <button 
                          onClick={() => setActiveView('sales')}
                          className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Catat Penjualan Pertama Sekarang &rarr;
                        </button>
                      </div>
                    ) : (
                      bestSellers.map((product, idx) => {
                        const originalItem = items.find(i => i.kode.toUpperCase() === product.kode.toUpperCase());
                        const stockText = originalItem ? `Sisa stok: ${originalItem.jumlah} unit` : 'Barang dihapus';
                        const maxQty = Math.max(...bestSellers.map(b => b.qty), 1);
                        const percentage = Math.round((product.qty / maxQty) * 100);

                        return (
                          <div key={product.kode} className="flex items-center space-x-4 p-3.5 hover:bg-slate-50/70 border border-slate-100 rounded-xl transition-all">
                            {/* Ranking Badge */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              idx === 0 ? 'bg-amber-100 text-amber-800' :
                              idx === 1 ? 'bg-slate-200 text-slate-800' :
                              idx === 2 ? 'bg-orange-100 text-orange-800' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {idx + 1}
                            </div>

                            {/* Foto */}
                            {(() => {
                              const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === product.kode.toUpperCase());
                              let photoToUse = matchedCat?.foto || product.foto;
                              if (!photoToUse && product.kode.toUpperCase().startsWith("PO-")) {
                                const matchedPo = preOrders.find(p => p.id.toUpperCase() === product.kode.toUpperCase());
                                if (matchedPo) {
                                  const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                  if (poImages.length > 0) {
                                    photoToUse = poImages[0].foto;
                                  }
                                }
                              }
                              if (photoToUse && !failedImages[`best_${product.kode}`]) {
                                return (
                                  <img
                                    src={getImageUrl(photoToUse)}
                                    alt={product.nama}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-150 shrink-0 cursor-zoom-in"
                                    onClick={() => {
                                      const matched = syncedItems.find(i => i.kode.toUpperCase() === product.kode.toUpperCase());
                                      if (matched) {
                                        setLightboxItem(matched);
                                      } else if (matchedCat) {
                                        setLightboxItem({
                                          kode: matchedCat.kode,
                                          nama: matchedCat.nama,
                                          kategori: matchedCat.kategori || '',
                                          jumlah: 0,
                                          hargaSatuan: matchedCat.harga,
                                          fotoBarang: matchedCat.foto,
                                          ambangBatas: 0,
                                          lokasi: ''
                                        });
                                      } else if (product.kode.toUpperCase().startsWith("PO-")) {
                                        const matchedPo = preOrders.find(p => p.id.toUpperCase() === product.kode.toUpperCase());
                                        if (matchedPo) {
                                          const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                          if (poImages.length > 0) {
                                            setLightboxItem({
                                              kode: poImages[0].kode,
                                              nama: poImages[0].nama,
                                              kategori: '',
                                              jumlah: 0,
                                              hargaSatuan: product.total / product.qty,
                                              fotoBarang: poImages[0].foto,
                                              ambangBatas: 0,
                                              lokasi: ''
                                            });
                                          }
                                        }
                                      }
                                    }}
                                    onError={() => {
                                      setFailedImages(prev => ({ ...prev, [`best_${product.kode}`]: true }));
                                    }}
                                  />
                                );
                              }
                              return (
                                <div className="w-10 h-10 bg-slate-50 border border-slate-150 rounded-lg flex items-center justify-center text-slate-400 text-[10px] font-bold shrink-0">
                                  <Image size={14} className="text-slate-300" />
                                </div>
                              );
                            })()}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 truncate block">{product.nama}</span>
                                <span className="text-xs font-bold text-slate-800 font-mono shrink-0">{product.qty} Terjual</span>
                              </div>
                              
                              {/* Custom horizontal sales scale indicator */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                <span className="font-mono text-[9px]">Kode: {product.kode} &bull; {stockText}</span>
                                <span className="font-semibold text-blue-600 font-mono text-[10px]">Total: {formatRupiah(product.total)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Recent Activity Log (Transaksi Terakhir) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Log Transaksi Terakhir</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">5 transaksi penjualan terbaru</p>
                    </div>
                    <History size={15} className="text-slate-400" />
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[420px]">
                    {sales.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center space-y-2">
                        <History size={24} className="text-slate-300 stroke-1" />
                        <span>Belum ada log transaksi.</span>
                      </div>
                    ) : (
                      sales.slice(0, 5).map((sale) => (
                        <div key={sale.id} className="p-3 border border-slate-100 hover:bg-slate-50/50 rounded-xl text-xs flex items-center space-x-3">
                          {/* Image */}
                          {(() => {
                            const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === sale.kodeBarang.toUpperCase());
                            let photoToUse = matchedCat?.foto;
                            if (!photoToUse && sale.kodeBarang.toUpperCase().startsWith("PO-")) {
                              const matchedPo = preOrders.find(p => p.id.toUpperCase() === sale.kodeBarang.toUpperCase());
                              if (matchedPo) {
                                const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                if (poImages.length > 0) {
                                  photoToUse = poImages[0].foto;
                                }
                              }
                            }
                            if (photoToUse && !failedImages[`log_${sale.id}`]) {
                              return (
                                <img
                                  src={getImageUrl(photoToUse)}
                                  alt={sale.namaBarang}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded object-cover border border-slate-100 shadow-xs shrink-0 cursor-zoom-in"
                                  onClick={() => {
                                    const matched = syncedItems.find(item => item.kode.toUpperCase() === sale.kodeBarang.toUpperCase());
                                    if (matched) {
                                      setLightboxItem(matched);
                                    } else if (matchedCat) {
                                      setLightboxItem({
                                        kode: matchedCat.kode,
                                        nama: matchedCat.nama,
                                        kategori: matchedCat.kategori || '',
                                        jumlah: 0,
                                        hargaSatuan: matchedCat.harga,
                                        fotoBarang: matchedCat.foto,
                                        ambangBatas: 0,
                                        lokasi: ''
                                      });
                                    } else if (sale.kodeBarang.toUpperCase().startsWith("PO-")) {
                                      const matchedPo = preOrders.find(p => p.id.toUpperCase() === sale.kodeBarang.toUpperCase());
                                      if (matchedPo) {
                                        const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                        if (poImages.length > 0) {
                                          setLightboxItem({
                                            kode: poImages[0].kode,
                                            nama: poImages[0].nama,
                                            kategori: '',
                                            jumlah: 0,
                                            hargaSatuan: sale.hargaSatuan,
                                            fotoBarang: poImages[0].foto,
                                            ambangBatas: 0,
                                            lokasi: ''
                                          });
                                        }
                                      }
                                    }
                                  }}
                                  onError={() => {
                                    setFailedImages(prev => ({ ...prev, [`log_${sale.id}`]: true }));
                                  }}
                                />
                              );
                            }
                            return (
                              <div className="w-10 h-10 bg-slate-50 border border-slate-150 rounded flex items-center justify-center text-slate-300 shrink-0">
                                <Image size={14} />
                              </div>
                            );
                          })()}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
                              <span>{sale.id}</span>
                              <span>{sale.tanggal}</span>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-700 truncate">{sale.namaBarang}</span>
                              <span className="font-semibold text-slate-800 font-mono shrink-0">x{sale.jumlah}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] border-t border-dashed border-slate-100 pt-1">
                              <span className="text-slate-400">Harga: {formatRupiah(sale.hargaSatuan)}</span>
                              <span className="font-bold text-blue-600 font-mono">{formatRupiah(sale.total)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Log Aktivitas Pengguna & Perubahan Stok */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <ClipboardList size={16} className="text-blue-600" />
                      Log Aktivitas & Riwayat Perubahan Stok Terbaru
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Menampilkan hingga 10 riwayat penyesuaian stok dan aktivitas operasional yang dicatat di sistem</p>
                  </div>
                  <span className="self-start sm:self-center bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
                    Total Aktivitas: {activityLogs.length}
                  </span>
                </div>

                <div className="p-5 overflow-x-auto">
                  {activityLogs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center space-y-2">
                      <History size={28} className="text-slate-300 stroke-1" />
                      <span>Belum ada log aktivitas stok terbaru.</span>
                    </div>
                  ) : (
                    <div className="min-w-[600px] divide-y divide-slate-100">
                      {activityLogs.slice(0, 10).map((log) => {
                        let badgeStyle = 'bg-slate-50 text-slate-700 border-slate-200';
                        if (log.aksi.includes('Tambah')) {
                          badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        } else if (log.aksi.includes('Hapus')) {
                          badgeStyle = 'bg-red-50 text-red-700 border-red-200';
                        } else if (log.aksi.includes('Edit') || log.aksi.includes('Ubah') || log.aksi.includes('Penyesuaian')) {
                          badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else if (log.aksi.includes('Penjualan')) {
                          badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                        } else if (log.aksi.includes('Titip Jual')) {
                          badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                        }

                        return (
                          <div key={log.id} className="py-3 flex items-start justify-between text-xs hover:bg-slate-50/40 px-2 rounded-lg transition-all">
                            <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide shrink-0 ${badgeStyle}`}>
                                {log.aksi}
                              </span>
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-700 font-medium leading-relaxed break-words">{log.detail}</p>
                                <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1">
                                  <span className="flex items-center gap-1 font-mono">
                                    <Clock size={11} /> {formatTimestamp(log.timestamp)}
                                  </span>
                                  <span className="flex items-center gap-1 font-semibold text-slate-500">
                                    <User size={11} /> {log.operator}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-100 py-0.5 px-2 rounded-md shrink-0 ml-4 self-center">
                              {log.id}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'sales' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Alert Feedback */}
              {salesError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl font-semibold shadow-sm flex items-start space-x-2 animate-in fade-in duration-150">
                  <CircleAlert size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <span>{salesError}</span>
                </div>
              )}
              {salesSuccess && (
                <div className="p-4 bg-green-50 border border-green-100 text-green-800 text-xs rounded-xl font-semibold shadow-sm flex items-start space-x-2 animate-in fade-in duration-150">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                  <span>{salesSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form Record Sale Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                  <div className="flex items-center space-x-2.5 text-blue-600 pb-2 border-b border-slate-100">
                    <ShoppingCart size={18} />
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Catat Penjualan</h3>
                  </div>

                  <form onSubmit={handleRecordSale} className="space-y-4">
                    
                    {/* Select Product */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Pilih Produk</label>
                      <select
                        value={formSaleKode}
                        onChange={(e) => handleProductSelection(e.target.value)}
                        required
                        className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 cursor-pointer font-semibold"
                      >
                        <option value="">-- Cari & Pilih Barang --</option>
                        {syncedItems
                          .filter(item => item.jumlah > 0)
                          .map(item => {
                            const { baseName } = parseInventoryItemName(item.nama);
                            return (
                              <option key={item.kode} value={item.kode}>
                                {baseName} ({item.kode}) - Total Stok: {item.jumlah}
                              </option>
                            );
                          })
                        }
                      </select>
                    </div>

                    {/* Ukuran (Size selection) */}
                    {formSaleKode && (() => {
                      const selectedItem = syncedItems.find(i => i.kode === formSaleKode);
                      if (!selectedItem) return null;
                      
                      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === formSaleKode.toUpperCase());
                      const { breakdown } = parseInventoryItemName(selectedItem.nama);
                      const sizeOptions = Object.keys(breakdown);
                      
                      const displaySizes = sizeOptions.length > 0 
                        ? sizeOptions 
                        : (matchedCat ? [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[] : ['Standard']);

                      return (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Pilih Ukuran</label>
                          <select
                            value={formSaleUkuran}
                            onChange={(e) => {
                              const chosenSize = e.target.value;
                              setFormSaleUkuran(chosenSize);
                              if (chosenSize) {
                                if (matchedCat) {
                                  const price = getPricesForSize(matchedCat, chosenSize, formSaleTipePelanggan) || selectedItem.hargaSatuan;
                                  setFormSaleHarga(price);
                                } else {
                                  setFormSaleHarga(selectedItem.hargaSatuan);
                                }
                              } else {
                                setFormSaleHarga(0);
                              }
                            }}
                            required
                            className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50/30 border-blue-100 text-blue-850 font-bold cursor-pointer"
                          >
                            <option value="">-- Pilih Ukuran --</option>
                            {displaySizes.map(size => {
                              const stockQty = breakdown[size] !== undefined ? breakdown[size] : selectedItem.jumlah;
                              return (
                                <option key={size} value={size} disabled={stockQty <= 0}>
                                  Ukuran {size} ({stockQty > 0 ? `Stok: ${stockQty} Unit` : 'HABIS'})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })()}

                    {/* Status Pelanggan / Tipe Harga */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Status Pelanggan / Tipe Harga</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => changeTipePelanggan('Standard')}
                          className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            formSaleTipePelanggan === 'Standard'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Standard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => changeTipePelanggan('Reseller')}
                          className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            formSaleTipePelanggan === 'Reseller'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>Reseller</span>
                        </button>
                      </div>
                    </div>

                    {/* Stock Detail Preview (If item is selected) */}
                    {formSaleKode && (() => {
                      const selectedItem = syncedItems.find(i => i.kode === formSaleKode);
                      if (!selectedItem) return null;
                      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === formSaleKode.toUpperCase());
                      const isLow = selectedItem.jumlah <= selectedItem.ambangBatas;
                      return (
                        <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Harga Standard:</span>
                            <span className="font-bold font-mono text-slate-700">{formatRupiah(selectedItem.hargaSatuan)}</span>
                          </div>
                          {matchedCat?.hargaReseller ? (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Harga Reseller:</span>
                              <span className="font-bold font-mono text-indigo-600">{formatRupiah(matchedCat.hargaReseller)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between border-t border-slate-250 pt-1.5 mt-1.5">
                            <span className="text-slate-400">Stok Gudang:</span>
                            <span className={`font-bold font-mono ${isLow ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}`}>
                              {selectedItem.jumlah} Unit {isLow && '(Kritis)'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                      {/* Quantity Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">Jumlah Jual</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={formSaleJumlah}
                            onChange={(e) => setFormSaleJumlah(Math.max(1, Number(e.target.value)))}
                            min={1}
                            required
                            disabled={!formSaleUkuran}
                            className="w-full text-xs py-2 pl-3 pr-12 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-mono h-9 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                          <div className="absolute right-3 text-[10px] font-bold text-slate-400 pointer-events-none">
                            Unit
                          </div>
                        </div>
                      </div>

                      {/* Customized Price Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">Harga Jual</label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-[10px] font-bold text-slate-400 pointer-events-none">
                            Rp
                          </span>
                          <input
                            type="number"
                            value={formSaleHarga}
                            onChange={(e) => setFormSaleHarga(Math.max(0, Number(e.target.value)))}
                            required
                            disabled={!formSaleUkuran}
                            className="w-full text-xs py-2 pl-9 pr-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-mono h-9 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sale Date Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal Transaksi</label>
                      <input
                        type="date"
                        value={formSaleTanggal}
                        onChange={(e) => setFormSaleTanggal(e.target.value)}
                        required
                        className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-mono"
                      />
                    </div>

                    {/* Catatan Penjualan Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Catatan Penjualan (Opsional)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Pembeli Budi, bonus gantungan kunci"
                        value={formSaleCatatan}
                        onChange={(e) => setFormSaleCatatan(e.target.value)}
                        className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                      />
                    </div>

                    {/* Real-time Summary */}
                    {formSaleKode && (() => {
                      const selectedItem = syncedItems.find(i => i.kode === formSaleKode);
                      if (!selectedItem) return null;
                      const { breakdown } = parseInventoryItemName(selectedItem.nama);
                      const remainingStock = (formSaleUkuran && breakdown[formSaleUkuran] !== undefined)
                        ? breakdown[formSaleUkuran] - formSaleJumlah
                        : selectedItem.jumlah - formSaleJumlah;
                      const totalBill = formSaleJumlah * formSaleHarga;

                      return (
                        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1.5 text-xs text-slate-700">
                          <div className="flex justify-between items-center">
                            <span>Sisa Stok {formSaleUkuran ? `Ukuran ${formSaleUkuran}` : 'Baru'}:</span>
                            <span className={`font-extrabold font-mono ${remainingStock < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                              {remainingStock < 0 ? 'STOK MELEBIHI LIMIT' : `${remainingStock} Unit`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-blue-200">
                            <span className="font-bold">Total Pembayaran:</span>
                            <span className="font-extrabold text-blue-600 font-mono text-sm">{formatRupiah(totalBill)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={recordingSale || !formSaleKode || !formSaleUkuran || (() => {
                        const sItem = syncedItems.find(i => i.kode === formSaleKode);
                        if (!sItem) return true;
                        const { breakdown } = parseInventoryItemName(sItem.nama);
                        const hasBreakdown = Object.keys(breakdown).length > 0;
                        if (hasBreakdown) {
                          return formSaleJumlah > (breakdown[formSaleUkuran] || 0);
                        }
                        return formSaleJumlah > sItem.jumlah;
                      })()}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {recordingSale ? (
                        <>
                          <RefreshCw className="animate-spin w-3.5 h-3.5" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Simpan & Kurangi Stok</span>
                        </>
                      )}
                    </button>

                  </form>
                </div>

                {/* Sales transactions list table */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[520px]">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Riwayat Transaksi Penjualan</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Semua data disinkronkan real-time dengan Google Sheets</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {spreadsheet.webViewLink && (
                        <a
                          href={spreadsheet.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                        >
                          <FileSpreadsheet size={11} className="text-emerald-600" />
                          <span>Buka Sheets (Tab Penjualan)</span>
                        </a>
                      )}
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Total: {sales.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    {sales.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-2 py-12 text-slate-400">
                        <History size={36} className="text-slate-300 stroke-1" />
                        <span className="text-xs font-semibold">Belum ada transaksi tercatat di database ini.</span>
                      </div>
                    ) : (
                      <table className="w-full min-w-[600px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-3">ID / Tanggal</th>
                            <th className="px-4 py-3">Barang</th>
                            <th className="px-4 py-3 text-center">Jumlah</th>
                            <th className="px-4 py-3 text-right">Harga</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50/40">
                              <td className="px-4 py-3 font-mono">
                                <span className="font-bold text-slate-700 block text-[10px]">{sale.id}</span>
                                <span className="text-[9px] text-slate-400 mt-0.5 block">{sale.tanggal}</span>
                              </td>
                               <td className="px-4 py-3 flex items-center space-x-3">
                                {(() => {
                                  const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === sale.kodeBarang.toUpperCase());
                                  let photoToUse = matchedCat?.foto;
                                  if (!photoToUse && sale.kodeBarang.toUpperCase().startsWith("PO-")) {
                                    const matchedPo = preOrders.find(p => p.id.toUpperCase() === sale.kodeBarang.toUpperCase());
                                    if (matchedPo) {
                                      const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                      if (poImages.length > 0) {
                                        photoToUse = poImages[0].foto;
                                      }
                                    }
                                  }
                                  if (photoToUse && !failedImages[`sale_row_${sale.id}`]) {
                                    return (
                                      <img
                                        src={getImageUrl(photoToUse)}
                                        alt={sale.namaBarang}
                                        referrerPolicy="no-referrer"
                                        className="w-8 h-8 rounded object-cover border border-slate-100 shadow-xs shrink-0 cursor-zoom-in"
                                        onClick={() => {
                                          const matched = syncedItems.find(item => item.kode.toUpperCase() === sale.kodeBarang.toUpperCase());
                                          if (matched) {
                                            setLightboxItem(matched);
                                          } else if (matchedCat) {
                                            setLightboxItem({
                                              kode: matchedCat.kode,
                                              nama: matchedCat.nama,
                                              kategori: matchedCat.kategori || '',
                                              jumlah: 0,
                                              hargaSatuan: matchedCat.harga,
                                              fotoBarang: matchedCat.foto,
                                              ambangBatas: 0,
                                              lokasi: ''
                                            });
                                          } else if (sale.kodeBarang.toUpperCase().startsWith("PO-")) {
                                            const matchedPo = preOrders.find(p => p.id.toUpperCase() === sale.kodeBarang.toUpperCase());
                                            if (matchedPo) {
                                              const poImages = getCatalogImagesForPo(matchedPo.pesananDetail);
                                              if (poImages.length > 0) {
                                                setLightboxItem({
                                                  kode: poImages[0].kode,
                                                  nama: poImages[0].nama,
                                                  kategori: '',
                                                  jumlah: 0,
                                                  hargaSatuan: sale.hargaSatuan,
                                                  fotoBarang: poImages[0].foto,
                                                  ambangBatas: 0,
                                                  lokasi: ''
                                                });
                                              }
                                            }
                                          }
                                        }}
                                        onError={() => {
                                          setFailedImages(prev => ({ ...prev, [`sale_row_${sale.id}`]: true }));
                                        }}
                                      />
                                    );
                                  }
                                  return (
                                    <div className="w-8 h-8 bg-slate-50 border border-slate-150 rounded flex items-center justify-center text-slate-300 shrink-0">
                                      <Image size={12} />
                                    </div>
                                  );
                                })()}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-800 block truncate max-w-[180px]" title={sale.namaBarang}>{sale.namaBarang}</span>
                                    {sale.ukuran && (
                                      <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded">
                                        {sale.ukuran}
                                      </span>
                                    )}
                                    {sale.tipePelanggan && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                        sale.tipePelanggan === 'Reseller' 
                                          ? 'bg-purple-50 border-purple-100 text-purple-600' 
                                          : 'bg-slate-50 border-slate-100 text-slate-600'
                                      }`}>
                                        {sale.tipePelanggan}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] flex-wrap">
                                    <span className="text-slate-400 font-mono">{sale.kodeBarang}</span>
                                    {sale.catatan && (
                                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded italic truncate max-w-[200px]" title={sale.catatan}>
                                        "{sale.catatan}"
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-600">
                                {sale.jumlah} Unit
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-500">
                                {formatRupiah(sale.hargaSatuan)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-blue-600">
                                {formatRupiah(sale.total)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setDeletingSaleItem(sale)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Batalkan & Kembalikan Stok"
                                >
                                  <MinusCircle size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeView === 'preorder' && (
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* PreOrder Stats Bento Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Total Orders */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total PreOrder</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">{preOrders.length}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Semua pesanan</span>
                  </div>
                </div>

                {/* Metric 2: Active Orders */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Antrean & Proses</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">
                      {preOrders.filter(p => p.status === 'antrean' || p.status === 'proses').length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Sedang dikerjakan</span>
                  </div>
                </div>

                {/* Metric 3: Ready Orders */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle size={20} className={preOrders.some(p => p.status === 'siap') ? "animate-pulse" : ""} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Siap Diambil</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">
                      {preOrders.filter(p => p.status === 'siap').length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Siap untuk pengepul</span>
                  </div>
                </div>

                {/* Metric 4: Estimated Revenue */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <TrendingUpIcon size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nilai Pesanan</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">
                      {formatRupiah(preOrders.filter(p => p.status !== 'dibatalkan').reduce((sum, p) => sum + p.totalBiaya, 0))}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Estimasi pendapatan</span>
                  </div>
                </div>
              </div>

              {/* Main Workspace for PreOrder */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Control Panel: Add PreOrder & Filters */}
                <div className="space-y-6">
                  {/* Create Button & Quick Links */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm">Operasi PreOrder</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Catat pesanan khusus, bokor, dulang, atau mebel dari pengepul/partner. Tentukan kapan pesanan harus diselesaikan agar pengiriman tepat waktu.
                    </p>
                    <button
                      onClick={openAddPoModal}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/10 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Tambah PreOrder Baru</span>
                    </button>
                    {spreadsheet.webViewLink && (
                      <a
                        href={spreadsheet.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-600" />
                        <span>Buka Sheets (Tab PreOrder)</span>
                      </a>
                    )}
                  </div>

                  {/* Filter and Search Box */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm">Pencarian & Filter</h3>
                    
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama pengepul..."
                        value={poSearch}
                        onChange={(e) => setPoSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                      />
                    </div>

                    {/* Status Filter Buttons */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Pesanan</span>
                      {[
                        { id: 'all', label: 'Semua Status', count: preOrders.length },
                        { id: 'antrean', label: 'Mulai', count: preOrders.filter(p => p.status === 'antrean').length, color: 'bg-amber-100 text-amber-800' },
                        { id: 'proses', label: 'Sedang Proses Pengerjaan', count: preOrders.filter(p => p.status === 'proses').length, color: 'bg-blue-100 text-blue-800' },
                        { id: 'siap', label: 'Siap Diambil / Produk Sudah Selesai', count: preOrders.filter(p => p.status === 'siap').length, color: 'bg-emerald-100 text-emerald-800' },
                        { id: 'selesai', label: 'Selesai & Produk Sudah Diambil', count: preOrders.filter(p => p.status === 'selesai').length, color: 'bg-slate-200 text-slate-800' },
                        { id: 'dibatalkan', label: 'Batalkan', count: preOrders.filter(p => p.status === 'dibatalkan').length, color: 'bg-red-100 text-red-800' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPoFilterStatus(tab.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all text-left cursor-pointer ${
                            poFilterStatus === tab.id
                              ? 'bg-slate-100 font-bold text-slate-800'
                              : 'hover:bg-slate-50 text-slate-500'
                          }`}
                        >
                          <span className="flex items-center space-x-2">
                            {tab.id !== 'all' && (
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                tab.id === 'antrean' ? 'bg-amber-500' :
                                tab.id === 'proses' ? 'bg-blue-500' :
                                tab.id === 'siap' ? 'bg-emerald-500 animate-pulse' :
                                tab.id === 'selesai' ? 'bg-slate-400' : 'bg-red-500'
                              }`} />
                            )}
                            <span>{tab.label}</span>
                          </span>
                          <span className="text-[10px] font-mono bg-slate-200/60 px-1.5 py-0.5 rounded-md font-bold text-slate-600">
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PreOrder Items List */}
                <div className="xl:col-span-2 space-y-4">
                  {/* Status alert bar */}
                  {poSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{poSuccess}</span>
                    </div>
                  )}

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">Daftar Pesanan PreOrder</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Semua data disimpan di Google Sheets secara live</p>
                      </div>
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        Menampilkan: {
                          preOrders
                            .filter(p => poFilterStatus === 'all' ? true : p.status === poFilterStatus)
                            .filter(p => p.namaPengepul.toLowerCase().includes(poSearch.toLowerCase()))
                            .length
                        } Pesanan
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {preOrders
                        .filter(p => poFilterStatus === 'all' ? true : p.status === poFilterStatus)
                        .filter(p => p.namaPengepul.toLowerCase().includes(poSearch.toLowerCase()))
                        .length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 text-slate-400">
                          <ClipboardList size={40} className="text-slate-300 stroke-1" />
                          <div>
                            <p className="text-xs font-bold">Tidak ada data PreOrder ditemukan.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Mulai dengan mengklik tombol "Tambah PreOrder Baru".</p>
                          </div>
                        </div>
                      ) : (
                        preOrders
                          .filter(p => poFilterStatus === 'all' ? true : p.status === poFilterStatus)
                          .filter(p => p.namaPengepul.toLowerCase().includes(poSearch.toLowerCase()))
                          .map((po) => {
                            // Calculate days remaining to target
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const target = new Date(po.tanggalTargetSelesai);
                            target.setHours(0,0,0,0);
                            const diffTime = target.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            let dateBadgeColor = "text-slate-500 bg-slate-50 border-slate-100";
                            let dateBadgeText = `${po.tanggalTargetSelesai}`;

                            if (po.status !== 'selesai' && po.status !== 'dibatalkan') {
                              if (diffDays === 0) {
                                dateBadgeColor = "text-amber-800 bg-amber-50 border-amber-200 animate-pulse font-bold";
                                dateBadgeText = "Hari Ini!";
                              } else if (diffDays < 0) {
                                dateBadgeColor = "text-red-800 bg-red-50 border-red-200 font-bold";
                                dateBadgeText = `Terlambat ${Math.abs(diffDays)} Hari (${po.tanggalTargetSelesai})`;
                              } else if (diffDays === 1) {
                                dateBadgeColor = "text-orange-800 bg-orange-50 border-orange-200 font-bold";
                                dateBadgeText = "Besok!";
                              } else {
                                dateBadgeColor = "text-blue-800 bg-blue-50 border-blue-100";
                                dateBadgeText = `${diffDays} hari lagi (${po.tanggalTargetSelesai})`;
                              }
                            } else if (po.status === 'selesai') {
                              dateBadgeColor = "text-emerald-800 bg-emerald-50 border-emerald-100";
                              dateBadgeText = `Selesai (${po.tanggalTargetSelesai})`;
                            }

                            return (
                              <div key={po.id} className="p-5 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="space-y-2.5 flex-1 min-w-0">
                                  {/* Header card with ID, status, and target date */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                      {po.id}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      po.tipeOrder === 'Reseller' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}>
                                      {po.tipeOrder === 'Reseller' ? 'Reseller' : 'Standard / Retail'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      po.status === 'antrean' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      po.status === 'proses' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      po.status === 'siap' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' :
                                      po.status === 'selesai' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {po.status === 'antrean' ? 'Mulai' :
                                       po.status === 'proses' ? 'Sedang Proses Pengerjaan' :
                                       po.status === 'siap' ? 'Siap Diambil / Produk Sudah Selesai' :
                                       po.status === 'selesai' ? 'Selesai & Produk Sudah Diambil' : 'Batalkan'}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${dateBadgeColor}`}>
                                      Target: {dateBadgeText}
                                    </span>
                                  </div>

                                  {/* Pengepul info */}
                                  <div>
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                      {po.namaPengepul}
                                      {po.kontakPengepul && (
                                        <a 
                                          href={`tel:${po.kontakPengepul}`}
                                          className="text-slate-400 hover:text-blue-600 transition-colors"
                                          title={`Telepon: ${po.kontakPengepul}`}
                                        >
                                          <Phone size={11} />
                                        </a>
                                      )}
                                    </h4>
                                    <span className="text-[10px] text-slate-400">Pemesanan: {po.tanggalPemesanan}</span>
                                  </div>

                                  {/* Detail Pesanan */}
                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs text-slate-700 whitespace-pre-line leading-relaxed font-mono">
                                      <div>{po.pesananDetail}</div>
                                      {po.isiNama && (
                                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                                          <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                                            Custom Nama
                                          </span>
                                          <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-sans">
                                            "{po.namaCustom}"
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-normal font-sans">
                                            ({(po.namaCustom || '').replace(/[^a-zA-Z0-9]/g, '').length} huruf)
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {/* Product Images from Catalog */}
                                    {(() => {
                                      const images = getCatalogImagesForPo(po.pesananDetail);
                                      if (images.length === 0) return null;
                                      return (
                                        <div className="flex sm:flex-col gap-1.5 shrink-0 justify-start items-center">
                                          {images.slice(0, 3).map((img, i) => (
                                            <div key={i} className="relative w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden group" title={`[${img.kode}] ${img.nama}`}>
                                              <img
                                                src={getImageUrl(img.foto)}
                                                alt={img.nama}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform"
                                                onClick={() => {
                                                  const matched = syncedItems.find(item => item.kode.toUpperCase() === img.kode.toUpperCase());
                                                  if (matched) {
                                                    setLightboxItem(matched);
                                                  } else {
                                                    setLightboxItem({
                                                      kode: img.kode,
                                                      nama: img.nama,
                                                      kategori: '',
                                                      jumlah: 0,
                                                      hargaSatuan: 0,
                                                      fotoBarang: img.foto,
                                                      ambangBatas: 0,
                                                      lokasi: ''
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Right action and pricing side */}
                                <div className="flex flex-col md:items-end justify-between self-stretch shrink-0 md:min-w-[180px] space-y-3">
                                  {/* Cost Display */}
                                  <div className="md:text-right space-y-1 w-full flex flex-col md:items-end">
                                    <div className="flex justify-between md:justify-end items-center gap-3 w-full text-xs">
                                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Biaya:</span>
                                      <span className="font-mono font-bold text-slate-800">{formatRupiah(po.totalBiaya)}</span>
                                    </div>
                                    <div className="flex justify-between md:justify-end items-center gap-3 w-full text-xs">
                                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">DP Dibayar:</span>
                                      <span className="font-mono font-bold text-emerald-600">
                                        {po.nominalDp ? formatRupiah(po.nominalDp) : 'Rp 0'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between md:justify-end items-center gap-3 w-full text-xs border-t border-slate-100 pt-1 mt-1">
                                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Sisa Tagihan:</span>
                                      <span className="font-mono font-black text-rose-600 text-sm">
                                        {formatRupiah(Math.max(0, po.totalBiaya - (po.nominalDp || 0)))}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Quick status progress timeline */}
                                  <div className="space-y-1.5 w-full">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block md:text-right">Atur Status Cepat</span>
                                    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                                      {po.status === 'antrean' && (
                                        <button
                                          onClick={() => handlePoStatusChange(po.id, 'proses')}
                                          className="text-[9px] font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-all cursor-pointer"
                                        >
                                          Mulai Pengerjaan
                                        </button>
                                      )}
                                      {po.status === 'proses' && (
                                        <button
                                          onClick={() => handlePoStatusChange(po.id, 'siap')}
                                          className="text-[9px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-all cursor-pointer"
                                        >
                                          Siap Diambil / Produk Selesai
                                        </button>
                                      )}
                                      {po.status === 'siap' && (
                                        <button
                                          onClick={() => handlePoStatusChange(po.id, 'selesai')}
                                          className="text-[9px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md transition-all cursor-pointer"
                                        >
                                          Selesai & Produk Diambil
                                        </button>
                                      )}
                                      {po.status !== 'selesai' && po.status !== 'dibatalkan' && (
                                        <button
                                          onClick={() => handlePoStatusChange(po.id, 'dibatalkan')}
                                          className="text-[9px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-all cursor-pointer"
                                        >
                                          Batalkan
                                        </button>
                                      )}
                                      {po.status === 'dibatalkan' && (
                                        <button
                                          onClick={() => handlePoStatusChange(po.id, 'antrean')}
                                          className="text-[9px] font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md transition-all cursor-pointer"
                                        >
                                          Pulihkan Ke Mulai
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Update, Download, and Delete actions */}
                                  <div className="flex items-center gap-2 md:justify-end">
                                    <button
                                      onClick={() => handleDownloadPoPDF(po)}
                                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                      title="Unduh SPK (PDF)"
                                    >
                                      <Download size={14} />
                                    </button>
                                    <button
                                      onClick={() => openEditPoModal(po)}
                                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Edit PreOrder"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePo(po)}
                                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="Hapus PreOrder"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeView === 'catalog' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Stats Bento Box Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Total Cataloged Products */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Tag size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Produk Katalog</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">{catalogItems.length}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Bisa dijual</span>
                  </div>
                </div>

                {/* Metric 2: Categories Count */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Layers size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Produk</span>
                    <span className="text-xl font-extrabold text-slate-800 font-mono block">
                      {new Set(catalogItems.map(i => i.kategori).filter(Boolean)).size}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Klasifikasi produk</span>
                  </div>
                </div>
              </div>

              {/* Main Catalog Grid */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                
                {/* Search & Filter Controls */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                  
                  <div className="relative w-full md:max-w-md">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Cari berdasarkan kode atau nama produk di katalog..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span className="font-semibold shrink-0">Kategori:</span>
                      <select
                        value={catalogFilterCategory}
                        onChange={(e) => setCatalogFilterCategory(e.target.value)}
                        className="w-full md:w-40 py-1.5 px-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700"
                      >
                        <option value="all">Semua</option>
                        {Array.from(new Set(catalogItems.map(i => i.kategori).filter(Boolean))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="">Tanpa Kategori</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setIsPrintCatalogOpen(true)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      title="Cetak/Unduh Katalog ke PDF"
                    >
                      <Printer size={13} />
                      Cetak Katalog
                    </button>
                  </div>

                </div>

                {/* Catalog Card Grid or Table */}
                <div className="p-6">
                  {catalogItems.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 text-slate-400">
                      <Tag size={44} className="text-slate-300 stroke-1" />
                      <div>
                        <p className="text-xs font-bold">Katalog Produk masih kosong.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Kelola produk Anda secara manual dengan mengklik "Tambah Produk Baru".</p>
                      </div>
                      <button
                        onClick={openAddCatalogModal}
                        className="mt-2 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg border border-blue-200 transition-all cursor-pointer"
                      >
                        Tambah Produk Pertama
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const filtered = catalogItems.filter(item => {
                        const matchSearch = item.kode.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                            item.nama.toLowerCase().includes(catalogSearch.toLowerCase());
                        const matchCategory = catalogFilterCategory === 'all' ||
                                              (item.kategori || '').toLowerCase() === catalogFilterCategory.toLowerCase();
                        return matchSearch && matchCategory;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-12 text-center text-slate-400 text-xs font-medium">
                            Tidak ada produk katalog yang cocok dengan pencarian Anda.
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {filtered.map((product) => (
                            <div 
                              key={product.kode}
                              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col group relative"
                            >
                              {/* Product Image Panel */}
                              <div className="aspect-square bg-slate-50 border-b border-slate-100 flex items-center justify-center relative overflow-hidden shrink-0">
                                {product.foto && !failedImages[`cat_${product.kode}`] ? (
                                  <img 
                                    src={getImageUrl(product.foto)} 
                                    alt={product.nama}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    onError={() => {
                                      setFailedImages(prev => ({ ...prev, [`cat_${product.kode}`]: true }));
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-1 text-slate-400">
                                    <Image size={28} className="text-slate-300 stroke-1" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tanpa Foto</span>
                                  </div>
                                )}
                                
                                {product.kategori && (
                                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-slate-900/80 backdrop-blur-xs text-white rounded-md">
                                    {product.kategori}
                                  </span>
                                )}
                              </div>

                              {/* Content Details */}
                              <div className="p-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-1">
                                  <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                                    {product.kode}
                                  </span>
                                  <h4 className="font-bold text-slate-800 text-xs tracking-tight line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                    {product.nama}
                                  </h4>
                                  
                                  {/* Custom attributes badges (Jenis, Motif, Warna) */}
                                  {(product.jenis || product.motif || product.warna) && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {product.jenis && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-md font-medium" title={`Jenis: ${product.jenis}`}>
                                          {product.jenis}
                                        </span>
                                      )}
                                      {product.motif && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-sky-50 border border-sky-100 text-sky-600 rounded-md font-medium" title={`Motif: ${product.motif}`}>
                                          {product.motif}
                                        </span>
                                      )}
                                      {product.warna && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-md font-medium" title={`Warna: ${product.warna}`}>
                                          {product.warna}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Variant Pricing Slots display */}
                                  <div className="mt-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100 space-y-1 text-[10px]">
                                    <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Daftar Ukuran & Harga:</div>
                                    <div className="space-y-1">
                                      {/* Variant 1 */}
                                      <div className="flex justify-between items-center bg-white p-1 rounded border border-slate-100">
                                        <span className="font-bold text-slate-600 font-mono text-[9px] px-1 bg-slate-100 rounded">
                                          {product.ukuran || 'Std'}
                                        </span>
                                        <div className="text-right text-[9px]">
                                          <div className="font-mono font-bold text-slate-700">{formatRupiah(product.harga)}</div>
                                          {product.hargaReseller ? (
                                            <div className="font-mono font-medium text-indigo-500 text-[8px] -mt-0.5">Reseller: {formatRupiah(product.hargaReseller)}</div>
                                          ) : null}
                                        </div>
                                      </div>

                                      {/* Variant 2 */}
                                      {product.ukuran2 && (
                                        <div className="flex justify-between items-center bg-white p-1 rounded border border-slate-100">
                                          <span className="font-bold text-slate-600 font-mono text-[9px] px-1 bg-slate-100 rounded">
                                            {product.ukuran2}
                                          </span>
                                          <div className="text-right text-[9px]">
                                            <div className="font-mono font-bold text-slate-700">{formatRupiah(product.harga2 || 0)}</div>
                                            {product.hargaReseller2 ? (
                                              <div className="font-mono font-medium text-indigo-500 text-[8px] -mt-0.5">Reseller: {formatRupiah(product.hargaReseller2)}</div>
                                            ) : null}
                                          </div>
                                        </div>
                                      )}

                                      {/* Variant 3 */}
                                      {product.ukuran3 && (
                                        <div className="flex justify-between items-center bg-white p-1 rounded border border-slate-100">
                                          <span className="font-bold text-slate-600 font-mono text-[9px] px-1 bg-slate-100 rounded">
                                            {product.ukuran3}
                                          </span>
                                          <div className="text-right text-[9px]">
                                            <div className="font-mono font-bold text-slate-700">{formatRupiah(product.harga3 || 0)}</div>
                                            {product.hargaReseller3 ? (
                                              <div className="font-mono font-medium text-indigo-500 text-[8px] -mt-0.5">Reseller: {formatRupiah(product.hargaReseller3)}</div>
                                            ) : null}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between">
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    {[product.ukuran, product.ukuran2, product.ukuran3].filter(Boolean).length} Ukuran Terdaftar
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openEditCatalogModal(product)}
                                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Edit Produk"
                                    >
                                      <Edit size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCatalog(product)}
                                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="Hapus Produk"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Footer Info */}
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
                  <div>Menampilkan {catalogItems.length} produk dalam katalog jualan</div>
                  {lastSynced && (
                    <div className="font-medium text-slate-400">
                      Sync: {lastSynced}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header Title and Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-6 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">Manajemen Atribut Produk (Database Sheets)</h3>
                  <p className="text-[11px] text-slate-500 max-w-xl">
                    Admin dapat menambah, mengedit, atau menghapus item atribut dari Google Sheets database. Atribut ini akan otomatis muncul sebagai pilihan opsi saat menambahkan atau mengedit Katalog Produk.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sheets Database:</span>
                  <span className="text-xs bg-white border border-slate-200 text-slate-600 font-bold px-3 py-1 rounded-lg">
                    {settingsTab.charAt(0).toUpperCase() + settingsTab.slice(1)}
                  </span>
                </div>
              </div>

              {/* Error/Success Feedbacks */}
              {settingsError && (
                <div className="p-4 bg-red-50 border border-red-150 text-red-800 text-xs rounded-xl font-semibold shadow-xs flex items-center gap-2.5">
                  <CircleAlert size={16} className="text-red-500 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}
              {settingsSuccess && (
                <div className="p-4 bg-green-50 border border-green-150 text-green-800 text-xs rounded-xl font-semibold shadow-xs flex items-center gap-2.5">
                  <Check size={16} className="text-green-500 shrink-0" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200">
                {(['database', 'jenis', 'motif', 'warna', 'ukuran'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setSettingsTab(tab);
                      setSettingsNewValue('');
                      setSettingsEditingIndex(null);
                      setSettingsError(null);
                      setSettingsSuccess(null);
                    }}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 capitalize cursor-pointer -mb-[2px] ${
                      settingsTab === tab
                        ? 'border-blue-600 text-blue-600 font-extrabold'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab === 'database' ? 'Koneksi Google Sheets' : `Atribut ${tab}`}
                  </button>
                ))}
              </div>

              {settingsTab === 'database' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Panel: Configuration Form & Status */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-fit space-y-6">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span>Pengaturan Web App URL</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Masukkan URL Google Apps Script Web App yang telah dideploy untuk menghubungkan aplikasi ini dengan database Google Sheet.
                      </p>
                    </div>

                    <form onSubmit={handleSaveAppsScriptUrl} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 block">
                          Google Apps Script URL:
                        </label>
                        <input
                          type="url"
                          value={appsScriptUrlInput}
                          onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                          placeholder="https://script.google.com/macros/s/XXXXX/exec"
                          className="w-full text-xs py-2.5 px-3 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                          required
                          disabled={settingsLoading}
                        />
                        {getAppsScriptUrl() ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Koneksi tersimpan ke Apps Script</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-semibold bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Belum terhubung ke Apps Script (Mode Offline Aktif)</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={settingsLoading}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {settingsLoading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Menyinkronkan...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan & Sinkronkan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <h5 className="text-xs font-bold text-slate-700">Daftar Sheet yang Digunakan:</h5>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-500 font-mono">
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Sheet1 (Inventaris)</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Penjualan</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> PreOrder</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Katalog</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> TitipJual</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> LogAktivitas</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Kategori</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Karyawan</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> Absensi</div>
                        <div className="flex items-center gap-1"><span className="text-blue-500">✔</span> GajiPembayaran</div>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        *Sheet di atas otomatis dibuat oleh sistem saat pertama kali terhubung dengan Apps Script.
                      </p>
                    </div>
                  </div>

                  {/* Right Panel: Step-by-Step Deployment Instructions */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-indigo-600" />
                        <span>Panduan Pemasangan Apps Script</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Ikuti langkah mudah berikut untuk menghubungkan Google Sheets Anda sebagai database pusat:
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-slate-600 max-h-[500px] overflow-y-auto pr-2">
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</div>
                        <div>
                          <p className="font-bold text-slate-800">Buat Spreadsheet Baru</p>
                          <p className="text-slate-500 text-[11px]">Buka Google Sheets di browser Anda (<a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">sheets.new</a>) atau buka sheet yang sudah ada.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</div>
                        <div>
                          <p className="font-bold text-slate-800">Buka Google Apps Script</p>
                          <p className="text-slate-500 text-[11px]">Pada menu atas, klik <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</div>
                        <div>
                          <p className="font-bold text-slate-800">Salin & Tempel Kode Backend</p>
                          <p className="text-slate-500 text-[11px] mb-2">Hapus seluruh kode default yang ada di editor, lalu salin seluruh kode dari file <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-600">apps-script.js</code> di folder root aplikasi Anda atau gunakan tombol copy di bawah ini:</p>
                          
                          <button
                            onClick={() => {
                              const code = `// ==============================================================================
// GOOGLE APPS SCRIPT WEB APP - DATABASE BACKEND FOR INVENTARIS APP
// ==============================================================================

const SPREADSHEET_ID = ""; // Kosongkan untuk menggunakan spreadsheet aktif tempat script ini ditempel.

function getActiveSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === "readAll") {
    return handleReadAll();
  }
  return jsonResponse({ 
    success: false, 
    error: "Action GET tidak valid. Gunakan ?action=readAll" 
  });
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    if (action === "saveSheet") {
      return handleSaveSheet(postData.sheetName, postData.values);
    } else if (action === "uploadImage") {
      return handleUploadImage(postData.name, postData.type, postData.base64Data);
    }
    return jsonResponse({ success: false, error: "Action POST tidak valid" });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleReadAll() {
  try {
    const ss = getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const db = {};
    const nameMap = {
      "sheet1": "inventaris",
      "penjualan": "penjualan",
      "preorder": "preorder",
      "katalog": "katalog",
      "titipjual": "consignment",
      "logaktivitas": "logs",
      "kategori": "kategori",
      "karyawan": "karyawan",
      "absensi": "absensi",
      "produksiborongan": "produksiBorongan",
      "pinjaman": "pinjaman",
      "gajipembayaran": "gajiPembayaran",
      "produkborongan": "produkBorongan",
      "jenis": "jenisList",
      "motif": "motifList",
      "warna": "warnaList",
      "ukuran": "ukuranList"
    };
    const requiredSheets = {
      "Sheet1": ["Kode", "Nama", "Jumlah", "Harga Satuan", "Foto Barang", "Ambang Batas", "Kategori"],
      "Penjualan": ["ID", "Tanggal", "Kode Barang", "Nama Barang", "Jumlah", "Harga Satuan", "Total", "Ukuran", "Tipe Pelanggan", "Catatan"],
      "PreOrder": ["ID", "Tanggal Pemesanan", "Nama Pengepul", "Kontak Pengepul", "Pesanan Detail", "Tanggal Target Selesai", "Status", "Total Biaya", "Nominal DP", "Sisa Pembayaran", "Tipe Order", "Isi Nama", "Nama Custom"],
      "Katalog": ["Kode", "Nama", "Kategori", "Harga", "Foto", "Harga Reseller", "Jenis", "Motif", "Warna", "Ukuran", "Ukuran 2", "Harga 2", "Harga Reseller 2", "Ukuran 3", "Harga 3", "Harga Reseller 3", "Nilai Borongan"],
      "TitipJual": ["ID", "Tanggal Ambil", "Tanggal Selesai", "Nama Mitra", "Kontak Mitra", "Detail Barang", "Status", "Total Nilai Ambil", "Total Nilai Laku", "Catatan"],
      "LogAktivitas": ["ID", "Timestamp", "Operator", "Aksi", "Detail"],
      "Kategori": ["Nama Kategori"],
      "Karyawan": ["ID", "Nama", "Kategori", "Gaji Harian", "Tanggal Masuk", "Status Aktif"],
      "Absensi": ["ID", "Tanggal", "ID Karyawan", "Nama Karyawan", "Status Kerja", "Keterangan"],
      "ProduksiBorongan": ["ID", "Tanggal", "ID Karyawan", "Nama Karyawan", "Kode Produk", "Nama Produk", "Jumlah", "Nilai Per Pcs", "Total Nilai"],
      "Pinjaman": ["ID", "Tanggal", "ID Karyawan", "Nama Karyawan", "Jumlah Pinjaman", "Status", "Catatan"],
      "GajiPembayaran": ["ID", "Tanggal Gajian", "Bulan Tahun", "ID Karyawan", "Nama Karyawan", "Gaji Pokok", "Tunjangan", "Lembur", "Bonus Borongan", "Total Pinjaman", "Potongan Pinjaman", "Total Diterima", "Metode Transfer", "Status Pembayaran"],
      "ProdukBorongan": ["ID", "Nama", "Nilai Per Pcs"],
      "Jenis": ["Jenis"],
      "Motif": ["Motif"],
      "Warna": ["Warna"],
      "Ukuran": ["Ukuran"]
    };
    Object.keys(requiredSheets).forEach(sheetName => {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(requiredSheets[sheetName]);
      }
    });
    const updatedSheets = ss.getSheets();
    updatedSheets.forEach(sheet => {
      const name = sheet.getName();
      const lowerName = name.toLowerCase().replace(/\\s/g, "");
      const dbKey = nameMap[lowerName];
      if (dbKey) {
        const values = sheet.getDataRange().getValues();
        db[dbKey] = values;
      }
    });
    return jsonResponse({ success: true, db: db });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleSaveSheet(sheetName, values) {
  try {
    const ss = getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clearContents();
    sheet.clearFormats();
    if (values && values.length > 0) {
      const range = sheet.getRange(1, 1, values.length, values[0].length);
      range.setValues(values);
    }
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleUploadImage(fileName, fileType, base64Data) {
  try {
    const folderName = "Inventaris_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, fileType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const url = "https://drive.google.com/uc?export=view&id=" + fileId;
    return jsonResponse({ success: true, url: url, fileId: fileId });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
                              navigator.clipboard.writeText(code);
                              setSettingsSuccess('Kode Apps Script berhasil dicopy ke clipboard!');
                              setTimeout(() => setSettingsSuccess(null), 3000);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5"
                          >
                            <Download size={12} />
                            <span>Copy Kode Apps Script</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">4</div>
                        <div>
                          <p className="font-bold text-slate-800">Terapkan Sebagai Aplikasi Web (Deploy)</p>
                          <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] mt-1">
                            <li>Klik tombol <strong>Terapkan (Deploy)</strong> di kanan atas &gt; pilih <strong>Penerapan baru (New deployment)</strong>.</li>
                            <li>Klik ikon gir di samping "Pilih jenis" &gt; pilih <strong>Aplikasi web (Web app)</strong>.</li>
                            <li>Isi deskripsi bebas (contoh: <code className="bg-slate-100 px-1 rounded text-slate-600 font-mono">Backend Inventaris</code>).</li>
                            <li>Ganti <strong>Jalankan sebagai (Execute as)</strong> menjadi <strong>Saya (email Anda)</strong>.</li>
                            <li>Ganti <strong>Yang memiliki akses (Who has access)</strong> menjadi <strong>Siapa saja (Anyone)</strong>. <span className="text-red-500 font-bold">*Sangat Penting!</span></li>
                            <li>Klik <strong>Terapkan (Deploy)</strong>.</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">5</div>
                        <div>
                          <p className="font-bold text-slate-800">Berikan Izin Akses (Authorize)</p>
                          <p className="text-slate-500 text-[11px]">Google akan meminta Anda untuk memberikan izin akses akun Anda. Klik <strong>Izin Akses (Authorize Access)</strong>, klik <strong>Lanjutan (Advanced)</strong> di bagian bawah popup, lalu pilih <strong>Buka Project (tidak aman) / Go to Untitled project (unsafe)</strong>, lalu klik <strong>Izinkan (Allow)</strong>.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">6</div>
                        <div>
                          <p className="font-bold text-slate-800">Salin URL & Tempelkan Disini</p>
                          <p className="text-slate-500 text-[11px]">Salin <strong>URL Aplikasi Web</strong> yang diberikan (berformat <code className="bg-slate-100 px-1 rounded text-indigo-600 font-mono">https://script.google.com/macros/s/.../exec</code>) lalu tempelkan ke kolom input di panel kiri dan klik <strong>Simpan & Sinkronkan</strong>. Selesai!</p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Column 1: Add New Item Form */}
                  <div className="md:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs h-fit space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-800 capitalize font-sans">Tambah {settingsTab} Baru</h4>
                      <p className="text-[10px] text-slate-400">Data akan langsung terunggah ke Google Spreadsheet.</p>
                    </div>

                    <form onSubmit={handleAddSettingsItem} className="space-y-3">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Nama {settingsTab}:</label>
                        <input
                          type="text"
                          value={settingsNewValue}
                          onChange={(e) => setSettingsNewValue(e.target.value)}
                          placeholder={`Contoh: ${
                            settingsTab === 'jenis' ? 'Tumpuk' :
                            settingsTab === 'motif' ? 'Batok Kayu' :
                            settingsTab === 'warna' ? 'Cat Maron' : 'D25'
                          }`}
                          className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          required
                          disabled={settingsLoading}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={settingsLoading}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {settingsLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah ke Database</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Column 2 & 3: List & Edit Panel */}
                  <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 capitalize">Daftar Atribut {settingsTab}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold font-mono">
                        {settingsTab === 'jenis' ? jenisList.length :
                         settingsTab === 'motif' ? motifList.length :
                         settingsTab === 'warna' ? warnaList.length : ukuranList.length} Item
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
                      {(() => {
                        const currentList =
                          settingsTab === 'jenis' ? jenisList :
                          settingsTab === 'motif' ? motifList :
                          settingsTab === 'warna' ? warnaList : ukuranList;

                        if (currentList.length === 0) {
                          return (
                            <div className="py-12 text-center text-xs text-slate-400 font-medium">
                              Daftar {settingsTab} kosong.
                            </div>
                          );
                        }

                        return currentList.map((item, index) => (
                          <div key={index} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            {settingsEditingIndex === index ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={settingsEditingValue}
                                  onChange={(e) => setSettingsEditingValue(e.target.value)}
                                  className="flex-1 text-xs py-1 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-slate-50"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEditSettingsItem(index)}
                                  disabled={settingsLoading}
                                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 cursor-pointer disabled:opacity-50"
                                >
                                  {settingsLoading ? '...' : 'Simpan'}
                                </button>
                                <button
                                  onClick={() => setSettingsEditingIndex(null)}
                                  className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] text-slate-400 font-bold">#{index + 1}</span>
                                  <span className="text-xs font-semibold text-slate-800">{item}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSettingsEditingIndex(index);
                                      setSettingsEditingValue(item);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSettingsItem(index)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                    title="Hapus"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {activeView === 'consignment' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Alert Feedback */}
              {tjError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl font-semibold shadow-sm flex items-start space-x-2">
                  <CircleAlert size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <span>{tjError}</span>
                </div>
              )}
              {tjSuccess && (
                <div className="p-4 bg-green-50 border border-green-100 text-green-800 text-xs rounded-xl font-semibold shadow-sm flex items-start space-x-2">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                  <span>{tjSuccess}</span>
                </div>
              )}

              {/* Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mitra Aktif</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block">
                      {consignments.filter(c => c.status === 'aktif').length} Titipan
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Barang sedang di luar</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Selesai</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block">
                      {consignments.filter(c => c.status === 'selesai').length} Transaksi
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold">Telah lunas dihitung</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Nilai Laku</span>
                    <span className="text-base font-extrabold text-slate-800 font-mono block truncate">
                      {formatRupiah(consignments.filter(c => c.status === 'selesai').reduce((sum, c) => sum + (c.totalNilaiLaku || 0), 0))}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Omset laku bersih</span>
                  </div>
                </div>
              </div>

              {/* Main List Container */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={tjSearch}
                      onChange={(e) => setTjSearch(e.target.value)}
                      placeholder="Cari nama mitra atau ID..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="flex border border-slate-200 p-0.5 bg-slate-100 rounded-lg shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => setTjFilterStatus('all')}
                      className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        tjFilterStatus === 'all'
                          ? 'bg-white text-slate-800 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setTjFilterStatus('aktif')}
                      className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        tjFilterStatus === 'aktif'
                          ? 'bg-white text-blue-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-blue-600'
                      }`}
                    >
                      Aktif
                    </button>
                    <button
                      onClick={() => setTjFilterStatus('selesai')}
                      className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        tjFilterStatus === 'selesai'
                          ? 'bg-white text-green-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-green-600'
                      }`}
                    >
                      Selesai
                    </button>
                    <button
                      onClick={() => setTjFilterStatus('dibatalkan')}
                      className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        tjFilterStatus === 'dibatalkan'
                          ? 'bg-white text-red-600 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-red-600'
                      }`}
                    >
                      Batal
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {consignments.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                      <ClipboardList size={40} className="text-slate-300 stroke-1" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Belum ada transaksi Titip Jual.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Mulai dengan mencatat pengambilan barang mitra.</p>
                      </div>
                      <button
                        onClick={() => {
                          setFormTjNamaMitra('');
                          setFormTjKontakMitra('');
                          setFormTjCatatan('');
                          setFormTjItems([]);
                          setTjError(null);
                          setTjSuccess(null);
                          setItemsBackup(items);
                          setIsTjModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                      >
                        Buat Titip Jual Sekarang
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                          <th className="py-3 px-6">ID & Tanggal</th>
                          <th className="py-3 px-6">Mitra / Penjual</th>
                          <th className="py-3 px-6">Rincian Barang</th>
                          <th className="py-3 px-6 text-right">Nilai Titip</th>
                          <th className="py-3 px-6 text-right">Nilai Laku</th>
                          <th className="py-3 px-6 text-center">Status</th>
                          <th className="py-3 px-6 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consignments
                          .filter(c => {
                            const matchSearch = c.namaMitra.toLowerCase().includes(tjSearch.toLowerCase()) || c.id.toLowerCase().includes(tjSearch.toLowerCase());
                            const matchStatus = tjFilterStatus === 'all' || c.status === tjFilterStatus;
                            return matchSearch && matchStatus;
                          })
                          .map((tj) => (
                            <tr key={tj.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                              <td className="py-4 px-6 font-medium">
                                <div className="font-mono font-bold text-slate-700">{tj.id}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{tj.tanggalAmbil}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-800">{tj.namaMitra}</div>
                                {tj.kontakMitra && (
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} /> {tj.kontakMitra}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 max-w-xs">
                                <div className="space-y-1">
                                  {tj.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-medium text-slate-600">
                                      <span className="truncate mr-3">
                                        {item.namaBarang}
                                        {item.namaCustom && (
                                          <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 ml-1.5 inline-block">
                                            "{item.namaCustom}"
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-mono text-slate-500 shrink-0">
                                        {tj.status === 'selesai' ? (
                                          <span className="font-semibold text-emerald-600">Laku {item.jumlahLaku}/{item.jumlahAmbil}</span>
                                        ) : (
                                          <span>Ambil {item.jumlahAmbil}</span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {tj.catatan && (
                                  <div className="text-[9.5px] italic text-slate-400 mt-1 truncate" title={tj.catatan}>
                                    Note: {tj.catatan}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right font-semibold font-mono text-slate-700">
                                {formatRupiah(tj.totalNilaiAmbil)}
                              </td>
                              <td className="py-4 px-6 text-right font-bold font-mono text-blue-600">
                                {tj.status === 'selesai' ? formatRupiah(tj.totalNilaiLaku) : '-'}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                  tj.status === 'aktif'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : tj.status === 'selesai'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                  {tj.status === 'aktif' && 'Aktif (Barang Keluar)'}
                                  {tj.status === 'selesai' && 'Selesai'}
                                  {tj.status === 'dibatalkan' && 'Batal'}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleDownloadTjInvoice(tj)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                    title="Unduh Invoice PDF"
                                  >
                                    <Download size={14} />
                                  </button>

                                  {tj.status === 'aktif' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingTj(tj);
                                          setFormTjEditNamaMitra(tj.namaMitra);
                                          setFormTjEditKontakMitra(tj.kontakMitra || '');
                                          setFormTjEditCatatan(tj.catatan || '');
                                          setFormTjEditItems([...tj.items]);
                                          setTjEditError(null);
                                          setTjEditSuccess(null);
                                          setSelectedTjEditCatCode('');
                                          setFormTjEditCatQty(1);
                                          setTjEditItemIsiNama(false);
                                          setTjEditItemNamaCustom('');
                                          setItemsBackup(items);
                                          setIsTjEditModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                        title="Ubah / Edit Data Titip Jual"
                                      >
                                        <Edit size={14} />
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSettlingTj(tj);
                                          const mappedSettle = tj.items.map(item => ({
                                            ...item,
                                            jumlahLaku: item.jumlahAmbil,
                                            jumlahKembali: 0
                                          }));
                                          setSettleItems(mappedSettle);
                                          setIsTjSettleModalOpen(true);
                                        }}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100 transition-colors cursor-pointer"
                                        title="Hitung Penjualan Laku"
                                      >
                                        Hitung Laku
                                      </button>

                                      <button
                                        onClick={() => setDeletingTjItem(tj)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                        title="Batalkan Titip Jual"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => setHardDeletingTj(tj)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Hapus Transaksi Permanen"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'inventory' && (
            <>
              {/* Stats Bento Box Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Unique Items */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Barang</span>
                <span className="text-xl font-extrabold text-slate-800 font-mono block">{totalUniqueItems}</span>
                <span className="text-[9px] text-slate-400 font-medium">Model berbeda</span>
              </div>
            </div>

            {/* Card 2: Total Units */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Stok</span>
                <span className="text-xl font-extrabold text-slate-800 font-mono block">{totalStockQty}</span>
                <span className="text-[9px] text-slate-400 font-medium">Unit fisik gudang</span>
              </div>
            </div>

            {/* Card 3: Asset Value */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-4 col-span-2 sm:col-span-1">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Database size={20} />
              </div>
              <div className="truncate w-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nilai Aset</span>
                <span className="text-base font-extrabold text-slate-800 font-mono block truncate">{formatRupiah(totalAssetsValue)}</span>
                <span className="text-[9px] text-slate-400 font-medium">Total nilai modal</span>
              </div>
            </div>

            {/* Card 4: Critical Stock Count */}
            <button
              onClick={() => setFilterType(filterType === 'low' ? 'all' : 'low')}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center space-x-4 cursor-pointer focus:outline-none ${
                lowStockCount > 0 
                  ? filterType === 'low'
                    ? 'bg-red-600 border-red-600 text-white shadow-md'
                    : 'bg-red-50 border-red-100 text-red-950 hover:bg-red-100/70'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className={`p-3 rounded-lg ${
                lowStockCount > 0 
                  ? filterType === 'low' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <TrendingDown size={20} />
              </div>
              <div className="truncate">
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${filterType === 'low' ? 'text-red-100' : 'text-slate-400'}`}>
                  Stok Menipis
                </span>
                <span className="text-xl font-extrabold font-mono block">
                  {lowStockCount} <span className="text-xs font-normal">Items</span>
                </span>
                <span className={`text-[9px] font-semibold block ${filterType === 'low' ? 'text-white underline' : 'text-slate-400'}`}>
                  {lowStockCount > 0 
                    ? filterType === 'low' ? 'Saringan aktif' : 'Saring stok kritis' 
                    : 'Semua aman'}
                </span>
              </div>
            </button>
          </div>

          {/* Main Inventory Grid Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Filtering and search control bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="relative w-full md:max-w-md">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari berdasarkan kode atau nama barang..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                {/* Category Filter Dropdown */}
                <div className="flex items-center space-x-2 text-xs text-slate-500 w-full sm:w-auto">
                  <span className="font-semibold shrink-0">Kategori:</span>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full sm:w-36 py-1 px-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700"
                  >
                    <option value="all">Semua</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="">Tanpa Kategori</option>
                  </select>
                </div>

                {/* Status Segmented Buttons */}
                <div className="flex items-center border border-slate-200 p-0.5 bg-slate-100 rounded-lg shrink-0 w-full sm:w-auto justify-center">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer transition-all ${
                      filterType === 'all' 
                        ? 'bg-white text-slate-800 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilterType('low')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer transition-all ${
                      filterType === 'low' 
                        ? 'bg-white text-red-600 shadow-xs' 
                        : 'text-slate-500 hover:text-red-600'
                    }`}
                  >
                    Kritis
                  </button>
                  <button
                    onClick={() => setFilterType('safe')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer transition-all ${
                      filterType === 'safe' 
                        ? 'bg-white text-emerald-600 shadow-xs' 
                        : 'text-slate-500 hover:text-emerald-600'
                    }`}
                  >
                    Aman
                  </button>
                </div>
              </div>

            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3 border-r border-slate-200 w-20 text-center">Foto</th>
                    
                    <th 
                      onClick={() => handleSort('kode')}
                      className="px-6 py-3 border-r border-slate-200 w-28 text-center cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Kode</span>
                        <ArrowUpDown size={10} className="text-slate-400" />
                      </div>
                    </th>
                    
                    <th 
                      onClick={() => handleSort('nama')}
                      className="px-6 py-3 border-r border-slate-200 cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Nama Barang</span>
                        <ArrowUpDown size={10} className="text-slate-400" />
                      </div>
                    </th>
                    
                    <th 
                      onClick={() => handleSort('kategori')}
                      className="px-6 py-3 border-r border-slate-200 w-36 cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Kategori</span>
                        <ArrowUpDown size={10} className="text-slate-400" />
                      </div>
                    </th>
                    
                    <th 
                      onClick={() => handleSort('jumlah')}
                      className="px-6 py-3 border-r border-slate-200 w-32 text-center cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Stok</span>
                        <ArrowUpDown size={10} className="text-slate-400" />
                      </div>
                    </th>
                    
                    <th 
                      onClick={() => handleSort('hargaSatuan')}
                      className="px-6 py-3 border-r border-slate-200 w-44 text-right cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Harga Satuan</span>
                        <ArrowUpDown size={10} className="text-slate-400" />
                      </div>
                    </th>

                    <th className="px-6 py-3 border-r border-slate-200 w-44 text-right">
                      Total Aset
                    </th>

                    <th className="px-6 py-3 w-28 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {loading && processedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium bg-white">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <RefreshCw className="animate-spin text-blue-600" size={24} />
                          <span>Membaca database Google Sheets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : processedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium bg-white">
                        Tidak ada barang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    processedItems.map((item) => {
                      const isLow = item.jumlah <= item.ambangBatas;
                      const totalVal = item.jumlah * item.hargaSatuan;
                      
                      return (
                        <tr 
                          key={item.kode} 
                          className={`transition-colors ${
                            isLow ? 'bg-red-50/50 hover:bg-red-50' : 'bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Foto */}
                          <td className="px-6 py-4 text-center border-r border-slate-100">
                            {(() => {
                              const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === item.kode.toUpperCase());
                              const photoToUse = matchedCat?.foto || item.fotoBarang;
                              if (photoToUse && !failedImages[`inv_${item.kode}`]) {
                                return (
                                  <img 
                                    src={getImageUrl(photoToUse)} 
                                    alt={item.nama}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 rounded object-cover mx-auto border border-slate-100 shadow-xs cursor-zoom-in hover:scale-105 hover:opacity-90 transition-all duration-150"
                                    onClick={() => setLightboxItem({ ...item, fotoBarang: photoToUse })}
                                    onError={() => {
                                      setFailedImages(prev => ({ ...prev, [`inv_${item.kode}`]: true }));
                                    }}
                                  />
                                );
                              }
                              return (
                                <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded mx-auto flex flex-col items-center justify-center text-slate-400 text-[9px] font-semibold">
                                  <Image size={14} className="text-slate-300 mb-0.5" />
                                  <span>NO IMG</span>
                                </div>
                              );
                            })()}
                          </td>

                          {/* Kode */}
                          <td className="px-6 py-4 font-mono text-slate-500 text-center border-r border-slate-100 text-xs font-semibold">
                            {item.kode}
                          </td>

                          {/* Nama Barang */}
                          <td className="px-6 py-4 font-medium text-slate-900 border-r border-slate-100">
                            {(() => {
                              const { baseName, breakdown } = parseInventoryItemName(item.nama);
                              const sizeEntries = Object.entries(breakdown);
                              return (
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-800 text-xs sm:text-sm">{baseName}</div>
                                  {sizeEntries.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {sizeEntries.map(([size, qty]) => (
                                        <span 
                                          key={size} 
                                          className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 border rounded-md animate-in fade-in duration-200 ${
                                            qty > 0 
                                              ? 'bg-blue-50 border-blue-100 text-blue-600' 
                                              : 'bg-red-50 border-red-100 text-red-600'
                                          }`}
                                        >
                                          {size}: {qty} Pcs
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {isLow && (
                              <span className="block text-[10px] text-red-500 font-bold uppercase mt-1">
                                Alert: Low Stock (Min: {item.ambangBatas})
                              </span>
                            )}
                          </td>

                          {/* Kategori */}
                          <td className="px-6 py-4 border-r border-slate-100 text-xs font-semibold text-slate-600">
                            {item.kategori ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                                {item.kategori}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Tanpa Kategori</span>
                            )}
                          </td>

                          {/* Jumlah / Stok */}
                          <td className="px-6 py-4 text-center border-r border-slate-100">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleQuickAdjustStock(item, -1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none"
                              >
                                -
                              </button>
                              <span className={`font-mono font-bold w-10 text-center text-xs ${isLow ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                                {item.jumlah} Unit
                              </span>
                              <button
                                onClick={() => handleQuickAdjustStock(item, 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Harga Satuan */}
                          <td className="px-6 py-4 text-right border-r border-slate-100 font-mono text-xs">
                            {formatRupiah(item.hargaSatuan)}
                          </td>

                          {/* Total Aset */}
                          <td className="px-6 py-4 text-right border-r border-slate-100 font-mono text-xs font-semibold text-slate-800">
                            {formatRupiah(totalVal)}
                          </td>

                          {/* Aksi */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="Edit Item"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => setDeletingInventoryItem(item)}
                                disabled={session.role !== 'admin'}
                                className={`p-1 rounded transition-colors ${
                                  session.role === 'admin' 
                                    ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer' 
                                    : 'text-slate-200 cursor-not-allowed'
                                }`}
                                title={session.role === 'admin' ? 'Hapus Barang' : 'Hanya Administrator'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Info Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
              <div>Menampilkan {processedItems.length} dari {items.length} barang di database</div>
              {lastSynced && (
                <div className="font-medium text-slate-400">
                  Last sync: {lastSynced}
                </div>
              )}
            </div>

          </div>
          </>
          )}

          {activeView === 'employee' && (
            <EmployeeManager
              token={token}
              spreadsheetId={spreadsheet.id}
              session={session}
              catalogItems={catalogItems}
              karyawanList={karyawanList}
              absensiList={absensiList}
              produksiBoronganList={produksiBoronganList}
              pinjamanList={pinjamanList}
              gajiPembayaranList={gajiPembayaranList}
              produkBoronganList={produkBoronganList}
              setKaryawanList={setKaryawanList}
              setAbsensiList={setAbsensiList}
              setProduksiBoronganList={setProduksiBoronganList}
              setPinjamanList={setPinjamanList}
              setGajiPembayaranList={setGajiPembayaranList}
              setProdukBoronganList={setProdukBoronganList}
              onAddActivityLog={handleAddActivityLog}
            />
          )}

        </div>

        {/* Statistics Footer Bar */}
        <footer className="h-12 bg-white border-t border-slate-200 flex items-center px-8 gap-12 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total Inventory Value:</span>
            <span className="font-bold text-slate-700 font-mono">{formatRupiah(totalAssetsValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Low Stock Warning:</span>
            <span className={`font-bold ${lowStockCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {lowStockCount > 0 ? `${lowStockCount} Items Low` : 'All Stock Healthy'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Live Google Drive Sync Connected</span>
          </div>
        </footer>

      </main>

      {/* CRUD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                {editingItem ? 'Ubah Rincian Barang' : 'Tambah Barang Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {duplicateCodeError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{duplicateCodeError}</span>
                </div>
              )}

              {/* Import from Catalog Widget */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Tarik Data dari Katalog Produk</span>
                </div>
                
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const selected = catalogItems.find(c => c.kode === val);
                      if (selected) {
                        if (!editingItem) {
                          setFormKode(selected.kode);
                        }
                        setFormNama(selected.nama);
                        setFormKategori(selected.kategori);
                        setFormHarga(selected.harga);
                        setFormFotoUrl(selected.foto || '');
                      }
                      // Reset selection
                      e.target.value = '';
                    }}
                    className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Produk dari Katalog --</option>
                    {catalogItems.map(c => (
                      <option key={c.kode} value={c.kode}>
                        [{c.kode}] {c.nama} - {formatRupiah(c.harga)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[9.5px] text-slate-400 font-medium">
                  💡 Memilih produk dari katalog akan otomatis mengisi kolom Kode dan Nama di bawah ini, serta menyinkronkan Kategori, Harga Satuan, dan Foto Barang secara otomatis dari Katalog Produk.
                </p>
              </div>
              


              {/* Info Detail dari Katalog Produk (Foto & Harga) */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Foto & Harga Barang</span>
                {(() => {
                  const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === formKode.trim().toUpperCase());
                  if (matchedCatalog) {
                    return (
                      <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex gap-4 items-center">
                        {matchedCatalog.foto ? (
                          <img 
                            src={getImageUrl(matchedCatalog.foto)} 
                            alt={matchedCatalog.nama}
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                            NO IMG
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] uppercase font-extrabold text-blue-600 tracking-wider block mb-0.5">Terhubung Katalog Produk</span>
                          <h4 className="text-xs font-bold text-slate-800 truncate">{matchedCatalog.nama}</h4>
                          <p className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">Kode: {matchedCatalog.kode}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-extrabold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-md">
                              {formatRupiah(matchedCatalog.harga)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {matchedCatalog.kategori || 'Tanpa Kategori'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                        <p className="text-xs text-amber-800 font-semibold">
                          ⚠️ Barang ini tidak terhubung dengan Katalog Produk.
                        </p>
                        <p className="text-[10.5px] text-slate-500 mt-1">
                          Pilih produk dari menu "Tarik Data dari Katalog Produk" di atas agar Foto Barang dan Harga Satuan langsung sinkron otomatis tanpa input manual.
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Size breakdown inputs */}
              {(() => {
                const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === formKode.trim().toUpperCase());
                const sizes = matchedCatalog
                  ? [
                      matchedCatalog.ukuran || 'Standard',
                      matchedCatalog.ukuran2,
                      matchedCatalog.ukuran3
                    ].filter(Boolean) as string[]
                  : (ukuranList.length > 0 ? ukuranList : ['Standard']);

                return (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-250">
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Layers size={14} className="animate-pulse" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                        Atur Stok Berdasarkan Ukuran
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {sizes.map((size) => {
                        const currentQty = formSizesStock[size] || 0;
                        return (
                          <div key={size} className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide block">
                              Ukuran {size}:
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={currentQty}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setFormSizesStock(prev => ({
                                  ...prev,
                                  [size]: val
                                }));
                              }}
                              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 flex justify-between pt-2 border-t border-slate-200">
                      <span>Total Stok Terhitung:</span>
                      <span className="text-blue-700 font-mono font-extrabold text-xs bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                        {formJumlah} Pcs
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                {/* Jumlah */}
                <div className="opacity-75">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Stok:</label>
                  <input
                    type="number"
                    disabled
                    value={formJumlah}
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed"
                  />
                </div>

                {/* Ambang Batas */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ambang Batas (Pcs):</label>
                  <input
                    type="number"
                    min="0"
                    value={formAmbang}
                    onChange={(e) => setFormAmbang(Number(e.target.value))}
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-semibold"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingPhoto}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Monthly Report Print Modal Overlay */}
      {isPrintOpen && (
        <PrintReport
          items={syncedItems}
          session={session}
          sheetName={spreadsheet.name}
          onClose={() => setIsPrintOpen(false)}
        />
      )}

      {/* Product Catalog Print Modal Overlay */}
      {isPrintCatalogOpen && (
        <PrintCatalog
          items={catalogItems.filter(item => {
            const matchSearch = item.kode.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                item.nama.toLowerCase().includes(catalogSearch.toLowerCase());
            const matchCategory = catalogFilterCategory === 'all' ||
                                  (item.kategori || '').toLowerCase() === catalogFilterCategory.toLowerCase();
            return matchSearch && matchCategory;
          })}
          session={session}
          sheetName={spreadsheet.name}
          onClose={() => setIsPrintCatalogOpen(false)}
        />
      )}

      {/* Lightbox Modal for Full Resolution Photo */}
      {lightboxItem && (() => {
        const matchedCatalog = catalogItems.find(c => c.kode.toUpperCase() === lightboxItem.kode.toUpperCase());
        const displayFoto = matchedCatalog ? matchedCatalog.foto : lightboxItem.fotoBarang;
        const displayHarga = matchedCatalog ? matchedCatalog.harga : lightboxItem.hargaSatuan;

        return (
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
            <div 
              className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-200 py-3 px-6 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{lightboxItem.nama}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Kode: {lightboxItem.kode}</p>
                </div>
                <button
                  onClick={() => setLightboxItem(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body (Full Res Image) */}
              <div className="flex-1 bg-slate-900 flex items-center justify-center p-4 overflow-hidden min-h-[300px]">
                {displayFoto && !failedImages[lightboxItem.kode] ? (
                  <img
                    src={getImageUrl(displayFoto)}
                    alt={lightboxItem.nama}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[60vh] object-contain rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-200"
                    onError={() => {
                      setFailedImages(prev => ({ ...prev, [lightboxItem.kode]: true }));
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2 text-slate-500">
                    <Image size={48} className="text-slate-700 stroke-1 animate-pulse" />
                    <span className="text-xs">Gambar tidak dapat dimuat atau belum ditentukan</span>
                  </div>
                )}
              </div>

              {/* Modal Footer (Details) */}
              <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-6 flex items-center justify-between text-xs text-slate-600 shrink-0 gap-4 flex-wrap">
                <div>
                  <span className="text-slate-400 font-medium">Stok Saat Ini:</span>
                  <span className="font-bold text-slate-800 ml-1.5 font-mono">{lightboxItem.jumlah} Unit</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Harga Satuan:</span>
                  <span className="font-bold text-slate-800 ml-1.5 font-mono">{formatRupiah(displayHarga)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Total Nilai Aset:</span>
                  <span className="font-bold text-blue-600 ml-1.5 font-mono">{formatRupiah(lightboxItem.jumlah * displayHarga)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" />
                Kelola Kategori Barang
              </h3>
              <button
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setNewCategoryName('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

             {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              {/* Add category form */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Tambah Kategori Baru:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      setDuplicateCategoryError(null);
                    }}
                    placeholder="Contoh: Bokor, Dulang, Furnitur..."
                    className="flex-1 text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    Tambah
                  </button>
                </div>
                {duplicateCategoryError && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                    <CircleAlert className="w-3 h-3 text-red-500 shrink-0" />
                    {duplicateCategoryError}
                  </p>
                )}
              </div>

              {/* Categories list */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Daftar Kategori:</label>
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Belum ada kategori yang ditambahkan.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-white shadow-xs">
                    {categories.map((cat) => (
                      <div key={cat} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          {cat}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3 px-6 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setNewCategoryName('');
                }}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Sales Revert / Delete Confirmation Modal */}
      {deletingSaleItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <CircleAlert className="w-4 h-4 text-red-500" />
                Batalkan Transaksi
              </h3>
              <button
                onClick={() => setDeletingSaleItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin membatalkan transaksi <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">{deletingSaleItem.id}</span>?
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Barang:</span>
                  <span className="font-bold text-slate-800">{deletingSaleItem.namaBarang}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah:</span>
                  <span className="font-bold text-slate-800 font-mono">{deletingSaleItem.jumlah} Unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold text-blue-600 font-mono">{formatRupiah(deletingSaleItem.total)}</span>
                </div>
              </div>

              <p className="text-[11px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 p-2.5 rounded-lg">
                ⚠️ Stok barang ini akan dikembalikan sebanyak <span className="font-bold">{deletingSaleItem.jumlah} unit</span> ke dalam inventaris gudang.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingSaleItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSale(deletingSaleItem)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Ya, Batalkan Transaksi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Inventory Item Delete Confirmation Modal */}
      {deletingInventoryItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <CircleAlert className="w-4 h-4 text-red-500" />
                Hapus Barang
              </h3>
              <button
                onClick={() => setDeletingInventoryItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus barang <span className="font-bold text-slate-800">"{deletingInventoryItem.nama}"</span>? Tindakan ini akan menghapusnya secara permanen dari database spreadsheet.
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kode Barang:</span>
                  <span className="font-mono font-bold text-slate-800">{deletingInventoryItem.kode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stok Saat Ini:</span>
                  <span className="font-bold text-slate-800 font-mono">{deletingInventoryItem.jumlah} Unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nilai Aset:</span>
                  <span className="font-bold text-blue-600 font-mono">{formatRupiah(deletingInventoryItem.jumlah * deletingInventoryItem.hargaSatuan)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingInventoryItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeDeleteItem(deletingInventoryItem)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Ya, Hapus Barang
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PreOrder Delete Confirmation Modal */}
      {deletingPoItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-250">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <CircleAlert className="w-4 h-4 text-red-500" />
                Hapus PreOrder
              </h3>
              <button
                onClick={() => setDeletingPoItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus pesanan PreOrder dari <span className="font-bold text-slate-800">"{deletingPoItem.namaPengepul}"</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">ID PreOrder:</span>
                  <span className="font-mono font-bold text-slate-800">{deletingPoItem.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Biaya:</span>
                  <span className="font-bold text-blue-600 font-mono">{formatRupiah(deletingPoItem.totalBiaya)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingPoItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  executeDeletePo(deletingPoItem);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Ya, Hapus PreOrder
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Catalog Item Delete Confirmation Modal */}
      {deletingCatalogItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <CircleAlert className="w-4 h-4 text-red-500" />
                Hapus Produk Katalog
              </h3>
              <button
                onClick={() => setDeletingCatalogItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus produk <span className="font-bold text-slate-800">"{deletingCatalogItem.nama}"</span> dari Katalog Produk? Tindakan ini akan menghapusnya secara permanen dari database spreadsheet.
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kode Produk:</span>
                  <span className="font-mono font-bold text-slate-800">{deletingCatalogItem.kode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Harga:</span>
                  <span className="font-bold text-slate-800 font-mono">{formatRupiah(deletingCatalogItem.harga)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingCatalogItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeDeleteCatalog(deletingCatalogItem)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Ya, Hapus Produk
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Category Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3 px-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 text-red-600">
                <CircleAlert className="w-3.5 h-3.5 text-red-500" />
                Hapus Kategori
              </h3>
              <button
                onClick={() => setDeletingCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 text-xs space-y-2">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus kategori <span className="font-bold text-slate-800">"{deletingCategory}"</span>?
              </p>
              <p className="text-[10px] text-slate-400 leading-normal">
                Catatan: Barang yang menggunakan kategori ini akan tetap aman, namun kategorinya akan dikosongkan di spreadsheet.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-2.5 px-4 flex justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingCategory) {
                    handleConfirmDeleteCategory(deletingCategory);
                  }
                  setDeletingCategory(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Hapus
              </button>
            </div>

          </div>
        </div>
      )}

      {deletingSettingsItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3 px-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 text-red-600">
                <CircleAlert className="w-3.5 h-3.5 text-red-500" />
                Hapus Atribut
              </h3>
              <button
                onClick={() => setDeletingSettingsItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 text-xs space-y-2">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus atribut <span className="lowercase">{settingsTab}</span> <span className="font-bold text-slate-800">"{deletingSettingsItem.value}"</span>?
              </p>
              <p className="text-[10px] text-slate-400 leading-normal">
                Catatan: Atribut ini akan dihapus permanen dari database Google Sheets Anda. Barang yang menggunakan atribut ini tidak akan terhapus.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-2.5 px-4 flex justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingSettingsItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  executeDeleteSettingsItem(deletingSettingsItem.index);
                  setDeletingSettingsItem(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
              >
                Hapus
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PreOrder Edit/Add Modal */}
      {isPoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                {editingPo ? 'Ubah Pesanan PreOrder' : 'Tambah PreOrder Baru'}
              </h3>
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handlePoSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {poError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{poError}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Nama Pengepul */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nama Pelanggan:</label>
                  <input
                    type="text"
                    value={formPoNamaPengepul}
                    onChange={(e) => setFormPoNamaPengepul(e.target.value)}
                    required
                    placeholder="Contoh: Pak Ketut Pengepul"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                {/* Kontak Pengepul */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kontak/No.HP:</label>
                  <input
                    type="text"
                    value={formPoKontak}
                    onChange={(e) => setFormPoKontak(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                {/* Tipe PreOrder */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tipe PreOrder:</label>
                  <select
                    value={formPoTipeOrder}
                    onChange={(e) => setFormPoTipeOrder(e.target.value as any)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="Standard">Standard / Retail</option>
                    <option value="Reseller">Reseller</option>
                  </select>
                </div>
              </div>

              {/* Detail Pesanan */}
              <div className="space-y-3">
                
                {/* Ambil Produk dari Katalog Widget */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Pilih Produk dari Katalog</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Catalog Dropdown */}
                    <div className="sm:col-span-2">
                      <select
                        value={selectedPoCatCode}
                        onChange={(e) => {
                          setSelectedPoCatCode(e.target.value);
                          setSelectedPoSize('1');
                        }}
                        className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700"
                      >
                        <option value="">-- Cari & Pilih Produk Katalog --</option>
                        {catalogItems.map(c => (
                          <option key={c.kode} value={c.kode}>
                            {c.nama} ({c.kode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <div className="flex rounded-lg border border-slate-200 bg-white">
                        <span className="px-2 py-1.5 text-[10px] bg-slate-50 text-slate-400 font-bold border-r border-slate-200 rounded-l-lg">Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={formPoCatQty}
                          onChange={(e) => setFormPoCatQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full text-xs py-1.5 px-2 text-slate-800 focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pilihan Ukuran & Harga Variant */}
                  {selectedPoCatCode && (
                    <div className="border-t border-slate-200/60 pt-2 mt-1.5 space-y-1.5 animate-in fade-in duration-150">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Pilih Ukuran / Varian Produk:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(() => {
                          const matchedCat = catalogItems.find(c => c.kode === selectedPoCatCode);
                          if (!matchedCat) return null;
                          const sizes = [
                            { slot: '1' as const, size: matchedCat.ukuran, h: matchedCat.harga, hr: matchedCat.hargaReseller },
                            { slot: '2' as const, size: matchedCat.ukuran2, h: matchedCat.harga2, hr: matchedCat.hargaReseller2 },
                            { slot: '3' as const, size: matchedCat.ukuran3, h: matchedCat.harga3, hr: matchedCat.hargaReseller3 }
                          ].filter(s => s.slot === '1' || s.size);

                          return sizes.map((item) => {
                            const isSelected = selectedPoSize === item.slot;
                            const priceToDisplay = formPoTipeOrder === 'Reseller' && item.hr && item.hr > 0 ? item.hr : item.h;
                            return (
                              <button
                                key={item.slot}
                                type="button"
                                onClick={() => setSelectedPoSize(item.slot)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-100' 
                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="text-[9px] font-bold uppercase text-slate-400">Ukuran {item.size || 'Standard'}</div>
                                <div className="text-xs font-mono font-bold mt-0.5">{formatRupiah(priceToDisplay || 0)}</div>
                                {formPoTipeOrder === 'Reseller' && item.hr && item.hr > 0 && (
                                  <div className="text-[8px] text-emerald-600 font-bold">(Reseller)</div>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Custom Name addition sub-form for the selected item */}
                  {selectedPoCatCode && (
                    <div className="border-t border-slate-200/60 pt-2.5 mt-1 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Custom Isi Nama Barang</span>
                          <span className="text-[9px] text-blue-600 font-semibold block">Tambahan biaya Rp 5.000 per huruf (spasi tidak dihitung)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemIsiNama}
                            onChange={(e) => {
                              setItemIsiNama(e.target.checked);
                              if (!e.target.checked) {
                                  setItemNamaCustom('');
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {itemIsiNama && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center animate-in duration-150">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={itemNamaCustom}
                              onChange={(e) => setItemNamaCustom(e.target.value)}
                              placeholder="Ketik nama untuk diukir..."
                              className="w-full text-xs py-1 px-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div className="text-[10px] text-slate-600 font-semibold bg-blue-50/50 border border-blue-100 p-1.5 rounded-lg flex items-center justify-center font-mono">
                            {itemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length} huruf = {formatRupiah(itemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length * 5000)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add to detail button */}
                  <button
                    type="button"
                    disabled={!selectedPoCatCode}
                    onClick={() => {
                      const matchedCat = catalogItems.find(c => c.kode === selectedPoCatCode);
                      if (!matchedCat) return;
                      
                      // Determine price and size label based on selected size variation slot
                      let basePrice = matchedCat.harga;
                      let baseResellerPrice = matchedCat.hargaReseller || 0;
                      let selectedSizeLabel = matchedCat.ukuran || '';

                      if (selectedPoSize === '2') {
                        basePrice = matchedCat.harga2 || matchedCat.harga;
                        baseResellerPrice = matchedCat.hargaReseller2 || matchedCat.hargaReseller || 0;
                        selectedSizeLabel = matchedCat.ukuran2 || '';
                      } else if (selectedPoSize === '3') {
                        basePrice = matchedCat.harga3 || matchedCat.harga;
                        baseResellerPrice = matchedCat.hargaReseller3 || matchedCat.hargaReseller || 0;
                        selectedSizeLabel = matchedCat.ukuran3 || '';
                      }

                      const priceToUse = (formPoTipeOrder === 'Reseller' && baseResellerPrice > 0)
                        ? baseResellerPrice
                        : basePrice;
                      
                      const letterCount = itemIsiNama ? itemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length : 0;
                      const surcharge = letterCount * 5000;
                      const subtotal = (priceToUse + surcharge) * formPoCatQty;
                      
                      setFormPoDetail(prev => {
                        const spacing = prev ? '\n' : '';
                        const sizePart = selectedSizeLabel ? ` [Ukuran: ${selectedSizeLabel}]` : '';
                        const nameString = itemIsiNama ? ` [Isi Nama: "${itemNamaCustom}" (+${formatRupiah(surcharge)}/item)]` : '';
                        return `${prev}${spacing}- ${matchedCat.nama}${sizePart} (${matchedCat.kode}) x${formPoCatQty} @ ${formatRupiah(priceToUse)}${nameString}`;
                      });
                      
                      setFormPoBiaya(prev => (prev || 0) + subtotal);

                      // Automatic aggregation to preorder general fields for Sheets compatibility
                      if (itemIsiNama && itemNamaCustom.trim()) {
                        setFormPoIsiNama(true);
                        setFormPoNamaCustom(prev => {
                          const cleaned = itemNamaCustom.trim();
                          if (!prev) return cleaned;
                          const existing = prev.split(', ').map(x => x.trim());
                          if (existing.includes(cleaned)) return prev;
                          return `${prev}, ${cleaned}`;
                        });
                      }
                      
                      // Reset selector fields
                      setSelectedPoCatCode('');
                      setSelectedPoSize('1');
                      setFormPoCatQty(1);
                      setItemIsiNama(false);
                      setItemNamaCustom('');
                    }}
                    className="w-full py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100/70 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Tambahkan Barang & Akumulasi Harga</span>
                  </button>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rincian / Detail Pesanan:</label>
                  <textarea
                    value={formPoDetail}
                    onChange={(e) => setFormPoDetail(e.target.value)}
                    required
                    rows={4}
                    placeholder="Contoh:&#10;- Bokor Ukuran Sedang (20 unit)&#10;- Dulang Kayu Jati (5 unit)"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal Target Selesai / Pengambilan */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Target Selesai / Diambil:</label>
                  <input
                    type="date"
                    value={formPoTargetTanggal}
                    onChange={(e) => setFormPoTargetTanggal(e.target.value)}
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nilai Barang */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Nilai Pesanan (Rp):</label>
                  <input
                    type="number"
                    value={formPoBiaya || ''}
                    onChange={(e) => setFormPoBiaya(Number(e.target.value) || 0)}
                    placeholder="Contoh: 1500000"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50 font-mono"
                  />
                </div>

                {/* Nominal DP */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nominal DP Dibayar (Rp):</label>
                  <input
                    type="number"
                    value={formPoNominalDp || ''}
                    onChange={(e) => setFormPoNominalDp(Number(e.target.value) || 0)}
                    placeholder="Contoh: 500000"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {/* Rincian Kalkulasi Biaya Akhir */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Ringkasan Rincian Biaya</span>
                <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Total Nilai Pesanan (Termasuk Custom Nama):</span>
                    <span className="font-mono">{formatRupiah(formPoBiaya)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>DP Dibayar:</span>
                    <span className="font-mono">-{formatRupiah(formPoNominalDp)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-extrabold text-rose-600 text-sm">
                    <span>Sisa Tagihan / Sisa Bayar:</span>
                    <span className="font-mono">{formatRupiah(formPoSisaPembayaran)}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status Pesanan:</label>
                <select
                  value={formPoStatus}
                  onChange={(e) => setFormPoStatus(e.target.value as any)}
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="antrean">Mulai</option>
                  <option value="proses">Sedang Proses Pengerjaan</option>
                  <option value="siap">Siap Diambil / Produk Sudah Selesai</option>
                  <option value="selesai">Selesai & Produk Sudah Diambil</option>
                  <option value="dibatalkan">Batalkan</option>
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={savingPo}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPo ? (
                  <>
                    <RefreshCw className="animate-spin w-3.5 h-3.5" />
                    <span>Menyimpan ke Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Simpan Pesanan PreOrder</span>
                  </>
                )}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* CATALOG ITEM ADD/EDIT MODAL */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                {editingCatalogItem ? 'Ubah Produk Katalog' : 'Tambah Produk Katalog Baru'}
              </h3>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleCatalogSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {catalogError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{catalogError}</span>
                </div>
              )}

              {duplicateCatalogItem && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-lg space-y-1 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <CircleAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Peringatan: Produk Sudah Ada!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Kombinasi Kategori, Jenis, Motif, dan Warna yang Anda pilih sudah terdaftar di Katalog:
                  </p>
                  <p className="text-[11px] font-mono font-bold bg-amber-100/50 p-1.5 rounded-md border border-amber-150 mt-1">
                    [{duplicateCatalogItem.kode}] {duplicateCatalogItem.nama}
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Silakan ubah kombinasi atribut agar tidak terjadi duplikasi produk di katalog.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {/* Kode */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kode Produk:</label>
                  <input
                    type="text"
                    value={formCatKode}
                    onChange={(e) => setFormCatKode(e.target.value)}
                    onBlur={(e) => {
                      const formatted = formatProductCode(e.target.value);
                      if (formatted) {
                        setFormCatKode(formatted);
                      }
                    }}
                    required
                    placeholder="e.g. NI-001"
                    className="w-full text-xs font-mono font-bold py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-800"
                  />
                </div>

                {/* Nama */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Nama Produk:</label>
                    <label className="flex items-center text-[10px] text-blue-600 font-bold cursor-pointer select-none">
                      <input
                        id="isAutoCatNamaCheckbox"
                        type="checkbox"
                        checked={isAutoCatNama}
                        onChange={(e) => setIsAutoCatNama(e.target.checked)}
                        className="mr-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      Format Otomatis
                    </label>
                  </div>
                  <input
                    id="formCatNamaInput"
                    type="text"
                    value={formCatNama}
                    onChange={(e) => setFormCatNama(e.target.value)}
                    required
                    disabled={isAutoCatNama}
                    placeholder={isAutoCatNama ? "Nama akan dibuat otomatis..." : "e.g. Bokor Ukir Emas"}
                    className={`w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isAutoCatNama ? "bg-slate-100 text-slate-500 font-semibold cursor-not-allowed" : "bg-slate-50 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              {/* Kategori */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kategori:</label>
                <div className="flex gap-2">
                  <select
                    value={formCatKategori}
                    onChange={(e) => setFormCatKategori(e.target.value)}
                    className="flex-1 text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input 
                    type="text"
                    value={formCatKategori}
                    onChange={(e) => setFormCatKategori(e.target.value)}
                    placeholder="Atau ketik kategori baru"
                    className="flex-1 text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Custom Attributes (Jenis, Motif, Warna) */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-250/50 space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Atribut Detail (Opsi):</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Jenis:</label>
                    <div className="flex gap-1.5">
                      <select
                        value={formCatJenis.toLowerCase().startsWith('tumpuk') ? 'Tumpuk' : formCatJenis}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.toLowerCase() === 'tumpuk') {
                            setFormCatJenis('Tumpuk 1');
                          } else {
                            setFormCatJenis(val);
                          }
                        }}
                        className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700"
                      >
                        <option value="">-- Pilih Jenis --</option>
                        {jenisList.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                      
                      {formCatJenis.toLowerCase().startsWith('tumpuk') && (
                        <select
                          value={formCatJenis.split(' ')[1] || '1'}
                          onChange={(e) => {
                            setFormCatJenis(`Tumpuk ${e.target.value}`);
                          }}
                          className="w-20 text-xs py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Motif:</label>
                    <select
                      value={formCatMotif}
                      onChange={(e) => setFormCatMotif(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700"
                    >
                      <option value="">-- Pilih Motif --</option>
                      {motifList.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Warna:</label>
                    <select
                      value={formCatWarna}
                      onChange={(e) => setFormCatWarna(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700"
                    >
                      <option value="">-- Pilih Warna --</option>
                      {warnaList.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Variasi Ukuran & Harga Section */}
              <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  Konfigurasi Ukuran & Harga (Minimal 1, Maksimal 3)
                </span>
                
                {/* Variasi 1 (Wajib) */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Variasi 1 (Wajib)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Ukuran:</label>
                      <select
                        value={formCatUkuran}
                        onChange={(e) => setFormCatUkuran(e.target.value)}
                        required
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-semibold text-slate-700"
                      >
                        <option value="">-- Pilih --</option>
                        {ukuranList.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Standar:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHarga || ''}
                        onChange={(e) => setFormCatHarga(Number(e.target.value) || 0)}
                        required
                        placeholder="e.g. 50000"
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Reseller:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHargaReseller || ''}
                        onChange={(e) => setFormCatHargaReseller(Number(e.target.value) || 0)}
                        placeholder="e.g. 40000"
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Variasi 2 (Opsional) */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Variasi 2 (Opsional)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Ukuran 2:</label>
                      <select
                        value={formCatUkuran2}
                        onChange={(e) => setFormCatUkuran2(e.target.value)}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-semibold text-slate-700"
                      >
                        <option value="">-- Kosong --</option>
                        {ukuranList.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Standar 2:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHarga2 || ''}
                        disabled={!formCatUkuran2}
                        onChange={(e) => setFormCatHarga2(Number(e.target.value) || 0)}
                        placeholder={formCatUkuran2 ? "e.g. 75000" : "Pilih ukuran dulu"}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Reseller 2:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHargaReseller2 || ''}
                        disabled={!formCatUkuran2}
                        onChange={(e) => setFormCatHargaReseller2(Number(e.target.value) || 0)}
                        placeholder={formCatUkuran2 ? "e.g. 60000" : "Pilih ukuran dulu"}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Variasi 3 (Opsional) */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Variasi 3 (Opsional)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Ukuran 3:</label>
                      <select
                        value={formCatUkuran3}
                        onChange={(e) => setFormCatUkuran3(e.target.value)}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-semibold text-slate-700"
                      >
                        <option value="">-- Kosong --</option>
                        {ukuranList.map(item => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Standar 3:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHarga3 || ''}
                        disabled={!formCatUkuran3}
                        onChange={(e) => setFormCatHarga3(Number(e.target.value) || 0)}
                        placeholder={formCatUkuran3 ? "e.g. 100000" : "Pilih ukuran dulu"}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Harga Reseller 3:</label>
                      <input
                        type="number"
                        min="0"
                        value={formCatHargaReseller3 || ''}
                        disabled={!formCatUkuran3}
                        onChange={(e) => setFormCatHargaReseller3(Number(e.target.value) || 0)}
                        placeholder={formCatUkuran3 ? "e.g. 80000" : "Pilih ukuran dulu"}
                        className="w-full text-[11px] py-1 px-1.5 border border-slate-200 rounded bg-slate-50 font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Upload Area */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">Foto Produk:</label>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleCatalogDrag}
                  onDragOver={handleCatalogDrag}
                  onDragLeave={handleCatalogDrag}
                  onDrop={handleCatalogDrop}
                  onClick={() => {
                    const el = document.getElementById('catalog-file-input');
                    if (el) el.click();
                  }}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 select-none ${
                    catDragActive 
                      ? 'border-blue-500 bg-blue-50/50' 
                      : 'border-slate-200 hover:border-blue-500 hover:bg-slate-50/30'
                  }`}
                >
                  <input
                    type="file"
                    id="catalog-file-input"
                    onChange={handleCatalogFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {uploadingCatalogPhoto ? (
                    <div className="flex flex-col items-center space-y-1 py-4">
                      <RefreshCw className="animate-spin text-blue-600 h-6 w-6" />
                      <span className="text-[11px] font-bold text-slate-600 animate-pulse">Mengunggah ke Google Drive...</span>
                    </div>
                  ) : formCatFoto ? (
                    <div className="flex items-center space-x-3 text-left w-full">
                      <img 
                        src={getImageUrl(formCatFoto)} 
                        alt="Uploaded preview" 
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded object-cover border border-slate-200 shrink-0" 
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-blue-700 flex items-center space-x-1">
                          <CheckCircle size={12} className="text-blue-600" />
                          <span>Berhasil Tersimpan di Drive</span>
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{formCatFoto}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormCatFoto('');
                          }}
                          className="text-[10px] font-bold text-red-600 hover:underline mt-1 bg-transparent border-none cursor-pointer"
                        >
                          Hapus Gambar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Upload className="mx-auto text-slate-400 h-6 w-6 mb-1" />
                      <p className="text-[11px] font-semibold text-slate-700">Tarik gambar ke sini, atau <span className="text-blue-600">pilih file</span></p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Mendukung JPEG, PNG, WEBP (maks. 5MB)</p>
                    </div>
                  )}
                </div>

                {/* Direct photo URL insertion alternative */}
                <div className="pt-2">
                  <div className="flex items-center space-x-2">
                    <span className="h-px bg-slate-100 flex-1" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Atau masukkan Link URL langsung</span>
                    <span className="h-px bg-slate-100 flex-1" />
                  </div>
                  <input
                    type="url"
                    value={formCatFoto}
                    onChange={(e) => setFormCatFoto(e.target.value)}
                    placeholder="e.g. https://domain.com/foto_produk.png"
                    className="w-full text-[11px] py-1.5 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 mt-2"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCatalog || uploadingCatalogPhoto}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingCatalog ? 'Menyimpan...' : 'Simpan ke Katalog'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Consignment (Titip Jual) Create Modal */}
      {isTjModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                Buat Surat Jalan & Titip Jual Baru
              </h3>
              <button
                type="button"
                onClick={handleCancelTjModal}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleTjSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {tjError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{tjError}</span>
                </div>
              )}

              {/* Partner Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nama Mitra / Penjual:</label>
                  <input
                    type="text"
                    value={formTjNamaMitra}
                    onChange={(e) => setFormTjNamaMitra(e.target.value)}
                    required
                    placeholder="Contoh: Bli Made Titip"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kontak / No. HP:</label>
                  <input
                    type="text"
                    value={formTjKontakMitra}
                    onChange={(e) => setFormTjKontakMitra(e.target.value)}
                    placeholder="Contoh: 081234567xxx (Opsional)"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Catatan Tambahan:</label>
                <textarea
                  value={formTjCatatan}
                  onChange={(e) => setFormTjCatatan(e.target.value)}
                  placeholder="Keterangan acara, pasar malam, pameran, lokasi titipan, dll. (Opsional)"
                  rows={2}
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              {/* Product selection from Inventaris */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Pilih Produk dari Inventaris</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Product */}
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Barang Inventaris:</label>
                    <select
                      value={selectedTjCatCode}
                      onChange={(e) => {
                        setSelectedTjCatCode(e.target.value);
                        setFormTjCatUkuran('');
                      }}
                      className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold h-9"
                    >
                      <option value="">-- Cari & Pilih Barang Inventaris --</option>
                      {syncedItems.map(item => {
                        const { baseName } = parseInventoryItemName(item.nama);
                        return (
                          <option key={item.kode} value={item.kode}>
                            [{item.kode}] {baseName} (Stok: {item.jumlah})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Select Size */}
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Ukuran:</label>
                    {selectedTjCatCode ? (() => {
                      const selectedItem = syncedItems.find(i => i.kode === selectedTjCatCode);
                      if (!selectedItem) return <div className="text-xs text-slate-400 h-9 flex items-center">Barang tidak ditemukan</div>;
                      
                      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === selectedTjCatCode.toUpperCase());
                      const { breakdown } = parseInventoryItemName(selectedItem.nama);
                      const sizeOptions = Object.keys(breakdown);
                      
                      const displaySizes = sizeOptions.length > 0 
                        ? sizeOptions 
                        : (matchedCat ? [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[] : ['Standard']);

                      return (
                        <select
                          value={formTjCatUkuran}
                          onChange={(e) => setFormTjCatUkuran(e.target.value)}
                          className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold h-9"
                        >
                          <option value="">-- Pilih Ukuran --</option>
                          {displaySizes.map(size => {
                            const stockQty = breakdown[size] !== undefined ? breakdown[size] : selectedItem.jumlah;
                            return (
                              <option key={size} value={size}>
                                {size} (Stok: {stockQty})
                              </option>
                            );
                          })}
                        </select>
                      );
                    })() : (
                      <select disabled className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-400 font-semibold h-9 cursor-not-allowed">
                        <option value="">-- Pilih Barang Terlebih Dahulu --</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Qty field */}
                  <div className="sm:col-span-3">
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Jumlah Ambil:</label>
                    <input
                      type="number"
                      min="1"
                      disabled={!formTjCatUkuran}
                      value={formTjCatQty}
                      onChange={(e) => setFormTjCatQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono font-bold h-9 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
 
                {/* Stock info widget */}
                {selectedTjCatCode && formTjCatUkuran && (() => {
                  const matchedCat = catalogItems.find(c => c.kode === selectedTjCatCode);
                  const invItem = syncedItems.find(i => i.kode === selectedTjCatCode);
                  if (!invItem) return null;

                  const { breakdown } = parseInventoryItemName(invItem.nama);
                  const invStock = Object.keys(breakdown).length > 0 
                    ? (breakdown[formTjCatUkuran] || 0)
                    : invItem.jumlah;

                  const priceToUse = matchedCat 
                    ? (getPricesForSize(matchedCat, formTjCatUkuran, 'Reseller') || matchedCat.hargaReseller || invItem.hargaSatuan || 0)
                    : (invItem.hargaSatuan || 0);

                  const letterCount = tjItemIsiNama ? tjItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length : 0;
                  const surcharge = letterCount * 5000;
 
                  return (
                    <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-lg flex items-center justify-between text-xs animate-in fade-in duration-150">
                      <div>
                        <span className="text-slate-500 font-semibold">Stok Ukuran {formTjCatUkuran}: </span>
                        <span className={`font-extrabold ${invStock <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {invStock} Unit
                        </span>
                        {invStock < formTjCatQty && (
                          <span className="text-red-600 font-bold ml-2">⚠️ Melebihi stok!</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Subtotal (Reseller): </span>
                        <span className="font-extrabold text-blue-600 font-mono">{formatRupiah((priceToUse + surcharge) * formTjCatQty)}</span>
                      </div>
                    </div>
                  );
                })()}
 
                {/* Custom Name addition sub-form for the selected consignment item */}
                {selectedTjCatCode && formTjCatUkuran && (
                  <div className="border-t border-slate-200 pt-2.5 mt-1 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Custom Isi Nama Barang</span>
                        <span className="text-[9px] text-blue-600 font-semibold block">Tambahan biaya Rp 5.000 per huruf (spasi tidak dihitung)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tjItemIsiNama}
                          onChange={(e) => {
                            setTjItemIsiNama(e.target.checked);
                            if (!e.target.checked) {
                              setTjItemNamaCustom('');
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
 
                    {tjItemIsiNama && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center animate-in duration-150">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={tjItemNamaCustom}
                            onChange={(e) => setTjItemNamaCustom(e.target.value)}
                            placeholder="Ketik nama untuk diukir..."
                            className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div className="text-[10px] text-slate-600 font-semibold bg-blue-50/50 border border-blue-100 p-1.5 rounded-lg flex items-center justify-center font-mono">
                          {tjItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length} huruf = {formatRupiah(tjItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length * 5000)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isAlreadyInTjList && (
                  <div className={`p-2.5 rounded-lg border text-xs leading-relaxed animate-in fade-in duration-150 ${
                    isTjBypassed 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isTjBypassed ? (
                      <span className="font-semibold flex items-start gap-1.5">
                        <span className="shrink-0">ℹ️</span>
                        <span>
                          Produk & ukuran ini sudah ada di daftar titipan, tetapi diperbolehkan karena Anda menggunakan nama custom: <strong className="font-mono bg-green-100 px-1 py-0.5 rounded text-green-950">"{tjItemNamaCustom.trim()}"</strong>.
                        </span>
                      </span>
                    ) : (
                      <span className="font-semibold flex items-start gap-1.5">
                        <span className="shrink-0">⚠️</span>
                        <span>
                          Produk dan ukuran ini sudah masuk ke daftar titipan! Tombol dinonaktifkan sementara sampai Anda mengubah produk/ukuran, atau mengaktifkan <strong>"Custom Isi Nama Barang"</strong> dan mengisinya.
                        </span>
                      </span>
                    )}
                  </div>
                )}
 
                <button
                  type="button"
                  disabled={!selectedTjCatCode || !formTjCatUkuran || (isAlreadyInTjList && !isTjBypassed)}
                  onClick={() => {
                    const matchedInv = syncedItems.find(i => i.kode === selectedTjCatCode);
                    if (!matchedInv) return;
 
                    const { baseName, breakdown } = parseInventoryItemName(matchedInv.nama);
                    const hasBreakdown = Object.keys(breakdown).length > 0;
                    
                    const invStock = hasBreakdown && formTjCatUkuran
                      ? (breakdown[formTjCatUkuran] || 0)
                      : matchedInv.jumlah;

                    if (invStock < formTjCatQty) {
                      setTjError(`Stok tidak cukup. Hanya ada ${invStock} unit untuk "${matchedInv.nama}"${formTjCatUkuran ? ` (Ukuran: ${formTjCatUkuran})` : ''} di inventaris.`);
                      return;
                    }

                    if (formTjCatQty < 1) {
                      setTjError(`Jumlah barang yang dimasukkan minimal harus 1.`);
                      return;
                    }
 
                    const cleanNamaCustom = tjItemIsiNama ? tjItemNamaCustom.trim() : '';
 
                    const hasSameCodeAndSize = formTjItems.some(i => i.kodeBarang.toUpperCase() === selectedTjCatCode.toUpperCase() && i.ukuran === formTjCatUkuran);
                    if (hasSameCodeAndSize) {
                      if (!cleanNamaCustom) {
                        setTjError(`Barang "${baseName}" [Ukuran: ${formTjCatUkuran}] sudah ada di daftar titipan. Untuk menambahkan barang yang sama, Anda wajib menggunakan opsi "Custom Isi Nama Barang".`);
                        return;
                      }
                      const duplicateCustomName = formTjItems.some(i => 
                        i.kodeBarang.toUpperCase() === selectedTjCatCode.toUpperCase() && 
                        i.ukuran === formTjCatUkuran && 
                        (i.namaCustom || '').trim().toLowerCase() === cleanNamaCustom.toLowerCase()
                      );
                      if (duplicateCustomName) {
                        setTjError(`Barang "${baseName}" [Ukuran: ${formTjCatUkuran}] dengan nama custom "${cleanNamaCustom}" sudah ada di daftar titipan.`);
                        return;
                      }
                    }
 
                    const matchedCat = catalogItems.find(c => c.kode === selectedTjCatCode);
                    const letterCount = tjItemIsiNama ? tjItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length : 0;
                    const surcharge = letterCount * 5000;
                    const resellerPrice = matchedCat 
                      ? (getPricesForSize(matchedCat, formTjCatUkuran, 'Reseller') || matchedCat.hargaReseller || matchedInv.hargaSatuan)
                      : matchedInv.hargaSatuan;

                    const newItemName = formTjCatUkuran 
                      ? `${baseName} [Ukuran: ${formTjCatUkuran}]` 
                      : baseName;

                    const newItem: ConsignmentItem = {
                      kodeBarang: matchedInv.kode,
                      namaBarang: newItemName,
                      jumlahAmbil: formTjCatQty,
                      jumlahLaku: 0,
                      jumlahKembali: 0,
                      hargaSatuan: resellerPrice + surcharge,
                      namaCustom: tjItemIsiNama && cleanNamaCustom ? cleanNamaCustom : undefined,
                      ukuran: formTjCatUkuran || undefined
                    };
 
                    const updatedItems = deductItemStock(items, matchedInv.kode, formTjCatQty, formTjCatUkuran);
                    setItems(updatedItems);
 
                    setFormTjItems(prev => [...prev, newItem]);
                    setSelectedTjCatCode('');
                    setFormTjCatUkuran('');
                    setFormTjCatQty(1);
                    setTjItemIsiNama(false);
                    setTjItemNamaCustom('');
                    setTjError(null);
                  }}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-blue-200"
                >
                  <Plus size={14} />
                  <span>Tambahkan ke Daftar Titipan</span>
                </button>
              </div>

              {/* Added items table */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Daftar Barang yang Diambil ({formTjItems.length})</span>
                
                {formTjItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Belum ada barang yang ditambahkan. Silakan pilih produk di atas.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                          <th className="py-2 px-4">Nama Produk</th>
                          <th className="py-2 px-4 text-center">Jumlah</th>
                          <th className="py-2 px-4 text-right">Harga Reseller</th>
                          <th className="py-2 px-4 text-right">Subtotal</th>
                          <th className="py-2 px-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {formTjItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-4">
                              <span className="font-bold text-slate-700">{item.namaBarang}</span>
                              <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
                                <span className="text-[9px] font-mono text-slate-400">{item.kodeBarang}</span>
                                {item.namaCustom && (
                                  <span className="text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.2">
                                    Custom Nama: "{item.namaCustom}"
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-center font-mono font-bold text-slate-800">
                              {item.jumlahAmbil} Pcs
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {formatRupiah(item.hargaSatuan)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-700">
                              {formatRupiah(item.jumlahAmbil * item.hargaSatuan)}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const itemToRestore = formTjItems[idx];
                                  if (itemToRestore) {
                                    const updatedItems = restoreItemStock(items, itemToRestore.kodeBarang, itemToRestore.jumlahAmbil, itemToRestore.ukuran);
                                    setItems(updatedItems);
                                  }
                                  setFormTjItems(prev => prev.filter((_, iIdx) => iIdx !== idx));
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Hapus Barang"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {/* Accumulated Total Summary banner */}
                    <div className="bg-slate-50/70 border-t border-slate-100 p-3.5 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Estimasi Nilai Titip:</span>
                      <span className="text-sm font-extrabold text-blue-600 font-mono">
                        {formatRupiah(formTjItems.reduce((sum, i) => sum + (i.jumlahAmbil * i.hargaSatuan), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCancelTjModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTj || formTjItems.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingTj ? 'Menyimpan...' : 'Simpan & Cetak Invoice'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Consignment (Titip Jual) Edit Modal */}
      {isTjEditModalOpen && editingTj && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-500" />
                Edit Transaksi Titip Jual ({editingTj.id})
              </h3>
              <button
                type="button"
                onClick={handleCancelTjEditModal}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleTjEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {tjEditError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{tjEditError}</span>
                </div>
              )}

              {/* Partner Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nama Mitra / Penjual:</label>
                  <input
                    type="text"
                    value={formTjEditNamaMitra}
                    onChange={(e) => setFormTjEditNamaMitra(e.target.value)}
                    required
                    placeholder="Contoh: Bli Made Titip"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kontak / No. HP:</label>
                  <input
                    type="text"
                    value={formTjEditKontakMitra}
                    onChange={(e) => setFormTjEditKontakMitra(e.target.value)}
                    placeholder="Contoh: 081234567xxx (Opsional)"
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Catatan Tambahan:</label>
                <textarea
                  value={formTjEditCatatan}
                  onChange={(e) => setFormTjEditCatatan(e.target.value)}
                  placeholder="Keterangan acara, pasar malam, pameran, lokasi titipan, dll. (Opsional)"
                  rows={2}
                  className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              {/* Product selection from Inventaris */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Pilih Produk dari Inventaris</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Product */}
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Barang Inventaris:</label>
                    <select
                      value={selectedTjEditCatCode}
                      onChange={(e) => {
                        setSelectedTjEditCatCode(e.target.value);
                        setFormTjEditCatUkuran('');
                      }}
                      className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold h-9"
                    >
                      <option value="">-- Cari & Pilih Barang Inventaris --</option>
                      {syncedItems.map(item => {
                        const { baseName } = parseInventoryItemName(item.nama);
                        return (
                          <option key={item.kode} value={item.kode}>
                            [{item.kode}] {baseName} (Stok: {item.jumlah})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Select Size */}
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Ukuran:</label>
                    {selectedTjEditCatCode ? (() => {
                      const selectedItem = syncedItems.find(i => i.kode === selectedTjEditCatCode);
                      if (!selectedItem) return <div className="text-xs text-slate-400 h-9 flex items-center">Barang tidak ditemukan</div>;
                      
                      const matchedCat = catalogItems.find(c => c.kode.toUpperCase() === selectedTjEditCatCode.toUpperCase());
                      const { breakdown } = parseInventoryItemName(selectedItem.nama);
                      const sizeOptions = Object.keys(breakdown);
                      
                      const displaySizes = sizeOptions.length > 0 
                        ? sizeOptions 
                        : (matchedCat ? [matchedCat.ukuran, matchedCat.ukuran2, matchedCat.ukuran3].filter(Boolean) as string[] : ['Standard']);

                      return (
                        <select
                          value={formTjEditCatUkuran}
                          onChange={(e) => setFormTjEditCatUkuran(e.target.value)}
                          className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold h-9"
                        >
                          <option value="">-- Pilih Ukuran --</option>
                          {displaySizes.map(size => {
                            const invStockSize = breakdown[size] !== undefined ? breakdown[size] : selectedItem.jumlah;
                            const currentlyAllocated = editingTj?.items.find(i => i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && i.ukuran === size)?.jumlahAmbil || 0;
                            const totalAvailableStock = invStockSize + currentlyAllocated;

                            return (
                              <option key={size} value={size}>
                                {size} (Stok: {totalAvailableStock})
                              </option>
                            );
                          })}
                        </select>
                      );
                    })() : (
                      <select disabled className="w-full text-xs py-2 px-2.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-400 font-semibold h-9 cursor-not-allowed">
                        <option value="">-- Pilih Barang Terlebih Dahulu --</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Qty field */}
                  <div className="sm:col-span-3">
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Jumlah:</label>
                    <input
                      type="number"
                      min="1"
                      disabled={!formTjEditCatUkuran}
                      value={formTjEditCatQty}
                      onChange={(e) => setFormTjEditCatQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono font-bold h-9 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
 
                {/* Selected Item Preview (Stock & Subtotal) */}
                {selectedTjEditCatCode && formTjEditCatUkuran && (() => {
                  const matchedCat = catalogItems.find(c => c.kode === selectedTjEditCatCode);
                  const invItem = syncedItems.find(i => i.kode === selectedTjEditCatCode);
                  if (!invItem) return null;

                  const { breakdown } = parseInventoryItemName(invItem.nama);
                  const invStockSize = Object.keys(breakdown).length > 0 
                    ? (breakdown[formTjEditCatUkuran] || 0)
                    : invItem.jumlah;

                  const currentlyAllocated = editingTj?.items.find(i => i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && i.ukuran === formTjEditCatUkuran)?.jumlahAmbil || 0;
                  const totalAvailableStock = invStockSize + currentlyAllocated;

                  const priceToUse = matchedCat 
                    ? (getPricesForSize(matchedCat, formTjEditCatUkuran, 'Reseller') || matchedCat.hargaReseller || invItem.hargaSatuan || 0)
                    : (invItem.hargaSatuan || 0);

                  const letterCount = tjEditItemIsiNama ? tjEditItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length : 0;
                  const surcharge = letterCount * 5000;
 
                  return (
                    <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-lg flex items-center justify-between text-xs animate-in fade-in duration-150">
                      <div>
                        <span className="text-slate-500 font-semibold">Stok Ukuran {formTjEditCatUkuran}: </span>
                        <span className={`font-extrabold ${totalAvailableStock <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {totalAvailableStock} Unit
                        </span>
                        {totalAvailableStock < formTjEditCatQty && (
                          <span className="text-red-600 font-bold ml-2">⚠️ Melebihi stok!</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Subtotal (Reseller): </span>
                        <span className="font-extrabold text-blue-600 font-mono">{formatRupiah((priceToUse + surcharge) * formTjEditCatQty)}</span>
                      </div>
                    </div>
                  );
                })()}
 
                {/* Custom Name addition sub-form for the selected consignment item */}
                {selectedTjEditCatCode && formTjEditCatUkuran && (
                  <div className="border-t border-slate-200 pt-2.5 mt-1 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Custom Isi Nama Barang</span>
                        <span className="text-[9px] text-blue-600 font-semibold block">Tambahan biaya Rp 5.000 per huruf (spasi tidak dihitung)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tjEditItemIsiNama}
                          onChange={(e) => {
                            setTjEditItemIsiNama(e.target.checked);
                            if (!e.target.checked) {
                              setTjEditItemNamaCustom('');
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
 
                    {tjEditItemIsiNama && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center animate-in duration-150">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={tjEditItemNamaCustom}
                            onChange={(e) => setTjEditItemNamaCustom(e.target.value)}
                            placeholder="Ketik nama untuk diukir..."
                            className="w-full text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div className="text-[10px] text-slate-600 font-semibold bg-blue-50/50 border border-blue-100 p-1.5 rounded-lg flex items-center justify-center font-mono">
                          {tjEditItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length} huruf = {formatRupiah(tjEditItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length * 5000)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isAlreadyInTjEditList && (
                  <div className={`p-2.5 rounded-lg border text-xs leading-relaxed animate-in fade-in duration-150 ${
                    isTjEditBypassed 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isTjEditBypassed ? (
                      <span className="font-semibold flex items-start gap-1.5">
                        <span className="shrink-0">ℹ️</span>
                        <span>
                          Produk & ukuran ini sudah ada di daftar titipan, tetapi diperbolehkan karena Anda menggunakan nama custom: <strong className="font-mono bg-green-100 px-1 py-0.5 rounded text-green-950">"{tjEditItemNamaCustom.trim()}"</strong>.
                        </span>
                      </span>
                    ) : (
                      <span className="font-semibold flex items-start gap-1.5">
                        <span className="shrink-0">⚠️</span>
                        <span>
                          Produk dan ukuran ini sudah masuk ke daftar titipan! Tombol dinonaktifkan sementara sampai Anda mengubah produk/ukuran, atau mengaktifkan <strong>"Custom Isi Nama Barang"</strong> dan mengisinya.
                        </span>
                      </span>
                    )}
                  </div>
                )}
 
                <button
                  type="button"
                  disabled={!selectedTjEditCatCode || !formTjEditCatUkuran || (isAlreadyInTjEditList && !isTjEditBypassed)}
                  onClick={() => {
                    const matchedInv = syncedItems.find(i => i.kode === selectedTjEditCatCode);
                    if (!matchedInv) return;
 
                    const { baseName, breakdown } = parseInventoryItemName(matchedInv.nama);
                    const hasBreakdown = Object.keys(breakdown).length > 0;
                    
                    const invStockSize = hasBreakdown && formTjEditCatUkuran
                      ? (breakdown[formTjEditCatUkuran] || 0)
                      : matchedInv.jumlah;

                    const currentlyAllocated = editingTj?.items.find(i => i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && i.ukuran === formTjEditCatUkuran)?.jumlahAmbil || 0;
                    const totalAvailableStock = invStockSize + currentlyAllocated;

                    if (totalAvailableStock < formTjEditCatQty) {
                      setTjEditError(`Stok tidak cukup. Hanya ada ${totalAvailableStock} unit untuk "${matchedInv.nama}"${formTjEditCatUkuran ? ` (Ukuran: ${formTjEditCatUkuran})` : ''} di inventaris + titipan saat ini.`);
                      return;
                    }

                    if (formTjEditCatQty < 1) {
                      setTjEditError(`Jumlah barang yang dimasukkan minimal harus 1.`);
                      return;
                    }
 
                    const cleanNamaCustom = tjEditItemIsiNama ? tjEditItemNamaCustom.trim() : '';
 
                    const hasSameCodeAndSize = formTjEditItems.some(i => i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && i.ukuran === formTjEditCatUkuran);
                    if (hasSameCodeAndSize) {
                      if (!cleanNamaCustom) {
                        setTjEditError(`Barang "${baseName}" [Ukuran: ${formTjEditCatUkuran}] sudah ada di daftar titipan. Untuk menambahkan barang yang sama, Anda wajib menggunakan opsi "Custom Isi Nama Barang".`);
                        return;
                      }
                      const duplicateCustomName = formTjEditItems.some(i => 
                        i.kodeBarang.toUpperCase() === selectedTjEditCatCode.toUpperCase() && 
                        i.ukuran === formTjEditCatUkuran && 
                        (i.namaCustom || '').trim().toLowerCase() === cleanNamaCustom.toLowerCase()
                      );
                      if (duplicateCustomName) {
                        setTjEditError(`Barang "${baseName}" [Ukuran: ${formTjEditCatUkuran}] dengan nama custom "${cleanNamaCustom}" sudah ada di daftar titipan.`);
                        return;
                      }
                    }
 
                    const matchedCat = catalogItems.find(c => c.kode === selectedTjEditCatCode);
                    const letterCount = tjEditItemIsiNama ? tjEditItemNamaCustom.replace(/[^a-zA-Z0-9]/g, '').length : 0;
                    const surcharge = letterCount * 5000;
                    const resellerPrice = matchedCat 
                      ? (getPricesForSize(matchedCat, formTjEditCatUkuran, 'Reseller') || matchedCat.hargaReseller || matchedInv.hargaSatuan)
                      : matchedInv.hargaSatuan;

                    const newItemName = formTjEditCatUkuran 
                      ? `${baseName} [Ukuran: ${formTjEditCatUkuran}]` 
                      : baseName;

                    const newItem: ConsignmentItem = {
                      kodeBarang: matchedInv.kode,
                      namaBarang: newItemName,
                      jumlahAmbil: formTjEditCatQty,
                      jumlahLaku: 0,
                      jumlahKembali: 0,
                      hargaSatuan: resellerPrice + surcharge,
                      namaCustom: tjEditItemIsiNama && cleanNamaCustom ? cleanNamaCustom : undefined,
                      ukuran: formTjEditCatUkuran || undefined
                    };
 
                    const updatedItems = deductItemStock(items, matchedInv.kode, formTjEditCatQty, formTjEditCatUkuran);
                    setItems(updatedItems);
 
                    setFormTjEditItems(prev => [...prev, newItem]);
                    setSelectedTjEditCatCode('');
                    setFormTjEditCatUkuran('');
                    setFormTjEditCatQty(1);
                    setTjEditItemIsiNama(false);
                    setTjEditItemNamaCustom('');
                    setTjEditError(null);
                  }}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-blue-200"
                >
                  <Plus size={14} />
                  <span>Tambahkan ke Daftar Titipan</span>
                </button>
              </div>

              {/* Added items table */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Daftar Barang yang Diambil ({formTjEditItems.length})</span>
                
                {formTjEditItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Belum ada barang yang ditambahkan. Silakan pilih produk di atas.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                          <th className="py-2 px-4">Nama Produk</th>
                          <th className="py-2 px-4 text-center">Jumlah</th>
                          <th className="py-2 px-4 text-right">Harga Reseller</th>
                          <th className="py-2 px-4 text-right">Subtotal</th>
                          <th className="py-2 px-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {formTjEditItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-4">
                              <span className="font-bold text-slate-700">{item.namaBarang}</span>
                              <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
                                <span className="text-[9px] font-mono text-slate-400">{item.kodeBarang}</span>
                                {item.namaCustom && (
                                  <span className="text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.2">
                                    Custom Nama: "{item.namaCustom}"
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-center font-mono font-bold text-slate-800">
                              {item.jumlahAmbil} Pcs
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {formatRupiah(item.hargaSatuan)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-700">
                              {formatRupiah(item.jumlahAmbil * item.hargaSatuan)}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const itemToRestore = formTjEditItems[idx];
                                  if (itemToRestore) {
                                    const updatedItems = restoreItemStock(items, itemToRestore.kodeBarang, itemToRestore.jumlahAmbil, itemToRestore.ukuran);
                                    setItems(updatedItems);
                                  }
                                  setFormTjEditItems(prev => prev.filter((_, iIdx) => iIdx !== idx));
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Hapus Barang"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {/* Accumulated Total Summary banner */}
                    <div className="bg-slate-50/70 border-t border-slate-100 p-3.5 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Estimasi Nilai Titip:</span>
                      <span className="text-sm font-extrabold text-blue-600 font-mono">
                        {formatRupiah(formTjEditItems.reduce((sum, i) => sum + (i.jumlahAmbil * i.hargaSatuan), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCancelTjEditModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTjEdit || formTjEditItems.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingTjEdit ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Consignment (Titip Jual) Settlement Modal */}
      {isTjSettleModalOpen && settlingTj && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-4 px-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Hitung Produk Laku - {settlingTj.id}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsTjSettleModalOpen(false);
                  setSettlingTj(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form body */}
            <form onSubmit={handleTjSettleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium uppercase text-[9px] tracking-wider block">Mitra Penjual:</span>
                  <span className="font-bold text-slate-800 mt-1 block">{settlingTj.namaMitra}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium uppercase text-[9px] tracking-wider block">Tanggal Pengambilan:</span>
                  <span className="font-bold text-slate-800 mt-1 block">{settlingTj.tanggalAmbil}</span>
                </div>
              </div>

              {/* Items listing to specify sold quantity */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Rincian Penjualan & Pengembalian</span>
                
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                        <th className="py-2 px-4">Nama Produk</th>
                        <th className="py-2 px-4 text-center">Diambil</th>
                        <th className="py-2 px-4 text-center w-32">Jumlah Laku</th>
                        <th className="py-2 px-4 text-center">Dikembalikan</th>
                        <th className="py-2 px-4 text-right">Subtotal Laku</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {settleItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-700">{item.namaBarang}</span>
                            <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
                              <span className="text-[9px] font-mono text-slate-400">
                                {item.kodeBarang} - {formatRupiah(item.hargaSatuan)} / pcs
                              </span>
                              {item.namaCustom && (
                                <span className="text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.2">
                                  Custom Nama: "{item.namaCustom}"
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                            {item.jumlahAmbil} pcs
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.jumlahAmbil}
                              value={item.jumlahLaku}
                              onChange={(e) => {
                                const val = Math.min(item.jumlahAmbil, Math.max(0, Number(e.target.value) || 0));
                                const updated = [...settleItems];
                                updated[idx] = {
                                  ...item,
                                  jumlahLaku: val,
                                  jumlahKembali: item.jumlahAmbil - val
                                };
                                setSettleItems(updated);
                              }}
                              className="w-20 mx-auto text-center font-bold text-xs py-1 px-2 border border-slate-200 rounded bg-white text-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                            {item.jumlahKembali} pcs
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-700">
                            {formatRupiah(item.jumlahLaku * item.hargaSatuan)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Accumulated Total sold Summary */}
                  <div className="bg-emerald-50/40 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">TOTAL YANG HARUS DIBAYAR MITRA:</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Semua sisa barang otomatis dimasukkan kembali ke inventaris gudang.</span>
                    </div>
                    <span className="text-base font-extrabold text-emerald-600 font-mono">
                      {formatRupiah(settleItems.reduce((sum, i) => sum + (i.jumlahLaku * i.hargaSatuan), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTjSettleModalOpen(false);
                    setSettlingTj(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTj}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingTj ? 'Menyimpan...' : 'Selesaikan & Terima Pembayaran'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Consignment Cancellation Confirmation Modal */}
      {deletingTjItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <CircleAlert className="w-4 h-4 text-red-500" />
                Batalkan Titip Jual
              </h3>
              <button
                onClick={() => setDeletingTjItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin membatalkan transaksi Titip Jual <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">{deletingTjItem.id}</span> untuk mitra <span className="font-bold text-slate-800">"{deletingTjItem.namaMitra}"</span>?
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Nilai Titip:</span>
                  <span className="font-bold text-slate-800 font-mono">{formatRupiah(deletingTjItem.totalNilaiAmbil)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah Produk:</span>
                  <span className="font-bold text-slate-800 font-mono">{deletingTjItem.items.length} Macam</span>
                </div>
              </div>

              <p className="text-[11px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 p-2.5 rounded-lg">
                ⚠️ Semua barang yang diambil dalam surat jalan ini otomatis akan dikembalikan utuh ke dalam stok inventaris gudang.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingTjItem(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  executeCancelTj(deletingTjItem);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loading ? 'Membatalkan...' : 'Ya, Batalkan Transaksi'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Consignment Permanent Deletion Confirmation Modal */}
      {hardDeletingTj && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 py-3.5 px-5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 text-red-600">
                <Trash2 className="w-4 h-4 text-red-500" />
                Hapus Titip Jual Permanen
              </h3>
              <button
                onClick={() => setHardDeletingTj(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus data transaksi Titip Jual <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">{hardDeletingTj.id}</span> untuk mitra <span className="font-bold text-slate-800">"{hardDeletingTj.namaMitra}"</span> secara permanen? Tindakan ini tidak dapat dibatalkan.
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Nilai Titip:</span>
                  <span className="font-bold text-slate-800 font-mono">{formatRupiah(hardDeletingTj.totalNilaiAmbil)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah Produk:</span>
                  <span className="font-bold text-slate-800 font-mono">{hardDeletingTj.items.length} Macam</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status Transaksi:</span>
                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase border ${
                    hardDeletingTj.status === 'aktif'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : hardDeletingTj.status === 'selesai'
                      ? 'bg-green-50 text-green-700 border-green-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    {hardDeletingTj.status}
                  </span>
                </div>
              </div>

              {(hardDeletingTj.status === 'aktif' || hardDeletingTj.status === 'selesai') && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 p-3 rounded-lg text-blue-950 font-medium">
                  <RefreshCw className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 animate-spin duration-3000" />
                  <div>
                    <span className="text-[11px] font-bold block text-blue-900">Pengembalian Stok Otomatis</span>
                    <span className="text-[9.5px] text-blue-700 font-normal leading-tight block mt-0.5">
                      Jumlah barang dari transaksi ini akan langsung dikembalikan ke database inventaris Anda.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setHardDeletingTj(null)}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  executeDeleteTjData(hardDeletingTj, restoreStockOnDelete);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loading ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Catalog Code Collision Resolution Modal */}
      {catalogCollisionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 text-amber-600">
              <CircleAlert className="w-6 h-6 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Tabrakan Kode Produk (Katalog)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kode produk <strong className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{formCatKode}</strong> sudah digunakan oleh produk lain:
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Produk Pemilik Kode Saat Ini:</span>
              <div className="text-xs">
                <span className="font-bold text-slate-800">{catalogCollisionItem.nama}</span>
                <span className="text-[11px] text-slate-500 font-mono block mt-0.5">Kategori: {catalogCollisionItem.kategori || 'Tanpa Kategori'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed">
              Pilihan Tindakan:
              <ul className="list-disc list-inside mt-1 space-y-1 text-slate-500">
                <li><strong className="text-slate-700">Tetap Gunakan:</strong> Kode ini akan diberikan ke produk baru Anda. Produk lama di atas akan otomatis diganti kodenya ke kode unik baru berikutnya.</li>
                <li><strong className="text-slate-700">Batal:</strong> Kembali ke form edit untuk mengganti kode produk Anda secara manual.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setCatalogCollisionItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
              >
                Batal (Edit Kode)
              </button>
              <button
                type="button"
                onClick={executeCatalogSaveWithOverride}
                disabled={savingCatalog}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {savingCatalog ? 'Memproses...' : 'Tetap Gunakan & Ganti Kode Lama'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Code Collision Resolution Modal */}
      {inventoryCollisionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 text-amber-600">
              <CircleAlert className="w-6 h-6 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Tabrakan Kode Barang (Gudang)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kode barang <strong className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{formKode}</strong> sudah digunakan oleh barang lain di inventaris:
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Barang Pemilik Kode Saat Ini:</span>
              <div className="text-xs">
                <span className="font-bold text-slate-800">{inventoryCollisionItem.nama}</span>
                <span className="text-[11px] text-slate-500 font-mono block mt-0.5">Jumlah Stok: {inventoryCollisionItem.jumlah} Pcs</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed">
              Pilihan Tindakan:
              <ul className="list-disc list-inside mt-1 space-y-1 text-slate-500">
                <li><strong className="text-slate-700">Tetap Gunakan:</strong> Kode ini akan diberikan ke barang baru Anda. Barang lama di atas akan otomatis diganti kodenya ke kode unik baru berikutnya di inventaris dan katalog.</li>
                <li><strong className="text-slate-700">Batal:</strong> Kembali ke form edit untuk mengganti kode secara manual.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setInventoryCollisionItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeInventorySaveWithOverride}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Tetap Gunakan & Ganti Kode Lama'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
