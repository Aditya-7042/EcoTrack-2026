import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

  const firebaseConfig = {
    apiKey: "AIzaSyCjJr9RfRARGbEOucL5-8EU6b-o-dtZxyg",
    authDomain: "ecotrack-a8cc2.firebaseapp.com",
    projectId: "ecotrack-a8cc2",
    storageBucket: "ecotrack-a8cc2.firebasestorage.app",
    messagingSenderId: "972183035152",
    appId: "1:972183035152:web:f41f1e1c7d673176f51995",
    measurementId: "G-W282276SN8"
  };

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const db = getDatabase(app);
  const dbRef = ref(db, "ecoData");

  let totalBytes = 0;
  let carbonMg = 0;
  const KWH_PER_GB = 0.06;      
  const CARBON_INTENSITY = 475; 
  let intervalId;

  function resetUI() {
      totalBytes = 0;
      carbonMg = 0;
      document.getElementById('data-val').innerText = '0.00 MB';
      document.getElementById('carbon-val').innerText = '0.00 mg CO₂';
  }
  resetUI();

  function updateDisplay() {
      const mb = totalBytes / (1024 * 1024);
      const gb = totalBytes / (1024 * 1024 * 1024);
      carbonMg = gb * KWH_PER_GB * CARBON_INTENSITY * 1000;

      document.getElementById('data-val').innerText = `${mb.toFixed(2)} MB`;
      document.getElementById('carbon-val').innerText = `${carbonMg.toFixed(2)} mg CO₂`;

      set(dbRef, { totalBytes: totalBytes, carbonImpact: carbonMg });
  }

  function startSimulation() {
      if(intervalId) return;
      intervalId = setInterval(() => {
          const img = new Image();
          img.src = `https://picsum.photos/200/200?random=${Math.floor(Math.random()*10000)}&t=${Date.now()}`;
          img.onload = () => {
              totalBytes += 50*100 * 3; 
              updateDisplay();
          };
      }, 1000);
  }

  function stopSimulation() {
      clearInterval(intervalId);
      intervalId = null;
  }

  document.getElementById("start-btn").onclick = startSimulation;
  document.getElementById("stop-btn").onclick = stopSimulation;
