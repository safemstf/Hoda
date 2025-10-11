// speech-worker.js
// CSP-compatible Web Worker for Whisper
// Works with libstream.js that has embedded WASM
// FIXED: Only runs on main worker, not Emscripten pthread workers

// CRITICAL: Detect if this is an Emscripten pthread worker
// Emscripten spawns worker threads even when we set pthreadPoolSize: 0
// because libstream.js was compiled WITH pthread support
const isMainWorker = !self.name || self.name === '' || !self.name.includes('em-pthread');

if (!isMainWorker) {
    // This is an Emscripten pthread worker spawned by the WASM module
    // Don't run ANY of our code - let Emscripten handle it
    console.log('[Worker] Emscripten pthread detected (name: ' + self.name + '), letting Emscripten handle it');
    // Exit early - don't initialize anything
    // The rest of this file won't execute for pthread workers
} else {
    console.log('[Worker] Main speech worker started');

    // Worker state - only for main worker
    let whisperInstance = null;
    let whisperContext = null; // handle for the native whisper context (must be declared)
    let isInitialized = false;
    let isRecording = false;
    let audioChunks = [];
    
    // For streaming mode
    let streamingMode = true;  // Use streaming API like the examples

    // Helper function to fetch with XMLHttpRequest fallback
    async function fetchWithFallback(url) {
        console.log('[Worker] Fetching:', url);
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 0) {
                    console.log('[Worker] XHR success:', xhr.status);
                    resolve({
                        ok: true,
                        status: xhr.status,
                        arrayBuffer: () => Promise.resolve(xhr.response),
                        text: () => {
                            const decoder = new TextDecoder('utf-8');
                            return Promise.resolve(decoder.decode(xhr.response));
                        }
                    });
                } else {
                    reject(new Error(`XHR failed: ${xhr.status} ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error(`XHR error loading ${url}`));
            };
            
            xhr.send();
        });
    }

    // --- small helpers to safely inspect Emscripten exports and call functions ----
    function _getWasmExports(moduleObj) {
        if (!moduleObj) return {};
        // common places different Emscripten bundles expose the wasm functions
        const candidates = [
            moduleObj.instance && moduleObj.instance.exports,
            moduleObj.wasmInstance && moduleObj.wasmInstance.exports,
            moduleObj.wasmModule && moduleObj.wasmModule.exports,
            moduleObj.exports,
            moduleObj.asm,
            moduleObj.asmLibraryArg,
            moduleObj
        ];
        for (const c of candidates) {
            if (c && typeof c === 'object') return c;
        }
        return {};
    }

    function _hasExport(moduleObj, name) {
        const exp = _getWasmExports(moduleObj);
        if (!exp) return false;
        if (typeof exp[name] === 'function') return true;
        if (typeof exp['_' + name] === 'function') return true;
        return false;
    }

    function _tryCwrap(moduleObj, name, retType, argTypes) {
        try {
            if (typeof moduleObj.cwrap === 'function') {
                const fn = moduleObj.cwrap(name.replace(/^_/, ''), retType, argTypes);
                if (typeof fn === 'function') return fn;
            }
        } catch (e) {
            // ignore - symbol likely absent
        }
        return null;
    }

    function _safeCcall(moduleObj, name, returnType, argTypes, args) {
        // verify that the export exists before calling ccall
        if (!_hasExport(moduleObj, name)) {
            throw new Error('Symbol not exported: ' + name);
        }
        if (typeof moduleObj.ccall !== 'function') {
            throw new Error('Module.ccall not available');
        }
        return moduleObj.ccall(name.replace(/^_/, ''), returnType, argTypes, args);
    }
    // -------------------------------------------------------------------------------

    // Listen for messages from main thread - ONLY for main worker
    self.addEventListener('message', async (event) => {
        const { type, payload, cmd } = event.data || {};
        
        // Ignore Emscripten pthread messages (they have 'cmd' instead of 'type')
        if (cmd) {
            // This is an Emscripten internal message (pthread communication)
            // Just ignore it - Emscripten will handle it internally
            return;
        }
        
        // Better logging to see what's coming in
        if (type !== 'audioData') {
            console.log('[Worker] Received message:', type, payload ? '(with payload)' : '(no payload)');
        }

        try {
            switch (type) {
                case 'init':
                    await initializeWhisper(payload);
                    break;
                case 'start':
                    startRecording();
                    break;
                case 'stop':
                    await stopRecording();
                    break;
                case 'abort':
                    abortRecording();
                    break;
                case 'audioData':
                    handleAudioData(payload);
                    break;
                case undefined:
                case null:
                    // Likely an Emscripten message, ignore
                    break;
                default:
                    console.warn('[Worker] Unknown message type:', type);
            }
        } catch (error) {
            console.error('[Worker] Error handling message:', error);
            postMessage({
                type: 'error',
                message: error.message || String(error),
                stack: error.stack
            });
        }
    });

    async function initializeWhisper(config) {
        try {
            console.log('[Worker] Initializing Whisper with config:', config);
            
            postMessage({ type: 'status', status: 'loading_model', data: { modelSize: config.modelSize } });
            
            const { bundleUrl, modelUrl, modelSize, sampleRate } = config;
            
            console.log('[Worker] Loading libstream.js from:', bundleUrl);

            try {
                // Use importScripts() for CSP compliance (it's allowed in workers)
                console.log('[Worker] Using importScripts to load libstream.js...');
                
                // Configure Module BEFORE importing to try to minimize pthread spawning
                self.Module = {
                    // Try to disable pthreads (may not work if compiled with pthread support)
                    pthreadPoolSize: 0,
                    // Prevent automatic worker spawning
                    noInitialRun: false,
                    noExitRuntime: true,
                    print: (text) => {
                        console.log('[Worker] Whisper:', text);
                    },
                    printErr: (text) => {
                        console.error('[Worker] Whisper error:', text);
                    },
                    locateFile: (path) => {
                        console.log('[Worker] locateFile:', path);
                        // If it's asking for a .wasm file, provide the full URL
                        if (path.endsWith('.wasm')) {
                            // Assume it's in the same directory as bundleUrl
                            const baseUrl = bundleUrl.substring(0, bundleUrl.lastIndexOf('/'));
                            return baseUrl + '/' + path;
                        }
                        return path;
                    }
                };
                
                // importScripts() is synchronous and CSP-safe for workers
                importScripts(bundleUrl);
                
                console.log('[Worker] libstream.js loaded via importScripts');
                console.log('[Worker] Type of Module:', typeof self.Module);
                console.log('[Worker] Module keys:', Object.keys(self.Module || {}));
                
                // Check for various possible exports
                const possibleExports = [
                    'Module', 'createWhisper', 'Whisper', 'whisper', 
                    'createModule', 'default', 'init', 'initialize'
                ];
                
                possibleExports.forEach(name => {
                    if (self[name]) {
                        console.log(`[Worker] Found global.${name}:`, typeof self[name]);
                    }
                });
                
                console.log('[Worker] All global keys containing "whisper" or "module":',
                    Object.keys(self).filter(k => 
                        k.toLowerCase().includes('whisper') || 
                        k.toLowerCase().includes('module')
                    )
                );
                
                // After importScripts, the Module should be available globally
                whisperInstance = self.Module;
                
                if (!whisperInstance) {
                    console.error('[Worker] Module not found! Available globals:', 
                        Object.keys(self).filter(k => !k.startsWith('_'))
                    );
                    throw new Error('Module not found after importScripts');
                }
                
                console.log('[Worker] Module object:', whisperInstance);
                console.log('[Worker] Module is callable?', typeof whisperInstance === 'function');
                
                // Wait for WASM to be ready
                if (whisperInstance.ready) {
                    console.log('[Worker] Module has .ready property, waiting...');
                    await whisperInstance.ready;
                    console.log('[Worker] Module.ready resolved');
                } else if (typeof whisperInstance.then === 'function') {
                    console.log('[Worker] Module is a promise, awaiting...');
                    whisperInstance = await whisperInstance;
                    console.log('[Worker] Module promise resolved');
                } else if (typeof whisperInstance === 'function') {
                    console.log('[Worker] Module is a factory function, calling it...');
                    whisperInstance = whisperInstance();
                    if (whisperInstance.then) {
                        console.log('[Worker] Factory returned promise, awaiting...');
                        whisperInstance = await whisperInstance;
                    }
                }
                
                console.log('[Worker] Final whisperInstance type:', typeof whisperInstance);
                console.log('[Worker] WASM loaded successfully');
                console.log('[Worker] Available methods:', whisperInstance ? 
                    Object.keys(whisperInstance)
                        .filter(k => typeof whisperInstance[k] === 'function')
                        .slice(0, 20) : 'none'
                );
                
                // Now load the model file
                console.log('[Worker] Loading model file from:', modelUrl);
                
                // Fetch the model file
                const modelResponse = await fetchWithFallback(modelUrl);
                const modelData = await modelResponse.arrayBuffer();
                
                console.log('[Worker] Model file loaded, size:', modelData.byteLength, 'bytes');
                
                // Write model to WASM filesystem using Emscripten FS API
                const modelFileName = 'model.bin';
                const uint8Array = new Uint8Array(modelData);
                
                // Use FS_createDataFile which is exposed by Emscripten
                // Format: FS_createDataFile(parent, name, data, canRead, canWrite, canOwn)
                try {
                    if (typeof whisperInstance.FS_createDataFile === 'function') {
                        console.log('[Worker] Using FS_createDataFile to write model');
                        whisperInstance.FS_createDataFile('/', modelFileName, uint8Array, true, true, true);
                        console.log('[Worker] Model written to WASM filesystem via FS_createDataFile');
                    } else if (whisperInstance.FS && typeof whisperInstance.FS.writeFile === 'function') {
                        console.log('[Worker] Using FS.writeFile to write model');
                        whisperInstance.FS.writeFile(modelFileName, uint8Array);
                        console.log('[Worker] Model written to WASM filesystem via FS.writeFile');
                    } else {
                        throw new Error('No FS write method available. Available methods: ' + 
                            Object.keys(whisperInstance).filter(k => k.includes('FS')).join(', '));
                    }
                } catch (fsError) {
                    console.error('[Worker] FS write error:', fsError);
                    throw new Error(`Failed to write model to WASM FS: ${fsError.message}`);
                }
                
                // Initialize Whisper context from the model
                console.log('[Worker] Initializing Whisper context...');
                
                // Debug: List all available functions
                const allFunctions = Object.keys(whisperInstance)
                    .filter(k => typeof whisperInstance[k] === 'function')
                    .sort();
                console.log('[Worker] All available functions:', allFunctions);
                
                // Try different initialization methods
                let initMethod = null;
                
                // Method 1: High-level init
                if (typeof whisperInstance.init === 'function') {
                    console.log('[Worker] Trying whisperInstance.init()');
                    whisperContext = whisperInstance.init(modelFileName);
                    initMethod = 'init';
                    
                // Method 2: Direct whisper_init_from_file
                } else if (typeof whisperInstance.whisper_init_from_file === 'function') {
                    console.log('[Worker] Trying whisper_init_from_file()');
                    whisperContext = whisperInstance.whisper_init_from_file(modelFileName);
                    initMethod = 'whisper_init_from_file';
                    
                // Method 3: createContext
                } else if (typeof whisperInstance.createContext === 'function') {
                    console.log('[Worker] Trying createContext()');
                    whisperContext = whisperInstance.createContext(modelFileName);
                    initMethod = 'createContext';
                    
                // Method 4: Using ccall
                } else if (whisperInstance.ccall) {
                    // safe ccall/cwrap attempts (do not call blindly)
                    console.log('[Worker] Trying safe cwrap/ccall attempts for whisper_init_from_file');

                    // 1) prefer cwrap if it exists and the symbol is exported
                    try {
                        const cw = _tryCwrap(whisperInstance, 'whisper_init_from_file', 'number', ['string']);
                        if (cw) {
                            console.log('[Worker] Using cwrap to call whisper_init_from_file');
                            whisperContext = cw(modelFileName);
                            initMethod = 'cwrap:whisper_init_from_file';
                        } else {
                            // 2) try ccall but only if the symbol exists in exports
                            console.log('[Worker] cwrap not available or symbol missing, trying safe ccall');
                            try {
                                whisperContext = _safeCcall(whisperInstance, 'whisper_init_from_file', 'number', ['string'], [modelFileName]);
                                initMethod = 'ccall:whisper_init_from_file';
                            } catch (ccallErr) {
                                console.warn('[Worker] safe ccall failed (try full path next):', ccallErr && ccallErr.message ? ccallErr.message : ccallErr);
                                // 3) try full path fallback (if symbol exists)
                                try {
                                    whisperContext = _safeCcall(whisperInstance, 'whisper_init_from_file', 'number', ['string'], ['/' + modelFileName]);
                                    initMethod = 'ccall:whisper_init_from_file (full path)';
                                } catch (ccallErr2) {
                                    console.error('[Worker] ccall full path failed:', ccallErr2 && ccallErr2.message ? ccallErr2.message : ccallErr2);
                                    // rethrow to be handled by outer catch (keeps existing logic)
                                    throw ccallErr2;
                                }
                            }
                        }
                    } catch (err) {
                        // bubble up — outer try/catch will report
                        console.error('[Worker] safe cwrap/ccall attempts threw:', err);
                        throw err;
                    }
                
                // Method 5: Try _whisper_init_from_file (direct C function)
                } else if (typeof whisperInstance._whisper_init_from_file === 'function') {
                    console.log('[Worker] Trying _whisper_init_from_file()');
                    // Allocate string in WASM memory
                    const pathPtr = whisperInstance.allocateUTF8(modelFileName);
                    whisperContext = whisperInstance._whisper_init_from_file(pathPtr);
                    whisperInstance._free(pathPtr);
                    initMethod = '_whisper_init_from_file';
                } else {
                    console.error('[Worker] No known initialization method found');
                    console.error('[Worker] Available functions:', allFunctions);
                    throw new Error('No known Whisper initialization method found. Available: ' + 
                        allFunctions.filter(f => f.includes('whisper') || f.includes('init')).join(', '));
                }
                
                if (!whisperContext || whisperContext === 0) {
                    throw new Error(`Failed to create Whisper context using ${initMethod}. Result: ${whisperContext}`);
                }
                
                console.log('[Worker] Whisper context created successfully using:', initMethod);
                console.log('[Worker] Context value:', whisperContext);
                
            } catch (loadError) {
                console.error('[Worker] Loading failed:', loadError);
                throw new Error(`Failed to load Whisper: ${loadError.message}`);
            }
            
            isInitialized = true;
            
            console.log('[Worker] Initialization complete - ready to transcribe');
            
            postMessage({ 
                type: 'ready',
                data: { 
                    modelSize: config.modelSize,
                    modelUrl: config.modelUrl 
                }
            });
            
        } catch (error) {
            console.error('[Worker] Initialization failed:', error);
            postMessage({
                type: 'error',
                message: `Failed to initialize Whisper: ${error.message}`,
                stack: error.stack
            });
        }
    }

    function startRecording() {
        if (!isInitialized) {
            postMessage({ 
                type: 'error', 
                message: 'Whisper not initialized. Call init first.' 
            });
            return;
        }
        
        console.log('[Worker] Starting recording');
        isRecording = true;
        audioChunks = [];
        
        postMessage({ type: 'status', status: 'recording', data: { message: 'Recording started' } });
    }

    async function stopRecording() {
        if (!isRecording) {
            console.log('[Worker] Not recording, ignoring stop');
            return;
        }
        
        console.log('[Worker] Stopping recording');
        isRecording = false;
        
        postMessage({ type: 'status', status: 'processing', data: { message: 'Processing audio...' } });
        
        try {
            if (audioChunks.length === 0) {
                console.warn('[Worker] No audio data collected');
                postMessage({ 
                    type: 'error', 
                    message: 'No audio data to process' 
                });
                return;
            }
            
            // Concatenate audio chunks
            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const audioData = new Float32Array(totalLength);
            let offset = 0;
            
            for (const chunk of audioChunks) {
                audioData.set(chunk, offset);
                offset += chunk.length;
            }
            
            console.log('[Worker] Processing audio, samples:', audioData.length, 
                        'duration:', (audioData.length / 16000).toFixed(2) + 's');
            
            // Transcribe using the Whisper context
            let transcription;
            
            // Try different Whisper API methods
            // Method 1: Direct transcribe function
            if (whisperContext && typeof whisperInstance.transcribe === 'function') {
                console.log('[Worker] Calling whisperInstance.transcribe() with context');
                transcription = await whisperInstance.transcribe(whisperContext, audioData);
                
            // Method 2: Full function with context
            } else if (whisperContext && typeof whisperInstance.full === 'function') {
                console.log('[Worker] Calling whisperInstance.full() with context');
                transcription = await whisperInstance.full(whisperContext, audioData);
                
            // Method 3: Using ccall
            } else if (whisperContext && whisperInstance.ccall) {
                console.log('[Worker] Calling whisper_full via ccall');
                
                // Allocate memory for audio data in WASM
                const audioPtr = whisperInstance._malloc(audioData.length * 4); // 4 bytes per float
                whisperInstance.HEAPF32.set(audioData, audioPtr / 4);
                
                // Call whisper_full
                const result = whisperInstance.ccall(
                    'whisper_full',
                    'number',
                    ['number', 'number', 'number', 'number'],
                    [whisperContext, 0, audioPtr, audioData.length]
                );
                
                console.log('[Worker] whisper_full returned:', result);
                
                // Get number of segments
                const nSegments = whisperInstance.ccall(
                    'whisper_full_n_segments',
                    'number',
                    ['number'],
                    [whisperContext]
                );
                
                console.log('[Worker] Number of segments:', nSegments);
                
                // Get text from segments
                let fullText = '';
                for (let i = 0; i < nSegments; i++) {
                    const textPtr = whisperInstance.ccall(
                        'whisper_full_get_segment_text',
                        'number',
                        ['number', 'number'],
                        [whisperContext, i]
                    );
                    
                    if (textPtr) {
                        const segmentText = whisperInstance.UTF8ToString(textPtr);
                        fullText += segmentText + ' ';
                    }
                }
                
                // Free memory
                whisperInstance._free(audioPtr);
                
                transcription = fullText.trim();
                
            } else {
                console.error('[Worker] Available methods:', 
                    Object.keys(whisperInstance || {})
                        .filter(k => typeof whisperInstance[k] === 'function')
                );
                throw new Error('No known Whisper transcription method found');
            }
            
            console.log('[Worker] Transcription result:', transcription);
            
            // Extract text
            let text = '';
            let confidence = 0.9;
            
            if (typeof transcription === 'string') {
                text = transcription;
            } else if (transcription && typeof transcription === 'object') {
                text = transcription.text || transcription.result || transcription.transcription || '';
                confidence = transcription.confidence || transcription.score || 0.9;
            }
            
            if (!text || text.trim().length === 0) {
                console.warn('[Worker] No text in transcription result');
                postMessage({ 
                    type: 'error', 
                    message: 'Transcription returned no text' 
                });
                return;
            }
            
            console.log('[Worker] Transcription successful:', text);
            
            postMessage({
                type: 'transcript',
                text: text.trim(),
                confidence: confidence,
                isFinal: true
            });
            
            audioChunks = [];
            
        } catch (error) {
            console.error('[Worker] Transcription failed:', error);
            postMessage({
                type: 'error',
                message: `Transcription failed: ${error.message}`,
                stack: error.stack
            });
        }
    }

    function abortRecording() {
        console.log('[Worker] Aborting recording');
        isRecording = false;
        audioChunks = [];
        
        // Note: We don't destroy whisperContext here because we might want to record again
        // Context cleanup happens when worker is terminated
        
        postMessage({ type: 'status', status: 'aborted', data: { message: 'Recording aborted' } });
    }

    function handleAudioData(data) {
        if (!isRecording) {
            return;
        }
        
        // Handle both Array and Float32Array
        if (data && (Array.isArray(data) || data.length > 0)) {
            const float32Data = Array.isArray(data) ? new Float32Array(data) : new Float32Array(data);
            audioChunks.push(float32Data);
            
            if (audioChunks.length % 100 === 0) {
                console.log('[Worker] Audio chunks:', audioChunks.length);
            }
        }
    }

    // Error handling - only for main worker
    self.addEventListener('error', (event) => {
        console.error('[Worker] Global error:', event);
        postMessage({
            type: 'error',
            message: event.message || 'Worker error',
            filename: event.filename,
            lineno: event.lineno
        });
    });

    self.addEventListener('unhandledrejection', (event) => {
        console.error('[Worker] Unhandled rejection:', event);
        postMessage({
            type: 'error',
            message: event.reason?.message || 'Unhandled promise rejection',
            stack: event.reason?.stack
        });
    });

    // Cleanup on worker termination
    self.addEventListener('beforeunload', () => {
        console.log('[Worker] Cleaning up before termination');
        
        // Free Whisper context if it exists
        if (whisperContext && whisperInstance) {
            try {
                if (typeof whisperInstance.free === 'function') {
                    whisperInstance.free(whisperContext);
                } else if (whisperInstance.ccall) {
                    whisperInstance.ccall('whisper_free', null, ['number'], [whisperContext]);
                }
                console.log('[Worker] Whisper context freed');
            } catch (e) {
                console.error('[Worker] Error freeing context:', e);
            }
        }
    });

    console.log('[Worker] Main speech worker ready');
}