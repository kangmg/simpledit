import { ErrorHandler } from '../utils/errorHandler.js';
import { ELEMENTS } from '../constants.js';

/**
 * Manages UI interactions, modals, and labels
 * Handles toolbar events, periodic table, coordinate editor, and atom labels
 */
export class UIManager {
    constructor(editor) {
        this.editor = editor;
        this.state = editor.state;
    }

    /**
     * Bind all toolbar button events
     */
    bindToolbarEvents() {
        this.bindModeButtons();
        this.bindViewButtons();
        this.bindLabelButton();
        this.bindExportButton();
        this.bindMoleculeButtons();
        this.bindSidebarEvents();
        this.bindUndoRedoEvents();
        this.bindPeriodicTableEvents();
        this.bindAutoBondButton();
        this.bindCoordinateEditorButton();
        this.bindBondThresholdSlider();
        console.log('UIManager: Toolbar events bound');
    }

    /**
     * Bind mode selection buttons (edit/select/move)
     */
    bindModeButtons() {
        const btnEdit = document.getElementById('btn-edit');
        const btnSelect = document.getElementById('btn-select');
        const btnMove = document.getElementById('btn-move');

        if (btnEdit) {
            btnEdit.onclick = () => this.editor.setMode('edit');
        }

        if (btnSelect) {
            btnSelect.onclick = () => {
                if (this.state.isSelectMode()) {
                    // Cycle selection mode
                    this.editor.selectionManager.cycleSelectionMode();
                } else {
                    this.editor.setMode('select');
                }
            };
        }

        if (btnMove) {
            btnMove.onclick = () => this.editor.setMode('move');
        }
    }

    /**
     * Bind view control buttons
     */
    bindViewButtons() {
        // Camera mode
        const cameraSelect = document.getElementById('camera-mode');
        if (cameraSelect) {
            cameraSelect.onchange = (e) => {
                this.state.setCameraMode(e.target.value);
                this.editor.renderer.setCameraMode(e.target.value);
            };
        }

        // Color scheme
        const colorSelect = document.getElementById('color-scheme');
        if (colorSelect) {
            colorSelect.onchange = (e) => {
                this.state.setColorScheme(e.target.value);
                this.editor.updateAtomColors();
            };
        }

        // Projection mode
        const projectionSelect = document.getElementById('projection-mode');
        if (projectionSelect) {
            projectionSelect.onchange = (e) => {
                this.state.setProjectionMode(e.target.value);
                this.editor.renderer.setProjectionMode(e.target.value);
            };
        }
    }

    /**
     * Bind label toggle button
     */
    bindLabelButton() {
        const btnLabel = document.getElementById('btn-label');
        if (btnLabel) {
            btnLabel.onclick = () => {
                const newMode = this.state.cycleLabelMode();
                this.editor.updateAllLabels();
                this.updateLabelButtonText();
            };
        }
    }

    /**
     * Bind export PNG button
     */
    bindExportButton() {
        const btnExport = document.getElementById('btn-export-png');
        if (btnExport) {
            btnExport.onclick = () => this.exportPNG();
        }
    }

    /**
     * Bind molecule management buttons
     */
    bindMoleculeButtons() {
        const btnNew = document.getElementById('btn-new-molecule');
        const btnDelete = document.getElementById('btn-delete-molecule');

        if (btnNew) {
            btnNew.onclick = () => {
                const name = prompt('Enter molecule name:', `Molecule ${this.editor.moleculeManager.molecules.length + 1}`);
                if (name) {
                    this.editor.moleculeManager.createMolecule(name);
                }
            };
        }

        if (btnDelete) {
            btnDelete.onclick = () => {
                if (confirm('Are you sure you want to delete the current molecule?')) {
                    const result = this.editor.moleculeManager.removeMolecule(
                        this.editor.moleculeManager.activeMoleculeIndex
                    );
                    if (result.error) {
                        this.showError(result.error);
                    }
                }
            };
        }
    }

