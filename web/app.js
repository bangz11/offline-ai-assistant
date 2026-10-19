const modelSelect = document.getElementById("model");
const getModel = () => modelSelect.value;

const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");

const SYSTEM = {
  role: "system",
  content:
    "You are a helpful offline AI assistant. Answer clearly and directly. " +
    "Keep answers concise unless the user asks for details. " +
    "For simple calculations, answer immediately without unnecessary explanation."
};

let history = [SYSTEM];
let controller = null;

const MAX_HISTORY_MESSAGES = 6;

function addMsg(text, cls) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

async function checkStatus() {
  const label = statusEl.querySelector("span");

  try {
    const r = await fetch("/api/tags");
    if (!r.ok) throw new Error("Ollama unavailable");

    const data = await r.json();
    const selected = getModel();

    const ok = (data.models || []).some(
      m => m.name === selected || m.name.startsWith(selected + ":")
    );

    statusEl.className = "status " + (ok ? "ok" : "err");
    label.textContent = ok ? "Ollama connected" : "Model not found";
  } catch {
    statusEl.className = "status err";
    label.textContent = "Ollama unreachable";
  }
}

async function send() {
  const text = input.value.trim();

  if (!text || controller) return;

  input.value = "";
  input.style.height = "auto";

  addMsg(text, "user");

  history.push({
    role: "user",
    content: text
  });

  // Keep the system message and only the latest conversation messages.
  const recentHistory = [
    SYSTEM,
    ...history.slice(1).slice(-MAX_HISTORY_MESSAGES)
  ];

  const bubble = addMsg("Thinking...", "bot");

  controller = new AbortController();

  sendBtn.textContent = "Stop";
  sendBtn.classList.add("stop");

  let answer = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: getModel(),
        messages: recentHistory,
        stream: true,
        options: {
          num_ctx: 4096,
          num_predict: 256,
          temperature: 0.3
        },
        keep_alive: "10m"
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(
        "Ollama returned HTTP " + res.status + ": " + await res.text()
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        const obj = JSON.parse(line);

        if (obj.error) {
          throw new Error(obj.error);
        }

        if (obj.message?.content) {
          answer += obj.message.content;
          bubble.textContent = answer;
          chat.scrollTop = chat.scrollHeight;
        }
      }
    }

    // Process any final buffered response.
    if (buffer.trim()) {
      const obj = JSON.parse(buffer);

      if (obj.error) throw new Error(obj.error);

      if (obj.message?.content) {
        answer += obj.message.content;
        bubble.textContent = answer;
      }
    }

    if (!answer.trim()) {
      bubble.textContent = "The model returned an empty response. Please try again.";
    }

    // Save only the completed answer to conversation history.
    history.push({
      role: "assistant",
      content: answer
    });

    // Prevent conversation history from growing indefinitely.
    history = [
      SYSTEM,
      ...history.slice(1).slice(-MAX_HISTORY_MESSAGES)
    ];

  } catch (e) {
    if (e.name === "AbortError") {
      bubble.textContent = answer
        ? answer + " [stopped]"
        : "[Response stopped]";

      // Keep a partial answer only if some text was generated.
      if (answer.trim()) {
        history.push({
          role: "assistant",
          content: answer
        });
      }
    } else {
      bubble.textContent = "Error: " + e.message;
      bubble.classList.add("err");

      // Remove the unanswered user message.
      history.pop();
      console.error("Chat request failed:", e);
    }
  } finally {
    controller = null;
    sendBtn.textContent = "Send";
    sendBtn.classList.remove("stop");

    checkStatus();
  }
}

sendBtn.addEventListener("click", () => {
  if (controller) {
    controller.abort();
  } else {
    send();
  }
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

document.getElementById("clear").addEventListener("click", () => {
  if (controller) controller.abort();

  history = [SYSTEM];
  chat.innerHTML = "";

  addMsg("Conversation cleared. Ask me anything!", "bot");
});

modelSelect.addEventListener("change", checkStatus);

checkStatus();
setInterval(checkStatus, 15000);