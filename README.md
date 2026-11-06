# Kitchen Display System (KDS) - Web Frontend (Vue 3 + Vite + Tailwind CSS)

Aplikasi antarmuka dapur (*Kitchen Display System*) berbasis web untuk Restoran Seafood. Aplikasi ini dirancang sangat ringan, responsif untuk layar monitor/tablet dapur, dan bekerja secara *real-time* via **Supabase Realtime (WebSockets)** tanpa membebani server backend.

---

## 🌟 Fitur Utama KDS (Sesuai PRD 3.4 & 4.4)

1. **Tampilan Kartu Pesanan Responsif (`OrderCard.vue`):**
   - Nomor Meja & Nama Pelanggan & Jumlah Tamu (Pax).
   - Waktu pesanan masuk & **Durasi Tunggu Berjalan (*live timer*)**:
     - `< 15 menit`: Status normal (hijau/slate).
     - `15 - 25 menit`: Status perhatian (amber/kuning).
     - `> 25 menit`: Status mendesak (*urgent pulse* merah menyala).
   - Indikator kemajuan masakan (contoh: *2 / 4 item selesai*).

2. **Penanda Khusus Pesanan Susulan (`is_addon = true`):**
   - Ditandai dengan badge mencolok: **`🔥 TAMBAHAN BARU`** beranimasi agar koki langsung menyadari jika tamu memesan menu susulan di tengah proses memasak.

3. **Kontrol Interaktif Status Memasak:**
   - Tombol status per item: **Antrean (`pending`)** $\rightarrow$ **Sedang Dimasak (`cooking`)** $\rightarrow$ **Selesai (`done`)**.
   - Tombol cepat **"Selesaikan Semua"** pada kartu pesanan.

4. **Notifikasi Suara (*Audio Alert* Otomatis):**
   - Menggunakan browser **Web Audio API** sintetis (bebas masalah 404/CORS file MP3).
   - Nada **Chime 2-tone** saat ada order baru.
   - Nada **Alert 3-tone** saat ada menu tambahan susulan (*Add-on*).
   - Nada **Success tone** saat masakan diselesaikan.
   - Dilengkapi tombol Mute/Unmute dan Tes Suara di header.

5. **Supabase Realtime Engine:**
   - Terhubung langsung ke PostgreSQL Supabase via WebSockets (`orders` dan `order_items` channel).
   - Fallback otomatis ke mode polling bila kredensial Supabase belum diisi.

6. **Filter Tab & Pencarian Cepat:**
   - Tab *Semua Aktif*, *Sedang Dimasak*, *Siap Diantar*, dan *Riwayat Selesai*.
   - Input pencarian cepat berdasarkan nama meja, customer, atau nama menu.

---

## 🚀 Panduan Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Konfigurasi Environment (`.env`)
Salin `.env.example` ke `.env`:
```env
# URL Backend NestJS
VITE_API_BASE_URL=http://localhost:3000/api

# Kredensial Supabase (Dapat dilihat di Supabase Dashboard -> Project Settings -> API)
VITE_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-SUPABASE-ANON-KEY]
```

### 3. Jalankan Mode Development
```bash
npm run dev
```
Aplikasi akan berjalan di: `http://localhost:5173`

### 4. Build untuk Production (Vercel Ready)
```bash
npm run build
```
Hasil build ada di folder `dist/` dan siap di-deploy langsung ke Vercel atau hosting statis lainnya.

