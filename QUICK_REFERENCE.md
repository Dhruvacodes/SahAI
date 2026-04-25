# 🚀 SahAI Quick Reference

## Commands to Run Everything

### Terminal 1: Backend
```bash
cd sahai/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
→ Backend runs at `http://localhost:8000`

### Terminal 2: Mobile App
```bash
cd sahai/apps/mobile
npm install
expo start
```
→ Scan QR code with Expo Go app

### Terminal 3: Dashboard
```bash
cd sahai/apps/dashboard
npm install
npm run dev
```
→ Dashboard at `http://localhost:3000`

---

## 📱 Mobile App: What to Try

### First Time Users
1. **Select हिंदी** (or any language you see)
2. **Tap "New Visit"**
3. **Hold mic button** and speak any of these:
   ```
   "सुनीता का BP 165/110 है। सूजन है। बच्चे की हरकत नहीं।"
   "रीना को बुखार है 39 डिग्री। सिर दर्द और कमजोरी।"
   "गीता बिल्कुल ठीक है। BP 120/80। खा रही ठीक से।"
   ```
4. **Release mic** → See Risk Score
5. **Tap "Save Visit"** → Saved to phone

### Pre-loaded Demo Patients
- **सुनीता देवी** - Age 26, 32 weeks pregnant (CRITICAL risk)
- **गीता रानी** - Age 19, 28 weeks pregnant (HIGH risk)
- **कमला देवी** - Age 38, 36 weeks pregnant (HIGH risk)
- **रीना कुमारी** - Age 24, 20 weeks pregnant (MEDIUM risk)
- **सविता सिंह** - Age 30, 16 weeks pregnant (LOW risk)

---

## 🖥️ Dashboard: What to See

### Overview (http://localhost:3000/dashboard)
- Stat cards (visits today, critical cases, etc.)
- High-risk patient table
- Patient details on click

### District Heatmap (http://localhost:3000/dashboard/heatmap)
- Blocks sorted by risk level
- Color-coded by dominance (CRITICAL=red, HIGH=orange, etc.)
- Sortable columns

---

## 🔧 Configuration

### Add API Keys
Edit `sahai/backend/.env`:
```ini
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

Get them from:
- [Anthropic Console](https://console.anthropic.com)
- [OpenAI Platform](https://platform.openai.com)

### Connect From Different Network
Edit `sahai/apps/mobile/.env`:
```ini
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8000
```

Replace `YOUR_COMPUTER_IP` with:
- **Windows:** `ipconfig` → IPv4 Address
- **Mac/Linux:** `ifconfig` → inet address

---

## 📱 Mobile App: Feature Breakdown

### Home Screen
- Welcome message
- Today's visit count
- Critical/High case alerts
- Quick action buttons

### Voice Recording Screen
- Patient details
- 🎤 Large mic button (press & hold)
- Waveform visualization
- Status: "Recording..." → "Analyzing..." → "Done ✓"

### Risk Summary
- Risk score (0-100) with color
- Warning flags in Hindi
- Extracted vitals (BP, Hb, etc.)
- "Save Visit" button

---

## 🖥️ Dashboard: Features

### Stat Cards
```
[Total Visits]  [Critical Cases]  [High Risk]  [Avg Score]
```

### Patient Table
```
Name | Village | Risk Level | Score | Last Visit | Top Warning | Action
```

### Heatmap
```
Block Name | Avg Score (bar) | Critical | High | Risk Level | Top Village
```

---

## 🧠 Under the Hood

### Mobile App (React Native)
- **Language Selection:** Displays 8+ languages in native script
- **Voice Recording:** Uses `expo-av` for audio
- **Risk Scoring:** Pure JavaScript rules (no ML)
- **SQLite:** All data stored locally
- **Mock Data:** Simulates backend responses for demo

### Backend (FastAPI)
- **ASR:** Whisper API for Hindi/Tamil/etc.
- **NLP:** Claude API for vitals extraction
- **Risk Engine:** Rule-based scoring (if BP >= 160, +40 points, etc.)
- **Referral Generation:** Claude writes referral letters
- **Sync:** REST endpoints for mobile uploads
- **Dashboard:** APIs for overview & heatmap

### Dashboard (Next.js)
- **SWR:** Real-time data fetching
- **Tailwind:** Responsive styling
- **Client Components:** React hooks for interactivity
- **API Routes:** Backend proxy endpoints

---

## 📊 Sample Risk Calculations

### Scenario 1: Critical
```
BP: 165/110         → +40 points
Oedema + Pregnant   → +20 points
Absent Fetal Mvmt   → +35 points
─────────────────────────────────
Total Score: 95 (CRITICAL) 🔴
```

### Scenario 2: High
```
BP: 145/95          → +25 points
Hemoglobin 8.5      → +12 points
─────────────────────────────────
Total Score: 37 (MEDIUM-HIGH) 🟠
```

### Scenario 3: Low
```
BP: 120/80          → 0 points
No symptoms         → 0 points
─────────────────────────────────
Total Score: 0 (LOW) 🟢
```

---

## 🔗 API Quick Test

### Using curl:

**Test Extraction:**
```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"transcript": "सुनीता का BP 165/110 है"}'
```

**Test Risk:**
```bash
curl -X POST http://localhost:8000/api/risk/score \
  -H "Content-Type: application/json" \
  -d '{
    "vitals": {"bloodPressureSystolic": 165, "bloodPressureDiastolic": 110},
    "patient": {"is_pregnant": true, "gestational_week": 32, "age_years": 26}
  }'
