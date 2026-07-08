import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Package, 
  DollarSign, 
  TrendingDown, 
  Plus, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Save, 
  Trash2, 
  Download, 
  ChevronRight, 
  FileText, 
  Coins, 
  Check, 
  CalendarRange,
  Search,
  AlertCircle,
  Printer,
  Settings
} from 'lucide-react';
import { 
  Karyawan, 
  Absensi, 
  ProduksiBorongan, 
  Pinjaman, 
  GajiPembayaran, 
  CatalogItem, 
  KaryawanKategori,
  ProdukBorongan
} from '../types';
import { 
  saveKaryawanData, 
  saveAbsensiData, 
  saveProduksiBoronganData, 
  savePinjamanData, 
  saveGajiPembayaranData,
  saveProdukBoronganData
} from '../lib/googleApi';

interface EmployeeManagerProps {
  token: string;
  spreadsheetId: string;
  session: any;
  catalogItems: CatalogItem[];
  karyawanList: Karyawan[];
  absensiList: Absensi[];
  produksiBoronganList: ProduksiBorongan[];
  pinjamanList: Pinjaman[];
  gajiPembayaranList: GajiPembayaran[];
  produkBoronganList: ProdukBorongan[];
  setKaryawanList: React.Dispatch<React.SetStateAction<Karyawan[]>>;
  setAbsensiList: React.Dispatch<React.SetStateAction<Absensi[]>>;
  setProduksiBoronganList: React.Dispatch<React.SetStateAction<ProduksiBorongan[]>>;
  setPinjamanList: React.Dispatch<React.SetStateAction<Pinjaman[]>>;
  setGajiPembayaranList: React.Dispatch<React.SetStateAction<GajiPembayaran[]>>;
  setProdukBoronganList: React.Dispatch<React.SetStateAction<ProdukBorongan[]>>;
  onAddActivityLog: (aksi: string, detail: string) => void;
}

type SubTab = 'karyawan' | 'absensi' | 'borongan' | 'pinjaman' | 'gaji' | 'produk_borongan';

