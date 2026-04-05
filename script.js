import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjJr9RfRARGbEOucL5-8EU6b-o-dtZxyg",
    authDomain: "ecotrack-a8cc2.firebaseapp.com",
    projectId: "ecotrack-a8cc2",
    databaseURL: "https://ecotrack-a8cc2-default-rtdb.firebaseio.com",
    storageBucket: "ecotrack-a8cc2.firebasestorage.app",
    messagingSenderId: "972183035152",
    appId: "1:972183035152:web:f41f1e1c7d673176f51995"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const sessionId = "session_" + Date.now(); // Unique ID for Firebase

let totalBytes = 0;
let intervalId;

async function updateUI(bytes) {
    try {
        // 1. Fetch calculation from your Node.js Backend (/api/audit.js)
        const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytes: bytes })
        });
        
        const result = await response.json();
        const carbonMg = result.carbonMg; 
        const mb = bytes / (1024 * 1024);

        // 2. Update the Screen
        document.getElementById('data-val').innerText = mb.toFixed(2) + " MB";
        document.getElementById('carbon-val').innerText = carbonMg + " mg CO₂";
        document.getElementById('status-badge').innerText = "System: Active";

        // 3. Sync to Firebase
        set(ref(db, 'live_audit/' + sessionId), {
            mb_transferred: mb.toFixed(2),
            carbon_mg: carbonMg,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error("Vercel Function Error:", err);
        document.getElementById('status-badge').innerText = "System: API Error";
    }
}

function startSimulation() {
    if(intervalId) return;
    document.getElementById('status-badge').innerText = "System: Processing...";
    intervalId = setInterval(() => {
        // Simulating data transfer via image load
        const img = new Image();
        img.src = `https://picsum.photos/200/200?random=${Math.floor(Math.random()*10000)}`;
        img.onload = () => {
            totalBytes += (150 * 1024); // Adding 150KB per load
            updateUI(totalBytes); // Pass the current bytes to the function
        };
    }, 2000);
}

function stopSimulation() {
    clearInterval(intervalId);
    intervalId = null;
    document.getElementById('status-badge').innerText = "System: Standby";
}

document.getElementById("start-btn").onclick = startSimulation;
document.getElementById("stop-btn").onclick = stopSimulation;
