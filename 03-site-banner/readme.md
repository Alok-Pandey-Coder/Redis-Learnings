# Express + Redis Basics — Revision Notes

```javascript
import express from "express"
import Redis from "ioredis"

const app = express()
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const BANNER_KEY = "app:banner";

app.post('/banner', async (req, res) => {
  await redis.set(BANNER_KEY, req.body.message || "Welcome to Sinkai community!");
  res.json({success: true});
})

app.get('/banner', async (req, res) => {
  const message = await redis.get(BANNER_KEY);
  res.json({message});
})

app.delete('/banner', async (req, res) => {
  await redis.del(BANNER_KEY);
  res.json({success: true});
})

app.get('/banner/exists', async (req, res) => {
  const exists = await redis.exists(BANNER_KEY);
  res.json({exists: Boolean(exists)});
})

app.listen(3000, () => {
  console.log("Welcome to redis basics, it is runnig on http://localhost:3000");
})
```

---

## 1. Imports & Setup

| Line | Meaning |
|---|---|
| `import express from "express"` | Node.js web framework — handles HTTP server + routes |
| `import Redis from "ioredis"` | Most popular Redis client library for Node.js — used to connect to Redis and send commands |
| `app.use(express.json())` | Middleware that auto-parses incoming JSON request bodies into `req.body`. Without this, `req.body` would be `undefined` |
| `new Redis(process.env.REDIS_URL \|\| "redis://localhost:6379")` | Creates a connection (TCP) to the Redis server. Uses `REDIS_URL` env var if set (production), otherwise falls back to local Redis — a common dev/prod portability pattern |
| `const BANNER_KEY = "app:banner"` | Constant for the Redis key name. The `namespace:key` style (`app:banner`) keeps keys organized as the app grows |

---

## 2. Routes (Functions)

### `POST /banner` — Set banner
```javascript
await redis.set(BANNER_KEY, req.body.message || "Welcome to Sinkai community!");
```
- `redis.set(key, value)` stores a key-value pair in Redis.
- Uses `req.body.message` if provided, else falls back to a default string.
- `await` is required — `.set()` is a network call to the Redis container; without `await`, the response would be sent before Redis confirms the write.

### `GET /banner` — Get banner
```javascript
const message = await redis.get(BANNER_KEY);
```
- `redis.get(key)` fetches the value for that key. Returns `null` if the key doesn't exist.

### `DELETE /banner` — Delete banner
```javascript
await redis.del(BANNER_KEY);
```
- `redis.del(key)` removes the key (and its value) from Redis.

### `GET /banner/exists` — Check existence
```javascript
const exists = await redis.exists(BANNER_KEY);
res.json({exists: Boolean(exists)});
```
- `redis.exists(key)` returns `1` (exists) or `0` (doesn't exist) — a **number**, not a boolean.
- `Boolean(exists)` converts it to `true`/`false` for a cleaner JSON response.

---

## 3. Server Start
```javascript
app.listen(3000, () => { ... })
```
Starts the Express server on port `3000`; the callback runs once the server is successfully listening.

---

## 4. In-Memory DB — Concept

- Normal DBs (MongoDB, etc.) store data on **disk** → slower (ms range) due to disk I/O.
- **In-memory DBs** (Redis) store data in **RAM** → much faster access, ideal for caching, sessions, rate-limiting.
- Redis by default keeps data **only in RAM** — data is lost on restart unless persistence (e.g., AOF via `--appendonly yes`) is enabled.

## 5. Why `await` even though Redis is in-memory?

Common confusion: "in-memory means instant, so why await?"

1. Redis runs as a **separate process/container** — not inside your Node.js app. Your app talks to it over a **network call (TCP socket)**, even on `localhost`.
2. Any network operation in JavaScript is **asynchronous** by nature, because Node.js is **single-threaded and non-blocking**. Without `await`, the code moves on before Redis responds, giving you a pending `Promise` instead of the actual value.
3. In-memory only makes Redis's **internal** operation fast (RAM read/write) — but sending the request and getting the response back still involves a network round-trip, which stays async regardless of speed.

**Example:**
```javascript
const value = await redisClient.get("someKey"); // correct — waits for actual value
console.log(value);

const value2 = redisClient.get("someKey"); // wrong — returns a pending Promise
console.log(value2); // Promise { <pending> }
```

---

## Quick Recap (for fast revision)

- **ioredis** → Redis client for Node.js
- **redis.set / get / del / exists** → basic Redis commands (write / read / delete / check)
- **await** needed because every Redis call is a network round-trip, not a local memory access
- **in-memory DB** → data lives in RAM (fast), not disk — but still accessed over network from the app
- **`exists` returns 1/0**, wrap with `Boolean()` for clean true/false in responses