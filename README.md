# AI Capstone - Day 1

React (Vite + TypeScript) frontend + tiny Express backend that calls Gemini.
The API key stays on the server in `.env`.

```
capstone/
  client/   React + TypeScript (Vite)
  server/   Express + Gemini (key in .env)
```

## Setup

1. Create a Gemini API key at https://aistudio.google.com/apikey

2. Create a file named `.env` inside the `server` folder and add this line, pasting your key after the `=`:

```
GEMINI_API_KEY=paste-your-key-here
```

3. Server (terminal 1):

```bash
cd server
npm install
npm run dev
```

You should see: `Server running on http://localhost:3001`.
Quick check: open http://localhost:3001/api/health in the browser.

4. Client (terminal 2):

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), type a question, click Send.

## Done when

- You get a reply from the model in the page.
- Your key appears only in `server/.env` (search the `client` folder: it must not appear).
- `.env` is listed in `.gitignore`.

## Troubleshooting

- `Missing GEMINI_API_KEY` - you did not create `server/.env` or the key line is empty.
- Error in the page / 502 - read the server terminal; usually a wrong key, a model name that is not
  available to you (change `GEMINI_MODEL` in `.env`), or the free-tier rate limit.
- Page cannot reach /api - make sure the server is running on port 3001.
