import { testCommands } from './test-data.js';

// Global variables
let chat = null;
let modelLoaded = false;
let loadStartTime = null;

// DOM elements
const statusEl = document.getElementById('status');
const commandInput = document.getElementById('commandInput');
const processBtn = document.getElementById('processBtn');
const outputEl = document.getElementById('output');

// Update status display
function updateStatus(message, type = 'loading') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

// Show output
function showOutput(content) {
    outputEl.textContent = content;
    outputEl.style.display = 'block';
}

// Load WebLLM model
async function loadModel() {
    try {
        updateStatus('Loading WebLLM...', 'loading');
        
        // Import WebLLM dynamically with error handling
        let ChatModule;
        try {
            const webllmModule = await import('https://esm.run/webllm');
            ChatModule = webllmModule.ChatModule;
        } catch (importError) {
            console.error('WebLLM import failed:', importError);
            // Try alternative import method
            try {
                const webllmModule = await import('https://cdn.skypack.dev/webllm');
                ChatModule = webllmModule.ChatModule;
            } catch (altError) {
                console.error('Alternative WebLLM import failed:', altError);
                throw new Error('Failed to import WebLLM: ' + importError.message);
            }
        }
        
        updateStatus('Initializing model...', 'loading');
        loadStartTime = performance.now();
        
        // Create chat instance with a lightweight model
        if (!ChatModule) {
            throw new Error('ChatModule not available');
        }
        chat = new ChatModule();
        
        // Try to load Phi-2-q4f16_1, fallback to other lightweight models
        const modelOptions = [
            'Phi-2-q4f16_1',
            'Phi-2-q4f32_1', 
            'TinyLlama-1.1B-Chat-v0.4-q4f16_1',
            'RedPajama-INCITE-Chat-3B-v1-q4f16_1'
        ];
        
        let modelId = null;
        for (const model of modelOptions) {
            try {
                updateStatus(`Loading ${model}...`, 'loading');
                await chat.reload(model);
                modelId = model;
                break;
            } catch (error) {
                console.warn(`Failed to load ${model}:`, error);
                continue;
            }
        }
        
        if (!modelId) {
            throw new Error('Could not load any compatible model');
        }
        
        const loadTime = ((performance.now() - loadStartTime) / 1000).toFixed(2);
        
        // Get memory usage if available
        let memoryInfo = '';
        if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            memoryInfo = ` | Memory: ${usedMB}MB`;
        }
        
        updateStatus(`Model loaded ✅\nModel: ${modelId}\nLoad time: ${loadTime}s${memoryInfo}`, 'success');
        
        // Enable UI
        commandInput.disabled = false;
        processBtn.disabled = false;
        modelLoaded = true;
        
        console.log(`Model loaded: ${modelId}`);
        console.log(`Load time: ${loadTime}s`);
        
    } catch (error) {
        console.error('Model loading failed:', error);
        updateStatus(`Model loading failed: ${error.message}`, 'error');
    }
}

// Process natural language command into structured JSON
async function processCommand(text) {
    if (!modelLoaded || !chat) {
        throw new Error('Model not loaded');
    }
    
    const prompt = `Convert this natural language command into a structured JSON intent. 
Only return valid JSON, no additional text.

Examples:
"scroll down" → {"intent":"scroll","direction":"down"}
"find login" → {"intent":"find","target":"login"}
"read this" → {"intent":"read","target":"this"}
"zoom in" → {"intent":"zoom","direction":"in"}
"help me" → {"intent":"help"}

Command: "${text}"

JSON:`;

    try {
        console.log('Processing command:', text);
        console.log('Prompt:', prompt);
        
        const response = await chat.generate(prompt);
        console.log('Raw response:', response);
        
        // Clean up the response to extract JSON
        let jsonStr = response.trim();
        
        // Remove any text before the first {
        const jsonStart = jsonStr.indexOf('{');
        if (jsonStart !== -1) {
            jsonStr = jsonStr.substring(jsonStart);
        }
        
        // Remove any text after the last }
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonEnd !== -1) {
            jsonStr = jsonStr.substring(0, jsonEnd + 1);
        }
        
        // Parse and validate JSON
        const parsed = JSON.parse(jsonStr);
        console.log('Parsed JSON:', parsed);
        
        return {
            input: text,
            rawResponse: response,
            parsedIntent: parsed
        };
        
    } catch (error) {
        console.error('Command processing failed:', error);
        throw new Error(`Failed to process command: ${error.message}`);
    }
}

// Handle form submission
async function handleSubmit() {
    const command = commandInput.value.trim();
    if (!command) return;
    
    try {
        processBtn.disabled = true;
        updateStatus('Processing command...', 'loading');
        
        const result = await processCommand(command);
        
        const output = `Input: "${result.input}"

Raw Response:
${result.rawResponse}

Parsed Intent:
${JSON.stringify(result.parsedIntent, null, 2)}`;
        
        showOutput(output);
        updateStatus('Command processed ✅', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        updateStatus(`Error: ${error.message}`, 'error');
        showOutput(`Error processing command: ${error.message}`);
    } finally {
        processBtn.disabled = false;
    }
}

// Load test command into input
window.loadTestCommand = function(command) {
    commandInput.value = command;
    commandInput.focus();
};

// Event listeners
processBtn.addEventListener('click', handleSubmit);
commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSubmit();
    }
});

// Initialize
loadModel();
