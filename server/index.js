// Express server with a filter_table tool. API keys live ONLY here (in .env).
import "dotenv/config";
import express from "express";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import rateLimit from "express-rate-limit";

const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001"; // cheapest
const MAX_MESSAGE_LENGTH = 2000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Add it to your .env file.");
  process.exit(1);
}

const chatLimiter = rateLimit({
  windowMs: 60000, // 1 minute window
  limit: 10, // 10 requests per IP per minute (older versions call this `max`)
  standardHeaders: true, // sends RateLimit headers
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." },
});

// ---------- The data the tool works on (in-memory demo table) ----------

const COLUMNS = ["name", "category", "price", "stock"];

const PRODUCTS = [
  { name: "Wireless Mouse", category: "accessories", price: 25, stock: 120 },
  {
    name: "Mechanical Keyboard",
    category: "accessories",
    price: 85,
    stock: 40,
  },
  { name: "USB-C Hub", category: "accessories", price: 45, stock: 0 },
  { name: "27-inch Monitor", category: "displays", price: 280, stock: 15 },
  { name: "Portable Monitor", category: "displays", price: 150, stock: 8 },
  { name: "Laptop Stand", category: "furniture", price: 35, stock: 60 },
  { name: "Standing Desk", category: "furniture", price: 420, stock: 5 },
  { name: "Office Chair", category: "furniture", price: 210, stock: 0 },
  { name: "Webcam HD", category: "video", price: 60, stock: 33 },
  { name: "Ring Light", category: "video", price: 30, stock: 75 },
];

const OPERATORS = {
  equals: (cell, value) => String(cell).toLowerCase() === value.toLowerCase(),
  contains: (cell, value) =>
    String(cell).toLowerCase().includes(value.toLowerCase()),
  gt: (cell, value) => Number(cell) > Number(value),
  lt: (cell, value) => Number(cell) < Number(value),
};

// ---------- The tool ----------

const filterTable = tool({
  description:
    "Filters the products table and returns the matching rows. " +
    "Columns: name, category, price, stock. " +
    "Use gt/lt only for the numeric columns price and stock.",
  inputSchema: z.object({
    column: z.enum(COLUMNS).describe("column to filter on"),
    operator: z
      .enum(["equals", "contains", "gt", "lt"])
      .describe(
        "equals/contains for text, gt (greater than)/lt (less than) for numbers",
      ),
    value: z
      .string()
      .describe("value to compare against, for example 'furniture' or '50'"),
  }),
  execute: async ({ column, operator, value }) => {
    const isNumericOp = operator === "gt" || operator === "lt";

    if (isNumericOp && !["price", "stock"].includes(column)) {
      // Thrown errors reach the UI as an error state we can render.
      throw new Error(
        `"${operator}" only works on price or stock, not "${column}".`,
      );
    }
    if (isNumericOp && Number.isNaN(Number(value))) {
      throw new Error(`"${value}" is not a number.`);
    }

    const rows = PRODUCTS.filter((row) =>
      OPERATORS[operator](row[column], value),
    );

    // This object becomes part.output in the browser.
    return {
      columns: COLUMNS,
      rows,
      filter: { column, operator, value },
      total: PRODUCTS.length,
      matched: rows.length,
    };
  },
});

// ---------- Server ----------

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

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
function friendlyServerError(error) {
  console.error("Stream error:", error);
  const status = error?.statusCode;
  if (status === 429)
    return "Rate limit reached. Please wait a moment and try again.";
  if (status === 401 || status === 403)
    return "The server's API key was rejected.";
  if (status === 400 && /credit balance/i.test(error?.message ?? "")) {
    return "The AI account is out of credits.";
  }
  return "The AI service had a problem. Please try again.";
}

app.post("/api/chat", chatLimiter, async (req, res) => {
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

    const modelMessages = await convertToModelMessages(messages);
    const controller = new AbortController();
    res.on("close", () => controller.abort()); // fires when the browser aborts

    const result = streamText({
      model: anthropic(MODEL), // provider function, not a plain string
      system:
        "You are a data assistant for a products table. " +
        "Use the filter_table tool to answer questions about products. " +
        "The UI already shows the table, so after the tool runs reply with ONE short " +
        "sentence and do not repeat the rows. Never invent data.",
      messages: modelMessages,
      tools: { filter_table: filterTable },
      stopWhen: stepCountIs(3), // tool call, then the short reply
      maxOutputTokens: 400,
      abortSignal: controller.signal,
    });

    result.pipeUIMessageStreamToResponse(res, {
      onError: friendlyServerError,
    });
  } catch (error) {
    console.error("Request failed:", error);
    if (!res.headersSent) {
      res.status(502).json({ error: "The AI service request failed." });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
