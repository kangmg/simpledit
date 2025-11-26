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
        this.prompt = document.getElementById('console-prompt');
        this.closeBtn = document.getElementById('console-close');

        this.inputMode = false;
        this.inputCallback = null;

        this.bindEvents();
        this.print('Console initialized. Type "help" for commands.', 'info');
    }

    bindEvents() {
        // Input handling
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Allow new line
                    return;
                }
                e.preventDefault();

                if (this.inputMode) {
                    this.handleInput();
                } else {
                    this.handleCommand();
                }
            } else if (e.key === 'ArrowUp') {
                if (!this.inputMode) {
                    e.preventDefault();
                    this.navigateHistory(-1);
                }
            } else if (e.key === 'ArrowDown') {
                if (!this.inputMode) {
                    e.preventDefault();
                    this.navigateHistory(1);
                }
            }
        });

        // Auto-resize textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
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

    startInputMode(promptText, callback) {
        this.inputMode = true;
        this.inputCallback = callback;
        this.prompt.innerText = promptText;
        this.input.value = '';
        this.input.focus();
        this.print(`Enter data for ${promptText.replace('> ', '')}. Press Enter to submit, Shift+Enter for new line.`, 'info');
    }

    endInputMode() {
        this.inputMode = false;
        this.inputCallback = null;
        this.prompt.innerText = '>';
        this.input.value = '';
        this.input.style.height = 'auto';
    }

    handleInput() {
        const data = this.input.value; // Keep raw data including newlines
        if (!data.trim()) return;

        this.print(data, 'input-data'); // Echo input

        if (this.inputCallback) {
            this.inputCallback(data);
        }

        this.endInputMode();
    }

    async handleCommand() {
        const rawInput = this.input.value.trim();
        if (!rawInput) {
            this.input.value = ''; // Clear newlines if any
            this.input.style.height = 'auto';
            return;
        }

        // Clear input immediately so output is visible
        this.input.value = '';
        this.input.style.height = 'auto';

        // Add to history
        this.commandHistory.push(rawInput);
        this.historyIndex = this.commandHistory.length;

        // Parse and process heredoc syntax
        const processedCommands = this.parseHeredoc(rawInput);

        // Execute each command sequentially, showing each with its result
        for (const { command: commandString, heredocData } of processedCommands) {
            // Display this command's prompt
            this.print(`> ${commandString}`, 'prompt');

            // If heredoc data exists, show it
            if (heredocData) {
                this.print(heredocData, 'input-data');
            }

            // Parse and execute
            const parsed = this.parser.parse(commandString);
            if (!parsed) continue;

            const command = this.commandRegistry.get(parsed.command);
            if (!command) {
                this.print(`Command '${parsed.command}' not found.`, 'error');
                continue;
            }

            try {
                // If heredoc data exists, pass it via special __heredoc__ arg
                if (heredocData) {
                    parsed.args.push('__heredoc__', heredocData);
                }

                // Await the command execution to support async commands like 'time'
                const result = await command.execute(parsed.args);

                if (result) {
                    if (result.success) this.print(result.success, 'success');
                    if (result.error) this.print(result.error, 'error');
                    if (result.warning) this.print(result.warning, 'warning');
                    if (result.info) this.print(result.info, 'info');
                }
            } catch (error) {
                this.print(`Error executing '${commandString}': ${error.message}`, 'error');
                console.error(error);
            }
        }
    }

    parseHeredoc(input) {
        // Replace backslashes with newlines first
        const normalized = input.replace(/\s*\\\s*/g, '\n');
        const lines = normalized.split('\n');

        const result = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            // Skip comments and empty lines
            if (!line || line.startsWith('#')) {
                i++;
                continue;
            }

            // Check for heredoc syntax: command <<DELIMITER
            const heredocMatch = line.match(/^(.+?)\s*<<\s*(\S+)$/);

            if (heredocMatch) {
                const [, commandPart, delimiter] = heredocMatch;
                const heredocLines = [];
                i++; // Move to next line

                // Collect lines until delimiter
                while (i < lines.length) {
                    const currentLine = lines[i];
                    if (currentLine.trim() === delimiter) {
                        i++; // Skip delimiter line
                        break;
                    }
                    heredocLines.push(currentLine);
                    i++;
                }

                result.push({
                    command: commandPart.trim(),
                    heredocData: heredocLines.join('\n')
                });
            } else {
                // Regular command
                result.push({
                    command: line,
                    heredocData: null
                });
                i++;
            }
        }

        return result;
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

        if (type === 'image') {
            // Display image from data URL
            const img = document.createElement('img');
            img.src = message;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.border = '1px solid #333';
            img.style.borderRadius = '4px';
            img.style.marginTop = '8px';
            line.appendChild(img);
        } else {
            // Preserve line breaks and spaces for text
            line.style.whiteSpace = 'pre-wrap';
            line.textContent = message;
        }

        this.output.appendChild(line);

        // Auto-scroll to bottom
        this.output.scrollTop = this.output.scrollHeight;
    }

    clear() {
        this.output.innerHTML = '';
    }
}
