# Offline AI Assistant (Docker + Ollama + llama3.2:3b)

A local AI chat assistant. After the model and images are downloaded once, it answers questions with **no internet connection**.

## Architecture

```
Browser ──► web (nginx :8080) ──/api/──► ollama (:11434, llama3.2:3b)
                                   all inside Docker network "ai-net"

hermes (optional, separate) ───────────► ollama
```

| Service      | Purpose |
|--------------|---------|
| `ollama`     | Runs the `llama3.2:3b` model. Models are saved in the `ollama_data` volume. |
| `model-init` | One-shot job: pulls `llama3.2:3b` only if it is missing (so it works offline later). |
| `web`        | nginx serving the HTML/CSS/JS site. It proxies `/api/` to `http://ollama:11434` over the Docker network. |
| `hermes`     | **Optional**, `--profile hermes`. Hermes Agent container. |

### Role of Hermes Agent (important)
Hermes Agent (by Nous Research) is a **separate, terminal-based AI agent**. In this project it is configured to use the same Ollama server as its model backend (`http://ollama:11434`), and it shares the Docker network.
**The website does NOT use Hermes.** The website talks directly to Ollama through nginx. Hermes is included as an additional agent you can run alongside Ollama.

## Requirements
- Docker Desktop (or Docker Engine) with Compose v2
- ~4 GB free disk, 8 GB RAM recommended
- Internet **only for the first setup**

## Setup (first time, with internet)
```bash
git clone <your-repo-url>
cd offline-ai-assistant
docker compose up -d --build
docker compose logs -f model-init     # watch the ~2 GB model download
```
When `model-init` finishes, open **http://localhost:8080**. The status badge should say **Ollama connected**.

## Test offline
1. Make sure the first setup finished and you can chat.
2. Disconnect Wi-Fi / unplug Ethernet.
3. Restart the stack:
   ```bash
   docker compose down
   docker compose up -d
   ```
4. Open http://localhost:8080 and ask a question. It still answers, because the model lives in the `ollama_data` volume and the images are cached locally.
   (Don't use `docker compose down -v`, that deletes the downloaded model.)

## Using Hermes Agent (optional)
```bash
# 1. One-time interactive setup: choose "Ollama" / custom endpoint
docker compose --profile hermes pull hermes
docker compose --profile hermes run --rm hermes setup
#    Endpoint:  http://ollama:11434/v1      Model: llama3.2:3b

# 2. Chat with Hermes in the terminal
docker compose --profile hermes run --rm hermes
```
Notes: Hermes needs internet to pull its image the first time. Small 3B models are limited for agent/tool tasks, so expect weaker results than the web chat. The Hermes data path in `docker-compose.yml` (`/opt/data`) may differ between image versions; check the Hermes docs if settings don't persist.

## Quick checks / troubleshooting
```bash
docker compose ps                                   # all services up?
docker compose exec ollama ollama list              # llama3.2:3b listed?
docker compose exec web wget -qO- http://ollama:11434/api/tags   # web -> ollama works?
docker compose logs web ollama
```
- **"Ollama unreachable"**: run `docker compose ps`; wait until `ollama` is healthy.
- **"Model not found"**: run `docker compose up model-init` with internet.
- **Slow answers**: normal on CPU; enable the GPU block in `docker-compose.yml` if you have an NVIDIA GPU.
- **Port 8080 busy**: change `"8080:80"` in `docker-compose.yml`.

## Project structure
```
docker-compose.yml
README.md
web/
  Dockerfile
  nginx.conf
  index.html
  style.css
  app.js
```

## Stop
```bash
docker compose down        # keeps the model
```

## Hermes Agent: current status and limitation
Hermes runs in Docker (profile `hermes`), shares the `ai-net` network, and is configured to use Ollama (`http://ollama:11434/v1`, model `llama3.2:3b`). The connection was verified (Hermes reached Ollama's API).
Hermes requires a context window of at least 64,000 tokens. On a CPU-only laptop this needs about 4 GB of extra RAM, and Ollama's model process was killed (out of memory), so Hermes could not complete a chat there. It should work on a machine with more RAM (set `OLLAMA_CONTEXT_LENGTH=65536` on the ollama service).
The website does NOT use Hermes. It talks directly to Ollama through nginx.
