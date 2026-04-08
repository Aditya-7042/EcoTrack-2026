import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getDatabase, ref, set, get, push } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// ============================================================
//  MASTER TOGGLE
//  false → Real mode (Vercel deployed)
//  true  → Simulation mode (local dev / demo)
// ============================================================
const isSimulation = false;

// ============================================================
//  Firebase
// ============================================================
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

// Show session ID in header
document.getElementById('session-label').textContent = sessionId.slice(-8);

let totalBytes = 0;
let intervalId = null;
let auditDone = false;
let lastCarbonMg = 0;
let lastMb = 0;

// ============================================================
//  HELPERS
// ============================================================

// Green rating based on carbon
function getGreenRating(carbonMg) {
    if (carbonMg < 10)  return { grade: 'A+', label: 'Excellent', cls: 'rating-a' };
    if (carbonMg < 50)  return { grade: 'A',  label: 'Great',     cls: 'rating-a' };
    if (carbonMg < 100) return { grade: 'B',  label: 'Good',      cls: 'rating-b' };
    if (carbonMg < 200) return { grade: 'C',  label: 'Average',   cls: 'rating-c' };
    if (carbonMg < 300) return { grade: 'D',  label: 'Poor',      cls: 'rating-d' };
    return                     { grade: 'F',  label: 'Critical',  cls: 'rating-f' };
}

// Real-world equivalents
function getEquivalent(carbonMg) {
    const carbonG = carbonMg / 1000;
    if (carbonG < 0.001) return `${(carbonMg * 1000).toFixed(1)} μg CO₂`;
    if (carbonG < 0.1)   return `${(carbonMg).toFixed(2)}mg ≈ LED on ${(carbonMg / 0.5).toFixed(1)}s`;
    if (carbonG < 1)     return `≈ ${(carbonG * 3.7).toFixed(2)}m phone charge`;
    return `≈ ${(carbonG / 120).toFixed(4)}km car drive`;
}

// Format number
function fmt(n) {
    return n >= 1000 ? (n / 1000).toFixed(2) + 'g' : n.toFixed(2) + 'mg';
}

// ============================================================
//  CORE: Update UI + carbon API + Firebase + AI
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

        lastCarbonMg = carbonMg;
        lastMb = mb;

        // ── Stat cards ──
        document.getElementById('data-val').innerText = mb.toFixed(2) + " MB";
        document.getElementById('data-sub').innerText = result.resourceCount
            ? `${result.resourceCount} resources detected`
            : 'Page resources measured';

        document.getElementById('carbon-val').innerText = fmt(carbonMg);
        document.getElementById('carbon-sub').innerText = `CO₂ equivalent · ${new Date().toLocaleTimeString()}`;

        // Green rating
        const rating = getGreenRating(carbonMg);
        const ratingEl = document.getElementById('rating-val');
        ratingEl.innerText = `${rating.grade} — ${rating.label}`;
        ratingEl.className = 'card-value ' + rating.cls;

        // Real world equivalent
        document.getElementById('equiv-val').innerText = getEquivalent(carbonMg);

        // 1000 visits/day
        const dailyG = (carbonMg * 1000) / 1000;
        document.getElementById('visits-val').innerText = fmt(carbonMg * 1000);
        document.getElementById('card-visits').querySelector('.card-sub').innerText =
            `= ${(dailyG / 1000).toFixed(4)}kg CO₂/day`;

        // ── Status badge ──
        const badge = document.getElementById('status-badge');
        const isCritical = carbonMg > 250;
        if (isCritical) {
            badge.innerText = '● CRITICAL';
            badge.className = 'critical';
            document.getElementById('card-carbon').classList.add('critical-card');
            document.getElementById('card-carbon').classList.remove('accent');
        } else {
            badge.innerText = isSimulation ? '● SIMULATING' : '● LIVE';
            badge.className = '';
            document.getElementById('card-carbon').classList.add('accent');
            document.getElementById('card-carbon').classList.remove('critical-card');
        }

        // ── CPU in sim mode ──
        if (isSimulation) {
            const cpuEl = document.getElementById('cpu-val');
            cpuEl.innerText = isCritical
                ? (Math.floor(Math.random() * 15) + 85) + "%"
                : (Math.floor(Math.random() * 13) + 12) + "%";
            cpuEl.style.color = isCritical ? 'var(--red)' : 'var(--text)';
        }

        // ── Firebase sync + history ──
        const historyRef = ref(db, 'history/' + sessionId);
        await push(historyRef, {
            mb_transferred: mb.toFixed(3),
            carbon_mg: carbonMg,
            rating: rating.grade,
            timestamp: Date.now()
        });

        await set(ref(db, 'live_audit/' + sessionId), {
            mb_transferred: mb.toFixed(2),
            carbon_mg: carbonMg,
            rating: rating.grade,
            status: isCritical ? "CRITICAL" : "NOMINAL",
            timestamp: Date.now()
        });

        // ── Load history graph ──
        loadHistory();

        // ── Trigger AI Advisor (once per real-mode audit) ──
        if (!isSimulation || isCritical) {
            runAIAdvisor(mb, carbonMg, rating.grade);
        }

    } catch (err) {
        console.error("updateUI error:", err);
    }
}

