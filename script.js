import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// ============================================================
//  MASTER TOGGLE
//  true  ? Simulation mode (fake image loads, demo buttons work)
//  false ? Real mode      (PerformanceObserver + PressureObserver)
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
let carbonData = [];
let timestamps = [];

// Chart setup
const ctx = document.getElementById('carbonChart').getContext('2d');
const carbonChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: timestamps,
        datasets: [{
            label: 'Carbon Impact (mg CO2)',
            data: carbonData,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// AI Chat
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

function addMessage(message, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = isUser ? 'user-message' : 'ai-message';
    msgDiv.textContent = message;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getAIResponse(userMessage, carbonMg) {
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes('high') || lowerMsg.includes('reduce')) {
        if (carbonMg > 250) {
            return "Your carbon impact is high. Consider optimizing network usage, using energy-efficient devices, or reducing data transfer.";
        } else {
            return "Your carbon impact is within acceptable limits. Keep monitoring and aim for sustainable practices.";
        }
    }
    if (lowerMsg.includes('cpu')) {
        return "CPU pressure affects energy consumption. High pressure indicates potential optimization opportunities.";
    }
    return "I'm here to help with your carbon footprint insights. Ask me about reducing emissions or understanding your data!";
}

sendBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        addMessage(message, true);
        const carbonMg = parseFloat(document.getElementById('carbon-val').textContent);
        const response = getAIResponse(message, carbonMg);
        setTimeout(() => addMessage(response), 500);
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

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
        document.getElementById('carbon-val').innerText = carbonMg.toFixed(2) + " mg CO2";

        // --- Update chart ---
        const now = new Date().toLocaleTimeString();
        timestamps.push(now);
        carbonData.push(carbonMg);
        if (timestamps.length > 20) {
            timestamps.shift();
            carbonData.shift();
        }
        carbonChart.update();

        // --- Status badge logic ---
        const badge = document.getElementById('status-badge');
        const isCritical = carbonMg > 250;

        badge.innerText = isCritical ? "System: CRITICAL" : "System: Nominal";
        badge.style.background = isCritical ? "#ff6b6b" : "#00ff88";
        badge.style.color = isCritical ? "white" : "black";

        // --- CPU: simulation shows fake % only in sim mode ---
        if (isSimulation) {
            const cpuEl = document.getElementById('cpu-val');
            if (isCritical) {
                cpuEl.innerText = (Math.floor(Math.random() * 15) + 85) + "%";
                cpuEl.style.color = "#ff6b6b";
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
//  REAL MODE � PerformanceObserver (network) + PressureObserver (CPU)
//  Only initialised when isSimulation === false
// ============================================================
if (!isSimulation) {
    // -- Real network tracking --
    try {
    let debounceTimer = null;

    const netObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
            if (entry.name.includes('/api/audit')) return;
            if (entry.transferSize > 0) {
                totalBytes += entry.transferSize;
            }
        });

        // Wait 1 second after last resource before calling API
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateUI(totalBytes);
        }, 1000);
    });
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
                cpuEl.style.color = (state === 'CRITICAL' || state === 'SERIOUS') ? "#ff6b6b" : "white";
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
//  SIMULATION MODE � only available when isSimulation === true
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
