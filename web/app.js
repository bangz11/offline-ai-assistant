const MODEL = "llama3.2:3b";
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");
const SYSTEM = { role: "system", content: "You are a helpful, concise assistant running fully offline on the user's computer." };

let history = [SYSTEM];
let controller = null;

function addMsg(text, cls) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

// Check that Ollama is reachable and the model is installed
async function checkStatus() {
  const label = statusEl.querySelector("span");
  try {
    const r = await fetch("/api/tags");
    const data = await r.json();
    const ok = (data.models || []).some(m => m.name === MODEL);
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
  input.value = ""; input.style.height = "auto";
  addMsg(text, "user");
  history.push({ role: "user", content: text });

  const bubble = addMsg("…", "bot");
  controller = new AbortController();
  sendBtn.textContent = "Stop"; sendBtn.classList.add("stop");
  let answer = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: history, stream: true }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Ollama returned HTTP " + res.status + ": " + (await res.text()));

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        if (obj.error) throw new Error(obj.error);
        if (obj.message?.content) {
          answer += obj.message.content;
          bubble.textContent = answer;
          chat.scrollTop = chat.scrollHeight;
        }
      }
    }
    history.push({ role: "assistant", content: answer });
  } catch (e) {
    if (e.name === "AbortError") {
      bubble.textContent = (answer || "") + " [stopped]";
      if (answer) history.push({ role: "assistant", content: answer });
    } else {
      bubble.textContent = "Error: " + e.message;
      bubble.classList.add("err");
      history.pop(); // remove the unanswered user message
    }
  } finally {
    controller = null;
    sendBtn.textContent = "Send"; sendBtn.classList.remove("stop");
    checkStatus();
  }
}

sendBtn.addEventListener("click", () => controller ? controller.abort() : send());
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});
document.getElementById("clear").addEventListener("click", () => {
  history = [SYSTEM];
  chat.innerHTML = "";
  addMsg("Conversation cleared. Ask me anything!", "bot");
});

checkStatus();
setInterval(checkStatus, 15000);