// ============================================================
//  HISTORY GRAPH
// ============================================================
async function loadHistory() {
    try {
        const snap = await get(ref(db, 'history/' + sessionId));
        if (!snap.exists()) return;

        const data = [];
        snap.forEach(child => {
            data.push({
                carbon: child.val().carbon_mg,
                time: child.val().timestamp
            });
        });

        document.getElementById('history-count').textContent = `${data.length} sessions recorded`;

        if (data.length < 1) return;
        document.getElementById('graph-empty').style.display = 'none';

        drawHistoryChart(data);
    } catch (e) {
        console.warn('History load error:', e);
    }
}

function drawHistoryChart(data) {
    const canvas = document.getElementById('history-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = 120 * dpr;
    canvas.style.height = '120px';
    ctx.scale(dpr, dpr);

    const W = canvas.offsetWidth || 800;
    const H = 120;
    const pad = { top: 10, bottom: 24, left: 40, right: 16 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const vals = data.map(d => d.carbon);
    const maxVal = Math.max(...vals, 1);
    const minVal = Math.min(...vals, 0);

    // Grid lines
    ctx.strokeStyle = 'rgba(26,37,53,0.8)';
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
        const y = pad.top + chartH * (1 - f);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();

        // Y label
        ctx.fillStyle = '#3a5068';
        ctx.font = `${9 * dpr / dpr}px Space Mono, monospace`;
        ctx.textAlign = 'right';
        ctx.fillText((minVal + (maxVal - minVal) * f).toFixed(1), pad.left - 4, y + 3);
    });

    if (data.length === 1) {
        // Single dot
        const x = pad.left + chartW / 2;
        const y = pad.top + chartH / 2;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
        return;
    }

    // Line
    const stepX = chartW / (data.length - 1);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, 'rgba(0,255,136,0.25)');
    grad.addColorStop(1, 'rgba(0,255,136,0)');

    ctx.beginPath();
    data.forEach((d, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + chartH - ((d.carbon - minVal) / (maxVal - minVal || 1)) * chartH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // Close path for fill
    ctx.lineTo(pad.left + (data.length - 1) * stepX, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    data.forEach((d, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + chartH - ((d.carbon - minVal) / (maxVal - minVal || 1)) * chartH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + chartH - ((d.carbon - minVal) / (maxVal - minVal || 1)) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
        ctx.strokeStyle = '#030508';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // X time labels
    ctx.fillStyle = '#3a5068';
    ctx.font = `9px Space Mono, monospace`;
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(data.length / 5);
    data.forEach((d, i) => {
        if (i % labelStep === 0 || i === data.length - 1) {
            const x = pad.left + i * stepX;
            const t = new Date(d.time);
            ctx.fillText(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, H - 4);
        }
    });
}

// ============================================================
//  AI ADVISOR — calls Claude via Anthropic API
// ============================================================
async function runAIAdvisor(mb, carbonMg, rating) {
    const box = document.getElementById('ai-advisor-box');

    // Show loading state
    box.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
            <span>AI analysing your carbon data...</span>
        </div>`;

    const prompt = `You are EcoTrack's AI Carbon Advisor. A web page has just been audited with these results:
- Data transferred: ${mb.toFixed(2)} MB
- Carbon impact: ${carbonMg.toFixed(2)} mg CO₂
- Green rating: ${rating}
- Page URL context: EcoTrack dashboard (uses Firebase SDK, vanilla JS, CSS)

Give a concise, specific carbon analysis in 3 short paragraphs:
1. What the numbers mean in plain English
2. The most likely causes of emissions on this type of page
3. Top 3 actionable tips to reduce carbon

Use ** for bold terms. Keep it technical but readable. Max 150 words total.`;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const text = data.content?.map(b => b.text || '').join('') || 'No response from AI.';

        // Render AI response
        const formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .split('\n')
            .filter(l => l.trim())
            .map(l => `<p>${l}</p>`)
            .join('');

        box.innerHTML = `
            <div class="ai-response">
                <div class="ai-header">⬡ AI Analysis — ${new Date().toLocaleTimeString()}</div>
                ${formatted}
            </div>`;
    } catch (err) {
        console.error('AI Advisor error:', err);
        box.innerHTML = `<div class="ai-placeholder"><div class="ai-pulse"></div><p>AI unavailable — check API connection.</p></div>`;
    }
}

// ============================================================
//  AI CHAT
// ============================================================
const chatHistory = [];

window.sendChat = async function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    await processChat(msg);
};

window.sendSuggestion = async function(msg) {
    await processChat(msg);
};

// Allow Enter key to send
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.sendChat();
});

async function processChat(userMsg) {
    const log = document.getElementById('chat-log');

    // User message
    const userEl = document.createElement('div');
    userEl.className = 'chat-msg user';
    userEl.textContent = userMsg;
    log.appendChild(userEl);

    // Thinking indicator
    const thinkEl = document.createElement('div');
    thinkEl.className = 'chat-msg thinking';
    thinkEl.textContent = '⬡ AI thinking...';
    log.appendChild(thinkEl);
    log.scrollTop = log.scrollHeight;

    // Build context-aware system prompt
    const systemPrompt = `You are EcoTrack's AI assistant specializing in web carbon emissions and sustainable web development.
Current page audit data:
- Data transferred: ${lastMb.toFixed(2)} MB
- Carbon impact: ${lastCarbonMg.toFixed(2)} mg CO₂
- Green rating: ${getGreenRating(lastCarbonMg).grade}
- Session: ${sessionId}

Answer concisely (2-4 sentences max). Use ** for bold. Be specific and technical when helpful.`;

    chatHistory.push({ role: "user", content: userMsg });

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                system: systemPrompt,
                messages: chatHistory
            })
        });

        const data = await response.json();
        const aiText = data.content?.map(b => b.text || '').join('') || 'Sorry, I could not respond.';

        chatHistory.push({ role: "assistant", content: aiText });

        // Remove thinking
        log.removeChild(thinkEl);

        // AI message
        const aiEl = document.createElement('div');
        aiEl.className = 'chat-msg ai';
        aiEl.innerHTML = aiText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        log.appendChild(aiEl);
        log.scrollTop = log.scrollHeight;

    } catch (err) {
        log.removeChild(thinkEl);
        const errEl = document.createElement('div');
        errEl.className = 'chat-msg ai';
        errEl.textContent = 'AI unavailable — check your connection.';
        log.appendChild(errEl);
        console.error('Chat error:', err);
    }
}

// ============================================================
//  REAL MODE
// ============================================================
if (!isSimulation) {

    document.getElementById('sim-controls').style.display = 'none';

    // CPU pressure
    if ('PressureObserver' in window) {
        try {
            const cpuObserver = new PressureObserver((records) => {
                const state = records[0].state.toUpperCase();
                const cpuEl = document.getElementById('cpu-val');
                cpuEl.innerText = state;
                cpuEl.style.color = (state === 'CRITICAL' || state === 'SERIOUS')
                    ? 'var(--red)' : 'var(--text)';
                document.getElementById('cpu-sub').innerText =
                    state === 'NOMINAL' ? 'Hardware running normally' :
                    state === 'FAIR'    ? 'Moderate CPU load' :
                    state === 'SERIOUS' ? 'High CPU load detected' :
                    'Critical CPU pressure!';
            });
            cpuObserver.observe("cpu");
        } catch (e) {
            document.getElementById('cpu-val').innerText = "Unavailable";
            document.getElementById('cpu-sub').innerText = "PressureObserver failed";
        }
    } else {
        document.getElementById('cpu-val').innerText = "Not supported";
        document.getElementById('cpu-sub').innerText = "Browser limitation";
    }

    // Audit once on page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (auditDone) return;
            auditDone = true;

            const entries = performance.getEntriesByType("resource");
            let resourceCount = 0;
            entries.forEach((entry) => {
                if (entry.name.includes('/api/audit')) return;
                const size = entry.transferSize > 0
                    ? entry.transferSize
                    : entry.decodedBodySize;
                if (size > 0) { totalBytes += size; resourceCount++; }
            });

            // Include HTML document itself
            const navEntry = performance.getEntriesByType("navigation")[0];
            if (navEntry) {
                const navSize = navEntry.transferSize > 0
                    ? navEntry.transferSize
                    : navEntry.decodedBodySize;
                if (navSize > 0) totalBytes += navSize;
            }

            updateUI(totalBytes);
        }, 1500);
    });
}

// ============================================================
//  SIMULATION MODE
// ============================================================
function startSimulation() {
    if (!isSimulation || intervalId) return;

    document.getElementById('status-badge').innerText = '● SIMULATING';
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
    if (!isSimulation || !intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    document.getElementById('status-badge').innerText = '● STANDBY';
    document.getElementById('status-badge').className = '';
}

document.getElementById('start-btn').addEventListener('click', startSimulation);
document.getElementById('stop-btn').addEventListener('click', stopSimulation);

// Resize charts on window resize
window.addEventListener('resize', () => loadHistory());
