import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// ============================================================
//  MASTER TOGGLE
//  false → Real mode (Vercel deployed, PerformanceObserver)
//  true  → Simulation mode (local dev, demo buttons)
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
let auditDone = false; // prevents repeated audit calls in real mode

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

        // --- CPU: fake % only in sim mode ---
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
//  REAL MODE — only runs when isSimulation === false
// ============================================================
if (!isSimulation) {

    // Hide simulation buttons
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'none';

    // Set badge to Live
    const badge = document.getElementById('status-badge');
    badge.innerText = "System: Live";
    badge.style.background = "#00ff88";
    badge.style.color = "black";

    // -- Real CPU pressure tracking --
    if ('PressureObserver' in window) {
        try {
            const cpuObserver = new PressureObserver((records) => {
                const state = records[0].state.toUpperCase();
                const cpuEl = document.getElementById('cpu-val');
                cpuEl.innerText = state;
                cpuEl.style.color = (state === 'CRITICAL' || state === 'SERIOUS')
                    ? "#ff4444"
                    : "white";
            });
            cpuObserver.observe("cpu");
        } catch (e) {
            console.warn("PressureObserver failed:", e);
            document.getElementById('cpu-val').innerText = "Unavailable";
        }
    } else {
        document.getElementById('cpu-val').innerText = "Not supported";
    }

    // -- Wait for page to fully load, then audit ONCE --
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (auditDone) return; // safety guard
            auditDone = true;

            const entries = performance.getEntriesByType("resource");
            entries.forEach((entry) => {
                if (entry.name.includes('/api/audit')) return;
                if (entry.transferSize > 0) {
                    totalBytes += entry.transferSize;
                }
            });

            // Also include the main HTML document itself
            const navEntry = performance.getEntriesByType("navigation")[0];
            if (navEntry && navEntry.transferSize > 0) {
                totalBytes += navEntry.transferSize;
            }

            updateUI(totalBytes);
        }, 1500);
    });
}

// ============================================================
//  SIMULATION MODE — only runs when isSimulation === true
// ============================================================
function startSimulation() {
    if (!isSimulation) return;
    if (intervalId) return;

    const badge = document.getElementById('status-badge');
    badge.innerText = "System: Simulating...";
    badge.style.background = "#00ff88";
    badge.style.color = "black";

    intervalId = setInterval(() => {
        const img = new Image();
        img.src = `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 10000)}&t=${Date.now()}`;
        img.onload = () => {
            totalBytes += 150 * 1024;
            updateUI(totalBytes);
        };
    }, 2000);
}

function stopSimulation() {
    if (!isSimulation) return;
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;

    const badge = document.getElementById('status-badge');
    badge.innerText = "System: Standby";
    badge.style.background = "#333";
    badge.style.color = "white";
}

// ============================================================
//  Button listeners (hidden in real mode anyway)
// ============================================================
document.getElementById('start-btn').addEventListener('click', startSimulation);
document.getElementById('stop-btn').addEventListener('click', stopSimulation);
