# Trolley Maintenance - MySQL Database Setup

## 📋 Deskripsi
Database MySQL untuk sistem Trolley Maintenance yang sebelumnya menggunakan Supabase.

## 🚀 Cara Instalasi

### 1. Prasyarat
- **XAMPP** atau **WAMP** terinstal dan berjalan
- **PHP 7.4+** dengan PDO MySQL extension
- **MySQL 5.7+** atau **MariaDB 10.3+**

### 2. Import Database ke phpMyAdmin

1. Buka browser dan akses: **http://localhost/phpmyadmin**
2. Klik tab **Import** di menu atas
3. Pilih file: `database/trolley_data.sql`
4. Klik tombol **Go** untuk mengeksekusi

Atau via command line:
```bash
mysql -u root -p < database/trolley_data.sql
```

### 3. Deploy API ke Local Server

**Untuk XAMPP:**
```bash
# Copy folder api ke htdocs
xcopy /E /I api C:\xampp\htdocs\trolley-api
```

**Untuk WAMP:**
```bash
# Copy folder api ke www
xcopy /E /I api C:\wamp64\www\trolley-api
```

### 4. Konfigurasi Database

Edit file `api/config/database.php` sesuai environment Anda:

```php
define('DB_HOST', 'localhost');       // Host database
define('DB_NAME', 'trolley_data'); // Nama database
define('DB_USER', 'root');            // Username MySQL
define('DB_PASS', '');                // Password MySQL
define('DB_PORT', 3306);              // Port MySQL
```

### 5. Test Koneksi

Akses di browser:
```
http://localhost/trolley-api/health.php
```

Response sukses:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2026-02-03T10:56:01+07:00"
  }
}
```

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/maintenance.php` | Ambil semua records |
| GET | `/maintenance.php?id=xxx` | Ambil satu record |
| GET | `/maintenance.php?start=xxx&end=xxx` | Ambil by date range |
| POST | `/maintenance.php` | Buat record baru |
| POST | `/maintenance.php` (batch) | Import batch records |
| PUT | `/maintenance.php?id=xxx` | Update record |
| DELETE | `/maintenance.php?id=xxx` | Hapus satu record |
| DELETE | `/maintenance.php?date=xxx` | Hapus records by date |
| DELETE | `/maintenance.php` | Hapus semua records |

## 📊 Struktur Tabel

### maintenance_records
| Field | Type | Deskripsi |
|-------|------|-----------|
| id | VARCHAR(50) | Primary key |
| no | INT | Nomor urut |
| part_no | VARCHAR(100) | Part number |
| serial | VARCHAR(100) | Serial number |
| type | ENUM | FULL / HALF |
| remark_* | BOOLEAN | Status remarks |
| from_location | VARCHAR(100) | Asal lokasi |
| delivery | VARCHAR(100) | Tujuan |
| input_type | ENUM | IN/OUT/REP/COD |
| status | ENUM | SERVICEABLE/UNSERVICEABLE |
| maintenance_date | DATE | Tanggal maintenance |
| created_at | TIMESTAMP | Waktu dibuat |
| updated_at | TIMESTAMP | Waktu update |

## 📁 Struktur File

```
TROLLEY/
├── api/
│   ├── config/
│   │   └── database.php    # Konfigurasi koneksi
│   ├── health.php          # Health check endpoint
│   └── maintenance.php     # CRUD API endpoint
└── database/
    └── trolley_maintenance.sql  # SQL schema
```

## ⚠️ Troubleshooting

### Error: Connection refused
- Pastikan Apache dan MySQL di XAMPP/WAMP sudah running

### Error: Access denied for user
- Cek username dan password di `database.php`

### Error: Unknown database
- Import dulu file `trolley_maintenance.sql` ke phpMyAdmin
