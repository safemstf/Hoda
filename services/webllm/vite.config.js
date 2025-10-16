import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: '/demo-enhanced.html',
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm']
  }
});