    /**
     * Bind sidebar toggle events
     */
    bindSidebarEvents() {
        const sidebar = document.querySelector('.floating-sidebar');
        const toggleBtn = document.getElementById('btn-toggle-sidebar');

        const iconCollapse = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 1.5033V3.5033L13 3.5033V7.6749L14.8285 5.84644L16.2427 7.26066L12 11.5033L7.75739 7.26066L9.17161 5.84644L11 7.67483V3.5033L6 3.5033V1.5033L18 1.5033Z" fill="currentColor" /><path d="M18 20.4967V22.4967H6V20.4967H11V16.3251L9.17154 18.1536L7.75732 16.7393L12 12.4967L16.2426 16.7393L14.8284 18.1536L13 16.3252V20.4967H18Z" fill="currentColor" /></svg>`;
        const iconExpand = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 1V3L7 3V1L17 1Z" fill="currentColor" /><path d="M16.2427 8.44772L14.8285 9.86194L13 8.03347L13 15.9665L14.8285 14.138L16.2427 15.5522L12 19.7949L7.75742 15.5522L9.17163 14.138L11 15.9664L11 8.03357L9.17163 9.86194L7.75742 8.44772L12 4.20508L16.2427 8.44772Z" fill="currentColor" /><path d="M17 23V21H7V23H17Z" fill="currentColor" /></svg>`;

        if (toggleBtn && sidebar) {
            toggleBtn.onclick = () => {
                sidebar.classList.toggle('collapsed');
                toggleBtn.innerHTML = sidebar.classList.contains('collapsed') ? iconExpand : iconCollapse;
                toggleBtn.style.transform = 'none';
                this.state.ui.sidebarCollapsed = sidebar.classList.contains('collapsed');
            };
        }
    }

    /**
     * Bind undo/redo buttons
     */
    bindUndoRedoEvents() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');

