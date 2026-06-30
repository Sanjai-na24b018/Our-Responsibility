# Our Responsibility 🦸‍♂️🏙️

Our Responsibility is an AI-powered civic engagement platform that empowers citizens to report, track, and resolve local infrastructural issues (like potholes, broken streetlights, and water leaks). By leveraging Google's Gemini AI, the platform automatically validates reports, assesses severity, and categorizes issues to streamline resolution for local authorities.

## 🚀 Key Features

* **🤖 AI-Powered Validation:** Uses Gemini API to analyze issue descriptions, validating categories, severity, and assessing potential risks.
* **🗺️ Interactive Map View:** See exactly where issues are happening in your community via an interactive Leaflet map.
* **⬆️ Community Upvoting:** Users can upvote pressing issues. High-priority items get automated escalation options.
* **🎮 Gamification & Badges:** Earn points for reporting and resolving issues. Rank up from "Observer" to "Civic Legend" and earn unique badges.
* **📧 One-Click Escalation:** Generates AI-drafted emails to easily escalate long-standing or critical issues to local authorities.
* **🔒 Secure Authentication:** Login securely using Google via Firebase Authentication.
* **⚡ Real-Time Updates:** Issues and points are synced in real-time across the community using Firebase Firestore.

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Leaflet (React-Leaflet), Lucide Icons
* **Backend:** Node.js, Express
* **Database & Auth:** Firebase Firestore, Firebase Authentication
* **AI Integration:** Google Gemini API (`@google/genai`)

## 📋 Prerequisites

Before you begin, ensure you have met the following requirements:
* Node.js (v18 or higher)
* A Firebase Project (with Firestore and Authentication enabled)
* A Google Gemini API Key

## ⚙️ Environment Variables

Create a `.env` file in the root directory and add the following variables. (See `.env.example` for reference).

```env
# Server-side Secrets (Do NOT expose to the client)
GEMINI_API_KEY="your_gemini_api_key_here"

# Note: Firebase configuration is handled via firebase-applet-config.json
```

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/our-responsibility.git
   cd our-responsibility
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   Ensure your Firebase configuration values (apiKey, authDomain, projectId, etc.) are present in `firebase-applet-config.json` in the root directory.

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will run on `http://localhost:3000`.

5. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📝 License
This project is licensed under the MIT License.
