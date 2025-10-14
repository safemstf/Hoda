// WebLLM Model Loader - Import WebLLM via ESM CDN
import { ChatModule } from 'https://esm.run/webllm';

class WebLLMModelLoader {
    constructor() {
        this.chat = null;
        this.isModelLoaded = false;
        this.loadStartTime = null;
        this.modelName = 'Phi-2-q4f16_1';
        this.statusElement = document.getElementById('status');
        this.outputElement = document.getElementById('output');
    }

    async init() {
        try {
            this.updateStatus('Initializing WebLLM...', 'loading');
            console.log('Starting WebLLM initialization...');
            
            // Initialize WebLLM chat module
            this.chat = new ChatModule();
            console.log('ChatModule initialized');
            
            // Start timing
            this.loadStartTime = performance.now();
            
            // Load Phi-2 model (lightweight model)
            await this.chat.reload(this.modelName, undefined, {
                "model_list": [
                    {
                        "model_url": "https://huggingface.co/mlc-ai/Phi-2-q4f16_1/resolve/main/",
                        "local_id": this.modelName
                    }
                ]
            });
            
            // Calculate load time
            const loadTime = performance.now() - this.loadStartTime;
            
            // Get memory usage (if available)
            const memoryUsage = this.getMemoryUsage();
            
            // Log model information
            console.log('Model loaded successfully!');
            console.log('Model name:', this.modelName);
            console.log('Load time:', `${(loadTime / 1000).toFixed(2)}s`);
            console.log('Memory usage:', memoryUsage);
            
            this.isModelLoaded = true;
            this.updateStatus('Model loaded successfully!', 'ready');
            this.showSuccessMessage(this.modelName, loadTime, memoryUsage);
            
        } catch (error) {
            console.error('Error initializing WebLLM:', error);
            this.updateStatus(`Error loading model: ${error.message}`, 'error');
            this.showErrorMessage(error);
        }
    }

    updateStatus(message, type) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            this.statusElement.className = `status ${type}`;
        }
    }

    getMemoryUsage() {
        // Try to get memory usage information
        if (performance.memory) {
            return {
                used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
            };
        } else {
            return 'Memory usage not available';
        }
    }

    showSuccessMessage(modelName, loadTime, memoryUsage) {
        if (this.outputElement) {
            const loadTimeSeconds = (loadTime / 1000).toFixed(2);
            let memoryInfo = '';
            
            if (typeof memoryUsage === 'object') {
                memoryInfo = `
Memory Usage:
- Used: ${memoryUsage.used}
- Total: ${memoryUsage.total}
- Limit: ${memoryUsage.limit}`;
            } else {
                memoryInfo = `Memory Usage: ${memoryUsage}`;
            }
            
            this.outputElement.innerHTML = `
<div style="color: #155724; background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 10px 0;">
    <h3>✅ Model Loaded Successfully!</h3>
    <p><strong>Model:</strong> ${modelName}</p>
    <p><strong>Load Time:</strong> ${loadTimeSeconds} seconds</p>
    <p><strong>${memoryInfo}</strong></p>
    <p>WebLLM is ready to use!</p>
</div>`;
        }
    }

    showErrorMessage(error) {
        if (this.outputElement) {
            this.outputElement.innerHTML = `
<div style="color: #721c24; background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0;">
    <h3>❌ Error Loading Model</h3>
    <p><strong>Error:</strong> ${error.message}</p>
    <p>Please check the console for more details.</p>
</div>`;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing WebLLM...');
    const modelLoader = new WebLLMModelLoader();
    await modelLoader.init();
});
