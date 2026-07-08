import React, { useEffect, useState } from 'react';
import { listSpreadsheets, createInventorySpreadsheet } from '../lib/googleApi';
import { SpreadsheetInfo, UserSession } from '../types';
import { FileSpreadsheet, PlusCircle, Search, LogOut, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

interface SpreadsheetSelectorProps {
  session: UserSession;
  token: string;
  onSelect: (sheet: SpreadsheetInfo) => void;
  onLogout: () => void;
}

export default function SpreadsheetSelector({ session, token, onSelect, onLogout }: SpreadsheetSelectorProps) {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [search, setSearch] = useState('');
  const [newSheetName, setNewSheetName] = useState('Database Inventaris Barang');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await listSpreadsheets(token);
      setSpreadsheets(list);
    } catch (err: any) {
      console.error(err);
      setError('Gagal memuat daftar spreadsheet dari Google Drive Anda. Pastikan koneksi internet stabil.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, [token]);

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetName.trim()) return;
    
    setLoadingCreate(true);
    setError(null);
    try {
      const newSheet = await createInventorySpreadsheet(token, newSheetName.trim());
      onSelect(newSheet);
    } catch (err: any) {
      console.error(err);
      setError('Gagal membuat spreadsheet baru di Google Drive. Periksa kuota Drive atau coba lagi.');
    } finally {
      setLoadingCreate(false);
    }
  };

  const filteredSheets = spreadsheets.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header Info */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {session.photoURL ? (
              <img src={session.photoURL} alt="User" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                {session.displayName[0]}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">{session.displayName}</p>
              <p className="text-xs text-slate-400 font-medium">Akses: <span className="font-bold text-blue-600 uppercase">{session.role}</span></p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors cursor-pointer bg-slate-50 hover:bg-red-50 py-2 px-3 rounded-lg border border-slate-200 hover:border-red-100"
          >
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Intro */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-sans">
            Pilih Database Inventaris
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Tentukan spreadsheet yang ingin digunakan sebagai database utama untuk menyimpan data barang.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create New Sheet Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 text-blue-600">
              <PlusCircle size={24} />
              <h3 className="font-bold text-slate-800">Buat Database Baru</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Membuat spreadsheet baru secara otomatis di folder utama Google Drive Anda yang sudah terformat dengan kolom Kode, Nama, Jumlah, Harga Satuan, Foto Barang, dan Ambang Batas.
            </p>
            <form onSubmit={handleCreateSheet} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Spreadsheet:</label>
                <input
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="e.g. Database Inventaris Gudang"
                  disabled={loadingCreate}
                  required
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                />
              </div>
              <button
                type="submit"
                disabled={loadingCreate || !newSheetName.trim()}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingCreate ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sedang Membuat...</span>
                  </>
                ) : (
                  <>
                    <span>Buat & Gunakan</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Select Existing Sheet Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-[400px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-blue-600">
                  <FileSpreadsheet size={24} />
                  <h3 className="font-bold text-slate-800">Gunakan Spreadsheet Ada</h3>
                </div>
                <button
                  onClick={fetchSheets}
                  disabled={loadingList}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Refresh Daftar"
                >
                  <RefreshCw size={14} className={loadingList ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pilih spreadsheet yang sudah ada di Drive Anda. Jika spreadsheet belum terformat, kami akan secara otomatis membaca dan menyesuaikan nama kolom yang sesuai.
              </p>

              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari spreadsheet..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl mt-3 p-1 space-y-2 max-h-[180px]">
              {loadingList ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-8">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span className="text-xs text-slate-400">Memindai Google Drive...</span>
                </div>
              ) : filteredSheets.length === 0 ? (
                <div className="h-full flex items-center justify-center py-8 text-center">
                  <p className="text-xs text-slate-400 font-medium">
                    {spreadsheets.length === 0 
                      ? 'Tidak ditemukan spreadsheet di Drive.' 
                      : 'Spreadsheet tidak cocok dengan pencarian.'}
                  </p>
                </div>
              ) : (
                filteredSheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    onClick={() => onSelect(sheet)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileSpreadsheet className="text-blue-600 shrink-0" size={16} />
                      <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-950">{sheet.name}</span>
                    </div>
                    <ArrowRight size={12} className="text-slate-300 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-4 text-center text-[10px] text-slate-400 border-t border-slate-200 bg-white">
        &copy; 2026 InvenSync Pro. Semua data tersimpan aman secara privat di Google Drive Anda.
      </footer>
    </div>
  );
}
