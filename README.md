# Bloomlyn Bot 🤖

Automated vendor scraping, AI-powered product compositing, and Telegram bot store pipeline.

## 🚀 Features
- **Scraper**: Listens to vendor channels using GramJS (MTProto).
- **AI Pipeline**:
  - Classifies products into categories (Bags, Necklaces, etc.).
  - Extracts price and description from messy captions.
  - **AI Compositor**: Places product images into professional, styled scenes using Gemini 2.0.
- **Store Bot**: Customer-facing Telegram bot for browsing and ordering.
- **Firestore DB**: Real-time inventory and user management.

## 🛠 Setup

### 1. Prerequisites
- Node.js >= 18.0.0
- A Firebase project with Firestore enabled.
- Telegram API ID and Hash (from [my.telegram.org](https://my.telegram.org)).
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/)).

### 2. Configuration
Copy `.env.example` to `.env` and fill in the details:
```bash
cp .env.example .env
```

### 3. Firebase Authentication
Place your service account key in `legacy/service-account-key.json`.

### 4. Telegram Scraper Session
To run in production (Railway), you need a persistent session string:
1. Run the bot locally once: `npm run dev`.
2. Follow the login prompts in your terminal.
3. Copy the "Session string" printed in the console.
4. Paste it into your `TELEGRAM_SESSION_STRING` in `.env`.

### 5. Deployment (Railway)
The project is pre-configured for Railway:
- `railway.json`: Configured for Node.js runtime.
- Environment variables: Ensure all variables from `.env` are added to your Railway project settings.

## 🏗 Industrial Standards & Production Readiness

This project follows modern development practices:
- **ESM Modules**: Uses native JavaScript modules (`import/export`).
- **In-Memory Queueing**: Handles AI rate limits and sequential processing.
- **Fail-safe Logic**: AI failures fall back to rule-based classification/extraction.
- **Environment Driven**: All sensitive and configurable data is moved out of code.

## 📄 License
MIT