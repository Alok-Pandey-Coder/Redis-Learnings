# Redis: JSON String vs Hash — Revision Notes

```javascript
import express from "express"
import Redis from "ioredis"

const app = express()
app.use(express.json())

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

app.post('/user/:id/json', async(req, res) => {
  await redis.set(`user:${req.params.id}:json`, JSON.stringify(req.body));
  res.json({savedAs: "json"});
})

app.post('/user/:id/hash', async(req, res) => {
  await redis.hset(`user:${req.params.id}:json`, req.body);
  res.json({savedAs: 'hash'});
})

app.get('/user/:id/json', async(req, res) => {
  const raw = await redis.get(`user:${req.params.id}:json`);
  res.json({user: raw ? JSON.parse(raw): null});
})

app.get('/user/:id/hash', async(req, res) => {
  const user = await redis.hgetall(`user:${req.params.id}:json`);
  res.json({user});
})

app.listen(3000, () => {
  console.log("server id running on port http://localhost:3000")
})
```

---

## ⚠️ Bug to note

Both `/json` and `/hash` POST routes use the **same key**:
```javascript
`user:${req.params.id}:json`   // used in BOTH routes
```
The hash route should use a different suffix (e.g. `:hash`), otherwise both routes clash on the same key — and Redis will error/conflict since a single key can't hold two different data types (string + hash) at once.

**Fix:**
```javascript
`user:${req.params.id}:hash`
```

---

## 1. Redis Data Types Used Here

Redis isn't just plain key → string. It supports multiple **data structures**. This code compares two of them:

### String (storing JSON) — `set` / `get`
```javascript
await redis.set(`user:${req.params.id}:json`, JSON.stringify(req.body));
```
- The entire object is stored as **one single string** (a text blob). Redis has no idea what's inside it.
- Requires manual serialization: `JSON.stringify()` before saving, `JSON.parse()` after reading.
- The object is stored/retrieved **as a whole unit** — to change even one field, you must fetch the whole object, parse it, modify it, and save the whole thing back.

### Hash — `hset` / `hgetall`
```javascript
await redis.hset(`user:${req.params.id}:json`, req.body);
```
- A Hash is a **native Redis data structure** that stores multiple **field-value pairs** under one key — like a JS object, but Redis itself understands the structure (unlike a JSON string, which is an opaque blob to Redis).
- Example: `req.body = {name: "Alok", age: 22}` gets stored internally as:
  ```
  user:5:hash
    ├── name → "Alok"
    └── age  → "22"
  ```
- Lets you access/update/delete **individual fields** directly, without touching the rest:
  ```javascript
  await redis.hset("user:5:hash", "age", "23");  // update only age
  await redis.hget("user:5:hash", "name");         // fetch only name
  await redis.hdel("user:5:hash", "age");          // delete only age
  ```

---

## 2. `hset`, `hget`, `hgetall` Explained

### `hset`
```javascript
redis.hset(key, field, value)
// or multiple fields at once:
redis.hset(key, {field1: value1, field2: value2})
```
Sets field(s) inside a Hash key. In this code:
```javascript
await redis.hset(`user:${req.params.id}:json`, req.body);
```
`req.body` (an object like `{name: "Alok", city: "Noida"}`) is passed directly — `ioredis` auto-converts it into field-value pairs. **No `JSON.stringify()` needed** since Redis handles fields natively.

### `hget` (not in this code, but good to know)
```javascript
redis.hget(key, field)
```
Fetches only **one specific field's** value from a Hash:
```javascript
await redis.hget("user:5:json", "name"); // returns just "Alok"
```

### `hgetall`
```javascript
const user = await redis.hgetall(`user:${req.params.id}:json`);
```
Returns **all fields and values** of a Hash as an object:
```javascript
{ name: "Alok", city: "Noida" }
```
Comes back as a plain JS object directly — **no `JSON.parse()` needed** (it was never a JSON string to begin with, it's a native Redis hash).

---

## 3. JSON String vs Hash — Comparison Table

| | JSON String (`set`/`get`) | Hash (`hset`/`hgetall`) |
|---|---|---|
| **Storage** | Whole object as one text blob | Field-value pairs, structured inside Redis |
| **Serialization** | Manual — `JSON.stringify()` / `JSON.parse()` | Automatic — `ioredis` handles field-value conversion |
| **Partial update** | Not possible directly — fetch whole object, modify, save whole object back | Possible — update a single field via `hset` |
| **Partial read** | Must parse the whole object even for one field | `hget` fetches a single field directly |
| **Memory efficiency** | Fine for small objects | More efficient for large objects/many fields |
| **Use case** | When you always need the whole object together (config, cache) | When you need to read/update individual fields separately (user profile-like data) |

---

## 4. Route-by-Route Recap

| Route | What it does |
|---|---|
| `POST /user/:id/json` | `JSON.stringify(req.body)` → stores whole object as one string via `set` |
| `POST /user/:id/hash` | `hset` → stores object as field-value pairs in a hash *(bug: key still says `:json`, should be `:hash`)* |
| `GET /user/:id/json` | `get` → fetches string, `JSON.parse()`s it back into an object |
| `GET /user/:id/hash` | `hgetall` → fetches the whole hash directly as an object, no parsing needed |

---

## Quick Recap (for fast revision)

- **String + JSON.stringify** → whole object as opaque text; simple but no partial access
- **Hash (`hset`/`hgetall`)** → native structured storage; supports partial field read/update
- **`hset(key, field, value)`** → set one field, or pass an object for multiple fields at once
- **`hget(key, field)`** → get one field's value
- **`hgetall(key)`** → get all fields as a JS object (no parsing needed)
- Rule of thumb: use **Hash** when you'll often touch individual fields; use **JSON string** when you always read/write the object as a whole