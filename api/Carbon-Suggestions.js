// Carbon Reduction AI Suggestions - using Claude API
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Only POST allowed" });
    }

    const { carbonMg, bytes, status } = req.body;
    const mbTransferred = (bytes / (1024 * 1024)).toFixed(2);
    const timestamp = Date.now();

// Handle missing API key gracefully - rotate through different suggestions
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
        console.log("No ANTHROPIC_API_KEY found, using fallback suggestions");
        const suggestionSets = [
            [
                "✓ Compress images and videos before upload",
                "✓ Enable browser caching for static assets",
                "✓ Use lazy loading for off-screen resources"
            ],
            [
                "📊 Convert images to WebP format (25-35% smaller)",
                "🔄 Implement service workers for offline caching",
                "⚡ Minify CSS, JavaScript, and HTML files"
            ],
            [
                "🌐 Use a Content Delivery Network (CDN)",
                "📱 Optimize for mobile-first loading",
                "🎯 Implement resource hints (preload, prefetch)"
            ],
            [
                "🗜️ Enable gzip/brotli compression on server",
                "📈 Use responsive images with srcset",
                "⚡ Remove unused CSS and JavaScript"
            ]
        ];

        // Rotate suggestions based on timestamp
        const setIndex = Math.floor(timestamp / 10000) % suggestionSets.length;

        return res.status(200).json({
            success: false,
            suggestions: suggestionSets[setIndex],
            fallback: true
        });
    }

    try {
        // Determine focus area based on current metrics
        let focusArea = "general optimization";
        if (carbonMg > 500) {
            focusArea = "high-impact data reduction";
        } else if (mbTransferred > 10) {
            focusArea = "resource loading optimization";
        } else if (status === "CRITICAL") {
            focusArea = "emergency carbon reduction";
        }

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
                    content: `You are an eco-friendly web optimization expert. Current session: ${timestamp}

METRICS:
- Carbon emissions: ${carbonMg}mg CO₂
- Data transferred: ${mbTransferred}MB
- Status: ${status}
- Focus area: ${focusArea}

IMPORTANT: Respond with ONLY a valid JSON array of exactly 3 strings. No other text, no markdown, no explanations.

Example: ["Compress all images using WebP format", "Enable browser caching headers", "Implement lazy loading for images"]

Provide 3 DIFFERENT, specific, actionable tips to REDUCE carbon production focused on ${focusArea}.`
                }]
            })
        });

        const data = await response.json();

        // Extract the text response
        let textContent = data.content[0].text;
        console.log("Claude raw response:", textContent);

        // Try to parse JSON from the response - more robust parsing
        let suggestions = [];
        try {
            // Clean the response text
            textContent = textContent.trim();

            // Look for JSON array pattern
            const jsonMatch = textContent.match(/\[[\s\S]*?\]/);

            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                console.log("Found JSON match:", jsonString);

                // Try to parse the JSON
                suggestions = JSON.parse(jsonString);

                // Ensure it's an array
                if (!Array.isArray(suggestions)) {
                    suggestions = [suggestions];
                }
            } else {
                // No JSON found, split by newlines and clean up
                console.log("No JSON found, using text fallback");
                suggestions = textContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.startsWith('[') && !line.startsWith(']'))
                    .slice(0, 3); // Take first 3 lines
            }
        } catch (parseError) {
            console.error("JSON parse error:", parseError);
            console.log("Falling back to text splitting");

            // Fallback: split by newlines and clean
            suggestions = textContent
                .split('\n')
                .map(line => line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
                .filter(line => line.length > 0)
                .slice(0, 3);
        }

        // Ensure we have exactly 3 suggestions
        while (suggestions.length < 3) {
            suggestions.push("Optimize resource loading and caching strategies");
        }
        suggestions = suggestions.slice(0, 3);

        console.log("Final suggestions:", suggestions);

        res.status(200).json({
            success: true,
            suggestions: suggestions,
            carbonMg: carbonMg,
            mbTransferred: mbTransferred
        });

    } catch (err) {
        console.error("Claude API error:", err);
        // Fallback suggestions if API fails
        const fallbackSuggestions = [
            "📊 Use WebP images instead of PNG/JPG (25-35% smaller)",
            "🔄 Implement service workers for caching and offline support",
            "📦 Enable gzip/brotli compression on your server"
        ];

        res.status(200).json({
            success: false,
            suggestions: fallbackSuggestions,
            error: err.message,
            fallback: true
        });
    }
}