        if (btnUndo) btnUndo.onclick = () => this.editor.undo();
        if (btnRedo) btnRedo.onclick = () => this.editor.redo();
    }

    /**
     * Bind periodic table events
     */
    bindPeriodicTableEvents() {
        const btnElement = document.getElementById('btn-element-select');
        const ptModal = document.getElementById('pt-modal');
        const maximizePt = document.querySelector('.maximize-pt');
        const closePtBtns = document.querySelectorAll('.close-pt');

        if (btnElement && ptModal) {
            btnElement.onclick = () => {
                // Reset maximize state
                if (ptModal.classList.contains('maximized')) {
                    this.toggleMaximize(ptModal);
                }
                this.editor.renderPeriodicTable();
                this.openPeriodicTable((element) => {
                    this.editor.selectedElement = element;
                    document.getElementById('current-element-symbol').textContent = element;
                    this.closePeriodicTable();
                });
            };
        }

        if (maximizePt && ptModal) {
            maximizePt.onclick = () => this.toggleMaximize(ptModal);
        }

        closePtBtns.forEach(btn => {
            btn.onclick = () => {
                if (ptModal.classList.contains('maximized')) {
                    this.toggleMaximize(ptModal);
                }
                this.closePeriodicTable();
            };
        });
    }

    /**
     * Bind auto-bond button
     */
    bindAutoBondButton() {
        const btnAutoBond = document.getElementById('btn-auto-bond');
        if (btnAutoBond) {
            btnAutoBond.onclick = () => {
                this.editor.autoBond();
                this.editor.renderManager.updateBondVisuals();
                this.editor.saveState();
                this.showSuccess('Auto-bonding complete');
            };
        }
    }

    /**
     * Bind coordinate editor button
     */
    bindCoordinateEditorButton() {
        const btnCoordEditor = document.getElementById('btn-coord-editor');
        if (btnCoordEditor) {
            btnCoordEditor.onclick = () => this.openCoordinateEditor();
        }

        // Bind window controls for Coordinate Editor
        const btnClose = document.getElementById('coord-close');
        const btnMinimize = document.getElementById('coord-minimize');
        const btnMaximize = document.getElementById('coord-maximize');
        const modal = document.getElementById('coord-modal');

        if (btnClose) btnClose.onclick = () => this.closeCoordinateEditor();
        if (btnMinimize && modal) btnMinimize.onclick = () => this.toggleMinimize(modal);
        if (btnMaximize && modal) btnMaximize.onclick = () => this.toggleMaximize(modal);
    }

    /**
     * Bind bond threshold slider
     */
    bindBondThresholdSlider() {
        const slider = document.getElementById('bond-threshold');
        const display = document.getElementById('val-bond-threshold');

        if (slider && display) {
            slider.oninput = (e) => {
                display.textContent = e.target.value;
            };
            // Rebond on change? Or just update value? 
            // Original behavior was likely just updating value, and autoBond uses it.
            // But user said "UI not updating", implying the display value didn't change.
        }
    }

    /**
     * Update label button text to reflect current mode
     */
    updateLabelButtonText() {
        const btn = document.getElementById('btn-label');
        if (!btn) return;

        const mode = this.state.getLabelMode();
        const modeText = {
            'none': 'Labels: Off',
            'symbol': 'Labels: Symbol',
            'number': 'Labels: Number',
            'both': 'Labels: Both'
        };

        btn.textContent = modeText[mode] || 'Labels';
    }

    /**
     * Open periodic table modal
     * @param {function} callback - Callback function when element is selected
     */
    openPeriodicTable(callback) {
        const modal = document.getElementById('periodic-table-modal');
        if (modal) {
            modal.style.display = 'block';
            this.currentPeriodicTableCallback = callback;
        }
    }

    /**
     * Close periodic table modal
     */
    closePeriodicTable() {
        const modal = document.getElementById('periodic-table-modal');
        if (modal) {
            modal.style.display = 'none';
            this.currentPeriodicTableCallback = null;
        }
    }

    /**
     * Render periodic table grid
     */
    renderPeriodicTable() {
        const container = document.getElementById('periodic-table');
        if (!container) return;

        container.innerHTML = '';

        // Standard Periodic Table Layout (18 columns)
        const layout = [
            ['X', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // Dummy atom
            ['H', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'He'],
            ['Li', 'Be', '', '', '', '', '', '', '', '', '', '', 'B', 'C', 'N', 'O', 'F', 'Ne'],
            ['Na', 'Mg', '', '', '', '', '', '', '', '', '', '', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
            ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
            ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
            ['Cs', 'Ba', 'La', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'],
            ['Fr', 'Ra', 'Ac', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', '', '', '', '', '', '', '', '', ''],
        ];

        layout.forEach(row => {
            row.forEach(symbol => {
                const cell = document.createElement('div');
                cell.className = 'pt-cell';

                if (symbol && ELEMENTS[symbol]) {
                    const data = ELEMENTS[symbol];
                    cell.classList.add('active');

                    // Background color based on current scheme
                    const color = this.editor.renderManager.getElementColor(symbol);
                    const hex = color.toString(16).padStart(6, '0');
                    cell.style.backgroundColor = `#${hex}`;

                    // Text color contrast
                    const r = (color >> 16) & 0xff;
                    const g = (color >> 8) & 0xff;
                    const b = color & 0xff;
                    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    cell.style.color = luma < 128 ? 'white' : 'black';

                    cell.innerText = symbol;
                    cell.title = `Atomic Number: ${data.atomicNumber}`;

                    cell.onclick = () => {
                        this.editor.selectedElement = symbol;
                        const symbolSpan = document.getElementById('current-element-symbol');
                        if (symbolSpan) {
                            symbolSpan.innerText = symbol;
                        } else {
                            const btn = document.getElementById('btn-element-select');
                            if (btn) btn.innerText = symbol;
                        }

                        // Callback if provided (e.g. from console command)
                        if (this.currentPeriodicTableCallback) {
                            this.currentPeriodicTableCallback(symbol);
                        } else {
                            this.closePeriodicTable();
                        }
                    };
                } else {
                    cell.classList.add('empty');
                }
                container.appendChild(cell);
            });
        });
    }

    /**
     * Open coordinate editor modal
     */
    openCoordinateEditor() {
        const modal = document.getElementById('coord-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const input = document.getElementById('coord-input');
        const formatSelect = document.getElementById('coord-format');
        const btnCopy = document.getElementById('btn-coord-copy');
        const btnImport = document.getElementById('btn-coord-import');
        const btnClose = document.getElementById('coord-close');

        if (!modal || !input) return;

        // Load current data
        const loadCurrentData = () => {
            const format = formatSelect.value;
            if (format === 'xyz') {
                const xyz = this.editor.fileIOManager.exportXYZ();
                input.value = xyz || '';
            } else if (format === 'json') {
                const json = this.editor.fileIOManager.atomsToJSON(this.editor.molecule.atoms);
                input.value = json;
            } else {
                input.value = '';
            }
        };

        loadCurrentData();

        modal.style.display = 'block';
        if (backdrop) backdrop.style.display = 'block';
        input.focus();

        // Disable editor interactions
        if (this.editor.renderer.controls) {
            this.editor.renderer.controls.enabled = false;
        }

        // Event Handlers
        this._coordHandlers = {
            formatChange: () => loadCurrentData(),
            copy: () => {
                const text = input.value;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btnCopy.innerText;
                    btnCopy.innerText = 'Copied!';
                    setTimeout(() => btnCopy.innerText = originalText, 1000);
                }).catch(err => console.error('Failed to copy:', err));
            },
            import: () => {
                const text = input.value;
                const format = formatSelect.value;

                if (text) {
                    try {
                        this.editor.saveState(); // Save before importing

                        if (format === 'xyz') {
                            const result = this.editor.fileIOManager.importXYZ(text);
                            if (result.error) {
                                this.showError(result.error);
                            } else {
                                this.editor.renderManager.rebuildScene();
                                this.showSuccess(result.success);
                                this.closeCoordinateEditor();
                            }
                        }
                        // Future formats here
                    } catch (error) {
                        console.error('Error importing coordinates:', error);
                        this.showError('Error importing coordinates');
                    }
                }
            },
            close: () => this.closeCoordinateEditor()
        };

        // Bind events
        if (formatSelect) formatSelect.onchange = this._coordHandlers.formatChange;
        if (btnCopy) btnCopy.onclick = this._coordHandlers.copy;
        if (btnImport) btnImport.onclick = this._coordHandlers.import;
        if (btnClose) btnClose.onclick = this._coordHandlers.close;
    }

    /**
     * Close coordinate editor modal
     */
    closeCoordinateEditor() {
        const modal = document.getElementById('coord-modal');
        const backdrop = document.getElementById('modal-backdrop');

        if (!modal) return;

        // Reset maximize state
        if (modal.classList.contains('maximized')) {
            this.toggleMaximize(modal);
        }

        modal.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';

        // Re-enable interactions
        if (this.editor.renderer.controls) {
            this.editor.renderer.controls.enabled = true;
        }

        // Cleanup events
        const formatSelect = document.getElementById('coord-format');
        const btnCopy = document.getElementById('btn-coord-copy');
        const btnImport = document.getElementById('btn-coord-import');
        const btnClose = document.getElementById('coord-close');

        if (formatSelect) formatSelect.onchange = null;
        if (btnCopy) btnCopy.onclick = null;
        if (btnImport) btnImport.onclick = null;
        if (btnClose) btnClose.onclick = null;

        this._coordHandlers = null;
    }

    /**
     * Toggle modal maximize
     * @param {HTMLElement} element - Modal element
     */
    toggleMaximize(element) {
        if (!element) return;

        if (element.classList.contains('maximized')) {
            element.classList.remove('maximized');
        } else {
            element.classList.add('maximized');
        }
    }

    /**
     * Toggle modal minimize
     * @param {HTMLElement} element - Modal element
     */
    toggleMinimize(element) {
        if (!element) return;
        // Simple minimize implementation: hide content or reduce height
        // For now, let's just toggle a 'minimized' class
        element.classList.toggle('minimized');
    }

    /**
     * Export current view as PNG
     */
    exportPNG() {
        const molecule = this.editor.molecule;

        if (molecule.atoms.length === 0) {
            this.showError('No atoms to export');
            return;
        }

        // Collect all objects
        const objects = [];
        this.editor.renderer.scene.traverse(obj => {
            if (obj.userData && (obj.userData.type === 'atom' || obj.userData.type === 'bond' || obj.userData.type === 'label')) {
                objects.push(obj);
            }
        });

        // Capture snapshot
        const dataURL = this.editor.renderer.captureSnapshot(objects, false);

        if (!dataURL) {
            this.showError('Failed to capture snapshot');
            return;
        }

        // Download
        const link = document.createElement('a');
        link.download = `molecule_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    /**
     * Show error message to user
     * @param {string} message - Error message
     */
    showError(message) {
        // For now, use alert. In future, could use a toast/notification system
        alert(message);
    }

    /**
     * Show success message to user
     * @param {string} message - Success message
     */
    showSuccess(message) {
        // For now, use console. In future, could use a toast/notification system
        if (import.meta.env.DEV) {
            console.log('✓', message);
        }
    }

    /**
     * Create label element for an atom
     * @param {Object} atom - Atom object
     * @returns {HTMLElement} Label element
     */
    createAtomLabel(atom) {
        const label = document.createElement('div');
        label.className = 'atom-label';
        label.dataset.atomIndex = atom.index;

        this.updateAtomLabelText(atom, label);

        return label;
    }

    /**
     * Update label text for an atom
     * @param {Object} atom - Atom object
     * @param {HTMLElement} label - Label element (optional, will find if not provided)
     */
    updateAtomLabelText(atom, label = null) {
        if (!label) {
            label = atom.label;
        }
        if (!label) return;

        const mode = this.state.getLabelMode();

        if (mode === 'none') {
            label.style.display = 'none';
        } else {
            label.style.display = 'block';

            if (mode === 'symbol') {
                label.textContent = atom.element;
            } else if (mode === 'number') {
                label.textContent = atom.index.toString();
            } else if (mode === 'both') {
                label.textContent = `${atom.element}${atom.index}`;
            }
        }
    }

    /**
     * Update all atom labels
     */
    updateAllLabels() {
        this.editor.molecule.atoms.forEach(atom => {
            // Create label if missing
            if (!atom.label) {
                const label = this.createAtomLabel(atom);
                this.editor.labelContainer.appendChild(label);
                atom.label = label;
            }

            // Update text based on mode
            this.updateAtomLabelText(atom);

            // Show/hide based on mode
            const mode = this.state.getLabelMode();
            atom.label.style.display = mode !== 'none' ? 'block' : 'none';
        });

        if (this.state.getLabelMode() !== 'none') {
            this.updateLabelPositions();
        }
    }

    /**
     * Update label positions (2D screen coordinates)
     */
    updateLabelPositions() {
        const camera = this.editor.renderer.camera;
        const canvas = this.editor.canvas;

        this.editor.molecule.atoms.forEach(atom => {
            if (!atom.label || !atom.mesh) return;

            // Project 3D position to 2D screen
            const pos = atom.mesh.position.clone();
            pos.project(camera);

            const x = (pos.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (pos.y * -0.5 + 0.5) * canvas.clientHeight;

            atom.label.style.left = `${x}px`;
            atom.label.style.top = `${y}px`;
        });
    }
}
