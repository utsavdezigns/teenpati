# Teen Patti

Real-time multiplayer Teen Patti card game. Play with 2–6 friends using a 4-letter room code — no sign-up needed.

Live: **[teenpati.utsavtripathi.com.np](https://teenpati.utsavtripathi.com.np)**

---

## Running locally

```bash
npm install
npm start          # http://localhost:3000
```

Copy `.env.example` to `.env` if you want to override any variable:

```bash
cp .env.example .env
```

### Run tests

```bash
npm test
```

---

## Deploying to Render

### 1. Create a Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (`utsavdezigns/teenpati`)
3. Use these settings:

| Field | Value |
|---|---|
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for always-on) |

### 2. Environment variables on Render

Set these in **Environment → Add Environment Variable**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://teenpati.utsavtripathi.com.np,https://utsavtripathi.com.np` |

`PORT` is set automatically by Render — do **not** override it.

### 3. Custom domain `teenpati.utsavtripathi.com.np`

1. In your Render service → **Settings → Custom Domains → Add Custom Domain**
2. Enter `teenpati.utsavtripathi.com.np` and click **Save**
3. Render will show you a **CNAME target** like `your-service.onrender.com`
4. In your DNS provider (wherever `utsavtripathi.com.np` is managed), add:

```
Type:  CNAME
Name:  teenpati
Value: your-service.onrender.com
TTL:   3600
```

5. Wait for DNS propagation (usually < 5 minutes). Render auto-provisions TLS.

---

## Project structure

```
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── roomManager.js    # Room lifecycle, player join/reconnect
│   ├── gameEngine.js     # Round logic, action validation, turn timer
│   ├── handRanker.js     # Hand evaluation and comparison
│   └── deck.js           # Deck creation and dealing
├── public/
│   ├── index.html        # Single-page app
│   ├── css/style.css
│   └── js/
│       ├── app.js        # Socket connection, screen router
│       ├── lobby.js      # Create / join room
│       ├── room.js       # Waiting room
│       ├── game.js       # Game table
│       ├── scoreboard.js # Point mode scoreboard
│       ├── results.js    # Final results + debt settlement
│       └── ui.js         # Cards, toasts, animations, confetti
├── tests/
│   └── handRanker.test.js
├── server.js             # Root entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port (set automatically by Render) |
| `ALLOWED_ORIGINS` | Production + localhost | Comma-separated CORS origins |
| `NODE_ENV` | — | Set to `production` on Render |

---

## Game rules (quick reference)

| | |
|---|---|
| **Boot** | Everyone pays boot into the pot at round start |
| **Blind** | Haven't seen cards — pay current stake to chaal |
| **Seen** | Seen cards — pay 2× stake to chaal |
| **Raise** | Double your stake amount; stake doubles |
| **Pack** | Fold — out for this round |
| **Show** | Only when 2 players remain; best hand wins the pot |

**Hand ranking (high → low):** Trail › Pure Sequence › Sequence › Color › Pair › High Card

A-K-Q is the highest sequence; A-2-3 is second highest.
