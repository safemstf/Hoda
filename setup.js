import { ChatModule } from "https://esm.run/webllm";

class LlamaEnvironment {
  constructor() {
    this.modelName = "Llama-3-8B-Instruct-q4f16_1";
    this.chat = null;
    this.ready = false;
    this.startBtn = document.getElementById("start-btn");
    this.progress = document.getElementById("progress");
    this.status = document.getElementById("status");
    this.logBox = document.getElementById("log");
  }

  log(msg) {
    const time = new Date().toLocaleTimeString();
    this.logBox.textContent += `\n[${time}] ${msg}`;
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }

  setStatus(message, type) {
    this.status.textContent = message;
    this.status.className = type;
  }

  memoryReport() {
    if (!performance.memory) return "Memory info not supported in this browser.";
    const m = performance.memory;
    return `Used: ${(m.usedJSHeapSize / 1e6).toFixed(1)} MB | Limit: ${(m.jsHeapSizeLimit / 1e6).toFixed(1)} MB`;
  }

  async initModel() {
    try {
      this.setStatus("🦙 Loading Llama model, please wait...", "loading");
      this.log(`Initializing ${this.modelName}...`);

      const t0 = performance.now();
      this.chat = new ChatModule();
      this.log("Chat module created.");

      await this.chat.reload(this.modelName, undefined, {
        model_list: [
          {
            model_url: `https://huggingface.co/mlc-ai/${this.modelName}/resolve/main/`,
            local_id: this.modelName,
          },
        ],
      });

      const duration = ((performance.now() - t0) / 1000).toFixed(2);
      this.ready = true;
      this.progress.value = 100;

      this.setStatus("✅ Llama model ready for use.", "ready");
      this.log(`Model loaded in ${duration}s`);
      this.log(this.memoryReport());
    } catch (e) {
      this.setStatus("❌ Model failed to load.", "error");
      this.log(`Error: ${e.message}`);
      console.error("WebLLM Error:", e);
    }
  }

  attach() {
    this.startBtn.addEventListener("click", async () => {
      if (this.ready) return this.log("Model already initialized.");
      await this.initModel();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const env = new LlamaEnvironment();
  env.attach();
  console.log("Llama environment setup ready.");
});