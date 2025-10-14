/**
 * Simple HTTP server for testing WebLLM in browser
 * Run with: node server.js
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm'
};

const server = createServer(async (req, res) => {
  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  let filePath = req.url === '/' ? '/test.html' : req.url;
  filePath = join(__dirname, filePath);

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 WebLLM Test Server running at http://localhost:${PORT}`);
  console.log(`📝 Open http://localhost:${PORT} in your browser to test`);
  console.log(`⚠️  Make sure you're using a browser with WebGPU support (Chrome/Edge 113+)`);
});
