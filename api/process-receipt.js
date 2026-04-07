import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { image, mediaType } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    // Get current date for context
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentMonth = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    const extractPrompt = [
      `You are an expert receipt OCR system. Today's date is ${currentDate} (${currentMonth}).`,
      "",
      "IMPORTANT DATE FORMAT RULES:",
      "- Receipts from Vietnam use DD/MM/YYYY format (day first, then month).",
      "- For example, '02/04/2026' on a Vietnamese receipt means April 2nd, 2026 (NOT February 4th).",
      "- Always convert dates to YYYY-MM-DD format in your output.",
      "- If the date is ambiguous, assume DD/MM/YYYY (Vietnamese format).",
      "- Most receipts will be from the current month or the previous month.",
      "",
      "RECEIPT QUALITY NOTES:",
      "- Some receipts may be from dot matrix printers with faded or low-quality text.",
      "- Look carefully at faded characters - use context clues (item names, prices, totals) to infer unclear text.",
      "- Vietnamese receipts often have Vietnamese item names - translate them to English.",
      "",
      "PER-KILO PRICING:",
      "- Many items (meat, fish, vegetables, fruits) are sold by weight (per kilogram).",
      "- If the receipt shows a per-kg price and weight for an item, extract both.",
      "- Look for patterns like: '2.5kg x 45,000' or 'DG: 45,000/kg' or 'SL: 2.5 kg'.",
      "- Set weight_kg to the weight in kilograms and price_per_kg to the price per kilogram.",
      "- If the item is not sold by weight, set both to null.",
      "",
      "Extract the following from this receipt image and return ONLY valid JSON:",
      "{",
      '  "store_name": "Store name in English",',
      '  "original_store_name": "Original store name as printed",',
      '  "date": "YYYY-MM-DD (converted from DD/MM/YYYY if Vietnamese)",',
      '  "items": [',
      '    {',
      '      "name": "Item name translated to English",',
      '      "original_name": "Original Vietnamese name",',
      '      "quantity": 1,',
      '      "unit_price": 0,',
      '      "total": 0,',
      '      "weight_kg": null,',
      '      "price_per_kg": null,',
      '      "category": "One of: Meat, Vegetables, Fruit, Staples, Cleaning Products, Flowers, Other Groceries, Soda Water & Soft Drinks, ORE (Official Residence), Other"',
      "    }",
      "  ],",
      '  "subtotal": 0,',
      '  "tax": 0,',
      '  "total_vnd": 0,',
      '  "paid_by": "cash or card or transfer if visible",',
      '  "raw_translation": "Brief English summary of the full receipt"',
      "}",
      "",
      "Rules:",
      "- All monetary values in VND (Vietnamese Dong), as numbers without currency symbols.",
      "- Translate Vietnamese item names to English in the 'name' field.",
      "- Keep original Vietnamese names in 'original_name' field.",
      "- If total is not visible, sum the item totals.",
      "- Assign each item a category from the list above.",
      "- For items sold by weight, always include weight_kg and price_per_kg when visible on receipt.",
      "- Return ONLY the JSON object, no markdown formatting, no code blocks.",
    ];

    const response = await client.messages.create({
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
            { type: "text", text: extractPrompt.join("\n") },
          ],
        },
      ],
    });

    const text = response.content[0].text;

    // Try to parse the response as JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response if it has markdown wrapping
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse OCR response as JSON");
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("OCR Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
