import '../style.css'
import { Editor } from './editor.js'

document.addEventListener('DOMContentLoaded', () => {
  const editor = new Editor();
  editor.init();
  editor.checkLocalMode();

  // Expose editor for agent API access (used by agentApiPlugin in vite.config.js)
  globalThis.__editor__ = editor;

  // Start polling loop so the Vite dev-server agent API can relay commands to the browser
  startAgentPolling(editor);
});

// Poll the dev-server command queue, execute each command in the editor, and
// return results so the waiting agent HTTP request can be resolved.
async function startAgentPolling(editor) {
  const POLL_INTERVAL = 500; // ms

  async function poll() {
    try {
      const response = await fetch('/api/agent/poll');
      if (!response.ok) return;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const task = await response.json();
      if (!task) return;

      const { id, command } = task;

      try {
        let result;
        if (command === '__export_sdf__') {
          // Direct SDF serialization bypasses the console
          result = editor.fileIOManager.exportSDF({});
        } else {
          // Execute via console so the command also appears in the UI
          result = await editor.console.execute(command);
        }

        await fetch('/api/agent/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, result: result ?? null }),
        });
      } catch (e) {
        await fetch('/api/agent/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, error: e.message }),
        });
      }
    } catch (_) {
      // /api/agent/poll not available (production / non-dev mode) - ignore silently
    }
  }

  setInterval(poll, POLL_INTERVAL);
}
