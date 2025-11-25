import { CommandParser } from './commandParser.js';
import { CommandRegistry } from './commandRegistry.js';

export class Console {
    constructor(editor) {
        this.editor = editor;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.commandRegistry = new CommandRegistry(editor);
        this.parser = new CommandParser();

        this.panel = document.getElementById('console-panel');
        this.output = document.getElementById('console-output');
        this.input = document.getElementById('console-input');
        this.closeBtn = document.getElementById('console-close');

        this.bindEvents();
        this.print('Console initialized. Type "help" for commands.', 'info');
    }

    bindEvents() {
        // Input handling
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        // Close button
        this.closeBtn.addEventListener('click', () => {
            this.toggle();
        });
    }

    toggle() {
        this.panel.classList.toggle('open');
        if (this.panel.classList.contains('open')) {
            this.input.focus();
        }
    }

    handleCommand() {
        const commandString = this.input.value.trim();
        if (!commandString) return;

        // Add to history
        this.commandHistory.push(commandString);
        this.historyIndex = this.commandHistory.length;

        // Display command
        this.print(`> ${commandString}`, 'prompt');

        // Parse and execute
        const parsed = this.parser.parse(commandString);
        if (!parsed) {
            this.input.value = '';
            return;
        }

        const command = this.commandRegistry.get(parsed.command);
        if (!command) {
            this.print(`Command '${parsed.command}' not found. Type 'help' for available commands.`, 'error');
            this.input.value = '';
            return;
        }

        try {
            const result = command.execute(parsed.args);
            if (result) {
                if (result.success) this.print(result.success, 'success');
                if (result.error) this.print(result.error, 'error');
                if (result.warning) this.print(result.warning, 'warning');
                if (result.info) this.print(result.info, 'info');
            }
        } catch (error) {
            this.print(`Error: ${error.message}`, 'error');
            console.error(error);
        }

        this.input.value = '';
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        this.historyIndex += direction;

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            this.input.value = '';
            return;
        }

        this.input.value = this.commandHistory[this.historyIndex] || '';
    }

    print(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;

        // Preserve line breaks
        const lines = message.split('\\n');
        lines.forEach((l, i) => {
            if (i > 0) line.appendChild(document.createElement('br'));
            line.appendChild(document.createTextNode(l));
        });

        this.output.appendChild(line);

        // Auto-scroll to bottom
        this.output.scrollTop = this.output.scrollHeight;
    }

    clear() {
        this.output.innerHTML = '';
    }
}
