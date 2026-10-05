// Tiny Express server. The Gemini API key lives ONLY here (in .env), never in the browser.
import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_MESSAGE_LENGTH = 2000;

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "Missing GEMINI_API_KEY. Copy .env.example to .env and add your key.",
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

// One request in, one answer out (no streaming yet - that is Day 2).
app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;

  if (typeof message !== "string" || message.trim() === "") {
    return res
      .status(400)
      .json({ error: 'Please send a non-empty "message" string.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res
      .status(400)
      .json({
        error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message,
    });
    res.json({ reply: response.text ?? "" });
  } catch (err) {
    // Log the real error on the server; send the browser a safe, generic message.
    console.error("Gemini request failed:", err);
    res
      .status(502)
      .json({
        error: "The AI service request failed. Check the server console.",
      });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
