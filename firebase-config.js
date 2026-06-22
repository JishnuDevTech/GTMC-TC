/* =========================================================
   FIREBASE CONFIG  —  fill this in with YOUR project's keys
   =========================================================

   How to get these values:
   1. Go to https://console.firebase.google.com
   2. Create a project (or open an existing one)
   3. Click the gear icon → Project settings → scroll to "Your apps"
   4. Click the </> (web) icon to register a web app
   5. Firebase will show you a config object exactly like the one
      below — copy your real values into firebaseConfig here.
   6. In the Firebase console, go to "Firestore Database" → Create
      database → start in PRODUCTION mode (then set rules, see
      README.md) and pick a region close to you (e.g. asia-south1
      for India).

   This file is intentionally separate from app.js so you can swap
   in your real keys without touching any app logic.
*/

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:         "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:          "YOUR_PROJECT_ID",
  storageBucket:      "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId:  "YOUR_SENDER_ID",
  appId:              "YOUR_APP_ID"
};
