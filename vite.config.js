import { defineConfig } from 'vite';

export default defineConfig({
  base: '/simpledit/',

  build: {
    // Output directory
    outDir: 'dist',

    // Generate sourcemaps for debugging
    sourcemap: true,

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
    },

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
});