```

---

## 🎬 Demo Script (2 Minutes)

1. **Open mobile app** (Expo Go)
   - "This is SahAI - voice AI for health workers"

2. **Select language**
   - "Languages appear in native script"

3. **Tap New Visit**
   - "Choose a patient from the list"

4. **Record voice**
   - Hold mic: "सुनीता का BP 165/110 है। गर्भावस्था में सूजन है।"
   - Show waveform animation

5. **Show risk assessment**
   - "Score: 89, CRITICAL"
   - "Flags: Severe hypertension, Oedema, Absent fetal movements"

6. **Save visit**
   - "All data saved to phone - works offline"

7. **Open dashboard**
   - "Supervisors see this automatically"
   - "Red heatmap shows रामपुर block has HIGH risk concentration"

---

## ⚡ Performance Tips

### Mobile App
- First install may take 1-2 minutes (Expo setup)
- Subsequent launches < 3 seconds
- Voice recording is real-time
- Risk score appears in < 1 second

### Backend
- First request warm up Anthropic API (5-10s)
- Subsequent requests < 2 seconds
- Database queries < 100ms

### Dashboard
- First load: SWR fetches from `/api/dashboard/summary`
- Refreshes every 30 seconds
- Sorting/filtering is instant (client-side)

---

## 🆘 If Something Breaks

### Cold start all
```bash
# Terminal 1
ps aux | grep uvicorn | grep -v grep | awk '{print $2}' | xargs kill -9
cd sahai/backend
python -m uvicorn app.main:app --reload

# Terminal 2
cd sahai/apps/mobile
expo start

# Terminal 3
cd sahai/apps/dashboard
npm run dev
```

### Clear everything and restart
```bash
# Backend
cd sahai/backend
rm -rf __pycache__ .pytest_cache

# Mobile
cd sahai/apps/mobile
rm -rf node_modules .expo
npm install

# Dashboard
cd sahai/apps/dashboard
rm -rf .next node_modules
npm install
```

---

## 📞 Quick Support

| Issue | Solution |
|-------|----------|
| QR code won't scan | Same WiFi? Try `expo start --lan` |
| Backend not responding | Is port 8000 free? Kill other process |
| Mobile app won't load | `expo cache clean` then restart |
| Database error | Is PostgreSQL running? Check `.env` |
| Dashboard blank | Check browser console, hard refresh |
| Voice not recording | Granted microphone permission? |

---

**Ready to demo? Start with [SETUP_GUIDE.md](./SETUP_GUIDE.md)!** 🚀
