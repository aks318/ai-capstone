import "./filter-table.css";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

const MAX_MESSAGE_LENGTH = 2000;

// ---------- Types for the filter_table tool part ----------
// This matches what the server's execute() returns.

type FilterTableOutput = {
  columns: string[];
  rows: Record<string, string | number>[];
  filter: { column: string; operator: string; value: string };
  total: number;
  matched: number;
};

// The fields we use from a tool part (the SDK's own type is very generic).
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

// ---------- The chat app ----------

export default function App() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat();

  const isBusy = status === "submitted" || status === "streaming";

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
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return <span key={index}>{part.text}</span>;
                }

                // Map the tool part to a React component.
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
          placeholder='Try: "Show furniture under $300"'
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
