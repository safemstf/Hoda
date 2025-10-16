// ✅ Simpler WebLLM Llama3 loader (stable)
import * as webllm from "https://esm.sh/@mlc-ai/web-llm";

let chat;
const statusEl = document.getElementById("status");
const button = document.getElementById("analyzeBtn");
const output = document.getElementById("output");
const input = document.getElementById("userInput");

async function initModel() {
  try {
    statusEl.textContent = "⏳ Loading Llama 3-8B-Instruct...";
    chat = await webllm.CreateMLCEngine("Llama-3-8B-Instruct-q4f16_1", {
      initProgressCallback: (p) => {
        statusEl.textContent = `Loading: ${(p.progress * 100).toFixed(0)} %`;
      },
    });

    statusEl.textContent = "✅ Model ready! Type or speak.";
    statusEl.className = "ready";
    button.disabled = false;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Load error: " + err.message;
  }
}

async function getResponse(text) {
  if (!chat) return "Model not loaded yet.";
  const reply = await chat.chat({ messages: [{ role: "user", content: text }] });
  return reply.output_text || "No response.";
}

button.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;
  output.textContent = "Thinking...";
  const res = await getResponse(text);
  output.textContent = res;
});

initModel();
