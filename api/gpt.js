// api/gpt.js
import OpenAI from "openai";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(200).json({ reply: "⚠️ No messages received. Please try again." });
    }

    // Prepend system message if missing
    if (!messages[0] || messages[0].role !== "system") {
      messages.unshift({
        role: "system",
        content: `You are a restricted AI assistant focused on Taxation and Tax Laws in Pakistan. 
Always respond in a helpful, concise manner.

**Important for tables:** 
- If the user requests tabular data, respond ONLY in JSON format:
{
  "headers": ["Column1", "Column2", ...],
  "rows": [
    ["Row1Col1", "Row1Col2", ...],
    ...
  ]
}
Do not include extra text inside the JSON. Return JSON only for tables.`
      });
    }

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing!");
      return res.status(200).json({ reply: "⚠️ Server configuration issue: API key missing." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Call OpenAI API
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages
      });
    } catch (err) {
      console.error("OpenAI API error:", err);

      // Handle rate-limit separately
      if (err.status === 429) {
        return res.status(200).json({ reply: "⚠️ Rate limit reached. Please wait a few minutes and try again." });
      }

      return res.status(200).json({ reply: "⚠️ AI service temporarily unavailable. Try again shortly." });
    }

    const content = completion?.choices?.[0]?.message?.content || "⚠️ No reply from AI.";
    res.status(200).json({ reply: content });

  } catch (err) {
    console.error("Unexpected server error:", err);
    res.status(200).json({ reply: "⚠️ Unexpected server error. Please try again." });
  }
}
