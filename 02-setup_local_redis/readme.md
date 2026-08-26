# Docker Compose Notes — Redis + MongoDB Setup

Revision notes for understanding this `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: sinkai_aur_redis
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis-data:/data

  mongo:
    image: mongo:7
    container_name: sinkai_aur_mongo
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: chai_aur_redis
    volumes:
      - mongo-data:/data/db

volumes:
  redis-data:
  mongo-data:
```

---

## 1. Core Concepts

### Image
A pre-built template/blueprint containing software + OS libraries + dependencies already installed. Example: `redis:7-alpine` = Redis v7 pre-installed on Alpine Linux (a lightweight OS). Downloaded from Docker Hub.

### Container
A **running instance** of an image. Image = recipe, Container = the actual running dish made from that recipe. One image can spawn multiple containers.

### Volume
Containers are **ephemeral** by default — data disappears if the container is deleted. A volume is persistent storage kept outside the container (on the host machine), so data survives container restarts/deletion.

---

## 2. File Structure Breakdown

### `services:`
Declares multiple containers that will run together as part of this compose setup.

### Redis Service

| Key | Meaning |
|---|---|
| `image: redis:7-alpine` | Which image to use to build the container |
| `container_name: sinkai_aur_redis` | Custom name for the container |
| `ports: "6379:6379"` | Maps **host_port:container_port** — lets you access Redis via `localhost:6379` on your machine |
| `command: ["redis-server", "--appendonly", "yes"]` | Command run when the container starts — enables Redis **AOF (Append Only File) persistence**, so data is written to disk instead of staying purely in-memory |
| `volumes: redis-data:/data` | Links Redis's internal `/data` folder to the named volume `redis-data`, so data persists across restarts |

### Mongo Service

| Key | Meaning |
|---|---|
| `image: mongo:7` | MongoDB v7 image |
| `container_name: sinkai_aur_mongo` | Custom container name |
| `ports: "27017:27017"` | Standard MongoDB port, host to container mapping |
| `environment: MONGO_INITDB_DATABASE` | Sets an environment variable inside the container — tells Mongo which default database to create on first startup |
| `volumes: mongo-data:/data/db` | Mongo stores its data in `/data/db` — linked to the named volume `mongo-data` for persistence |

### Bottom-level `volumes:` block
```yaml
volumes:
  redis-data:
  mongo-data:
```
**Declares** the named volumes so Docker can manage their actual storage location on the host. Without this declaration, the `volumes:` references inside each service won't work.

---

## 3. What Happens on `docker-compose up`

- Two containers spawn: one for Redis, one for MongoDB
- Both are accessible on their respective ports (`6379` and `27017`)
- Both persist their data via volumes — even if the containers are stopped/removed, the data remains and gets reattached on next run

---

## Quick Recap (for fast revision)

- **Image** → blueprint/template
- **Container** → running instance of an image
- **Volume** → persistent storage outside the container
- **ports: "host:container"** → connects your machine's port to the container's port
- **command** → overrides the default startup command of the image
- **environment** → sets env vars inside the container
- **top-level `volumes:`** → must declare named volumes here before using them in services