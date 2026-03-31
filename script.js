// --- 1. GLOBAL VARIABLES ---
const KWH_PER_GB = 0.06;      
const CARBON_INTENSITY = 475; 
let totalBytes = 0;

// --- 2. THE IMPROVED AUDITOR ENGINE ---
function initAuditor() {
    // Check history (Catch CSS/JS/HTML already loaded)
    performance.getEntriesByType('resource').forEach(entry => {
        // Fix: Some browsers report 0 for transferSize on localhost
        // so we check encodedBodySize and decodedBodySize as well
        const size = entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
        totalBytes += size;
    });

    // Listen for new movement (Images, Fetch calls, etc.)
    const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
            const size = entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
            if (size > 0) {
                totalBytes += size;
                updateDisplay(); 
            }
        });
    });
    
    observer.observe({ type: 'resource', buffered: true });
    updateDisplay(); // Initial UI update
}

// --- 3. THE UI UPDATE LOGIC ---
function updateDisplay() {
    // Convert Bytes to MB
    const mb = totalBytes / (1024 * 1024);
    const dataDisplay = document.getElementById('data-val');
    
    if (dataDisplay) {
        dataDisplay.innerText = `${mb.toFixed(2)} MB`;
    }

    // Carbon Calculation
    const gb = totalBytes / (1024 * 1024 * 1024);
    const carbonMg = gb * KWH_PER_GB * CARBON_INTENSITY * 1000;
    
    const carbonDisplay = document.getElementById('carbon-val');
    if (carbonDisplay) {
        carbonDisplay.innerText = `${carbonMg.toFixed(2)} mg CO₂`;
    }
}

// --- 4. CPU MONITOR (Compute Pressure) ---
if ('PressureObserver' in window) {
    const pressureObserver = new PressureObserver((changes) => {
        const latest = changes[0];
        const cpuDisplay = document.getElementById('cpu-val');
        if (cpuDisplay) cpuDisplay.innerText = latest.state.toUpperCase();
        
        const badge = document.getElementById('status-badge');
        if (badge) badge.style.color = latest.state === 'critical' ? '#ff4444' : '#00ff88';
    });
    pressureObserver.observe('cpu');
}

// --- 5. EXECUTION ---
initAuditor();

// --- 6. AUTO-TEST (Forces movement after 1.5 seconds) ---
setTimeout(() => {
    console.log("Running auto-test fetch...");
    fetch('https://jsonplaceholder.typicode.com/photos?_limit=20')
        .then(() => console.log("Test data fetched! Check the UI."));
}, 1500);