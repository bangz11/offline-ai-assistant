# Offline AI Assistant

**A local AI chatbot using Docker, Ollama and a web interface.**

An Offline AI Assistant is a chatbot that runs AI models locally on your computer. Users ask questions through a website and receive answers without sending anything to an online AI service. After the first download, it works **without internet**.

**Main technologies:** Docker, Docker Compose, Ollama, Nginx, HTML, CSS, JavaScript. Optional: Hermes Agent.

---

## Table of Contents

1. [About the Project](#1-about-the-project)
2. [System Architecture](#2-system-architecture)
3. [Project Flow](#3-project-flow)
4. [The Local AI Models](#4-the-local-ai-models)
5. [Docker](#5-docker)
6. [Technologies Used](#6-technologies-used)
7. [Project Structure](#7-project-structure)
8. [Understanding the Code](#8-understanding-the-code)
9. [Installation Guide](#9-installation-guide)
10. [How to Use the Assistant](#10-how-to-use-the-assistant)
11. [Testing Offline](#11-testing-the-assistant-offline)
12. [Useful Docker Commands](#12-useful-docker-commands)
13. [Troubleshooting](#13-troubleshooting)
14. [Hermes Agent](#14-hermes-agent)
15. [Requirements Checklist](#15-requirements-checklist)
16. [What I Learned](#16-what-i-learned)
17. [Conclusion](#17-conclusion)

---

## 1. About the Project

Many AI applications need the internet because their models run on remote servers. This project uses **local models** instead. The user talks to the AI through a simple website with an emerald green and gold theme. The website sends questions to Ollama, which runs the selected model and returns the answer.

### Main Features

- Chat with a local AI model
- Select between two models: `llama3.2:3b` and `qwen2.5:1.5b`
- See answers as they are generated (streaming)
- Stop a response, or clear the conversation
- A status badge shows whether Ollama is connected
- Everything runs with Docker Compose
- Works offline after the first download

---

## 2. System Architecture

```
                 USER
                   |
                   v
          +------------------+
          |   WEB BROWSER    |   Chat interface
          +------------------+
                   |
                   v
          +------------------+
          |      NGINX       |   Serves the website and
          |  (web container) |   forwards /api/ to Ollama
          +------------------+
                   |      Docker network: ai-net
                   v
          +------------------+
          |      OLLAMA      |   Runs the local AI models
          | (ollama container)|
          +------------------+
                   |
                   v
          llama3.2:3b  /  qwen2.5:1.5b
```

**How it works**

1. **Web browser:** the user types a question.
2. **Nginx:** serves the website and forwards API requests to Ollama.
3. **Ollama:** loads and runs the selected model.
4. **AI model:** generates the answer.
5. **Response:** travels back through Ollama and Nginx to the browser.

The containers talk through the Docker network `ai-net`. The browser never connects to the Ollama container directly.

---

## 3. Project Flow

```
Open the website
      |
Select an AI model
      |
Type a question
      |
JavaScript sends the request to /api/chat
      |
Nginx forwards it to http://ollama:11434
      |
The selected model generates an answer
      |
The answer streams back to the website
      |
The user reads the answer
```

**Example:** the user asks "What is Docker?". JavaScript sends the question, Nginx forwards it, Ollama uses the selected model, and the website shows the explanation as it is generated. All of this happens on your own computer.

---

## 4. The Local AI Models

An AI model is the part that generates answers. **Ollama** is the software that loads and runs it. **Docker** runs Ollama and the other services. The **website** is how the user talks to the model.

| Feature | `llama3.2:3b` | `qwen2.5:1.5b` |
|---------|---------------|----------------|
| Size | 3 billion parameters | 1.5 billion parameters |
| Memory use | Higher (about 2.6 GB loaded) | Lower (about 1.2 GB loaded) |
| Speed | Slower | Faster |
| Purpose | Local question answering | Local question answering |

Actual speed depends on your computer. Ollama is set to keep **one model loaded at a time** (`OLLAMA_MAX_LOADED_MODELS: 1`) so it fits in limited Docker memory. Switching models therefore takes a moment.

---

## 5. Docker

Docker runs applications and their dependencies in **containers**. Docker Compose starts and connects several containers with one command.

### Docker Services

| Service | Container | Purpose |
|---------|-----------|---------|
| `ollama` | `ollama` | Runs the local AI models |
| `model-init` | `model-init` | Downloads the models if they are missing, then exits (this is normal) |
| `web` | `offline-ai-web` | Nginx website, built from `web/Dockerfile` |
| `hermes` | `hermes-agent` | Separate terminal AI agent (the website does **not** use it) |

### Docker Network

All services are on the network **`ai-net`**. Inside it, Nginx reaches Ollama at `http://ollama:11434`, where `ollama` is the service name.

### Docker Volumes

| Volume | Stores |
|--------|--------|
| `ollama_data` | The downloaded AI models (this is why it works offline) |
| `hermes_data` | Hermes Agent settings |

> **Important:** never run `docker compose down -v` unless you want to delete the models.

---

## 6. Technologies Used

| Technology | Explanation |
|------------|-------------|
| Docker | Runs applications in containers |
| Docker Compose | Starts and connects the services |
| Ollama | Runs the local AI models |
| Nginx | Serves the website and forwards API requests |
| HTML | Structure of the website |
| CSS | Appearance (emerald green and gold theme) |
| JavaScript | Sends questions and displays answers |
| Hermes Agent | Optional separate terminal agent |
| Git and GitHub | Store and share the source code |

---

## 7. Project Structure

```
offline-ai-assistant/
|-- docker-compose.yml
|-- README.md
|-- .gitignore
|
|-- web/
    |-- Dockerfile
    |-- nginx.conf
    |-- index.html
    |-- style.css
    |-- app.js
```

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines the services, network, volumes and startup order |
| `web/Dockerfile` | Builds the website image (Nginx) |
| `web/nginx.conf` | Serves the site and forwards `/api/` to Ollama |
| `web/index.html` | Page structure: chat area, input, buttons, model selector |
| `web/style.css` | Layout and the emerald and gold design |
| `web/app.js` | Chat logic: sends questions, shows streamed answers, handles Stop and Clear |
| `README.md` | Documentation |

---

## 8. Understanding the Code

### A. HTML: the structure

```html
<h1>Offline <span>AI Assistant</span></h1>
<textarea id="input" placeholder="Type your question..."></textarea>
<button id="send">Send</button>
```

### B. CSS: the design

```css
:root {
  --emerald: #064e3b;
  --gold: #d4af37;
}
body {
  background: radial-gradient(circle at top, #064e3b, #032b20 70%);
  color: #f8f5e8;
}
```

Emerald is the background and the AI's messages. Gold is used for the title, borders, your messages and the Send button.

### C. JavaScript: sending a question

```javascript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: getModel(),            // selected model
    messages: recentHistory,      // the conversation
    stream: true,                 // show the answer as it is generated
    options: { num_ctx: 4096, num_predict: 256, temperature: 0.3 },
    keep_alive: "10m"             // keep the model in memory
  })
});
```

The settings keep answers fast on a computer without a GPU: a small context (`num_ctx`), a limit on answer length (`num_predict`), and only the last 6 messages are sent.

### D. Nginx: connecting the website to Ollama

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;

location /api/ {
    set $ollama_upstream http://ollama:11434;
    proxy_pass $ollama_upstream;
    proxy_buffering off;
}
```

Requests to `/api/` are forwarded to the `ollama` service. The `resolver` line makes Nginx look up Ollama's address again every few seconds, so the website keeps working if Ollama restarts. `proxy_buffering off` lets the streamed words reach the browser immediately.

### E. Docker Compose: starting everything

```bash
docker compose up -d
```

This one command starts all services in the background.

---

## 9. Installation Guide

### Requirements

- Docker Desktop (or Docker Engine) with Docker Compose
- Git
- About 5 GB of free disk space
- At least 4 GB of memory available to Docker
- **Internet for the first run only**

### Step 1: Download the project

```bash
git clone https://github.com/bangz11/offline-ai-assistant.git
cd offline-ai-assistant
```

### Step 2: Check Docker

```bash
docker --version
docker compose version
```

Make sure Docker Desktop is running.

### Step 3: Start the project (internet needed)

```bash
docker compose up -d --build
```

### Step 4: Wait for the models

```bash
docker compose logs -f model-init
```

The download is about 3 GB. When the log finishes (`success`), press `Ctrl+C`. This does not stop the containers.

### Step 5: Check the models

```bash
docker compose exec ollama ollama list
```

You should see `llama3.2:3b` and `qwen2.5:1.5b`.

### Step 6: Warm up a model (recommended)

The first answer is slow because the model loads into memory. Load it once:

```bash
docker compose exec ollama ollama run qwen2.5:1.5b "hi"
```

Type `/bye` after the reply.

### Step 7: Open the website

Go to **http://localhost:8080**. The badge should say **Ollama connected**.

---

## 10. How to Use the Assistant

1. Open http://localhost:8080.
2. Choose a model in the dropdown.
3. Type a question and press **Enter** (**Shift + Enter** adds a new line).
4. Wait for the answer. Click **Stop** to cancel a long answer.
5. Click **Clear conversation** to start again.

**Example questions**

- What is information technology?
- Explain Docker in simple words.
- What is the difference between HTML and CSS?
- Give me three tips for studying programming.

The first answer can take a minute while the model loads. Do not press Stop during that time.

---

## 11. Testing the Assistant Offline

1. Start the project **with internet** and make sure both models are installed.
2. Ask one question to confirm it works.
3. **Turn off Wi-Fi** (or unplug Ethernet).
4. Restart the services:
   ```bash
   docker compose down
   docker compose up -d
   ```
5. Open http://localhost:8080 and ask a question.

It answers because the models are stored in the `ollama_data` volume and the Docker images are already on the computer.

> **While offline, use `docker compose up -d` only. Do not add `--build`**, because building checks the internet for the base image.
> Do not run `docker compose down -v` or `docker system prune`. They delete the models or the stored images.

---

## 12. Useful Docker Commands

| Task | Command |
|------|---------|
| Start services | `docker compose up -d` |
| Build and start (internet needed) | `docker compose up -d --build` |
| Stop services (keeps models) | `docker compose down` |
| Check service status | `docker compose ps` |
| View logs | `docker compose logs -f ollama web` |
| List installed models | `docker compose exec ollama ollama list` |
| Models loaded in memory | `docker compose exec ollama ollama ps` |
| Validate the configuration | `docker compose config -q` |

---

## 13. Troubleshooting

| Problem | Solution |
|---------|----------|
| Website does not open | Run `docker compose ps` |
| Badge stays on "Checking..." | Run `docker compose restart web`, then press `Ctrl+Shift+R` |
| "Ollama unreachable" | Check that the `ollama` container is running |
| "Model not found" | Run `docker compose exec ollama ollama list` |
| "Failed to fetch" | Docker may be out of memory. Use one model at a time and close other programs |
| Stuck on "Thinking..." | The model is loading. Wait 1 to 2 minutes |
| Answers are slow | Use `qwen2.5:1.5b`, ask short questions, warm up the model first |
| Old page shown | Press `Ctrl+Shift+R` |
| Compose file error | Run `docker compose config -q` to see the line |

---

## 14. Hermes Agent

**What it is:** Hermes Agent (by Nous Research) is a separate, terminal-based AI agent.

**Its role in this project:** it runs in its own Docker container (`hermes-agent`) on the same `ai-net` network and was configured with `hermes setup` to use the same Ollama server (`http://ollama:11434/v1`, model `llama3.2:3b`). The connection was verified: Hermes reached Ollama's API.

**What it does not do:** **the website does not use Hermes.** The web chat talks directly to Ollama through Nginx.

**Limitation:** Hermes requires a context window of at least 64,000 tokens. On this computer, Docker has only about 3.6 GB of memory, and loading a 64k context made Ollama's model process run out of memory, so Hermes could not complete a chat here. On a computer with more RAM, add this to the `ollama` service in `docker-compose.yml`:

```yaml
    environment:
      OLLAMA_CONTEXT_LENGTH: "65536"
      OLLAMA_FLASH_ATTENTION: "1"
      OLLAMA_KV_CACHE_TYPE: "q8_0"
```

**Open Hermes:**

```bash
docker compose run --rm hermes
```

---

## 15. Requirements Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Docker Compose runs the services | Done |
| 2 | Hermes Agent in a Docker container | Container runs; chat needs more RAM (section 14) |
| 3 | Ollama in Docker with `llama3.2:3b` | Done (plus `qwen2.5:1.5b`) |
| 4 | HTML/CSS/JS website, emerald green and gold | Done |
| 5 | Users ask questions and get local answers | Done |
| 6 | Works offline after downloads | Done (tested with Wi-Fi off) |
| 7 | Containers communicate through a Docker network | Done (`ai-net`) |
| 8 | GitHub with source, Dockerfile, compose, README | Done |

---

## 16. What I Learned

- Running AI models locally
- Using Docker and Docker Compose
- Connecting services through a Docker network
- Serving a website and forwarding requests with Nginx
- Building a website with HTML, CSS and JavaScript
- Displaying streamed AI responses
- Troubleshooting containers, memory limits and startup problems
- Testing an application without internet

---

## 17. Conclusion

The Offline AI Assistant shows how a local AI model can be connected to a website using Docker, Ollama and Nginx. The user types a question, JavaScript sends it, Nginx forwards it to Ollama, and the selected model generates the answer. The main advantage is that it runs on the user's computer without depending on an online AI service after the required software and models have been downloaded.

**Author:** [bangz11](https://github.com/bangz11)
