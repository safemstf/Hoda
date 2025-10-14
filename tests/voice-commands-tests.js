import { MicrophoneManager } from '../services/stt/src/microphoneManager.js';
import { SpeechRecognitionService } from '../services/stt/src/speechRecognitionService.js';
import { CommandNormalizer } from '../services/stt/src/commandNormalizer.js';
import { INTENT_SCHEMAS } from '../services/stt/src/intents-temporary.js';

let micManager = null;
let speechRecognition = null;
let commandNormalizer = null;
let isActive = false;

const voiceBtn = document.getElementById('voice-btn');
const statusText = document.getElementById('status-text');
const substatusText = document.getElementById('status-subtext');
const transcriptText = document.getElementById('transcript-text');
const feedback = document.getElementById('feedback');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackDetails = document.getElementById('feedback-details');
const commandLog = document.getElementById('command-log');
const commandLogList = document.getElementById('command-log-list');

let commandHistory = [];

// Category icons
const categoryIcons = {
    navigate: '🧭',
    read: '📖',
    form_action: '📝',
    zoom: '🔍',
    find_content: '🔎',
    link_action: '🔗',
    help: '❓'
};

// Build command panel from INTENT_SCHEMAS
function buildCommandPanel() {
    const commandPanel = document.getElementById('command-panel');
    for (const [intentName, intentSchema] of Object.entries(INTENT_SCHEMAS)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'command-category';

        const icon = categoryIcons[intentName] || '•';
        const title = (intentSchema.description || '').split('(')[0].trim();

        categoryDiv.innerHTML = `
            <div class="category-title">${icon} ${title}</div>
            <ul class="command-list">
                ${intentSchema.examples.map(example =>
            `<li class="command-item"><code>${escapeHtml(example)}</code></li>`
        ).join('')}
            </ul>
        `;

        commandPanel.appendChild(categoryDiv);
    }
}

// Build the panel on load
buildCommandPanel();

// Initialize
async function initialize() {
    try {
        // Initialize microphone
        micManager = new MicrophoneManager();
        const micSuccess = await micManager.initialize();

        if (!micSuccess) {
            throw new Error('Failed to initialize microphone');
        }

        // Initialize speech recognition with WASM-only options
        // IMPORTANT: Change modelUrl to wherever you host your model files locally
        speechRecognition = new SpeechRecognitionService(micManager, {
            modelSize: 'tiny-en-q5_1',
            modelUrl: '/src/models/ggml-tiny.en.bin',
            workerUrl: '/src/worker/speech-worker.js',
            bundleUrl: '/src/vender/bin/libstream.js',
            allowAutoLoad: false,
            defaultConfidence: 0.92
        });

        // Initialize command normalizer
        commandNormalizer = new CommandNormalizer();

        // Set up event listeners BEFORE loading model so status updates flow
        setupEventListeners();

        // Load model up-front to avoid any HTTP upload fallback paths
        statusText.textContent = 'Loading model...';
        substatusText.textContent = 'Preparing local STT engine';
        try {
            await speechRecognition.loadModel();
            statusText.textContent = 'Model loaded';
            substatusText.textContent = 'Ready to listen';
        } catch (err) {
            // If model load fails, show a clear error and propagate
            console.error('Model load failed:', err);
            showFeedback('error', '❌ Model Load Failed', err?.message || String(err));
            throw err;
        }

        return true;
    } catch (error) {
        console.error('Initialization error:', error);
        showFeedback('error', '❌ Initialization Error', error.message || String(error));
        return false;
    }
}

function setupEventListeners() {
    // Listen for transcripts
    speechRecognition.onTranscript((data) => {
        transcriptText.textContent = data.text || 'Listening...';
        transcriptText.className = `transcript-text ${data.isFinal ? '' : 'interim'}`;
    });

    // Listen for commands
    speechRecognition.onCommand((sttInput) => {
        handleCommand(sttInput);
    });

    // Listen for errors (increment failedCommands so stats reflect failures)
    speechRecognition.onError((errorData) => {
        console.error('Speech error:', errorData);

        // increment failedCommands for stats if available
        if (speechRecognition && typeof speechRecognition.stats === 'object') {
            speechRecognition.stats.failedCommands = (speechRecognition.stats.failedCommands || 0) + 1;
            updateStats();
        }

        // Provide user-facing feedback but don't forcibly stop listening for non-critical errors
        if (errorData?.type === 'network') {
            // If the underlying library truly reports network, show a clear message.
            // But since you're running offline WASM, this should not happen — it's here defensively.
            showFeedback('error', '🌐 Network Error', (errorData.message || 'Network error from STT engine') + '\nIf you expected local mode, check modelUrl and WASM bundle.');
        } else if (errorData?.type === 'validation') {
            showFeedback('warning', '⚠️ Validation Error', errorData.message || 'Invalid STT input format');
        } else {
            showFeedback('error', '❌ Error', errorData.message || JSON.stringify(errorData));
        }
    });

    // Listen for status changes and reflect in UI
    speechRecognition.onStatus((status, data) => {
        console.log('Status:', status, data);
        switch (status) {
            case 'loading_model':
                statusText.textContent = 'Loading model...';
                substatusText.textContent = data?.modelSize ? `Model: ${data.modelSize}` : 'Loading...';
                break;
            case 'model_loaded':
                statusText.textContent = 'Model loaded';
                substatusText.textContent = 'Ready to listen';
                break;
            case 'started':
                statusText.textContent = 'Listening...';
                substatusText.textContent = 'Say a command from the list below';
                break;
            case 'stopped':
                statusText.textContent = 'Stopped';
                substatusText.textContent = 'Click to start again';
                break;
            case 'aborted':
                statusText.textContent = 'Aborted';
                substatusText.textContent = 'Recording aborted';
                break;
            case 'library_progress':
                // Show a short progress if provided
                if (data && typeof data.progress === 'number') {
                    statusText.textContent = `Model load: ${(data.progress * 100).toFixed(0)}%`;
                    substatusText.textContent = 'Loading model assets';
                }
                break;
            default:
                // generic
                if (typeof status === 'string') {
                    statusText.textContent = status;
                    substatusText.textContent = data?.message || '';
                }
        }
    });
}

