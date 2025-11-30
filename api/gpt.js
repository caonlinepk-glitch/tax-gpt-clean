console.log("OPENAI_API_KEY exists?", !!process.env.OPENAI_API_KEY);

import OpenAI from "openai";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    // Ensure messages exist
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages are required" });
    }

    // Ensure the first message is system with table instructions
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

    // Create OpenAI client using environment variable
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages
    });

    const content = completion?.choices?.[0]?.message?.content || "No reply";

    res.status(200).json({ reply: content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
