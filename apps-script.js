// ==============================================================================
// GOOGLE APPS SCRIPT WEB APP - DATABASE BACKEND FOR INVENTARIS APP
// ==============================================================================
// 
// Cara Pemasangan & Hubungkan:
// 
// 1. Buka Google Sheets yang ingin digunakan sebagai database utama.
// 2. Pada menu atas, klik "Extensions" (Ekstensi) > "Apps Script".
// 3. Hapus kode default yang ada (jika ada), lalu paste seluruh kode di bawah ini.
// 4. Klik ikon Simpan (Save) di bagian atas editor.
// 5. Klik tombol "Deploy" di kanan atas > "New deployment" (Terapkan baru).
// 6. Klik ikon gir (pilih jenis penerapan) > pilih "Web app" (Aplikasi Web).
// 7. Isi konfigurasi berikut:
//    - Description: Database Inventaris Backend
//    - Execute as: "Me" (Saya / email Anda)
//    - Who has access: "Anyone" (Siapa saja / Umum)  <-- PENTING! Agar aplikasi React bisa mengakses tanpa hambatan popup
// 8. Klik "Deploy". Google akan meminta izin akses (Authorize Access) akun Anda.
//    - Klik "Authorize Access", pilih email Anda.
//    - Klik "Advanced" (Lanjutan) > Klik "Go to Untitled project (unsafe)" / "Buka project (tidak aman)".
//    - Klik "Allow" (Izinkan).
// 9. Salin URL Aplikasi Web yang diberikan (Web app URL), formatnya:
//    https://script.google.com/macros/s/XXXXX/exec
// 10. Buka aplikasi React Anda, lalu di Header Dashboard Admin, klik "Hubungkan Database / Google Sheets"
//     dan paste URL tersebut. Selesai! Sistem Anda langsung terhubung secara real-time ke Google Sheets!
// 
// ==============================================================================

const SPREADSHEET_ID = ""; // Kosongkan untuk menggunakan spreadsheet aktif tempat script ini ditempel.

function getActiveSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Handle HTTP GET Requests (Read All Data)
 */
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

/**
 * Handle HTTP POST Requests (Save Data & Image Upload)
 */
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

/**
 * Membaca semua sheet secara batch dan mengembalikan data dalam format JSON
 */
function handleReadAll() {
  try {
    const ss = getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const db = {};
    
    // Pemetaan nama sheet di Google Sheets ke key database di React App
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
    
    // Auto-create missing sheets dengan header standar jika belum ada
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
    
    // Inisialisasi lembar kerja yang belum ada
    Object.keys(requiredSheets).forEach(sheetName => {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(requiredSheets[sheetName]);
      }
    });

    // Membaca ulang seluruh data lembar kerja
    const updatedSheets = ss.getSheets();
    updatedSheets.forEach(sheet => {
      const name = sheet.getName();
      const lowerName = name.toLowerCase().replace(/\s/g, "");
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

/**
 * Menyimpan data lembar kerja secara utuh (Overwrite / Clear & Write)
 */
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

/**
 * Unggah gambar dari React langsung ke Google Drive dan return URL sharing publiknya
 */
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
