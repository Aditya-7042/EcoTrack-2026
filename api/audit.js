// ============================================================
//  EcoTrack API — /api/audit.js
//  Vercel Serverless Function (Node.js 20.x)
//  Calculates carbon footprint from bytes transferred
// ============================================================

export default function handler(req, res) {

    // CORS headers — allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Only POST allowed" });
    }

    const { bytes, resourceCount } = req.body;

    // Validate input
    const inputBytes = parseFloat(bytes) || 0;

    // ── Carbon Calculation Constants ──
    // Source: Website Carbon Calculator methodology (websitecarbon.com)
    const KWH_PER_GB = 0.06;        // kWh consumed per GB of data transfer
    const CARBON_INTENSITY = 475;    // gCO₂ per kWh (global average grid)
    const RETURN_VISITOR_RATE = 0.5; // 50% of visitors are returning (use cache)

    // ── Core formula ──
    const gb = inputBytes / (1024 * 1024 * 1024);
    const energyKwh = gb * KWH_PER_GB;
    const carbonG = energyKwh * CARBON_INTENSITY;
    const carbonMg = (carbonG * 1000).toFixed(2);

    // ── Green rating ──
    const carbonMgNum = parseFloat(carbonMg);
    let rating = 'A+';
    if (carbonMgNum > 300) rating = 'F';
    else if (carbonMgNum > 200) rating = 'D';
    else if (carbonMgNum > 100) rating = 'C';
    else if (carbonMgNum > 50)  rating = 'B';
    else if (carbonMgNum > 10)  rating = 'A';

    // ── Per-visit comparisons ──
    const dailyVisits1k = carbonMgNum * 1000; // mg for 1000 visits
    const annualG = (carbonMgNum * 365 * 1000) / 1000; // grams per year for 1k daily visitors

    return res.status(200).json({
        success: true,
        carbonMg,
        rating,
        energyKwh: energyKwh.toFixed(8),
        gb: gb.toFixed(8),
        resourceCount: resourceCount || null,
        comparisons: {
            daily1kVisitsMg: dailyVisits1k.toFixed(2),
            annual1kVisitsG: annualG.toFixed(4),
        },
        constants: {
            KWH_PER_GB,
            CARBON_INTENSITY,
        },
        runtime: "Vercel Node.js 20.x",
        timestamp: Date.now()
    });
}
