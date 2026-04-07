// Carbon Reduction AI Suggestions - using Claude API
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Only POST allowed" });
    }

    const { carbonMg, bytes, status } = req.body;

    // Handle missing API key gracefully
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ 
            error: "AI service not configured",
            suggestions: [
                "✓ Compress images and videos before upload",
                "✓ Enable browser caching for static assets",
                "✓ Use lazy loading for off-screen resources"
            ]
        });
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 300,
                messages: [{
                    role: "user",
                    content: `You are an eco-friendly web optimization expert. Based on these metrics:
- Carbon emissions: ${carbonMg}mg CO₂
- Data transferred: ${(bytes / (1024 * 1024)).toFixed(2)}MB
- Status: ${status}

Provide exactly 3 specific, actionable tips to REDUCE carbon production. Format as a JSON array of strings. Each tip should be practical and implementable immediately. Example format:
["Tip 1 here", "Tip 2 here", "Tip 3 here"]

Focus on web performance, data optimization, and resource efficiency.`
                }]
            })
        });

        const data = await response.json();
        
        // Extract the text response
        let textContent = data.content[0].text;
        
        // Try to parse JSON from the response
        let suggestions = [];
        try {
            // Find JSON array in the response
            const jsonMatch = textContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            } else {
                suggestions = [textContent];
            }
        } catch (e) {
            suggestions = [textContent];
        }

        res.status(200).json({ 
            success: true,
            suggestions: suggestions,
            carbonMg: carbonMg,
            mbTransferred: (bytes / (1024 * 1024)).toFixed(2)
        });

    } catch (err) {
        console.error("Claude API error:", err);
        // Fallback suggestions if API fails
        res.status(200).json({ 
            success: false,
            suggestions: [
                "📊 Use WebP images instead of PNG/JPG (25-35% smaller)",
                "🔄 Implement service workers for caching and offline support",
                "📦 Enable gzip/brotli compression on your server"
            ],
            error: "Using default suggestions"
        });
    }
}
