import { FormEvent, useState } from 'react';

type ChatResponse = { reply?: string; error?: string };

export default function App() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || loading) return;

    setLoading(true);
    setError('');
    setReply('');

    try {
      // Calls OUR server, not the AI provider. The server holds the API key.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data: ChatResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setReply(data.reply ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>AI Capstone - Day 1</h1>
      <p className="hint">Type a question. React sends it to the Express server, which asks the model.</p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask something, e.g. Explain closures in JavaScript in 3 lines"
          rows={4}
        />
        <button type="submit" disabled={loading || message.trim() === ''}>
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {reply && (
        <section className="reply" aria-live="polite">
          <h2>Reply</h2>
          <p>{reply}</p>
        </section>
      )}
    </main>
  );
}
