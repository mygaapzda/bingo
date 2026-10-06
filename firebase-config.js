// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnbwyRyyI3m1Znbb81pLVc5YTNpYNtH94",
  authDomain: "realtime-database-c180b.firebaseapp.com",
  databaseURL: "https://realtime-database-c180b-default-rtdb.firebaseio.com",
  projectId: "realtime-database-c180b",
  storageBucket: "realtime-database-c180b.firebasestorage.app",
  messagingSenderId: "195993641461",
  appId: "1:195993641461:web:682ee566e8a2ac27e240bc",
  measurementId: "G-K41R1D25HD"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
