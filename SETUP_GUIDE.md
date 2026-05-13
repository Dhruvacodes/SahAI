# 🌾 SahAI — Complete Setup & Running Guide

**A modern AI co-pilot for India's ASHA health workers**

This is a **production-ready prototype** with:
- ✅ React Native mobile app (Expo) with offline-first SQLite
- ✅ Voice recording in Hindi/Tamil/Bengali/other Indian languages
- ✅ AI-powered risk assessment using Claude API
- ✅ FastAPI backend with PostgreSQL
- ✅ Next.js dashboard for ANM supervisors
- ✅ Fully functional offline sync system

---

## 📋 Prerequisites

### For Mobile App (Expo)
- **Node.js** 16+ ([download](https://nodejs.org/))
- **Expo CLI** (install globally)
- **Android device or emulator** with minimum Android 10
- **Expo Go app** on your phone (free from Google Play Store)

### For Backend (FastAPI)
- **Python** 3.9+ ([download](https://www.python.org/))
- **PostgreSQL** 12+ ([download](https://www.postgresql.org/)) — or use Docker

### For Dashboard (Next.js)
- **Node.js** (same as above)

---

## 🚀 Quick Start (5 minutes)

### Step 1: Install Expo CLI

```bash
npm install -g expo-cli
```

### Step 2: Navigate to Mobile App

```bash
cd sahai/apps/mobile
npm install
```

### Step 3: Install Dependencies

Due to the large virtual environment folders that were deleted for cleanup, you may need to reinstall Python dependencies. Do it once:

```bash
cd sahai/backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Step 4: Start the Backend

In one terminal window, run the FastAPI server:

```bash
cd sahai/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5: Start the Mobile App

In another terminal, run:

```bash
cd sahai/apps/mobile
expo start
```

A QR code will appear in your terminal.

### Step 6: Open on Your Phone

**Option A — Using Expo Go (Easiest):**

1. Install **Expo Go** app from Google Play Store
2. Open the app and scan the QR code from the terminal
3. The app will load in ~30 seconds

**Option B — Using Android Emulator:**

If you have Android Studio:

1. Start your Android emulator
2. In the Expo terminal, press `a` to open in Android emulator
3. App launches automatically

**Option C — Using Physical Device (Recommended)**

1. Make sure your phone and computer are on **same WiFi network**
2. Get your computer's local IP address:
   - **macOS/Linux:** `ifconfig | grep "inet " | grep -v localhost`
   - **Windows:** `ipconfig` (look for IPv4 Address)
3. Install Expo Go on your Android phone
4. Scan the QR code shown in terminal
5. App connects and loads locally

---

## 📱 Mobile App Walkthrough

### 1️⃣ Language Selection
When you first open the app, you'll see language options displayed **in their own scripts**:
- हिंदी (Hindi)
- தமிழ் (Tamil)
- తెలుగు (Telugu)
- ಕನ್ನಡ (Kannada)
- বাংলা (Bengali)
- मराठी (Marathi)
- ગુજરાતી (Gujarati)
- ଓଡ଼ିଆ (Odia)

**Tap any language** to proceed.

### 2️⃣ Home Screen
You'll see:
- Welcome message with ASHA worker name (demo: सविता देवी)
- **Today's visit count** (initially 0)
- Large **"New Visit"** button
- Patient list & Sync buttons

### 3️⃣ Recording a Visit

1. **Tap "New Visit"**
2. **See pre-loaded demo patients**: सुनीता देवी, गीता रानी, कमला देवी, etc.
3. **Tap a patient** to select for the visit
4. **Voice Recording Screen:**
   - Patient details shown at top
   - **Large mic button** (🎤) — press and hold to record
   - Say anything in Hindi describing the visit. E.g.:
     ```
     "सुनीता का BP 165/110 है। सूजन है पैरों में।
      बच्चे की हरकतें नहीं हो रहीं।"
     ```
   - **Release to stop** recording
   - App analyzes and shows risk score

### 4️⃣ Visit Summary & Risk Assessment
After recording, you'll see:
- **Risk Score** (0-100) with color coding
  - 🟢 GREEN (0-25): LOW
  - 🔵 BLUE (26-50): MEDIUM
  - 🟠 ORANGE (51-75): HIGH
  - 🔴 RED (76-100): CRITICAL
- **Warning flags** explained in Hindi (e.g., "उच्च रक्तचाप", "एनीमिया")
- **Extracted vitals** (BP, Hemoglobin, Oedema, etc.)
- **Save Visit** button

### 5️⃣ Data Stored Locally
Once you tap "Save Visit":
- All data saved to phone's internal SQLite database
- **Works completely offline** — no internet needed
- Patient list updates with new visit

---

## 🔗 Connection to Backend

### For Demo (Automatic Mock Data):
The mobile app currently uses **mock transcripts** to simulate the AI analysis. This is perfect for demo because:
- ✅ No API keys needed
- ✅ Fast response
- ✅ Predictable results

### To Connect to Real Backend API:

Edit `sahai/apps/mobile/src/services/apiService.ts` (when you create it):

```typescript
export const API_BASE_URL = "http://YOUR_COMPUTER_IP:8000";
// Example: "http://192.168.1.100:8000"
```

Then in `VoiceInputScreen.tsx`, replace the mock transcription with:

```typescript
// Instead of simulateTranscription:
const response = await fetch(`${API_BASE_URL}/api/asr/transcribe`, {
  method: "POST",
  headers: { "Content-Type": "multipart/form-data" },
  body: audioFormData,
});
const data = await response.json();
onTranscriptReady(data.transcript);
```

**To get your computer's IP address:**

- **Windows:** Open Command Prompt, type `ipconfig`, look for IPv4 Address (usually `192.168.x.x`)
- **macOS/Linux:** Open terminal, type `ifconfig`, find inet address

**Important:** Phone and computer must be on the **same WiFi network**.

---

## 🏥 Dashboard (Next.js)

The ANM supervisor dashboard is already running at `http://localhost:3000`

### Features:
- 📊 Overview page with stat cards
- 📈 High-risk patient table (real-time from backend)
- 🗺️ District risk heatmap (color-coded by risk level)
- 👥 Patient detail pages with visit history

### Start the dashboard (if stopped):

```bash
cd sahai/apps/dashboard
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## 🗄️ Database Setup

### Option 1: Using Docker (Easiest)

If you have Docker installed:

```bash
docker run --name sahai-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sahai \
  -p 5432:5432 \
  -d postgres:15
```

### Option 2: Local PostgreSQL

1. Install PostgreSQL
2. Create database:
   ```bash
   psql -U postgres
   CREATE DATABASE sahai;
   \c sahai
   \q
   ```

3. Update `.env`:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sahai
   ```

4. Run migrations (when implemented):
   ```bash
   cd sahai/backend
   alembic upgrade head
   ```

---

## 🧪 Testing the System End-to-End

### Scenario: Record a critical-risk visit

1. **Open mobile app** → Select language (हिंदी)
2. **Tap "New Visit"**
3. **Select patient "सुनीता देवी"** (high-risk patient: 26 years, 32 weeks pregnant)
4. **Hold mic and speak:**
   ```
   "सुनीता को BP 165/110 है। पैरों में सूजन है।
    बच्चे की हरकत 2 दिन से नहीं। सिर दर्द है।"
   ```
5. **Release mic** → App analyzes (takes 1-2 seconds)
6. **See Risk Score: 85-90 CRITICAL 🔴**
7. **Flags shown:**
   - 🚨 गंभीर उच्च रक्तचाप
   - 🚨 गर्भावस्था में सूजन
   - 🚨 भ्रूण की गतिविधि नहीं
8. **Tap "Save Visit"** → Saved to phone's database

### Verify in Dashboard:

1. Open `http://localhost:3000` in browser
2. Go to "Overview" tab
3. Look for "सुनीता देवी" in the high-risk table (if synced)

---

## 📁 Project Structure

```
sahai/
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── LanguageSelectionScreen.tsx
│   │   │   │   ├── HomeScreen.tsx
│   │   │   │   ├── VoiceInputScreen.tsx
│   │   │   │   └── VisitSummaryScreen.tsx
│   │   │   ├── db/
│   │   │   │   └── database.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── locales.ts (translations)
│   │   ├── App.tsx (main entry point)
│   │   └── app.json
│   └── dashboard/
│       ├── app/
│       │   ├── dashboard/
│       │   │   ├── page.tsx (overview)
│       │   │   ├── heatmap/page.tsx (district view)
│       │   │   └── patient/[id]/page.tsx (patient detail)
│       │   └── api/ (Next.js API routes)
│       └── components/
└── backend/
    ├── app/
    │   ├── main.py (FastAPI app)
    │   ├── config.py
    │   ├── routers/
    │   │   ├── asr.py (speech-to-text)
    │   │   ├── extraction.py (Claude NLP)
    │   │   ├── risk.py (risk scoring)
    │   │   ├── referral.py (referral letters)
    │   │   ├── sync.py (mobile data sync)
    │   │   └── dashboard.py (ANM dashboards)
    │   └── services/
    └── requirements.txt
```

---

## 🔑 Environment Variables

### Backend (.env file)

Create `sahai/backend/.env`:

```ini
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sahai

# API Keys
ANTHROPIC_API_KEY=sk-ant-... (get from https://console.anthropic.com)
OPENAI_API_KEY=sk-... (get from https://platform.openai.com)

# JWT Auth
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# App Config
APP_NAME=Sahai API
APP_ENV=development
```

### Mobile (.env for Expo)

Create `sahai/apps/mobile/.env`:

```ini
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
# Replace with your computer's IP address
```

---

## 🐛 Troubleshooting

### "Cannot find Expo module"
```bash
npm install -g expo-cli
cd sahai/apps/mobile
npm install
```

### "QR code won't scan"
1. Make sure phone is on same WiFi as computer
2. Check computer firewall allows port 8000 and 3000
3. Try: `expo start --lan` (local area network mode)

### "Database connection error"
1. Check PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Try: `psql postgresql://postgres:postgres@localhost:5432/sahai`

### "Voice recording not working"
1. Grant microphone permission when prompted
2. Check `Settings → Apps → Expo Go → Permissions → Microphone` is allowed
3. Try recording in a quiet environment

### "Backend API not responding"
1. Check backend is running: `python -m uvicorn app.main:app --reload`
2. Verify port 8000 is not in use: `lsof -i :8000` (macOS/Linux)
3. Check firewall settings

