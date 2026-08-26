# Express + Redis OTP System (TTL) — Revision Notes

```javascript
import express from "express"
import Redis from "ioredis"

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

function otpKey(phone) {
  return `otp:${phone}`;
}

app.post('/otp', async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.set(otpKey(phone), otp, 'EX', 60);
  res.json({message: 'Otp sent', otp});
})

app.post('/otp/verify', async (req, res) => {
  const {phone, otp} = req.body;
  const savedOTP = await redis.get(otpKey(phone));

  if(!savedOTP) {
    return res.status(400).json({message: 'OTP expired or not found'})
  }

  if(savedOTP !== otp) {
    return res.status(400).json({message: 'Invalid otp'});
  }

  await redis.del(otpKey(phone));
  res.json({message: 'OTP verified successfully'});
})

app.get('/otp/:phone/ttl', async (req, res) => {
  const ttl = await redis.ttl(otpKey(req.params.phone));
  res.json({ttl});  
})

app.listen(3000, () => {
  console.log("application is running on http://localhost:3000");
})
```

---

## 1. What is TTL?

**TTL = Time To Live** — how long a key stays "alive" in Redis before it's automatically deleted, without needing a manual `del`.

```javascript
await redis.set(otpKey(phone), otp, 'EX', 60);
```
`'EX', 60` tells Redis: expire this key automatically after **60 seconds**.

### Common TTL use-cases
- OTPs (this example) — must become invalid after a short window
- Session tokens — auto-expire after inactivity
- Rate limiting — "max 5 requests per minute" logic
- Caching — stale data cleans itself up

---

## 2. How Redis Checks/Tracks Expiry Internally

Redis uses **two mechanisms** together:

| Mechanism | How it works |
|---|---|
| **Passive (Lazy) Expiration** | When a client accesses a key (`GET`, `EXISTS`, etc.), Redis first checks if its TTL has passed. If expired, it deletes the key immediately and returns `null`/not-found — this is why `savedOTP` comes back `null` after 60s |
| **Active Expiration** | Redis periodically (~10 times/sec) scans a **random sample** of keys with TTLs in the background and deletes any that have expired — even if nobody accessed them. This prevents unused expired keys from sitting in memory forever |

Together, these ensure expired data never gets served **and** memory doesn't leak from forgotten keys.

### `TTL` command
```javascript
const ttl = await redis.ttl(otpKey(req.params.phone));
```
Returns:
- **Positive number** (e.g. `45`) → seconds left before expiry
- **`-1`** → key exists but has no TTL (permanent)
- **`-2`** → key doesn't exist (never created, or already expired)

---

## 3. Code Walkthrough

### Setup
Same pattern as before — Express app + Redis connection via `ioredis`, using `REDIS_URL` env var or local fallback.

### Helper: `otpKey(phone)`
```javascript
function otpKey(phone) {
  return `otp:${phone}`;
}
```
Ensures consistent, typo-free key naming — e.g. phone `9876543210` → key `"otp:9876543210"`.

### `POST /otp` — Generate & send OTP
```javascript
const otp = Math.floor(100000 + Math.random() * 900000).toString();
await redis.set(otpKey(phone), otp, 'EX', 60);
```
- `Math.random()` → random decimal between `0` and `1`
- `* 900000` → scales range to `0–900000`
- `+ 100000` → shifts range to `100000–999999` (guarantees 6 digits)
- `.toString()` → converts to string since Redis stores strings
- `redis.set(key, otp, 'EX', 60)` → saves OTP with a **60-second TTL**; auto-deletes after that
- Response includes the OTP directly here only for demo/testing — in a real app you'd send it via SMS/email, not in the response

### `POST /otp/verify` — Verify OTP
```javascript
const savedOTP = await redis.get(otpKey(phone));

if(!savedOTP) {
  return res.status(400).json({message: 'OTP expired or not found'})
}
if(savedOTP !== otp) {
  return res.status(400).json({message: 'Invalid otp'});
}

await redis.del(otpKey(phone));
```
- Fetches saved OTP from Redis.
- **Case 1:** `savedOTP` is falsy/`null` → either never sent, or TTL expired and Redis auto-deleted it → error.
- **Case 2:** `savedOTP` doesn't match user input → wrong OTP → error.
- **Success:** Manually `del()` the key so the same OTP can't be verified twice — enforces **one-time use**, even if TTL hadn't expired yet.

### `GET /otp/:phone/ttl` — Check remaining time
```javascript
const ttl = await redis.ttl(otpKey(req.params.phone));
res.json({ttl});
```
- `req.params.phone` → phone number from the URL (e.g. `/otp/9876543210/ttl`)
- Useful for showing a frontend countdown like "OTP expires in 45 seconds"

---

## Quick Recap (for fast revision)

- **TTL (Time To Live)** → auto-expiry time for a key, set via `'EX', seconds` in `redis.set()`
- **Lazy expiration** → checked when a key is accessed
- **Active expiration** → background sweep (~10x/sec) that proactively deletes expired keys
- **`redis.ttl(key)`** → returns seconds left (`-1` = no expiry, `-2` = key doesn't exist)
- **`redis.del(key)`** → manual deletion, used here to enforce one-time OTP use
- OTP flow: generate 6-digit code → store with 60s TTL → verify by comparing → delete on success