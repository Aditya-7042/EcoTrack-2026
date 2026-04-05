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
        const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytes: bytes })
        });
        
        const result = await response.json();
        const carbonMg = parseFloat(result.carbonMg); 
        const mb = bytes / (1024 * 1024);

        // 1. Update the Basic Values
        document.getElementById('data-val').innerText = mb.toFixed(2) + " MB";
        document.getElementById('carbon-val').innerText = carbonMg + " mg CO₂";

        // 2. Logic: System Status & CPU Pressure
        const badge = document.getElementById('status-badge');
        const cpuElement = document.getElementById('cpu-val');
        
        if (carbonMg > 250) {
            // CRITICAL STATE
            badge.innerText = "System: CRITICAL";
            badge.style.background = "#ff4444"; // Red
            badge.style.color = "white";
            
            // Spike CPU to 85-99%
            const spike = Math.floor(Math.random() * 15) + 85;
            cpuElement.innerText = spike + "%";
            cpuElement.style.color = "#ff4444";
        } else {
            // NOMINAL STATE
            badge.innerText = "System: Nominal";
            badge.style.background = "#00ff88"; // Green
            badge.style.color = "black";
            
            // Normal CPU 12-25%
            const normal = Math.floor(Math.random() * 13) + 12;
            cpuElement.innerText = normal + "%";
            cpuElement.style.color = "white";
        }

        // 3. Sync to Firebase
        set(ref(db, 'live_audit/' + sessionId), {
            mb_transferred: mb.toFixed(2),
            carbon_mg: carbonMg,
            status: carbonMg > 250 ? "CRITICAL" : "NOMINAL",
            timestamp: Date.now()
        });

    } catch (err) {
        console.error("Vercel Function Error:", err);
        document.getElementById('status-badge').innerText = "System: OFFLINE";
        document.getElementById('status-badge').style.background = "gray";
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
