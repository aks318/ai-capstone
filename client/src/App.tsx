import { FormEvent, useRef, useState } from "react";

export default function App() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Stores the controller so the Stop button can access it
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const text = message.trim();

    if (!text || loading) return;

    setLoading(true);
    setError("");
    setReply("");

    // Create a new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Calls OUR server, not the AI provider.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("Response body is not available.");
      }

      // Get a reader for the response stream
      const reader = res.body.getReader();

      // Converts Uint8Array chunks into strings
      const decoder = new TextDecoder();

      let accumulatedReply = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        accumulatedReply += chunk;

        setReply(accumulatedReply);
      }

      // Flush any remaining decoded characters
      const remaining = decoder.decode();

      if (remaining) {
        accumulatedReply += remaining;
        setReply(accumulatedReply);
      }
    } catch (err) {
      // AbortError means the user clicked Stop.
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  return (
    <main className="app">
      <h1>AI Capstone - Day 2</h1>

      <p className="hint">
        Type a question. The response is streamed from the Express server.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask something, e.g. Explain closures in JavaScript in 3 lines"
          rows={4}
        />

        <button type="submit" disabled={loading || message.trim() === ""}>
          {loading ? "Thinking..." : "Send"}
        </button>

        {loading && (
          <button type="button" onClick={handleStop}>
            Stop
          </button>
        )}
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {reply && (
        <section className="reply" aria-live="polite">
          <h2>Reply</h2>
          <p>{reply}</p>
        </section>
      )}
    </main>
  );
}
