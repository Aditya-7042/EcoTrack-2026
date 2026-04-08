// This is your Node.js Backend logic running on Vercel
export default function handler(req, res) {
    if (req.method === 'POST') {
        const { bytes } = req.body;

        // Strict validation
        if (typeof bytes !== 'number' || bytes < 0 || !isFinite(bytes)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bytes: must be a non-negative number'
            });
        }

        // Backend Constants for EcoTrack
        const KWH_PER_GB = 0.06;
        const CARBON_INTENSITY = 475; // g CO2/kWh

        // Calculate carbon impact
        const gb = bytes / (1024 ** 3);
        const kwh = gb * KWH_PER_GB;
        const carbonG = kwh * CARBON_INTENSITY;
        const carbonMg = carbonG * 1000;

        // Return detailed response
        res.status(200).json({
            success: true,
            carbonMg: Number(carbonMg.toFixed(2)),
            carbonG: Number(carbonG.toFixed(2)),
            energyKwh: Number(kwh.toFixed(4)),
            dataGb: Number(gb.toFixed(4)),
            timestamp: Date.now(),
            runtime: "Vercel Node.js 20.x"
        });
    } else if (req.method === 'GET') {
        // Info endpoint
        res.status(200).json({
            message: "EcoTrack Carbon Audit API",
            endpoints: {
                POST: "/api/audit - Calculate carbon impact from bytes",
                GET: "/api/audit - API info"
            },
            constants: {
                KWH_PER_GB: 0.06,
                CARBON_INTENSITY: 475
            }
        });
    } else {
        res.status(405).json({ message: "Method not allowed. Use POST or GET." });
    }
}
