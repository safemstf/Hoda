
# TTS service — testing and CI

This document describes how to run tests locally and explains the GitHub Actions workflow that runs the test suite on CI.

Prerequisites
- Node.js (recommended >= 20 for CI compatibility; tests run on Node 18 but some deps show engine warnings)
- npm

Install dependencies

```powershell
cd services/tts
npm install
```

Run the demo (simulated speaker, local)

```powershell
npm run demo
```

Run tests locally

```powershell
npm test
```

What the tests cover
- `src/tests/test_speaker.test.js` — speaker queueing and interruption policies (replace/queue/reject). This mocks `global.chrome.tts`.
- `src/tests/test_dom_extractor.test.js` — DOM extractor behavior (Jest uses a jsdom environment).
- `src/tests/test_confirmations.test.js` — confirmations helper payloads and error handling.
- `src/tests/test_reader.test.js` — reader `readPageSemantic` behavior and payload handling.

CI (GitHub Actions)
- File: `.github/workflows/tts-tests.yml`
- Runs on `push` and `pull_request` to `WebLLM` and `main`.
- Uses Node.js 20 and runs `npm ci` followed by `npm test` inside `services/tts`.

Notes
- The package declares an `engines.node` requirement of `>=20` to match CI. If you run tests locally with Node 18 you may see engine warnings but tests should still run.
- If you prefer a different test runner (e.g., mocha, ava), I can convert the tests accordingly.

If you want, I can add a root-level GitHub Actions workflow that runs tests for all services (`stt`, `tts`, `webllm`) in a matrix job.

