import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

const MAX_MESSAGE_LENGTH = 2000;

export default function App() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Posts to /api/chat by default.
  const { messages, sendMessage, status, error, stop } = useChat();

  const isBusy = status === "submitted" || status === "streaming";

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function submit() {
    const text = input.trim();

    if (!text || isBusy) return;

    setInput("");
    await sendMessage({ text });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit();
  }

  // Enter sends, Shift+Enter inserts a newline.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <main className="app">
      <h1>AI Chat</h1>

      <section className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <strong>{message.role === "user" ? "You" : "AI"}</strong>

            <div>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <span key={index}>{part.text}</span>
                ) : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && <p className="thinking">Thinking...</p>}
        <div ref={bottomRef} />
      </section>

      {error && <p className="error">{error.message}</p>}

      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
        />

        <button type="submit" disabled={isBusy || !input.trim()}>
          Send
        </button>

        {isBusy && (
          <button type="button" onClick={stop}>
            Stop
          </button>
        )}
      </form>
    </main>
  );
}
