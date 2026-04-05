import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// ============================================================
//  MASTER TOGGLE
//  true  → Simulation mode (fake image loads, demo buttons work)
//  false → Real mode      (PerformanceObserver + PressureObserver)
// ============================================================
const isSimulation = false;

// --- Firebase Setup ---
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
const sessionId = "session_" + Date.now();

let totalBytes = 0;
let intervalId = null;

// ============================================================
//  CORE: Update UI + call backend carbon API + sync Firebase
// ============================================================
async function updateUI(bytes) {
    try {
        const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytes })
        });

        const result = await response.json();
        const carbonMg = parseFloat(result.carbonMg);
        const mb = bytes / (1024 * 1024);

        // --- Update stat cards ---
        document.getElementById('data-val').innerText = mb.toFixed(2) + " MB";
        document.getElementById('carbon-val').innerText = carbonMg.toFixed(2) + " mg";

        // --- Status badge logic ---
        const badge = document.getElementById('status-badge');
        const isCritical = carbonMg > 250;

        badge.innerText = isCritical ? "System: CRITICAL" : "System: Nominal";
        badge.style.background = isCritical ? "#ff4444" : "#00ff88";
        badge.style.color = isCritical ? "white" : "black";

        // --- CPU: simulation shows fake % only in sim mode ---
        if (isSimulation) {
            const cpuEl = document.getElementById('cpu-val');
            if (isCritical) {
                cpuEl.innerText = (Math.floor(Math.random() * 15) + 85) + "%";
                cpuEl.style.color = "#ff4444";
            } else {
                cpuEl.innerText = (Math.floor(Math.random() * 13) + 12) + "%";
                cpuEl.style.color = "white";
            }
        }

        // --- Firebase sync ---
        await set(ref(db, 'live_audit/' + sessionId), {
            mb_transferred: mb.toFixed(2),
            carbon_mg: carbonMg,
            status: isCritical ? "CRITICAL" : "NOMINAL",
            timestamp: Date.now()
        });

    } catch (err) {
        console.error("updateUI error:", err);
    }
}

// ============================================================
//  REAL MODE — PerformanceObserver (network) + PressureObserver (CPU)
//  Only initialised when isSimulation === false
// ============================================================
if (!isSimulation) {
    // -- Real network tracking --
    try {
        const netObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.transferSize > 0) {
                    totalBytes += entry.transferSize;
                    updateUI(totalBytes);
                }
            });
        });
        // buffered:true picks up resources loaded before observer attached
        netObserver.observe({ type: "resource", buffered: true });
    } catch (e) {
        console.warn("PerformanceObserver not supported:", e);
        document.getElementById('data-val').innerText = "Not supported";
    }

    // -- Real CPU pressure tracking --
    if ('PressureObserver' in window) {
        try {
            const cpuObserver = new PressureObserver((records) => {
                const state = records[0].state.toUpperCase(); // nominal | fair | serious | critical
                const cpuEl = document.getElementById('cpu-val');
                cpuEl.innerText = state;
                cpuEl.style.color = (state === 'CRITICAL' || state === 'SERIOUS') ? "#ff4444" : "white";
            });
            cpuObserver.observe("cpu");
        } catch (e) {
            console.warn("PressureObserver failed:", e);
            document.getElementById('cpu-val').innerText = "Unavailable";
        }
    } else {
        document.getElementById('cpu-val').innerText = "Not supported";
    }

    // Hide simulation buttons in real mode
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'none';

    // Set initial badge
    document.getElementById('status-badge').innerText = "System: Live";
}

// ============================================================
//  SIMULATION MODE — only available when isSimulation === true
// ============================================================
function startSimulation() {
    if (!isSimulation) return; // Guard: no-op in real mode
    if (intervalId) return;    // Already running

    document.getElementById('status-badge').innerText = "System: Simulating...";
    document.getElementById('status-badge').style.background = "#00ff88";
    document.getElementById('status-badge').style.color = "black";

    intervalId = setInterval(() => {
        const img = new Image();
        img.src = `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 10000)}&t=${Date.now()}`;
        img.onload = () => {
            totalBytes += 150 * 1024; // ~150 KB per image load
            updateUI(totalBytes);
        };
    }, 2000);
}

function stopSimulation() {
    if (!isSimulation) return; // Guard: no-op in real mode
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;

    document.getElementById('status-badge').innerText = "System: Standby";
    document.getElementById('status-badge').style.background = "#333";
    document.getElementById('status-badge').style.color = "white";
}

// ============================================================
//  Event listeners (buttons are hidden in real mode anyway)
// ============================================================
document.getElementById('start-btn').addEventListener('click', startSimulation);
document.getElementById('stop-btn').addEventListener('click', stopSimulation);
