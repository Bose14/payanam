# 🏍️ RideSync — Motorcycle Group Riding Platform

> **"Plan group bike rides, discover scenic stops, navigate together, track riding formation live on one map, detect rider separations/deviations, coordinate stops with glove-friendly controls, and communicate through the ride."**

---

## 🏗️ System Architecture

```
 ┌──────────────────────────────────────────────────────────────┐
 │             RideSync Web Cockpit Simulator (Port 3000)       │
 │   • High-Contrast Dark Motorcycle Cockpit Theme              │
 │   • Interactive Leaflet Map with CartoDB Dark Matter         │
 │   • Glove-Friendly Quick Actions (☕ Tea, ⛽ Fuel, 🚨 SOS)    │
 │   • Live Phone OTP Authentication & Account Switcher         │
 └──────────────────────────────┬───────────────────────────────┘
                                │ HTTP REST API (CORS Enabled)
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │             RideSync Backend Server (Port 5000)              │
 │   • Node 24 Native SQLite Database Engine (DatabaseSync)     │
 │   • Zero-Dependency Local Relational Database                │
 │   • Web Database Admin Studio (/db-admin)                    │
 │   • Dual-Mode: Instant Local SQLite / Supabase PostgreSQL    │
 └──────────────────────────────┬───────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     📁 server/ridesync.db     │       │    ☁️ Supabase Cloud Postgres  │
│  (Active Local Database File) │       │   (PostgreSQL 15 + PostGIS)   │
│  • profiles                   │       │   • 20261006000000_schema.sql │
│  • rides                      │       │   • 20261006000001_seed.sql   │
│  • ride_members               │       │   • Full Row Level Security   │
│  • waypoints                  │       │   • Realtime Broadcast/Websock│
│  • ride_pins & ride_messages  │       └───────────────────────────────┘
│  • otp_verifications          │
└───────────────────────────────┘
```

---

## 📦 Project Structure

```
ridesync/
├── web_app/                                # Interactive Cockpit Frontend
│   ├── index.html                          # Responsive mobile frame & desktop simulator UI
│   ├── style.css                           # High-contrast cockpit styling & glove touch targets
│   ├── app.js                              # Main application coordinator & telemetry engine
│   ├── auth.js                             # Phone number + 6-digit OTP verification & SMS toast
│   ├── db.js                               # Universal Database API client (Local DB & Supabase)
│   └── maps.js                             # Multi-layer tiles (Carto Dark, OSM, Satellite), OSRM & Photon
│
├── server/                                 # Backend REST API & Local Database Server
│   ├── server.js                           # Node 24 SQLite server & REST endpoints
│   ├── ridesync.db                         # Physical SQLite relational database file
│   ├── config.json                         # Database driver & credentials configuration
│   └── .env.example                        # Environment configuration template
│
├── supabase/
│   └── migrations/
│       ├── 20261006000000_ridesync_schema.sql # PostgreSQL 15 + PostGIS + RLS + Triggers
│       └── 20261006000001_seed_accounts.sql   # Pre-seeded rider accounts and default rides
│
├── flutter_ridesync/                       # Production Clean Architecture Flutter App
│   ├── pubspec.yaml                        # Dependencies (Supabase, Maps, Geolocator, BLoC)
│   └── lib/
│       ├── core/                           # Constants, themes, and GeoMath corridor algorithms
│       └── features/                       # Real-time telemetry, separation detector, deviation engine
│
└── README.md
```

---

## ⚡ Quickstart Guide

### 1. Start the Local Backend & Database Server (Port 5000)
The backend uses Node 24's native zero-dependency SQLite engine:
```bash
node server/server.js
```
* **REST API:** `http://localhost:5000/api`
* **Web Database Studio:** `http://localhost:5000/db-admin`
* **Physical Database File:** `server/ridesync.db`

