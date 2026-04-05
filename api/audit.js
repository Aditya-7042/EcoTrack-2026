// This is your Node.js Backend logic running on Vercel
export default function handler(req, res) {
    // Only allow POST requests (Secure)
    if (req.method === 'POST') {
        const { bytes } = req.body;
        
        // Ensure bytes is a number
        const inputBytes = parseFloat(bytes) || 0;
        
        // Backend Constants for EcoTrack
        const KWH_PER_GB = 0.06;
        const CARBON_INTENSITY = 475; 
        
        // Logic: Calculate Carbon on the Vercel Server
        const gb = inputBytes / (1024 * 1024 * 1024);
        const carbonMg = (gb * KWH_PER_GB * CARBON_INTENSITY * 1000).toFixed(2);

        // Send the result back to your browser
        res.status(200).json({ 
            success: true, 
            carbonMg: carbonMg,
            runtime: "Vercel Node.js 20.x" 
        });
    } else {
        // Error if someone tries to 'GET' the URL
        res.status(405).json({ message: "Only POST allowed" });
    }
}
