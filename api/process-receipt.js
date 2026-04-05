// Vercel Serverless Function — proxies receipt images to Claude API
// This keeps your API key secure on the server side

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, mediaType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Step 1: Extract and translate receipt
    const extractPrompt = [
      "This is a Vietnamese receipt. Please:",
      "1. Extract all items with prices in Vietnamese dong (VND)",
      "2. Translate all Vietnamese text to English",
      "3. Return ONLY a valid JSON object (no markdown, no backticks) with this structure:",
      "{",
      '  "store_name": "translated store name",',
      '  "original_store_name": "original Vietnamese name",',
      '  "date": "YYYY-MM-DD",',
      '  "items": [',
      '    { "name": "English name", "original_name": "Vietnamese name", "quantity": number, "unit_price": number, "total": number }',
      "  ],",
      '  "subtotal": number,',
      '  "tax": number,',
      '  "total_vnd": number,',
      '  "raw_translation": "Full translation of receipt text"',
      "}",
    ].join("\n");

    const extractResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            { type: "text", text: extractPrompt },
          ],
        },
      ],
    });

    const rawText = extractResponse.content[0].text;

    // Clean markdown code fences if present
    let jsonStr = rawText;
    if (rawText.includes("```")) {
      const parts = rawText.split("```");
      for (let i = 1; i < parts.length; i += 2) {
        const block = parts[i];
        // Remove optional language tag (e.g., "json")
        const cleaned = block.replace(/^[a-z]*\n/, "").trim();
        if (cleaned.startsWith("{")) {
          jsonStr = cleaned;
          break;
        }
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Step 2: Categorize items
    const itemNames = parsed.items.map((i) => i.name);
    const catPrompt = [
      "Assign a grocery category to each item. Categories: Vegetables, Fruits, Meat, Fish, Dairy, Household, Spices, Beverages, Snacks, Other.",
      "Return ONLY a valid JSON object (no markdown):",
      '{ "categories": { "item_name": "category" } }',
      "Items: " + JSON.stringify(itemNames),
    ].join("\n");

    const catResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: catPrompt }],
    });

    let catJsonStr = catResponse.content[0].text;
    if (catJsonStr.includes("```")) {
      const parts = catJsonStr.split("```");
      for (let i = 1; i < parts.length; i += 2) {
        const block = parts[i];
        const cleaned = block.replace(/^[a-z]*\n/, "").trim();
        if (cleaned.startsWith("{")) {
          catJsonStr = cleaned;
          break;
        }
      }
    }

    const categories = JSON.parse(catJsonStr).categories || {};

    // Combine results
    const result = {
      ...parsed,
      date: parsed.date || new Date().toISOString().split("T")[0],
      items: parsed.items.map((item) => ({
        ...item,
        category: categories[item.name] || "Other",
      })),
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Receipt processing error:", error);
    return res.status(500).json({
      error: "Failed to process receipt",
      details: error.message,
    });
  }
}
