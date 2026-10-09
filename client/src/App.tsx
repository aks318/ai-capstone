import "./filter-table.css";
import "./chat-controls.css";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

const MAX_MESSAGE_LENGTH = 2000;

// ---------- Types for the filter_table tool part ----------

type FilterTableOutput = {
  columns: string[];
  rows: Record<string, string | number>[];
  filter: { column: string; operator: string; value: string };
  total: number;
  matched: number;
};

type ToolPartLike = {
  state: string; // "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const OPERATOR_LABEL: Record<string, string> = {
  equals: "=",
  contains: "contains",
  gt: ">",
  lt: "<",
};

// ---------- Generative UI: the tool result as a component ----------

function FilterTableCard({ part }: { part: ToolPartLike }) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <div className="tool-card tool-loading">Filtering table...</div>;
  }

  if (part.state === "output-error") {
    return (
      <div className="tool-card tool-error">
        Could not filter the table: {part.errorText ?? "unknown error"}
      </div>
    );
  }

  if (part.state !== "output-available") return null;

  const { columns, rows, filter, total, matched } =
    part.output as FilterTableOutput;

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <span className="filter-chip">
          {filter.column} {OPERATOR_LABEL[filter.operator] ?? filter.operator}{" "}
          {filter.value}
        </span>
        <span className="tool-card-count">
          {matched} of {total} rows
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="tool-empty">No rows matched this filter.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={typeof row[col] === "number" ? "num" : ""}
                    >
                      {col === "price" ? `$${row[col]}` : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Error handling: raw error -> friendly message ----------

function friendlyError(error: Error): string {
  let message = error.message;

  // For HTTP errors our server returns JSON like {"error":"..."}.
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.error === "string") message = parsed.error;
  } catch {
    // not JSON, keep the original message
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }

  return message || "Something went wrong. Please try again.";
}

// ---------- The chat app ----------

export default function App() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({
      onError: (err) => console.error("Chat error:", err),
    });

  console.log(messages);

  const isBusy = status === "submitted" || status === "streaming";

  const lastMessage = messages[messages.length - 1];
  const lastIsUser = lastMessage?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function submit() {
    const text = input.trim();
    if (!text || isBusy) return;

    if (error) clearError();

    // useChat adds the user message to `messages` immediately (optimistic),
    // before the server has replied. We just clear the textbox.
    setInput("");
    await sendMessage({ text });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
    if (e.key === "Escape" && isBusy) {
      stop();
    }
  }

  return (
    <main className="app">
      <h1>AI Chat</h1>

      <section className="messages" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-hint">Try: "Show furniture under $300"</p>
        )}

        {messages.map((message) => {
          const isLast = message.id === lastMessage?.id;

          // Optimistic states of the user's own message
          const isPending = isLast && lastIsUser && status === "submitted";
          const isFailed = isLast && lastIsUser && status === "error";

          return (
            <div
              key={message.id}
              className={`message ${message.role}${isPending ? " pending" : ""}${isFailed ? " failed" : ""}`}
            >
              <strong>{message.role === "user" ? "You" : "AI"}</strong>

              <div>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <span key={index}>{part.text}</span>;
                  }

                  if (part.type === "tool-filter_table") {
                    return (
                      <FilterTableCard
                        key={index}
                        part={part as unknown as ToolPartLike}
                      />
                    );
                  }

                  return null;
                })}
              </div>

              {isPending && (
                <small className="message-status">Sending...</small>
              )}
              {isFailed && (
                <small className="message-status">Failed to get a reply</small>
              )}
            </div>
          );
        })}

        {status === "submitted" && <p className="thinking">Thinking...</p>}
        <div ref={bottomRef} />
      </section>

      {status === "error" && error && (
        <div className="error-banner" role="alert">
          <span>{friendlyError(error)}</span>
          <div className="error-actions">
            <button type="button" onClick={() => void regenerate()}>
              Retry
            </button>
            <button type="button" onClick={clearError}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {status === "ready" && messages.length > 0 && (
        <div className="toolbar">
          <button type="button" onClick={() => void regenerate()}>
            {lastIsUser ? "Retry" : "Regenerate"}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something... (Enter to send, Esc to stop)"
        />

        <button type="submit" disabled={isBusy || !input.trim()}>
          Send
        </button>

        {isBusy && (
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        )}
      </form>
    </main>
  );
}