export default function EmployeeManager({
  token,
  spreadsheetId,
  session,
  catalogItems,
  karyawanList,
  absensiList,
  produksiBoronganList,
  pinjamanList,
  gajiPembayaranList,
  produkBoronganList,
  setKaryawanList,
  setAbsensiList,
  setProduksiBoronganList,
  setPinjamanList,
  setGajiPembayaranList,
  setProdukBoronganList,
  onAddActivityLog
}: EmployeeManagerProps) {
  const [subTab, setSubTab] = useState<SubTab>('karyawan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Custom confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Helper to show custom confirmation modal
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      }
    });
  };

  // General helpers
  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const generateId = () => {
    return 'EMP-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
  };

  const generateGenId = (prefix: string) => {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 100);
  };

  // ==========================================
  // 1. DAFTAR KARYAWAN STATES & HANDLERS
  // ==========================================
  const [formEmpId, setFormEmpId] = useState('');
  const [formEmpNama, setFormEmpNama] = useState('');
  const [formEmpKategori, setFormEmpKategori] = useState<KaryawanKategori>('Harian');
  const [formEmpGajiHarian, setFormEmpGajiHarian] = useState(0);
  const [formEmpTanggalMasuk, setFormEmpTanggalMasuk] = useState(new Date().toISOString().substring(0, 10));
  const [formEmpStatus, setFormEmpStatus] = useState(true);
  const [isEditingEmp, setIsEditingEmp] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const filteredEmployees = useMemo(() => {
    return karyawanList.filter(emp => 
      emp.nama.toLowerCase().includes(empSearch.toLowerCase()) ||
      emp.id.toLowerCase().includes(empSearch.toLowerCase())
    );
  }, [karyawanList, empSearch]);

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpNama.trim()) {
      setError('Nama karyawan harus diisi');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let updatedList: Karyawan[] = [];
      const logUser = session.displayName || session.email || 'Sistem';

      if (isEditingEmp) {
        // Edit existing
        updatedList = karyawanList.map(emp => 
          emp.id === formEmpId 
            ? { 
                ...emp, 
                nama: formEmpNama, 
                kategori: formEmpKategori, 
                gajiHarian: formEmpKategori === 'Harian' ? formEmpGajiHarian : 0, 
                tanggalMasuk: formEmpTanggalMasuk,
                statusAktif: formEmpStatus 
              } 
            : emp
        );
        onAddActivityLog('Edit Karyawan', `Mengedit data karyawan: ${formEmpNama} (${formEmpId})`);
      } else {
        // Create new
        const newId = generateId();
        const newEmp: Karyawan = {
          id: newId,
          nama: formEmpNama,
          kategori: formEmpKategori,
          gajiHarian: formEmpKategori === 'Harian' ? formEmpGajiHarian : 0,
          tanggalMasuk: formEmpTanggalMasuk,
          statusAktif: true
        };
        updatedList = [newEmp, ...karyawanList];
        onAddActivityLog('Tambah Karyawan', `Menambahkan karyawan baru: ${formEmpNama} (${newId})`);
      }

      await saveKaryawanData(token, spreadsheetId, updatedList);
      setKaryawanList(updatedList);
      setSuccess(`Karyawan "${formEmpNama}" berhasil disimpan ke Google Sheets!`);
      resetEmpForm();
    } catch (err: any) {
      console.error(err);
      setError('Gagal menyimpan karyawan ke Google Sheets: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const resetEmpForm = () => {
    setFormEmpId('');
    setFormEmpNama('');
    setFormEmpKategori('Harian');
    setFormEmpGajiHarian(0);
    setFormEmpTanggalMasuk(new Date().toISOString().substring(0, 10));
    setFormEmpStatus(true);
    setIsEditingEmp(false);
  };

  const handleEditEmpClick = (emp: Karyawan) => {
    setFormEmpId(emp.id);
    setFormEmpNama(emp.nama);
    setFormEmpKategori(emp.kategori);
    setFormEmpGajiHarian(emp.gajiHarian);
    setFormEmpTanggalMasuk(emp.tanggalMasuk);
    setFormEmpStatus(emp.statusAktif);
    setIsEditingEmp(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEmp = (id: string, nama: string) => {
    showConfirm(
      'Konfirmasi Hapus Karyawan',
      `Apakah Anda yakin ingin menghapus karyawan "${nama}"? Data absensi, produksi, dan pinjaman akan tetap tersimpan.`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const updatedList = karyawanList.filter(emp => emp.id !== id);
          await saveKaryawanData(token, spreadsheetId, updatedList);
          setKaryawanList(updatedList);
          setSuccess(`Karyawan "${nama}" berhasil dihapus.`);
          onAddActivityLog('Hapus Karyawan', `Menghapus karyawan: ${nama} (${id})`);
        } catch (err: any) {
          setError('Gagal menghapus karyawan: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // ==========================================
  // 2. ABSENSI (ATTENDANCE) STATES & HANDLERS
  // ==========================================
  const [absensiTanggal, setAbsensiTanggal] = useState(new Date().toISOString().substring(0, 10));
  // Local state for the attendance grid on the selected date
  const [absensiGrid, setAbsensiGrid] = useState<Record<string, { status: 'Hadir' | 'Hadir 1/2 Hari' | 'Tidak Hadir'; keterangan: string }>>({});

  // When date changes, load existing attendance or initialize default
  const activeEmployees = useMemo(() => {
    return karyawanList.filter(emp => emp.statusAktif);
  }, [karyawanList]);

  const activeHarianEmployees = useMemo(() => {
    return activeEmployees.filter(emp => emp.kategori === 'Harian');
  }, [activeEmployees]);

  const loadAbsensiGrid = () => {
    const grid: Record<string, { status: 'Hadir' | 'Hadir 1/2 Hari' | 'Tidak Hadir'; keterangan: string }> = {};
    // Default all active daily employees to 'Hadir'
    activeHarianEmployees.forEach(emp => {
      grid[emp.id] = { status: 'Hadir', keterangan: '' };
    });

    // Overwrite with existing attendance records for this date
    const existing = absensiList.filter(abs => abs.tanggal === absensiTanggal);
    existing.forEach(abs => {
      grid[abs.idKaryawan] = {
        status: abs.statusKerja,
        keterangan: abs.keterangan || ''
      };
    });

    setAbsensiGrid(grid);
  };

  React.useEffect(() => {
    loadAbsensiGrid();
  }, [absensiTanggal, karyawanList, absensiList]);

  const handleGridStatusChange = (empId: string, status: 'Hadir' | 'Hadir 1/2 Hari' | 'Tidak Hadir') => {
    setAbsensiGrid(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        status
      }
    }));
  };

  const handleGridKeteranganChange = (empId: string, keterangan: string) => {
    setAbsensiGrid(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        keterangan
      }
    }));
  };

  const handleSaveAbsensi = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create new list omitting old records for this date
      const otherDays = absensiList.filter(abs => abs.tanggal !== absensiTanggal);
      
      const newEntries: Absensi[] = activeHarianEmployees.map(emp => {
        const gridItem = absensiGrid[emp.id] || { status: 'Hadir', keterangan: '' };
        return {
          id: generateGenId('ABS'),
          tanggal: absensiTanggal,
          idKaryawan: emp.id,
          namaKaryawan: emp.nama,
          statusKerja: gridItem.status,
          keterangan: gridItem.keterangan
        };
      });

      const updatedList = [...newEntries, ...otherDays];
      await saveAbsensiData(token, spreadsheetId, updatedList);
      setAbsensiList(updatedList);
      setSuccess(`Absensi untuk tanggal ${absensiTanggal} berhasil disimpan ke Google Sheets!`);
      onAddActivityLog('Catat Absensi', `Mendata absensi karyawan untuk tanggal ${absensiTanggal}`);
    } catch (err: any) {
      setError('Gagal menyimpan absensi: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };


  // ==========================================
  // 3. PRODUKSI BORONGAN STATES & HANDLERS
  // ==========================================
  const [prodTanggal, setProdTanggal] = useState(new Date().toISOString().substring(0, 10));
  const [prodEmpId, setProdEmpId] = useState('');
  const [prodKodeProduk, setProdKodeProduk] = useState('');
  const [prodJumlah, setProdJumlah] = useState(1);
  const [prodNilaiPerPcs, setProdNilaiPerPcs] = useState(0);

  const activeBoronganEmployees = useMemo(() => {
    return karyawanList.filter(emp => emp.statusAktif && emp.kategori === 'Borongan');
  }, [karyawanList]);

  // Handle Produk Borongan selection to prefill wage
  const handleProdukBoronganSelectChange = (id: string) => {
    setProdKodeProduk(id);
    const item = produkBoronganList.find(pb => pb.id === id);
    if (item) {
      setProdNilaiPerPcs(item.nilaiPerPcs);
    } else {
      setProdNilaiPerPcs(0);
    }
  };

  const handleAddProduksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodEmpId) {
      setError('Pilih karyawan terlebih dahulu');
      return;
    }
    if (!prodKodeProduk) {
      setError('Pilih produk terlebih dahulu');
      return;
    }
    if (prodJumlah <= 0) {
      setError('Jumlah produksi harus lebih dari 0');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const emp = karyawanList.find(k => k.id === prodEmpId);
      const prod = produkBoronganList.find(pb => pb.id === prodKodeProduk);
      
      const newEntry: ProduksiBorongan = {
        id: generateGenId('PRD'),
        tanggal: prodTanggal,
        idKaryawan: prodEmpId,
        namaKaryawan: emp ? emp.nama : 'Unknown',
        kodeProduk: prodKodeProduk,
        namaProduk: prod ? prod.nama : 'Produk Kustom',
        jumlah: prodJumlah,
        nilaiPerPcs: prodNilaiPerPcs,
        totalNilai: prodJumlah * prodNilaiPerPcs
      };

      const updatedList = [newEntry, ...produksiBoronganList];
      await saveProduksiBoronganData(token, spreadsheetId, updatedList);
      setProduksiBoronganList(updatedList);
      setSuccess(`Hasil produksi borongan "${newEntry.namaKaryawan}" berhasil ditambahkan!`);
      onAddActivityLog('Tambah Produksi Borongan', `Mencatat produksi ${newEntry.jumlah} pcs ${newEntry.namaProduk} untuk ${newEntry.namaKaryawan}`);
      
      // Reset production inputs except date and employee
      setProdKodeProduk('');
      setProdJumlah(1);
      setProdNilaiPerPcs(0);
    } catch (err: any) {
      setError('Gagal mencatat produksi borongan: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduksi = (id: string, namaEmp: string) => {
    showConfirm(
      'Hapus Produksi Borongan',
      `Apakah Anda yakin ingin menghapus catatan produksi borongan untuk ${namaEmp}?`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const updatedList = produksiBoronganList.filter(p => p.id !== id);
          await saveProduksiBoronganData(token, spreadsheetId, updatedList);
          setProduksiBoronganList(updatedList);
          setSuccess('Catatan produksi borongan berhasil dihapus.');
          onAddActivityLog('Hapus Produksi Borongan', `Menghapus catatan produksi borongan untuk ${namaEmp}`);
        } catch (err: any) {
          setError('Gagal menghapus catatan produksi: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Filtered production entries for display
  const currentDayProductions = useMemo(() => {
    return produksiBoronganList.filter(p => p.tanggal === prodTanggal);
  }, [produksiBoronganList, prodTanggal]);


  // ==========================================
  // 4. PINJAMAN (LOANS) STATES & HANDLERS
  // ==========================================
  const [pinjTanggal, setPinjTanggal] = useState(new Date().toISOString().substring(0, 10));
  const [pinjEmpId, setPinjEmpId] = useState('');
  const [pinjJumlah, setPinjJumlah] = useState(0);
  const [pinjCatatan, setPinjCatatan] = useState('');
  const [pinjSearch, setPinjSearch] = useState('');

  const handleAddPinjaman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinjEmpId) {
      setError('Pilih karyawan peminjam');
      return;
    }
    if (pinjJumlah <= 0) {
      setError('Jumlah pinjaman harus lebih dari Rp 0');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const emp = karyawanList.find(k => k.id === pinjEmpId);
      const newEntry: Pinjaman = {
        id: generateGenId('LND'),
        tanggal: pinjTanggal,
        idKaryawan: pinjEmpId,
        namaKaryawan: emp ? emp.nama : 'Unknown',
        jumlahPinjaman: pinjJumlah,
        status: 'Belum Lunas',
        catatan: pinjCatatan
      };

      const updatedList = [newEntry, ...pinjamanList];
      await savePinjamanData(token, spreadsheetId, updatedList);
      setPinjamanList(updatedList);
      setSuccess(`Pinjaman baru Rp ${pinjJumlah.toLocaleString('id-ID')} atas nama "${newEntry.namaKaryawan}" berhasil dicatat!`);
      onAddActivityLog('Tambah Pinjaman Karyawan', `Mencatat pinjaman baru ${formatRupiah(pinjJumlah)} untuk ${newEntry.namaKaryawan}`);

      // Reset
      setPinjEmpId('');
      setPinjJumlah(0);
      setPinjCatatan('');
    } catch (err: any) {
      setError('Gagal menyimpan pinjaman: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePinjamanStatus = (id: string, currentStatus: 'Belum Lunas' | 'Lunas', namaEmp: string, nominal: number) => {
    const nextStatus: 'Belum Lunas' | 'Lunas' = currentStatus === 'Belum Lunas' ? 'Lunas' : 'Belum Lunas';
    showConfirm(
      'Ubah Status Pinjaman',
      `Ubah status pinjaman ${namaEmp} sebesar ${formatRupiah(nominal)} menjadi "${nextStatus}"?`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const updatedList = pinjamanList.map(p => 
            p.id === id ? { ...p, status: nextStatus } : p
          );
          await savePinjamanData(token, spreadsheetId, updatedList);
          setPinjamanList(updatedList);
          setSuccess(`Status pinjaman ${namaEmp} berhasil diubah.`);
          onAddActivityLog('Ubah Status Pinjaman', `Mengubah status pinjaman ${namaEmp} (${formatRupiah(nominal)}) menjadi ${nextStatus}`);
        } catch (err: any) {
          setError('Gagal mengubah status pinjaman: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeletePinjaman = (id: string, namaEmp: string, nominal: number) => {
    showConfirm(
      'Hapus Catatan Pinjaman',
      `Hapus transaksi pinjaman ${namaEmp} sebesar ${formatRupiah(nominal)}?`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const updatedList = pinjamanList.filter(p => p.id !== id);
          await savePinjamanData(token, spreadsheetId, updatedList);
          setPinjamanList(updatedList);
          setSuccess('Catatan pinjaman berhasil dihapus.');
          onAddActivityLog('Hapus Pinjaman', `Menghapus catatan pinjaman ${namaEmp} sebesar ${formatRupiah(nominal)}`);
        } catch (err: any) {
          setError('Gagal menghapus pinjaman: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Summary of unpaid loans grouped by employee
  const loanBalanceByEmployee = useMemo(() => {
    const balances: Record<string, number> = {};
    pinjamanList.forEach(p => {
      if (p.status === 'Belum Lunas') {
        balances[p.idKaryawan] = (balances[p.idKaryawan] || 0) + p.jumlahPinjaman;
      }
    });
    return balances;
  }, [pinjamanList]);

  const filteredLoans = useMemo(() => {
    return pinjamanList.filter(p => 
      p.namaKaryawan.toLowerCase().includes(pinjSearch.toLowerCase()) ||
      p.idKaryawan.toLowerCase().includes(pinjSearch.toLowerCase())
    );
  }, [pinjamanList, pinjSearch]);


  // ==========================================
  // 4b. MASTER PRODUK BORONGAN STATES & HANDLERS
  // ==========================================
  const [formPbId, setFormPbId] = useState('');
  const [formPbNama, setFormPbNama] = useState('');
  const [formPbNilaiPerPcs, setFormPbNilaiPerPcs] = useState(0);
  const [isEditingPb, setIsEditingPb] = useState(false);
  const [pbSearch, setPbSearch] = useState('');

  const handleSaveProdukBorongan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPbNama.trim()) {
      setError('Nama produk borongan harus diisi');
      return;
    }
    if (formPbNilaiPerPcs <= 0) {
      setError('Nilai upah per pcs harus lebih dari Rp 0');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let updatedList: ProdukBorongan[] = [];

      if (isEditingPb) {
        updatedList = produkBoronganList.map(pb =>
          pb.id === formPbId
            ? { ...pb, nama: formPbNama.trim(), nilaiPerPcs: formPbNilaiPerPcs }
            : pb
        );
        onAddActivityLog('Edit Produk Borongan', `Mengedit produk borongan: ${formPbNama.trim()} (Upah: ${formatRupiah(formPbNilaiPerPcs)})`);
      } else {
        const newPb: ProdukBorongan = {
          id: `PB-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
          nama: formPbNama.trim(),
          nilaiPerPcs: formPbNilaiPerPcs
        };
        updatedList = [...produkBoronganList, newPb];
        onAddActivityLog('Tambah Produk Borongan', `Menambah produk borongan baru: ${newPb.nama} (Upah: ${formatRupiah(newPb.nilaiPerPcs)})`);
      }

      await saveProdukBoronganData(token, spreadsheetId, updatedList);
      setProdukBoronganList(updatedList);
      setSuccess(isEditingPb ? 'Produk borongan berhasil diperbarui' : 'Produk borongan baru berhasil ditambahkan');

      // Reset form
      setFormPbId('');
      setFormPbNama('');
      setFormPbNilaiPerPcs(0);
      setIsEditingPb(false);
    } catch (err: any) {
      console.error(err);
      setError('Gagal menyimpan data produk borongan ke Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProdukBorongan = (pb: ProdukBorongan) => {
    setFormPbId(pb.id);
    setFormPbNama(pb.nama);
    setFormPbNilaiPerPcs(pb.nilaiPerPcs);
    setIsEditingPb(true);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteProdukBorongan = (id: string, nama: string) => {
    showConfirm(
      'Hapus Produk Borongan',
      `Hapus produk borongan "${nama}" dari daftar?`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const updatedList = produkBoronganList.filter(pb => pb.id !== id);
          await saveProdukBoronganData(token, spreadsheetId, updatedList);
          setProdukBoronganList(updatedList);
          setSuccess(`Produk borongan "${nama}" berhasil dihapus`);
          onAddActivityLog('Hapus Produk Borongan', `Menghapus produk borongan: ${nama}`);
          
          if (formPbId === id) {
            setFormPbId('');
            setFormPbNama('');
            setFormPbNilaiPerPcs(0);
            setIsEditingPb(false);
          }
        } catch (err: any) {
          console.error(err);
          setError('Gagal menghapus produk borongan dari Google Sheets');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const filteredProdukBorongan = useMemo(() => {
    return produkBoronganList.filter(pb =>
      pb.nama.toLowerCase().includes(pbSearch.toLowerCase()) ||
      pb.id.toLowerCase().includes(pbSearch.toLowerCase())
    );
  }, [produkBoronganList, pbSearch]);


  // ==========================================
  // 5. GAJI & PAYROLL STATES & HANDLERS
  // ==========================================
  const currentYear = new Date().getFullYear();
  const [gajiBulan, setGajiBulan] = useState(String(new Date().getMonth() + 1).padStart(2, '0')); // "01" - "12"
  const [gajiTahun, setGajiTahun] = useState(String(currentYear));
  const [activePayrollEmpId, setActivePayrollEmpId] = useState<string | null>(null);
  
  // Custom temporary overrides for payroll processing
  const [customPotonganPinjaman, setCustomPotonganPinjaman] = useState<Record<string, number>>({});
  const [gajiCatatan, setGajiCatatan] = useState<Record<string, string>>({});

  const monthOptions = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  // Main payroll engine calculation for the selected month/year
  const payrollCalculations = useMemo(() => {
    const targetPeriod = `${gajiBulan}-${gajiTahun}`; // e.g., "07-2026"
    
    // Get year-month prefix for date checking: "2026-07"
    const targetPrefix = `${gajiTahun}-${gajiBulan}`;

    return karyawanList.map(emp => {
      // 1. Calculate Attendance (Days worked) for Harian
      const monthAbsensi = absensiList.filter(abs => 
        abs.idKaryawan === emp.id && 
        abs.tanggal.startsWith(targetPrefix)
      );
      const totalHadir = monthAbsensi.filter(abs => abs.statusKerja === 'Hadir').length;
      const totalSetengah = monthAbsensi.filter(abs => abs.statusKerja === 'Hadir 1/2 Hari').length;
      const totalHariKerja = totalHadir + (totalSetengah * 0.5);

      // 2. Base salary calculation
      let gajiPokok = 0;
      let totalBorongan = 0;

      if (emp.kategori === 'Harian') {
        gajiPokok = totalHariKerja * emp.gajiHarian;
      } else {
        // Calculate production output total for Borongan in this period
        const monthProd = produksiBoronganList.filter(p => 
          p.idKaryawan === emp.id && 
          p.tanggal.startsWith(targetPrefix)
        );
        totalBorongan = monthProd.reduce((sum, item) => sum + item.totalNilai, 0);
      }

      // Gross earning before loan deduction
      const totalKotor = emp.kategori === 'Harian' ? gajiPokok : totalBorongan;

      // 3. Find Unpaid Loans
      const empUnpaidLoans = pinjamanList.filter(p => 
        p.idKaryawan === emp.id && 
        p.status === 'Belum Lunas'
      );
      const totalSisaPinjaman = empUnpaidLoans.reduce((sum, item) => sum + item.jumlahPinjaman, 0);

      // Default deduction is the lesser of remaining loan or gross salary
      const defaultPotongan = Math.min(totalSisaPinjaman, totalKotor);
      const customDeduction = customPotonganPinjaman[emp.id] !== undefined 
        ? customPotonganPinjaman[emp.id] 
        : defaultPotongan;

      const totalBersih = Math.max(0, totalKotor - customDeduction);

      // Check if already paid in history
      const paymentHistory = gajiPembayaranList.find(p => 
        p.idKaryawan === emp.id && 
        p.bulanTahun === targetPeriod
      );

      return {
        employee: emp,
        totalHariKerja,
        gajiHarianRate: emp.gajiHarian,
        gajiPokok,
        totalBorongan,
        totalKotor,
        totalSisaPinjaman,
        recommendedDeduction: defaultPotongan,
        activeDeduction: customDeduction,
        totalBersih,
        isPaid: !!paymentHistory,
        paymentRecord: paymentHistory,
        unpaidLoansList: empUnpaidLoans
      };
    });
  }, [karyawanList, absensiList, produksiBoronganList, pinjamanList, gajiPembayaranList, gajiBulan, gajiTahun, customPotonganPinjaman]);

  // Handle pay action
  const handlePaySalary = (calc: typeof payrollCalculations[0]) => {
    if (calc.isPaid) {
      setError('Gaji karyawan ini untuk periode ini sudah pernah dibayarkan!');
      return;
    }

    showConfirm(
      'Konfirmasi Pembayaran Gaji',
      `Konfirmasi pembayaran gaji untuk ${calc.employee.nama} sebesar ${formatRupiah(calc.totalBersih)}?`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          const targetPeriod = `${gajiBulan}-${gajiTahun}`;
          const recordId = generateGenId('PAY');
          
          const newPayRecord: GajiPembayaran = {
            id: recordId,
            tanggalGajian: new Date().toISOString().substring(0, 10),
            bulanTahun: targetPeriod,
            idKaryawan: calc.employee.id,
            namaKaryawan: calc.employee.nama,
            kategori: calc.employee.kategori,
            totalHariKerja: calc.totalHariKerja,
            gajiHarianRate: calc.gajiHarianRate,
            gajiPokok: calc.gajiPokok,
            totalBorongan: calc.totalBorongan,
            potonganPinjaman: calc.activeDeduction,
            totalBersih: calc.totalBersih,
            catatan: gajiCatatan[calc.employee.id] || `Gaji periode ${gajiBulan}/${gajiTahun}`
          };

          // 1. Save payroll payment record
          const updatedPayList = [newPayRecord, ...gajiPembayaranList];
          await saveGajiPembayaranData(token, spreadsheetId, updatedPayList);
          setGajiPembayaranList(updatedPayList);

          // 2. Adjust or clear Open Loans if deduction was applied
          if (calc.activeDeduction > 0) {
            let deductionLeft = calc.activeDeduction;
            const updatedLoans = pinjamanList.map(loan => {
              if (loan.idKaryawan === calc.employee.id && loan.status === 'Belum Lunas') {
                if (deductionLeft >= loan.jumlahPinjaman) {
                  const paidAmount = loan.jumlahPinjaman;
                  deductionLeft -= paidAmount;
                  return { 
                    ...loan, 
                    status: 'Lunas' as const,
                    catatan: `${loan.catatan || ''} [DILUNASI_GAJI_${targetPeriod}_Rp${paidAmount}]`.trim()
                  };
                } else if (deductionLeft > 0) {
                  // Partial reduction: Since simple schema has only "Lunas"/"Belum Lunas",
                  // we reduce its amount directly and write a note
                  const reducedAmount = loan.jumlahPinjaman - deductionLeft;
                  const appliedDeduction = deductionLeft;
                  deductionLeft = 0;
                  return { 
                    ...loan, 
                    jumlahPinjaman: reducedAmount, 
                    catatan: `${loan.catatan || ''} [POTONG_SEBAGIAN_GAJI_${targetPeriod}_Rp${appliedDeduction}] (Dipotong sebagian Rp ${appliedDeduction.toLocaleString('id-ID')} saat gajian)`.trim()
                  };
                }
              }
              return loan;
            });

            await savePinjamanData(token, spreadsheetId, updatedLoans);
            setPinjamanList(updatedLoans);
          }

          setSuccess(`Berhasil membayarkan gaji dan mencatat transaksi untuk ${calc.employee.nama}!`);
          onAddActivityLog('Bayar Gaji', `Membayar gaji bersih ${formatRupiah(calc.totalBersih)} untuk ${calc.employee.nama} periode ${targetPeriod}`);
        } catch (err: any) {
          setError('Gaji gagal diproses: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Handle reset salary payment back to draft/unpaid
  const handleResetSalary = (calc: typeof payrollCalculations[0]) => {
    const targetPeriod = `${gajiBulan}-${gajiTahun}`;
    showConfirm(
      'Reset Pembayaran Gaji',
      `Apakah Anda yakin ingin membatalkan/reset pembayaran gaji untuk "${calc.employee.nama}" periode ${targetPeriod}? Data transaksi gaji akan dihapus dan potongan pinjaman/kasbon akan dikembalikan ke posisi semula.`,
      async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
          // 1. Find and delete the GajiPembayaran record
          const paymentToRemove = gajiPembayaranList.find(
            p => p.idKaryawan === calc.employee.id && p.bulanTahun === targetPeriod
          );

          if (!paymentToRemove) {
            throw new Error('Data pembayaran gaji tidak ditemukan untuk periode ini.');
          }

          const updatedPayList = gajiPembayaranList.filter(p => p.id !== paymentToRemove.id);
          await saveGajiPembayaranData(token, spreadsheetId, updatedPayList);
          setGajiPembayaranList(updatedPayList);

          // 2. Restore modified loans
          const updatedLoans = pinjamanList.map(loan => {
            if (loan.idKaryawan === calc.employee.id && loan.catatan) {
              let currentCatatan = loan.catatan;
              let updatedStatus = loan.status;
              let updatedJumlah = loan.jumlahPinjaman;

              // Check for fully paid tag: [DILUNASI_GAJI_07-2026_Rp50000]
              const fullMatchRegex = new RegExp(`\\[DILUNASI_GAJI_${targetPeriod}_Rp(\\d+)\\]`);
              const fullMatch = currentCatatan.match(fullMatchRegex);
              if (fullMatch) {
                updatedStatus = 'Belum Lunas' as const;
                currentCatatan = currentCatatan.replace(fullMatchRegex, '');
              }

              // Check for partially paid tag: [POTONG_SEBAGIAN_GAJI_07-2026_Rp20000]
              const partialMatchRegex = new RegExp(`\\[POTONG_SEBAGIAN_GAJI_${targetPeriod}_Rp(\\d+)\\]`);
              const partialMatch = currentCatatan.match(partialMatchRegex);
              if (partialMatch) {
                const restoredAmount = Number(partialMatch[1]);
                updatedJumlah = updatedJumlah + restoredAmount;
                currentCatatan = currentCatatan.replace(partialMatchRegex, '');
              }

              // Also clean up any manual Old/Legacy notes if they exists
              const oldPartialRegex = new RegExp(`\\(Dipotong sebagian Rp [\\d.,]+ saat gajian\\)`);
              currentCatatan = currentCatatan.replace(oldPartialRegex, '');

              return {
                ...loan,
                status: updatedStatus,
                jumlahPinjaman: updatedJumlah,
                catatan: currentCatatan.trim()
              };
            }
            return loan;
          });

          await savePinjamanData(token, spreadsheetId, updatedLoans);
          setPinjamanList(updatedLoans);

          setSuccess(`Status pembayaran gaji untuk "${calc.employee.nama}" berhasil di-reset kembali ke draft.`);
          onAddActivityLog('Reset Gaji', `Membatalkan pembayaran gaji untuk ${calc.employee.nama} periode ${targetPeriod}`);
        } catch (err: any) {
          setError('Gagal membatalkan pembayaran: ' + (err.message || err));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Receipt printing simulation trigger
  const handlePrintReceipt = (calc: typeof payrollCalculations[0]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Gagal membuka jendela cetak. Pastikan pop-up diperbolehkan.');
      return;
    }

    const targetPeriod = `${gajiBulan}-${gajiTahun}`;
    const datePaid = calc.paymentRecord ? calc.paymentRecord.tanggalGajian : new Date().toISOString().substring(0, 10);
    const receiptId = calc.paymentRecord ? calc.paymentRecord.id : 'DRAFT-' + calc.employee.id;

    const rawManager = session.displayName || 'Admin';
    const managerName = rawManager.toLowerCase().includes('spensix') ? 'Nyiur Indah' : rawManager;

    printWindow.document.write(`
      <html>
        <head>
          <title>Slip Gaji - ${calc.employee.nama}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; color: #1e293b; padding: 20px; max-width: 500px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 1.2rem; font-weight: bold; text-transform: uppercase; }
            .meta-table, .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem; }
            .meta-table td { padding: 3px 0; }
            .detail-table th, .detail-table td { padding: 6px 0; text-align: left; }
            .detail-table th { border-bottom: 1px solid #cbd5e1; }
            .total-row { border-top: 1px solid #cbd5e1; font-weight: bold; }
            .footer { text-align: center; border-top: 2px dashed #94a3b8; padding-top: 20px; margin-top: 30px; font-size: 0.8rem; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">SLIP GAJI KARYAWAN</div>
            <div>Nyiur Indah - Sistem Finansial</div>
            <div style="font-size: 0.8rem; margin-top: 5px;">ID Slip: ${receiptId}</div>
          </div>
          
          <table class="meta-table">
            <tr><td style="width: 140px;">Nama Karyawan</td><td>: ${calc.employee.nama}</td></tr>
            <tr><td>Kategori Kerja</td><td>: ${calc.employee.kategori}</td></tr>
            <tr><td>Periode Gaji</td><td>: ${targetPeriod}</td></tr>
            <tr><td>Tanggal Pembayaran</td><td>: ${datePaid}</td></tr>
          </table>

          <table class="detail-table">
            <thead>
              <tr>
                <th>Deskripsi</th>
                <th style="text-align: right;">Jumlah/Rate</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${calc.employee.kategori === 'Harian' ? `
                <tr>
                  <td>Hari Kerja (Hadir)</td>
                  <td style="text-align: right;">${calc.totalHariKerja} Hari</td>
                  <td style="text-align: right;">-</td>
                </tr>
                <tr>
                  <td>Upah Gaji Harian</td>
                  <td style="text-align: right;">${formatRupiah(calc.gajiHarianRate)}/hari</td>
                  <td style="text-align: right;">${formatRupiah(calc.gajiPokok)}</td>
                </tr>
              ` : `
                <tr>
                  <td>Hasil Borongan Produk</td>
                  <td style="text-align: right;">Unit Terhitung</td>
                  <td style="text-align: right;">${formatRupiah(calc.totalBorongan)}</td>
                </tr>
              `}
              <tr class="total-row">
                <td>Gaji Kotor (Bruto)</td>
                <td></td>
                <td style="text-align: right;">${formatRupiah(calc.totalKotor)}</td>
              </tr>
              <tr>
                <td style="color: #ef4444;">Deduction (Potongan Pinjaman)</td>
                <td></td>
                <td style="text-align: right; color: #ef4444;">-${formatRupiah(calc.activeDeduction)}</td>
              </tr>
              <tr class="total-row" style="font-size: 1.1rem; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;">
                <td>Gaji Bersih (Netto)</td>
                <td></td>
                <td style="text-align: right; color: #10b981;">${formatRupiah(calc.totalBersih)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 30px;">
            <p style="font-size: 0.8rem; font-style: italic;">Catatan: ${gajiCatatan[calc.employee.id] || calc.paymentRecord?.catatan || '-'}</p>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 0.9rem;">
            <div style="text-align: center; width: 150px;">
              <div>Penerima,</div>
              <div style="margin-top: 50px; border-bottom: 1px solid #1e293b;">${calc.employee.nama}</div>
            </div>
            <div style="text-align: center; width: 150px;">
              <div>Manajer Keuangan,</div>
              <div style="margin-top: 50px; border-bottom: 1px solid #1e293b;">${managerName}</div>
            </div>
          </div>

          <div class="footer">
            <p>Terima kasih atas kerja keras dan dedikasi Anda!</p>
            <p>Dicetak otomatis oleh Sistem Inventaris & Payroll</p>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" id="karyawan-section">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-12 -translate-y-12 pointer-events-none">
          <Users size={250} />
        </div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-2xl font-extrabold flex items-center gap-3">
            <Users className="text-blue-200" size={28} />
            Sistem Manajemen Karyawan & Payroll
          </h2>
          <p className="text-sm text-blue-100 max-w-xl">
            Sistem terintegrasi untuk mendata kehadiran harian, hasil produksi borongan, kasbon/pinjaman, 
            dan pembayaran gaji bulanan secara terotomatisasi dengan Google Sheets.
          </p>
        </div>

        {/* METRICS HUD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20">
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-blue-200 font-medium">Total Karyawan</div>
            <div className="text-xl font-bold flex items-baseline gap-1 mt-1">
              {karyawanList.length} <span className="text-xs text-blue-300 font-normal">orang</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-blue-200 font-medium">Karyawan Harian</div>
            <div className="text-xl font-bold flex items-baseline gap-1 mt-1">
              {karyawanList.filter(e => e.kategori === 'Harian').length} <span className="text-xs text-blue-300 font-normal font-sans">org</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-blue-200 font-medium">Karyawan Borongan</div>
            <div className="text-xl font-bold flex items-baseline gap-1 mt-1">
              {karyawanList.filter(e => e.kategori === 'Borongan').length} <span className="text-xs text-blue-300 font-normal">org</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-blue-200 font-medium">Total Sisa Kasbon</div>
            <div className="text-xl font-bold mt-1 text-amber-200 font-sans">
              {formatRupiah(pinjamanList.filter(p => p.status === 'Belum Lunas').reduce((sum, i) => sum + i.jumlahPinjaman, 0))}
            </div>
          </div>
        </div>
      </div>

      {/* SUB MENU TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-1">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSubTab('karyawan'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'karyawan'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users size={16} />
            Data Karyawan
          </button>
          <button
            onClick={() => { setSubTab('absensi'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'absensi'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calendar size={16} />
            Absensi Harian
          </button>
          <button
            onClick={() => { setSubTab('borongan'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'borongan'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Package size={16} />
            Produksi Borongan
          </button>
          <button
            onClick={() => { setSubTab('pinjaman'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'pinjaman'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Coins size={16} />
            Kasbon & Pinjaman
          </button>
          <button
            onClick={() => { setSubTab('gaji'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'gaji'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <DollarSign size={16} />
            Sistem Gaji (Bulan)
          </button>
        </div>
        <div className="flex items-center sm:self-center">
          <button
            onClick={() => { setSubTab('produk_borongan'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'produk_borongan'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings size={16} />
            Produk Borongan
          </button>
        </div>
      </div>

      {/* FEEDBACK STATUS */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-500 shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* ACTIVE SUB-TAB INTERFACES */}
      {loading && (
        <div className="flex items-center justify-center p-12 bg-white/50 rounded-2xl border border-slate-100">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="ml-3 text-slate-600 font-semibold text-sm">Menyinkronkan Google Sheets...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          
          {/* 1. DATA KARYAWAN VIEW */}
          {subTab === 'karyawan' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add/Edit Form */}
              <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 self-start">
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  {isEditingEmp ? 'Ubah Data Karyawan' : 'Registrasi Karyawan Baru'}
                </h3>
                <form onSubmit={handleSaveEmployee} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">NAMA KARYAWAN</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap..."
                      value={formEmpNama}
                      onChange={e => setFormEmpNama(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">SISTEM KATEGORI GAJI</label>
                    <select
                      value={formEmpKategori}
                      onChange={e => {
                        const val = e.target.value as KaryawanKategori;
                        setFormEmpKategori(val);
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="Harian">Harian (Diupah per Hari Hadir)</option>
                      <option value="Borongan">Borongan (Diupah per Hasil Produksi)</option>
                    </select>
                  </div>

                  {formEmpKategori === 'Harian' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
                      <label className="text-xs font-bold text-slate-500">NOMINAL GAJI HARIAN (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Misal: 100000"
                        value={formEmpGajiHarian || ''}
                        onChange={e => setFormEmpGajiHarian(Number(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                      />
                      <p className="text-[10px] text-slate-400">Setiap karyawan harian dapat memiliki upah harian yang berbeda-beda.</p>
                    </div>
                  )}

                  {formEmpKategori === 'Borongan' && (
                    <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed animate-in slide-in-from-top-2 duration-150">
                      <strong>Info Karyawan Borongan:</strong> Diupah berdasarkan produk apa saja yang diproduksi setiap hari. Nominal per pcs ditentukan di menu <strong>Katalog</strong> atau dapat disesuaikan pada saat penginputan hasil kerja harian.
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">TANGGAL MASUK</label>
                    <input
                      type="date"
                      required
                      value={formEmpTanggalMasuk}
                      onChange={e => setFormEmpTanggalMasuk(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                    />
                  </div>

                  {isEditingEmp && (
                    <div className="flex items-center gap-3 p-1 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-xs font-bold text-slate-500 pl-3">STATUS AKTIF</span>
                      <button
                        type="button"
                        onClick={() => setFormEmpStatus(!formEmpStatus)}
                        className={`ml-auto px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          formEmpStatus 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {formEmpStatus ? 'Aktif Kerja' : 'Nonaktif/Resign'}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      <Save size={16} />
                      Simpan Karyawan
                    </button>
                    {isEditingEmp && (
                      <button
                        type="button"
                        onClick={resetEmpForm}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Employee List Table */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Database Karyawan</h3>
                    <p className="text-xs text-slate-400">Total terdaftar: {karyawanList.length} orang</p>
                  </div>

                  {/* Search bar */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Cari nama / ID..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {filteredEmployees.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium">
                    Tidak ada data karyawan ditemukan. Silakan tambahkan terlebih dahulu.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                          <th className="py-3 px-2">ID Karyawan</th>
                          <th className="py-3 px-2">Nama</th>
                          <th className="py-3 px-2">Sistem Gaji</th>
                          <th className="py-3 px-2 text-right">Gaji Harian</th>
                          <th className="py-3 px-2 text-center">Status</th>
                          <th className="py-3 px-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredEmployees.map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-2 font-mono text-xs text-slate-500">{emp.id}</td>
                            <td className="py-3.5 px-2 font-semibold text-slate-800">{emp.nama}</td>
                            <td className="py-3.5 px-2">
                              <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-bold ${
                                emp.kategori === 'Harian' 
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                  : 'bg-orange-50 text-orange-700 border border-orange-100'
                              }`}>
                                {emp.kategori}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-right font-sans font-medium text-slate-800">
                              {emp.kategori === 'Harian' ? formatRupiah(emp.gajiHarian) : '-'}
                            </td>
                            <td className="py-3.5 px-2 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                emp.statusAktif 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${emp.statusAktif ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                {emp.statusAktif ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditEmpClick(emp)}
                                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors cursor-pointer"
                                  title="Edit data"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteEmp(emp.id, emp.nama)}
                                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ABSENSI HARIAN VIEW */}
          {subTab === 'absensi' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Mendata Absensi & Kehadiran Karyawan</h3>
                  <p className="text-xs text-slate-400">Pilih tanggal dan centang kehadiran karyawan harian & borongan di bawah ini.</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
                  <Calendar size={18} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase">TANGGAL:</span>
                  <input
                    type="date"
                    required
                    value={absensiTanggal}
                    onChange={e => setAbsensiTanggal(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-slate-800 outline-none border-none focus:ring-0 font-sans"
                  />
                </div>
              </div>

              {activeHarianEmployees.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">
                  Tidak ada karyawan berstatus aktif dengan sistem gaji Harian untuk diabsen.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                          <th className="py-3 px-2">Nama Karyawan</th>
                          <th className="py-3 px-2">Sistem Gaji</th>
                          <th className="py-3 px-2 text-center">Status Kehadiran</th>
                          <th className="py-3 px-2">Keterangan Tambahan / Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {activeHarianEmployees.map(emp => {
                          const currentGrid = absensiGrid[emp.id] || { status: 'Hadir', keterangan: '' };
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-2 font-bold text-slate-800">{emp.nama}</td>
                              <td className="py-4 px-2">
                                <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                                  emp.kategori === 'Harian' 
                                    ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                }`}>
                                  {emp.kategori}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-center">
                                <div className="inline-flex rounded-xl p-1 bg-slate-100 gap-1">
                                  {(['Hadir', 'Hadir 1/2 Hari', 'Tidak Hadir'] as const).map(st => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleGridStatusChange(emp.id, st)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                                        currentGrid.status === st
                                          ? st === 'Hadir' 
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : st === 'Hadir 1/2 Hari'
                                              ? 'bg-amber-500 text-white shadow-sm'
                                              : 'bg-red-600 text-white shadow-sm'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {st}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                <input
                                  type="text"
                                  placeholder="Contoh: Pulang kampung, Demam..."
                                  value={currentGrid.keterangan}
                                  onChange={e => handleGridKeteranganChange(emp.id, e.target.value)}
                                  className="w-full max-w-sm px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleSaveAbsensi}
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all"
                    >
                      <Save size={18} />
                      Simpan Absensi Hari Ini
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. PRODUKSI BORONGAN VIEW */}
          {subTab === 'borongan' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Record Production Entry Form */}
              <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 self-start">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-lg font-bold text-slate-900">Catat Hasil Borongan</h3>
                  <p className="text-xs text-slate-400">Input produk yang diselesaikan hari ini.</p>
                </div>

                <form onSubmit={handleAddProduksi} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">TANGGAL KERJA</label>
                    <input
                      type="date"
                      required
                      value={prodTanggal}
                      onChange={e => setProdTanggal(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">KARYAWAN BORONGAN</label>
                    <select
                      required
                      value={prodEmpId}
                      onChange={e => setProdEmpId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">-- Pilih Karyawan --</option>
                      {activeBoronganEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">PRODUK YANG DIHASILKAN</label>
                    <select
                      required
                      value={prodKodeProduk}
                      onChange={e => handleProdukBoronganSelectChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">-- Pilih Produk Borongan --</option>
                      {produkBoronganList.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.nama} ({formatRupiah(item.nilaiPerPcs)} / pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">JUMLAH (PCS)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={prodJumlah || ''}
                        onChange={e => setProdJumlah(Number(e.target.value) || 1)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">NILAI PER PCS (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        required
                        value={prodNilaiPerPcs || ''}
                        onChange={e => setProdNilaiPerPcs(Number(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                      />
                    </div>
                  </div>

                  {prodJumlah > 0 && prodNilaiPerPcs > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs flex justify-between items-center text-emerald-800">
                      <span className="font-semibold">Subtotal Upah Borongan:</span>
                      <span className="text-sm font-extrabold font-sans">{formatRupiah(prodJumlah * prodNilaiPerPcs)}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    Tambahkan Hasil Borongan
                  </button>
                </form>
              </div>

              {/* Day's Entries */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Catatan Produksi Tanggal: {prodTanggal}</h3>
                    <p className="text-xs text-slate-400">Total entri hari ini: {currentDayProductions.length} transaksi</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400">TOTAL UPAH BORONGAN HARI INI</div>
                    <div className="text-base font-extrabold text-blue-600 font-sans">
                      {formatRupiah(currentDayProductions.reduce((sum, item) => sum + item.totalNilai, 0))}
                    </div>
                  </div>
                </div>

                {currentDayProductions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium">
                    Belum ada hasil produksi borongan dicatat untuk tanggal {prodTanggal}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                          <th className="py-2.5 px-1">Karyawan</th>
                          <th className="py-2.5 px-1">Nama Produk</th>
                          <th className="py-2.5 px-1 text-center">Jumlah</th>
                          <th className="py-2.5 px-1 text-right">Nilai/Pcs</th>
                          <th className="py-2.5 px-1 text-right">Total Upah</th>
                          <th className="py-2.5 px-1 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {currentDayProductions.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-3 px-1 font-bold text-slate-800">{item.namaKaryawan}</td>
                            <td className="py-3 px-1">
                              <div className="text-xs font-mono text-slate-400">{item.kodeProduk}</div>
                              <div className="text-xs font-medium text-slate-700">{item.namaProduk}</div>
                            </td>
                            <td className="py-3 px-1 text-center font-sans">{item.jumlah} pcs</td>
                            <td className="py-3 px-1 text-right font-sans text-xs text-slate-600">{formatRupiah(item.nilaiPerPcs)}</td>
                            <td className="py-3 px-1 text-right font-sans font-semibold text-emerald-600">{formatRupiah(item.totalNilai)}</td>
                            <td className="py-3 px-1 text-center">
                              <button
                                onClick={() => handleDeleteProduksi(item.id, item.namaKaryawan)}
                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. PINJAMAN / KASBON VIEW */}
          {subTab === 'pinjaman' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Loan Entry Form */}
              <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 self-start">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-lg font-bold text-slate-900">Catat Pinjaman Baru (Kasbon)</h3>
                  <p className="text-xs text-slate-400">Pencatatan kasbon karyawan untuk dikurangi saat gajian.</p>
                </div>

                <form onSubmit={handleAddPinjaman} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">TANGGAL PINJAMAN</label>
                    <input
                      type="date"
                      required
                      value={pinjTanggal}
                      onChange={e => setPinjTanggal(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">KARYAWAN</label>
                    <select
                      required
                      value={pinjEmpId}
                      onChange={e => setPinjEmpId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">-- Pilih Karyawan --</option>
                      {activeEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nama} ({emp.kategori}) {loanBalanceByEmployee[emp.id] ? `[Sisa kasbon: ${formatRupiah(loanBalanceByEmployee[emp.id])}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">NOMINAL PINJAMAN (Rp)</label>
                    <input
                      type="number"
                      id="loan-amount-input"
                      min="1"
                      step="1"
                      required
                      placeholder="Masukkan jumlah..."
                      value={pinjJumlah || ''}
                      onChange={e => setPinjJumlah(Number(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans"
                    />
                    <p className="text-[11px] text-slate-400 font-medium">Bisa meminjam dengan nominal berapapun. Sisa pinjaman yang belum lunas otomatis dialihkan ke bulan berikutnya.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">CATATAN / KEPERLUAN</label>
                    <textarea
                      placeholder="Contoh: Keperluan berobat anak, dll..."
                      value={pinjCatatan}
                      onChange={e => setPinjCatatan(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none outline-none transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Coins size={16} />
                    Simpan Kasbon Karyawan
                  </button>
                </form>
              </div>

              {/* Loan Logs & Unpaid balances */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Histori Kasbon & Pinjaman</h3>
                    <p className="text-xs text-slate-400">Daftar transaksi pinjaman uang yang pernah dilakukan karyawan.</p>
                  </div>

                  {/* Search bar */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Cari karyawan..."
                      value={pinjSearch}
                      onChange={e => setPinjSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {filteredLoans.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium">
                    Tidak ada catatan pinjaman terdaftar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                          <th className="py-3 px-2">Tanggal</th>
                          <th className="py-3 px-2">Nama Karyawan</th>
                          <th className="py-3 px-2 text-right">Jumlah</th>
                          <th className="py-3 px-2">Keperluan/Catatan</th>
                          <th className="py-3 px-2 text-center">Status</th>
                          <th className="py-3 px-2 text-center">Ubah / Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredLoans.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-2 font-mono text-xs text-slate-500">{p.tanggal}</td>
                            <td className="py-3.5 px-2 font-bold text-slate-800">{p.namaKaryawan}</td>
                            <td className="py-3.5 px-2 text-right font-sans font-semibold text-slate-800">
                              {formatRupiah(p.jumlahPinjaman)}
                            </td>
                            <td className="py-3.5 px-2 text-xs text-slate-500 italic max-w-[180px] truncate" title={p.catatan}>
                              {p.catatan || '-'}
                            </td>
                            <td className="py-3.5 px-2 text-center">
                              <button
                                onClick={() => handleTogglePinjamanStatus(p.id, p.status, p.namaKaryawan, p.jumlahPinjaman)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer uppercase transition-all ${
                                  p.status === 'Lunas' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                }`}
                              >
                                {p.status === 'Lunas' ? (
                                  <>
                                    <CheckCircle size={10} />
                                    Lunas
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={10} />
                                    Belum Lunas
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 px-2 text-center">
                              <button
                                onClick={() => handleDeletePinjaman(p.id, p.namaKaryawan, p.jumlahPinjaman)}
                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Hapus catatan"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4b. MASTER DAFTAR PRODUK BORONGAN VIEW */}
          {subTab === 'produk_borongan' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Input / Edit */}
              <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 self-start">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-md font-bold text-slate-950">
                    {isEditingPb ? 'Edit Produk Borongan' : 'Tambah Produk Borongan'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kelola daftar produk & nominal upah borongan secara manual.
                  </p>
                </div>

                <form onSubmit={handleSaveProdukBorongan} className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nama Produk:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kaos Polos Hitam XL"
                      value={formPbNama}
                      onChange={(e) => setFormPbNama(e.target.value)}
                      className="w-full text-xs font-semibold py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Upah per Pcs (Rp):</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 5000"
                      value={formPbNilaiPerPcs || ''}
                      onChange={(e) => setFormPbNilaiPerPcs(Number(e.target.value))}
                      className="w-full text-xs font-semibold py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-800"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {isEditingPb ? 'Simpan' : 'Tambah'}
                    </button>
                    {isEditingPb && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormPbId('');
                          setFormPbNama('');
                          setFormPbNilaiPerPcs(0);
                          setIsEditingPb(false);
                        }}
                        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-lg transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Data Table */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                
                {/* Search and Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-md font-bold text-slate-950">Daftar Produk Borongan</h3>
                    <p className="text-xs text-slate-400">Menampilkan {filteredProdukBorongan.length} produk yang dapat dihasilkan oleh karyawan.</p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari produk..."
                      value={pbSearch}
                      onChange={(e) => setPbSearch(e.target.value)}
                      className="pl-9 pr-4 py-1.5 w-full sm:w-60 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 font-medium"
                    />
                  </div>
                </div>

                {filteredProdukBorongan.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500">Tidak ada produk borongan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Silakan tambahkan produk baru melalui formulir di sebelah kiri.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          <th className="px-5 py-3">ID</th>
                          <th className="px-5 py-3">Nama Produk</th>
                          <th className="px-5 py-3 text-right">Nilai Upah per Pcs</th>
                          <th className="px-5 py-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {filteredProdukBorongan.map((pb) => (
                          <tr key={pb.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-[10px] text-slate-400">{pb.id}</td>
                            <td className="px-5 py-3.5 text-slate-900">{pb.nama}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-900">{formatRupiah(pb.nilaiPerPcs)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditProdukBorongan(pb)}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors cursor-pointer"
                                  title="Edit Produk"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteProdukBorongan(pb.id, pb.nama)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors cursor-pointer"
                                  title="Hapus Produk"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. SISTEM GAJI & PAYROLL VIEW */}
          {subTab === 'gaji' && (
            <div className="space-y-6">
              
              {/* Filter Period Box */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Perhitungan Penggajian Bulanan</h3>
                  <p className="text-xs text-slate-400">Sistem otomatis menghitung upah harian & borongan dikurangi sisa kasbon yang aktif.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-slate-400">BULAN:</span>
                    <select
                      value={gajiBulan}
                      onChange={e => {
                        setGajiBulan(e.target.value);
                        setActivePayrollEmpId(null);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none cursor-pointer"
                    >
                      {monthOptions.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-slate-400">TAHUN:</span>
                    <select
                      value={gajiTahun}
                      onChange={e => {
                        setGajiTahun(e.target.value);
                        setActivePayrollEmpId(null);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none cursor-pointer font-sans"
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Payroll Calculator GRID */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Daftar Pembayaran Gaji Periode: {monthOptions.find(m => m.value === gajiBulan)?.label} {gajiTahun}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                        <th className="py-3 px-2">ID & Nama</th>
                        <th className="py-3 px-2">Kategori</th>
                        <th className="py-3 px-2 text-center">Kehadiran / Kerja</th>
                        <th className="py-3 px-2 text-right">Gaji Kotor (Bruto)</th>
                        <th className="py-3 px-2 text-right">Potongan Kasbon</th>
                        <th className="py-3 px-2 text-right">Gaji Bersih (Netto)</th>
                        <th className="py-3 px-2 text-center">Status</th>
                        <th className="py-3 px-2 text-center">Aksi / Cetak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {payrollCalculations.map(calc => {
                        const isCurrentActive = activePayrollEmpId === calc.employee.id;
                        return (
                          <React.Fragment key={calc.employee.id}>
                            <tr className={`hover:bg-slate-50/50 transition-colors ${calc.isPaid ? 'bg-slate-50/30' : ''}`}>
                              <td className="py-4 px-2">
                                <div className="font-extrabold text-slate-800">{calc.employee.nama}</div>
                                <div className="text-[10px] font-mono text-slate-400">{calc.employee.id}</div>
                              </td>
                              <td className="py-4 px-2">
                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                                  calc.employee.kategori === 'Harian' 
                                    ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                }`}>
                                  {calc.employee.kategori}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-center font-medium text-slate-700">
                                {calc.employee.kategori === 'Harian' ? (
                                  <span>{calc.totalHariKerja} Hari Hadir</span>
                                ) : (
                                  <span>Piece-rate Output</span>
                                )}
                              </td>
                              <td className="py-4 px-2 text-right font-sans font-bold text-slate-800">
                                {formatRupiah(calc.totalKotor)}
                              </td>
                              <td className="py-4 px-2 text-right">
                                <span className="font-sans font-semibold text-red-600 block">
                                  -{formatRupiah(calc.activeDeduction)}
                                </span>
                                {calc.totalSisaPinjaman > 0 && (
                                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5 leading-tight">
                                    Sisa Kasbon: {formatRupiah(Math.max(0, calc.totalSisaPinjaman - calc.activeDeduction))}
                                    <br />
                                    <span className="text-amber-600">(dialihkan ke bln depan)</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-2 text-right font-sans font-black text-emerald-600">
                                {formatRupiah(calc.totalBersih)}
                              </td>
                              <td className="py-4 px-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  calc.isPaid 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${calc.isPaid ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                  {calc.isPaid ? 'Terbayar' : 'Draft'}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {!calc.isPaid && (
                                    <button
                                      onClick={() => setActivePayrollEmpId(isCurrentActive ? null : calc.employee.id)}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                    >
                                      Proses / Bayar
                                    </button>
                                  )}
                                  
                                  {calc.isPaid && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-extrabold">Terbayar</span>
                                      <button
                                        onClick={() => handleResetSalary(calc)}
                                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-extrabold rounded-lg cursor-pointer transition-colors border border-red-100"
                                        title="Reset / Batalkan proses pembayaran"
                                      >
                                        Reset Proses
                                      </button>
                                    </div>
                                  )}

                                  <button
                                    onClick={() => handlePrintReceipt(calc)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition-colors"
                                    title="Cetak Slip Gaji"
                                  >
                                    <Printer size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* EXPANSIBLE PROCESS FORM PANEL */}
                            {isCurrentActive && !calc.isPaid && (
                              <tr className="bg-slate-50/50 animate-in fade-in duration-150">
                                <td colSpan={8} className="p-4 border-l-4 border-blue-600 bg-blue-50/10">
                                  <div className="max-w-2xl space-y-4">
                                    <div className="flex items-center gap-2">
                                      <TrendingDown className="text-blue-600" size={18} />
                                      <h4 className="text-sm font-bold text-slate-800">Detail Form Pemotongan Kasbon & Transaksi Gaji</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Input Potongan Pinjaman (Maks: {formatRupiah(calc.totalSisaPinjaman)})</div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <input
                                            type="number"
                                            max={calc.totalSisaPinjaman}
                                            min="0"
                                            value={customPotonganPinjaman[calc.employee.id] !== undefined ? customPotonganPinjaman[calc.employee.id] : calc.recommendedDeduction}
                                            onChange={e => {
                                              const val = Math.min(calc.totalSisaPinjaman, Math.max(0, Number(e.target.value) || 0));
                                              setCustomPotonganPinjaman(prev => ({
                                                ...prev,
                                                [calc.employee.id]: val
                                              }));
                                            }}
                                            className="w-40 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none font-sans"
                                          />
                                          <span className="text-[11px] text-slate-400 font-semibold">dari sisa kasbon {formatRupiah(calc.totalSisaPinjaman)}</span>
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Catatan Pembayaran</div>
                                        <input
                                          type="text"
                                          placeholder="Contoh: Pembayaran gaji + potong kasbon..."
                                          value={gajiCatatan[calc.employee.id] || ''}
                                          onChange={e => setGajiCatatan(prev => ({
                                            ...prev,
                                            [calc.employee.id]: e.target.value
                                          }))}
                                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                                        />
                                      </div>
                                    </div>

                                    {/* CALCULATOR SUMMARY SLATE */}
                                    <div className="p-4 bg-slate-100 rounded-2xl flex flex-wrap justify-between items-center gap-4">
                                      <div className="flex gap-6">
                                        <div>
                                          <div className="text-[10px] font-bold text-slate-400">UPAH KOTOR</div>
                                          <div className="text-sm font-extrabold text-slate-700 font-sans">{formatRupiah(calc.totalKotor)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold text-slate-400">DIPOTONG KASBON</div>
                                          <div className="text-sm font-extrabold text-red-600 font-sans">-{formatRupiah(customPotonganPinjaman[calc.employee.id] !== undefined ? customPotonganPinjaman[calc.employee.id] : calc.recommendedDeduction)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold text-slate-400">UPAH BERSIH DIBAYARKAN</div>
                                          <div className="text-sm font-black text-emerald-600 font-sans">{formatRupiah(calc.totalBersih)}</div>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handlePaySalary(calc)}
                                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                                        >
                                          <Check size={14} />
                                          Bayar Gaji Sekarang
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActivePayrollEmpId(null)}
                                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">{confirmDialog.title}</h3>
            </div>
            
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                Ya, Lanjutkan
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
