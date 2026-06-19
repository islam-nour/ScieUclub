import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAGYvKom-rfUY0kA3vH3K1HKxgRQwiIvY",
  authDomain: "scieuclub-3183e.firebaseapp.com",
  projectId: "scieuclub-3183e",
  storageBucket: "scieuclub-3183e.firebasestorage.app",
  messagingSenderId: "73005112650",
  appId: "1:73005112650:web:d01ccdb4f6b56ba8d235b3",
  measurementId: "G-6SNW8DB8S7"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  addDoc,
  app,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  updateDoc
};
