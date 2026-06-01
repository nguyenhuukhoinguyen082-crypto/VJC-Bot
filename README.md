# PTFS Airline Panel

A high-performance, configurable virtual airline management system designed for PTFS (Pilot Training Flight Simulator) and other flight simulation communities. Built with Next.js 15, FastAPI, and PostgreSQL.

---

## Key Features

- Robust Economy: Earn virtual currency (VND) via Discord /work commands, gambling, and engagement. Spend it on flight bookings.
- Flight Operations: Real-time booking system, interactive seatmaps, and live flight tracking.
- Integrated Discord Bot: Full-featured bot for moderation, economy, and automated inflight voice announcements (gTTS).
- Analytics Dashboard: Detailed reports on registrations, revenue, and user activity for staff.
- Dynamic Branding: Change your airline name, logos, colors, and social links instantly via branding.json.
- Scalable Backend: Powered by PostgreSQL for reliable data management and SQLAlchemy for performance.

---

## Technical Stack

- Frontend: Next.js 15 (App Router), Tailwind CSS, Framer Motion, TanStack Query.
- Backend: FastAPI (Python 3.10+), SQLAlchemy ORM, PostgreSQL.
- Bot: Disnake (Discord API wrapper).
- Authentication: JWT with secure HTTP-only cookies and CSRF protection.

---

## Installation and Local Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 20+
- PostgreSQL 14+
- Discord Bot Token (from Discord Developer Portal)

### 2. Database Setup
1. Create a new PostgreSQL database (example: airline_panel).
2. The schema will be automatically generated on the first run.

### 3. Backend Configuration
1. Navigate to backend/.
2. Copy .env.example to .env.
3. Fill in the required variables:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/airline_panel
   SECRET_KEY=your_very_long_random_secret_key
   API_KEY=your_internal_api_key_for_bot_communication
   BOT_TOKEN=your_discord_bot_token
   GUILD_ID=your_discord_server_id
   ```
4. Install dependencies: pip install -r requirements.txt

### 4. Frontend Configuration
1. Navigate to frontend/.
2. Copy .env.example to .env.local.
3. Set the API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Install dependencies: npm install

### 5. Running the Application
- Start Backend and Bot: From the backend/ folder, run python start.py.
- Start Frontend: From the frontend/ folder, run npm run dev.

---

## Hosting Guide

### Frontend (Vercel/Netlify)
1. Push the frontend/ directory to GitHub.
2. Connect your repository to Vercel.
3. Set the Environment Variables (NEXT_PUBLIC_API_URL) in the Vercel dashboard.
4. Deploy.

### Backend and Bot (Render/Railway/VPS)
1. Database: Use a managed service like Render PostgreSQL or Aiven.
2. Web Service: Deploy the backend/ folder as a Python web service.
   - Start Command: python api.py (or use Gunicorn/Uvicorn for production).
3. Background Worker: You may need a separate worker process to run the Discord bot (python bot/main.py).
4. Environment: Ensure all .env variables are added to your hosting provider dashboard.

---

## Customization

All airline-specific identity is stored in config/branding.json. You can modify:
- airline: Name, Short Name, Description.
- colors: Main theme colors used by both Web and Bot.
- logos: URLs for Main Logo, Icon, and Bot Avatar.
- links: Website, Discord Invite, and social media.

---

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

- Attribution: You must give credit to the original creator (anh.).
- Non-Commercial: You may NOT use this project for commercial purposes or monetary gain.
- ShareAlike: If you modify the code, you must distribute your contributions under the same license.

---

Created for the PTFS community.