function handleCommand(sttInput) {
    console.log('Received command:', sttInput);

    // Normalize the command
    const normalized = commandNormalizer.normalize(sttInput.text);

    console.log('Normalized:', normalized);

    // Add to command log
    addToCommandLog(sttInput.text, normalized);

    // Update stats
    updateStats();

    if (normalized.intent === 'unknown') {
        // Unknown command
        const suggestions = commandNormalizer.getSuggestions(sttInput.text);
        const suggestionText = suggestions.length > 0
            ? `Did you mean: ${suggestions.map(s => s.example).join(', ')}?`
            : 'Try saying "help" for available commands';

        const details = `You said: "${sttInput.text}"
Confidence: ${Math.round((sttInput.confidence || 0) * 100)}%
Status: Not recognized

${suggestionText}`;

        showFeedback('warning', '❓ Unknown Command', details);
    } else {
        // Recognized command
        const details = `You said: "${sttInput.text}"

✓ Recognized as: ${normalized.intent} → ${normalized.command}
✓ Confidence: ${Math.round((sttInput.confidence || 0) * 100)}%
✓ Slots: ${JSON.stringify(normalized.slots)}`;

        showFeedback('success', '✓ Command Recognized!', details);

        // Play success sound
        playTone(800, 100);
    }
}

function addToCommandLog(spoken, normalized) {
    const time = new Date().toLocaleTimeString();
    const entry = {
        time,
        spoken,
        normalized
    };

    commandHistory.unshift(entry);
    if (commandHistory.length > 5) commandHistory.pop();

    // Show log
    commandLog.style.display = 'block';

    // Update display
    commandLogList.innerHTML = commandHistory.map(cmd => {
        const status = cmd.normalized.intent === 'unknown' ? '❌' : '✓';
        const intent = cmd.normalized.intent === 'unknown' ? 'unknown' : `${cmd.normalized.intent}`;
        const statusColor = cmd.normalized.intent === 'unknown' ? '#f87171' : '#4ade80';
        
        return `<div class="command-log-entry">
            <div class="command-log-time">${escapeHtml(cmd.time)}</div>
            <div class="command-log-content">${status} "${escapeHtml(cmd.spoken)}" → <span style="color: ${statusColor}">${escapeHtml(intent)}</span></div>
        </div>`;
    }).join('');
}

function showFeedback(type, title, details) {
    feedbackTitle.textContent = title;
    feedbackDetails.textContent = details;

    feedback.className = `recognition-feedback show ${type}`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 5000);
}

function updateStats() {
    if (!speechRecognition) return;

    const stats = speechRecognition.getStats();
    document.getElementById('stat-total').textContent = stats.totalCommands;
    document.getElementById('stat-recognized').textContent = stats.recognizedCommands;
    document.getElementById('stat-failed').textContent = stats.failedCommands;
    document.getElementById('stat-confidence').textContent = stats.averageConfidencePercent;
}

function playTone(frequency, duration) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
        console.log('Could not play sound:', error);
    }
}

async function startListening() {
    if (!micManager || !speechRecognition) {
        voiceBtn.disabled = true;
        statusText.textContent = 'Initializing...';
        substatusText.textContent = 'Please wait...';
        const success = await initialize();
        voiceBtn.disabled = false;
        if (!success) return;
    }

    try {
        // ensure model is loaded (defensive)
        if (!speechRecognition.getState().modelLoaded) {
            statusText.textContent = 'Loading model...';
            await speechRecognition.loadModel();
        }

        await speechRecognition.start();
        isActive = true;
        voiceBtn.classList.add('listening');
        statusText.textContent = 'Listening...';
        substatusText.textContent = 'Say a command from the list below';
    } catch (error) {
        console.error('Failed to start listening:', error);
        showFeedback('error', '❌ Start Error', error.message || String(error));
    }
}

function stopListening() {
    if (speechRecognition) {
        try {
            speechRecognition.stop();
        } catch (e) {
            console.warn('stop() threw:', e);
        }
    }
    isActive = false;
    voiceBtn.classList.remove('listening');
    statusText.textContent = 'Stopped';
    substatusText.textContent = 'Click to start again';
}

// Button click handler
voiceBtn.addEventListener('click', async () => {
    if (!isActive) {
        voiceBtn.disabled = true;
        statusText.textContent = 'Initializing...';
        substatusText.textContent = 'Please wait...';

        await startListening();

        voiceBtn.disabled = false;
    } else {
        stopListening();
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (speechRecognition) {
        speechRecognition.destroy();
    }
    if (micManager) {
        micManager.destroy();
    }
});

// Small helper to escape transcript string for insertion into HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}