### 2. Start the Web Frontend (Port 3000)
```bash
npx serve web_app -l 3000
```
Open **[http://localhost:3000](http://localhost:3000)** in any web browser.

---

## 🗄️ Database Management & Inspection

### A. Web Database Studio *(Zero-Install)*
Navigate to **[http://localhost:5000/db-admin](http://localhost:5000/db-admin)** to view:
* Real-time table browser with live row counters (`profiles`, `rides`, `ride_members`, `waypoints`, `ride_pins`, `ride_messages`, `otp_verifications`).
* Interactive SQL Query Runner with instant tabular data rendering.

### B. In-App Table Viewer
Click **`🗄️ View SQLite Tables (ridesync.db)`** on the right side panel in the web app.

### C. IDE Extension (VS Code / Antigravity IDE)
1. Open Extensions (`Ctrl + Shift + X`) and search for **`SQLite Viewer`** (by Florian Klampfer / qwtel).
2. Click on [`server/ridesync.db`](file:///c:/Users/asbos/.gemini/antigravity-ide/scratch/ridesync/server/ridesync.db) to inspect and edit tables visually inside the editor.

---

## 📱 Pre-Seeded Rider Accounts (Phone & OTP)

You can log in manually using OTP verification or click any 1-tap test rider account:

| Rider Name | Phone Number | Motorcycle | Role | Blood Group | Emergency Contact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bose** | `+91 98765 43210` | KTM 390 Adventure | Lead / Navigator | `O+ve` | Vikram (Brother) `+91 98765 00001` |
| **Arun** | `+91 98765 43211` | BMW G310 GS | Sweeper | `B+ve` | Pooja (Wife) `+91 98765 00002` |
| **Karthi** | `+91 98765 43212` | RE Hunter 350 | Rider | `A+ve` | Suresh (Father) `+91 98765 00003` |
| **Vicky** | `+91 98765 43213` | Scrambler 400X | Rider | `AB+ve` | Dinesh (Friend) `+91 98765 00004` |
| **Priya** | `+91 98765 43214` | Ninja 300 | Rider | `O-ve` | Meera (Mother) `+91 98765 00005` |

* **OTP Code:** When requesting an OTP, a simulated SMS notification banner will pop up with a 1-tap **Auto-fill** button (or enter `123456`).
* **New Rider Signups:** Entering any new phone number automatically opens the rider onboarding form.

---

## 🗺️ Map Data & Road Routing

1. **Map Tile Providers**:
   * **CartoDB Dark Matter** *(Default)*: High-contrast night/sunlight visibility for motorcycle cockpits.
   * **OpenStreetMap Standard**: Traditional street view.
   * **Stadia Alidade Smooth Dark**: High-definition vector dark style.
   * **Satellite Hybrid (ESRI)**: Photorealistic terrain imagery.
2. **OSRM (Open Source Routing Machine)**:
   * Dynamically computes real highway and ghat turn-by-turn road geometry and driving distance between waypoints.
3. **Photon & Nominatim Live Geocoding**:
   * Instant search for petrol pumps, tea halts, hotels, viewpoints, and landmarks.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Check server and database status with live table row counts |
| `POST` | `/api/db/query` | Execute raw SQL query against `ridesync.db` |
| `POST` | `/api/auth/request-otp` | Generate and store 6-digit OTP in `otp_verifications` |
| `POST` | `/api/auth/verify-otp` | Verify OTP code and authenticate rider |
| `GET` | `/api/profiles` | Fetch all rider profiles |
| `POST` | `/api/profiles` | Create or update rider profile |
| `GET` | `/api/rides` | Fetch all active and completed rides with stops and members |
| `POST` | `/api/rides` | Create a new group ride |
| `PUT` | `/api/rides/:id` | Update ride name, date, time, distance, or status |
| `POST` | `/api/rides/join` | Join ride lobby using 6-character ride code (e.g. `KODAI26`) |
| `POST` | `/api/rides/:id/waypoints` | Update/reorder waypoints for a ride |
| `POST` | `/api/rides/:id/pins` | Drop live map pin (☕ Tea, ⛽ Fuel, 🍴 Food, 📸 Photo, 🚨 SOS) |
| `POST` | `/api/rides/:id/messages` | Send in-ride group chat message |

---

## ☁️ Switching to Live Cloud Supabase / PostgreSQL

To switch the backend to a remote Supabase or PostgreSQL database:

1. Update [`server/config.json`](file:///c:/Users/asbos/.gemini/antigravity-ide/scratch/ridesync/server/config.json):
   ```json
   {
     "dbDriver": "supabase-postgres",
     "supabaseUrl": "https://your-project.supabase.co",
     "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
     "postgresUrl": "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"
   }
   ```
2. Execute the migrations in the Supabase SQL Editor:
   * [`supabase/migrations/20261006000000_ridesync_schema.sql`](file:///c:/Users/asbos/.gemini/antigravity-ide/scratch/ridesync/supabase/migrations/20261006000000_ridesync_schema.sql)
   * [`supabase/migrations/20261006000001_seed_accounts.sql`](file:///c:/Users/asbos/.gemini/antigravity-ide/scratch/ridesync/supabase/migrations/20261006000001_seed_accounts.sql)

---

## 📱 Running the Flutter Mobile App

If you have the **Flutter SDK** installed:
```bash
cd flutter_ridesync
flutter pub get
flutter run
```
* Supports Android, iOS, Chrome (Web), and Windows desktop builds.

---

## 📄 License
MIT License &copy; 2026 RideSync Platform
