# 🛒 Trolley Maintenance System

Sistem manajemen maintenance trolley berbasis web dengan React + Supabase.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, REST API)
- **UI Components:** Radix UI, Material UI, Lucide Icons

## Fitur

- 📊 Dashboard analytics dengan chart interaktif
- 📝 Form input maintenance (CRUD)
- 📁 Import/Export Excel
- 📷 Barcode scanner
- 🔐 Multi-user authentication (Admin & Operator)
- 📜 History log tracking
- 📱 Responsive design

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/ramadhoniwicaksono/trolleyacs.git
cd trolleyacs
npm install
```

### 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** → jalankan isi file `database/supabase_schema.sql`
3. Copy **Project URL** dan **Anon Key** dari Settings → API

### 3. Environment Variables

Copy `.env.example` menjadi `.env` dan isi dengan credentials Supabase:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Jalankan

```bash
npm run dev
```

## Database Schema

- `maintenance_records` — Data maintenance trolley
- `trolley_history_logs` — History log perubahan data
- `users` — Data user untuk autentikasi

## License

Private project.