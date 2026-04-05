// This is your Node.js Backend logic
export default function handler(req, res) {
    // Only allow POST requests (Secure)
    if (req.method === 'POST') {
        const { bytes } = req.body;
        
        // Backend Constants
        const KWH_PER_GB = 0.06;
        const CARBON_INTENSITY = 475; 
        
        // Logic: Calculate Carbon on the Server
        const gb = bytes / (1024 * 1024 * 1024);
        const carbonMg = (gb * KWH_PER_GB * CARBON_INTENSITY * 1000).toFixed(2);

        // Send the result back to your phone/browser
        res.status(200).json({ 
            success: true, 
            carbonMg: carbonMg,
            runtime: "Node.js 20.x" 
        });
    } else {
        res.status(405).json({ message: "Only POST allowed" });
    }
}
