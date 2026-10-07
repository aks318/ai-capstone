// Tiny Express server. The Gemini API key lives ONLY here (in .env), never in the browser.
import "dotenv/config";
import express from "express";
import { streamText, convertToModelMessages } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_MESSAGE_LENGTH = 2000;

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "Missing GEMINI_API_KEY. Copy .env.example to .env and add your key.",
  );
  process.exit(1);
}

// Pass the key explicitly so we can keep using GEMINI_API_KEY as the env var name.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

// Returns the combined text of the latest user message (used for length validation).
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") {
      return (m.parts ?? [])
        .filter((p) => p?.type === "text")
        .map((p) => p.text ?? "")
        .join("");
    }
  }
  return "";
}

// Stream Gemini's response to the browser chunk by chunk.
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: "messages must be a non-empty array" });
    }

    if (lastUserText(messages).length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      });
    }

    // UI messages (from useChat) -> model messages (for streamText)
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: google(MODEL),
      messages: modelMessages, // must be `messages`, not `modelMessages`
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    console.error("Gemini request failed:", error);

    if (!res.headersSent) {
      res.status(502).json({ error: "The AI service request failed." });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
