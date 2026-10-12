# 🎬 Tamildhool Clone with Serverless API

A modern, responsive clone of **Tamildhool** for streaming Tamil TV serials and reality shows. Built to run seamlessly on **localhost** and deploy directly to **Vercel** with serverless API functions.

---

## 🚀 Quick Start (Localhost)

1. Navigate to the project folder:
   ```bash
   cd tamildhool-clone
   ```
2. Install dependencies (already installed):
   ```bash
   npm install
   ```
3. Start the local server:
   ```bash
   npm start
   ```
4. Open in browser:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📡 API Endpoints (Vercel Serverless Compatible)

All API endpoints are located in `/api` and return clean JSON with CORS enabled:

| Endpoint | Method | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/api/channels` | `GET` | - | Returns all TV channels (Vijay TV, Sun TV, Zee Tamil, etc.) and stats |
| `/api/shows` | `GET` | `channel`, `id`, `search` | Returns show listings or show details with episode archive |
| `/api/episodes` | `GET` | `channel`, `show`, `date`, `limit`, `page` | Returns latest daily episodes with pagination |
| `/api/episode` | `GET` | `id` *(required)* | Returns single episode data, multi-server playback URLs, related episodes, next/prev episode IDs |
| `/api/search` | `GET` | `q` *(required)* | Fast search across shows and episodes |

### Example API Requests:
- **All Channels:** `http://localhost:3000/api/channels`
- **Vijay TV Shows:** `http://localhost:3000/api/shows?channel=vijay-tv`
- **Latest Episodes:** `http://localhost:3000/api/episodes?limit=10`
- **Single Episode:** `http://localhost:3000/api/episode?id=siragadikka-aasai-ep-520`
- **Instant Search:** `http://localhost:3000/api/search?q=siragadikka`

---

## ⚡ Features

1. **Tamildhool UI & Navigation:**
   - Channel filter tabs (All, Vijay TV, Sun TV, Zee Tamil, Colors Tamil, Reality Shows).
   - "Today's Serials" and "Popular Shows" sections.
   - Quick search modal with instant search suggestions.
2. **Multi-Server Video Player:**
   - Switch between **Server 1 (Primary HD)**, **Server 2 (1080p)**, **Server 3 (Alternate Embed)**, and **Server 4 (HLS Direct)**.
   - Cinema Light Mode (Lights OFF/ON).
   - Previous Episode and Next Episode one-click navigation buttons.
3. **Show Details Archive:**
   - Dedicated page for every serial showing total episodes, timing, synopsis, and past episode archives.
4. **Vercel Zero-Config:**
   - Ready with `vercel.json` and standard serverless routing.

---

## ☁️ How to Deploy to Vercel

When you are ready to publish:
1. Push to your GitHub repository (or deploy directly via Vercel CLI).
2. On [Vercel Dashboard](https://vercel.com):
   - Import your GitHub repository.
   - Set the Root Directory to `tamildhool-clone` (or deploy from root if separate).
   - Click **Deploy**.
3. Vercel automatically deploys the `/public` static files and creates Serverless Functions for all files inside `/api`.
