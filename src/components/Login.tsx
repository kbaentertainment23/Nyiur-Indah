import React, { useState } from 'react';
import { googleSignIn } from '../lib/firebase';
import { UserRole, UserSession } from '../types';
import { ShieldCheck, User as UserIcon, Lock, Database } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession, token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setIsPopupBlocked(false);
    try {
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess({
          role: selectedRole,
          displayName: result.user.displayName || 'Pengguna',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
        }, result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked')) {
        setIsPopupBlocked(true);
      } else {
        setError('Gagal masuk dengan Google. Silakan coba lagi atau periksa izin scope.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 transition-all">
        {/* Title & Brand */}
        <div className="text-center">
          <div className="inline-flex p-3 bg-blue-50 rounded-2xl text-blue-600 mb-4 ring-8 ring-blue-50/50">
            <Database size={40} className="animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Nyiur <span className="text-blue-600">Indah</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Pelacakan Stok Real-time Terintegrasi Google Sheets
          </p>
        </div>

        {/* Role Selector Card */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700 block mb-2">
            Pilih Peran Akses Masuk:
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                selectedRole === 'admin'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-950'
                  : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className={`h-7 w-7 mb-2 ${selectedRole === 'admin' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="font-bold text-sm block">Administrator</span>
              <span className="text-[10px] text-slate-500 mt-1">Akses Penuh & Setelan</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('staff')}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                selectedRole === 'staff'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-950'
                  : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserIcon className={`h-7 w-7 mb-2 ${selectedRole === 'staff' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="font-bold text-sm block">Staf Gudang</span>
              <span className="text-[10px] text-slate-500 mt-1">Kelola & Update Stok</span>
            </button>
          </div>
        </div>

        {/* Informative Text about selected role */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-start space-x-2">
            <Lock size={16} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedRole === 'admin' 
                ? 'Mode Admin mengizinkan Anda untuk mengatur spreadsheet utama, mengubah detail barang, menghapus barang, menyesuaikan ambang batas stok, dan mengunduh laporan bulanan.'
                : 'Mode Staf mengizinkan Anda untuk melihat database inventaris, memperbarui jumlah barang saat ada stok masuk/keluar, dan mengunduh laporan stok bulanan.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {isPopupBlocked && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
            <div className="flex items-start space-x-2">
              <span className="text-xl">⚠️</span>
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-950">Popup Masuk Google Diblokir</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Browser Anda memblokir popup masuk Google karena aplikasi sedang dijalankan di dalam <strong>iframe (sandbox) AI Studio</strong>.
                </p>
              </div>
            </div>
            
            <div className="border-t border-amber-200/50 pt-2.5 space-y-2">
              <p className="text-[10px] font-medium text-amber-900">Silakan pilih salah satu solusi berikut:</p>
              
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full flex items-center justify-center py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm text-xs font-semibold transition-colors cursor-pointer"
                >
                  🌐 Buka di Tab Baru (Disarankan)
                </button>
                <p className="text-[9px] text-amber-700 text-center">
                  Membuka aplikasi di luar iframe agar popup Google Auth dapat terbuka secara normal.
                </p>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-amber-200/50"></div>
                <span className="flex-shrink mx-2 text-[9px] text-amber-600 font-bold uppercase">Atau</span>
                <div className="flex-grow border-t border-amber-200/50"></div>
              </div>

              <div className="text-[10px] text-amber-800 leading-relaxed space-y-1 pl-1">
                <p><strong>Izinkan manual:</strong> Klik ikon popup diblokir di bilah alamat browser Anda (biasanya di sebelah kanan kolom URL), pilih <strong>"Selalu izinkan pop-up..."</strong>, lalu coba masuk kembali.</p>
              </div>
            </div>
          </div>
        )}

        {/* Google Login Button */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-slate-500 font-medium text-sm">Menghubungkan ke Google...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <svg className="h-5 w-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span className="font-semibold text-slate-800">Masuk dengan Akun Google</span>
              </div>
            )}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Aplikasi memerlukan akses ke Google Drive & Sheets Anda untuk menyimpan data inventaris secara mandiri dan aman.
          </p>
        </div>
      </div>
    </div>
  );
}
