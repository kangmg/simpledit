import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, cpSync } from 'fs';
import { join, resolve } from 'path';
import { writeFile } from 'fs/promises';

// Special browser-side command: bypasses the console and calls exportSDF() directly.
const EXPORT_SDF_CMD = '__export_sdf__';

const COMMAND_TIMEOUT_MS = 30000;

// Helper: read HTTP request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Helper: send 405 and return false when the HTTP method doesn't match.
function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return false;
  }
  return true;
}

// Agent HTTP API plugin
// Implements a command broker so an external agent can control simpledit over HTTP.
//
// Architecture: Vite middleware runs in Node.js, the editor runs in the browser.
// Commands are bridged via a queue:
//   Agent  --POST /api/command-->  Node queue  <--GET /api/agent/poll--  Browser
//   Agent  <--response (wait)--   Node queue  --POST /api/agent/result-->  Browser
//
// Special command EXPORT_SDF_CMD is handled by the browser to return SDF data.
function agentApiPlugin() {
  const commandQueue = [];
  const pendingResults = new Map(); // id -> { resolve, reject }
  let commandIdCounter = 0;

  // Queue a command for the browser to execute and wait for its result.
  function queueCommand(command) {
    const id = ++commandIdCounter;
    return new Promise((resolve, reject) => {
      pendingResults.set(id, { resolve, reject });
      commandQueue.push({ id, command });
      setTimeout(() => {
        if (pendingResults.has(id)) {
          pendingResults.delete(id);
          reject(new Error(`Command timeout (${COMMAND_TIMEOUT_MS / 1000}s)`));
        }
      }, COMMAND_TIMEOUT_MS);
    });
  }

  return {
    name: 'agent-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url.split('?')[0];

        // POST /api/command - agent submits a command string to execute
        if (url === '/api/command') {
          if (!requireMethod(req, res, 'POST')) return;
          res.setHeader('Content-Type', 'application/json');
          try {
            const body = await readBody(req);
            const { command } = JSON.parse(body);
            const result = await queueCommand(command);
            res.end(JSON.stringify({ success: true, result, error: null }));
          } catch (e) {
            res.end(JSON.stringify({ success: false, result: null, error: e.message }));
          }
          return;
        }

        // GET /api/agent/poll - browser polls for the next queued command
        if (url === '/api/agent/poll') {
          if (!requireMethod(req, res, 'GET')) return;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(commandQueue.shift() ?? null));
          return;
        }

        // POST /api/agent/result - browser sends back the command result
        if (url === '/api/agent/result') {
          if (!requireMethod(req, res, 'POST')) return;
          res.setHeader('Content-Type', 'application/json');
          try {
            const body = await readBody(req);
            const { id, result, error } = JSON.parse(body);
            const pending = pendingResults.get(id);
            if (pending) {
              pendingResults.delete(id);
              if (error) {
                pending.reject(new Error(error));
              } else {
                pending.resolve(result);
              }
            }
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
          return;
        }

        // GET /api/export/sdf  - return current editor SDF as JSON
        // POST /api/export/sdf - serialize SDF and save to the given path
        if (url === '/api/export/sdf') {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            try {
              const sdf = await queueCommand(EXPORT_SDF_CMD);
              res.end(JSON.stringify({ sdf, error: null }));
            } catch (e) {
              res.end(JSON.stringify({ sdf: null, error: e.message }));
            }

          } else if (req.method === 'POST') {
            try {
              const body = await readBody(req);
              const { path: outputPath } = JSON.parse(body);
              const sdf = await queueCommand(EXPORT_SDF_CMD);
              await writeFile(resolve(outputPath), sdf, 'utf8');
              res.end(JSON.stringify({ success: true, path: outputPath, error: null }));
            } catch (e) {
              res.end(JSON.stringify({ success: false, path: null, error: e.message }));
            }

          } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          return;
        }

        // POST /api/write - write arbitrary content to a file on disk (dev only)
        if (url === '/api/write') {
          if (!requireMethod(req, res, 'POST')) return;
          res.setHeader('Content-Type', 'application/json');
          try {
            const body = await readBody(req);
            const { path: filePath, content } = JSON.parse(body);
            await writeFile(resolve(filePath), content, 'utf8');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: '/simpledit/',

  build: {
    // Output directory
    outDir: 'dist',

    // Generate sourcemaps for debugging
    sourcemap: true,

    // Minification (using esbuild instead of terser)
    minify: 'esbuild',

    // Chunk splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'managers': [
            './src/managers/selectionManager.js',
            './src/managers/uiManager.js',
            './src/managers/fileIOManager.js',
            './src/managers/renderManager.js',
            './src/managers/geometryController.js',
          ],
        },
      },
    },

    // Target modern browsers
    target: 'es2020',

    // Chunk size warning limit (KB)
    chunkSizeWarningLimit: 1000,
  },

  // Development server
  server: {
    port: 3000,
    open: true,
  },

  // Path resolution
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // Include WASM files as assets
  assetsInclude: ['**/*.wasm'],

  // Optimize dependencies
  optimizeDeps: {
    exclude: ['@rdkit/rdkit'], // Exclude RDKit from pre-bundling to preserve WASM loading
  },

  // Plugin to copy tutorial and API docs after build
  plugins: [
    agentApiPlugin(),
    {
      name: 'copy-docs',
      closeBundle() {
        try {
          // Create tutorial directory
          const tutorialDir = join('dist', 'tutorial');
          mkdirSync(tutorialDir, { recursive: true });

          // Copy tutorial.html to dist/tutorial/index.html
          copyFileSync('tutorial.html', join(tutorialDir, 'index.html'));
          console.log('✓ Copied tutorial.html to dist/tutorial/index.html');

          // Copy docs/api to dist/api
          cpSync('docs/api', 'dist/api', { recursive: true });
          console.log('✓ Copied docs/api to dist/api');

          // Copy RDKit library to dist/lib/rdkit
          const rdkitDest = join('dist', 'lib', 'rdkit');
          mkdirSync(rdkitDest, { recursive: true });
          cpSync(join('public', 'lib', 'rdkit'), rdkitDest, { recursive: true });
          console.log('✓ Copied RDKit library to dist/lib/rdkit');

          // Copy JSME library to dist/lib/jsme
          const jsmeDest = join('dist', 'lib', 'jsme');
          mkdirSync(jsmeDest, { recursive: true });
          cpSync(join('public', 'lib', 'jsme'), jsmeDest, { recursive: true });
          console.log('✓ Copied JSME library to dist/lib/jsme');

          // Copy OpenChemLib resources to dist/lib/openchemlib
          const oclDest = join('dist', 'lib', 'openchemlib');
          mkdirSync(oclDest, { recursive: true });
          cpSync(join('public', 'lib', 'openchemlib'), oclDest, { recursive: true });
          console.log('✓ Copied OpenChemLib resources to dist/lib/openchemlib');
        } catch (err) {
          console.error('Error copying docs:', err);
        }
      },
    },
  ],
});
