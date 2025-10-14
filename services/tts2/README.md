# services/tts2

Minimal Text-to-Speech (TTS) implementation and tests following the `webllm` formats contract.

Files:
- `formats.js` - schema and validators (already present)
- `index.js` - public API (speak)
- `speaker.js` - simulated TTS synthesizer
- `reader.js` - validates input and calls speaker
- `tests/` - simple test runner and tests

Run tests:

```powershell
cd services/tts2
npm test
```

Prerequisites:
- Node.js (node and npm) must be installed. On Windows, ensure `node` is on your PATH.
- Run `npm install` in `services/tts2` to install the `uuid` dependency before running tests.
