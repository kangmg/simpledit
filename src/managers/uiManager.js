import * as THREE from 'three';
import { ErrorHandler } from '../utils/errorHandler.js';
import { ELEMENTS } from '../constants.js';
import { jsmeManager } from './jsmeManager.js';
import { oclEditorManager } from './oclEditorManager.js';

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
        this.bindJSMEButton();
        this.bindBondThresholdSlider();
        this.bindConsoleButton();
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
                this.editor.renderer.setProjection(e.target.value);
            };
        }
    }

    /**
     * Bind label toggle button
     */
    bindLabelButton() {
        const btnLabel = document.getElementById('btn-toggle-labels');
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
     * Bind console toggle button
     */
    bindConsoleButton() {
        const btnConsole = document.getElementById('btn-toggle-console');
        if (btnConsole) {
            btnConsole.onclick = () => {
                if (this.editor.console) {
                    this.editor.console.toggle();
                }
            };
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

                    // If atoms are selected, update their element
                    const selectedAtoms = this.editor.molecule.atoms.filter(a => a.selected);
                    if (selectedAtoms.length > 0) {
                        selectedAtoms.forEach(atom => {
                            atom.element = element;
                            this.editor.updateAtomVisuals(atom);
                        });
                        this.editor.updateAllLabels(); // Update labels to reflect new element
                    }

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
        // Minimize button acts as close button (Mac-style design choice by user)
        if (btnMinimize && modal) btnMinimize.onclick = () => this.closeCoordinateEditor();
        if (btnMaximize && modal) btnMaximize.onclick = () => this.toggleMaximize(modal);
    }

    /**
     * Bind JSME button
     */
    bindJSMEButton() {
        const btnJSME = document.getElementById('btn-edit-2d');
        if (btnJSME) {
            btnJSME.onclick = () => this.openJSME();
        }
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
        const btn = document.getElementById('btn-toggle-labels');
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
        const modal = document.getElementById('pt-modal');
        if (modal) {
            modal.style.display = 'block';
            this.currentPeriodicTableCallback = callback;
        }
    }

    /**
     * Close periodic table modal
     */
    closePeriodicTable() {
        const modal = document.getElementById('pt-modal');
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
        const splitFragmentsCheckbox = document.getElementById('chk-split-fragments');

        if (!modal || !input) return;

        // Load current data
        const loadCurrentData = async () => {
            const format = formatSelect.value;
            const splitFragments = splitFragmentsCheckbox ? splitFragmentsCheckbox.checked : false;

            if (format === 'xyz') {
                const xyz = this.editor.fileIOManager.exportXYZ({ splitFragments });
                input.value = xyz || '';
            } else if (format === 'smi' || format === 'smiles') {
                const smiles = await this.editor.fileIOManager.exportSMILES({ splitFragments, includeName: false });
                input.value = smiles || '';
            } else if (format === 'sdf') {
                const sdf = await this.editor.fileIOManager.exportSDF({ splitFragments });
                input.value = sdf || '';
            } else if (format === 'json') {
                const json = this.editor.fileIOManager.atomsToJSON(this.editor.molecule.atoms);
                input.value = json;
            } else if (format === 'smi' || format === 'smiles') {
                const smiles = this.editor.fileIOManager.exportSMILES({ splitFragments });
                input.value = smiles || '';
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
            import: async () => {
                const text = input.value;
                const format = formatSelect.value;

                if (text) {
                    try {
                        this.editor.saveState(); // Save before importing

                        if (format === 'xyz') {
                            // Multi-frame XYZ automatically creates separate molecules
                            const result = this.editor.fileIOManager.importXYZ(text, {
                                shouldClear: true,
                                autoBond: true
                            });
                            if (result.error) {
                                this.showError(result.error);
                            } else {
                                this.editor.renderManager.rebuildScene();
                                this.updateAtomCount(); // Sync UI
                                this.showSuccess(result.success || 'Imported XYZ');
                                this.closeCoordinateEditor();
                            }
                        } else if (format === 'smi' || format === 'smiles') {
                            const result = await this.editor.fileIOManager.importSMILES(text, {
                                shouldClear: true,
                                autoBond: false,
                                generate3D: true, // Default to 3D for Coordinate Editor
                                addHydrogens: true
                            });
                            if (result.error) {
                                this.showError(result.error);
                            } else {
                                this.editor.renderManager.rebuildScene();
                                this.updateAtomCount(); // Sync UI
                                this.showSuccess('Imported SMILES');
                                this.closeCoordinateEditor();
                            }
                        } else if (format === 'sdf') {
                            const result = this.editor.fileIOManager.importSDF(text, {
                                shouldClear: true,
                                autoBond: false
                            });
                            if (result.error) {
                                this.showError(result.error);
                            } else {
                                this.editor.renderManager.rebuildScene();
                                this.updateAtomCount(); // Sync UI
                                this.showSuccess('Imported SDF');
                                this.closeCoordinateEditor();
                            }
                        }
                    } catch (error) {
                        console.error('Error importing coordinates:', error);
                        this.showError('Error importing coordinates: ' + error.message);
                    }
                }
            },
            close: () => this.closeCoordinateEditor()
        };

        // Bind events
        if (formatSelect) formatSelect.onchange = this._coordHandlers.formatChange;
        if (splitFragmentsCheckbox) splitFragmentsCheckbox.onchange = this._coordHandlers.formatChange;
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
        const splitFragmentsCheckbox = document.getElementById('chk-split-fragments');

        if (formatSelect) formatSelect.onchange = null;
        if (splitFragmentsCheckbox) splitFragmentsCheckbox.onchange = null;
        if (btnCopy) btnCopy.onclick = null;
        if (btnImport) btnImport.onclick = null;
        if (btnClose) btnClose.onclick = null;

        this._coordHandlers = null;
    }

    /**
     * Toggle maximize state of JSME modal
     */
    toggleJSMEMaximize() {
        const modal = document.getElementById('jsme-modal');
        if (!modal) return;
        modal.classList.toggle('maximized');
    }



    /**
     * Open 2D Editor modal (JSME or OCL)
     */
    async openJSME() {
        const modal = document.getElementById('jsme-modal');
        const backdrop = document.getElementById('modal-backdrop');

        if (!modal) return;

        // Show modal first
        modal.style.display = 'flex';
        if (backdrop) backdrop.style.display = 'block';

        // Default to JSME if not set
        if (!this.activeEditor) this.activeEditor = 'jsme';
        this.updateEditorVisibility();

        // Initialize editors
        try {
            // Always init both if possible, or just the active one
            // Init JSME and OCL in parallel
            await Promise.all([
                jsmeManager.init('jsme-container'),
                oclEditorManager.init('ocl-editor-container')
            ]);

            // IMPORTANT: Clear both editors by setting empty molecule
            // (clear() method doesn't always work reliably)
            jsmeManager.setMol("");
            oclEditorManager.setMol("");
            // Auto-load removed as per user request
        } catch (error) {
            console.error('Failed to initialize 2D editors:', error);
            this.showError('Failed to initialize 2D editors. Please check console.');
        }

        // Disable editor controls
        if (this.editor.renderer.controls) {
            this.editor.renderer.controls.enabled = false;
        }

        // Bind modal buttons
        const btnImport = document.getElementById('btn-jsme-import');
        const btnClose = document.getElementById('btn-jsme-close');
        const btnMinimize = document.getElementById('btn-jsme-minimize');
        const btnMaximize = document.getElementById('btn-jsme-maximize');

        // Sync/Sanitize buttons
        const btnSync = document.getElementById('btn-sync-mol');
        const btnSanitize = document.getElementById('btn-sanitize-mol');

        if (btnSync) btnSync.onclick = () => this.loadMoleculeTo2D({ sanitize: false });
        if (btnSanitize) btnSanitize.onclick = () => this.loadMoleculeTo2D({ sanitize: true });

        // Toggle buttons
        const btnToggleJSME = document.getElementById('btn-editor-jsme');
        const btnToggleOCL = document.getElementById('btn-editor-ocl');

        if (btnToggleJSME) btnToggleJSME.onclick = () => this.switchEditor('jsme');
        if (btnToggleOCL) btnToggleOCL.onclick = () => this.switchEditor('ocl');

        if (btnImport) {
            btnImport.onclick = async () => {
                let molBlock;

                if (this.activeEditor === 'jsme') {
                    molBlock = jsmeManager.getMol();
                } else {
                    molBlock = oclEditorManager.getMol();
                }

                if (molBlock) {
                    const result = await this.editor.fileIOManager.updateFromMolBlock(molBlock);

                    if (result && result.error) {
                        this.showError(result.error);
                    } else {
                        // Rebuild 3D scene
                        this.editor.renderManager.rebuildScene();

                        // Force update side panel
                        this.editor.updateSelectionInfo();
                        this.editor.moleculeManager.updateUI();

                        // Close modal and show success
                        this.showSuccess('Updated molecule from 2D editor');
                        console.log('[2D Editor] Molecule updated successfully');
                        this.closeJSME();
                    }
                }
            };
        }

        if (btnClose) btnClose.onclick = () => this.closeJSME();
        if (btnMinimize) btnMinimize.onclick = () => this.closeJSME();
        if (btnMaximize) btnMaximize.onclick = () => this.toggleJSMEMaximize();
    }

    /**
     * Load current 3D molecule into 2D editor with options
     * @param {Object} options - { sanitize: boolean }
     */
    loadMoleculeTo2D(options = {}) {
        // Load current molecule (selected atoms or all if none selected)
        const selectedAtoms = this.editor.selectionManager.getSelectedAtoms();
        const atomsToLoad = selectedAtoms.length > 0 ? selectedAtoms : this.editor.molecule.atoms;

        console.log('[2D Editor] Loading molecule:', {
            selectedCount: selectedAtoms.length,
            totalCount: this.editor.molecule.atoms.length,
            loadingAtoms: atomsToLoad.length,
            options
        });

        if (atomsToLoad.length === 0) {
            this.showError("No atoms to load");
            return;
        }

        // Generate MolBlock with options
        // If OCL editor, force 2D generation to avoid <rect> errors with 3D coords
        const exportOptions = { ...options };
        if (this.activeEditor === 'ocl') {
            exportOptions.generate2D = true;
        }
        const molBlock = this.editor.fileIOManager.atomsToMolBlock(atomsToLoad, exportOptions);

        // Load into active editor
        if (this.activeEditor === 'jsme') {
            jsmeManager.setMol(molBlock);
        } else {
            oclEditorManager.setMol(molBlock);
        }

        this.showSuccess(options.sanitize ? "Molecule sanitized (inferred bonds)" : "Molecule synced (connectivity only)");
    }

    /**
     * Switch active editor
     * @param {'jsme'|'ocl'} editorType 
     */
    switchEditor(editorType) {
        if (this.activeEditor === editorType) return;

        // Sync data before switching
        let currentMolBlock;
        if (this.activeEditor === 'jsme') {
            currentMolBlock = jsmeManager.getMol();
        } else {
            currentMolBlock = oclEditorManager.getMol();
        }

        this.activeEditor = editorType;
        this.updateEditorVisibility();

        // Set data to new editor
        if (currentMolBlock) {
            if (this.activeEditor === 'jsme') {
                jsmeManager.setMol(currentMolBlock);
            } else {
                oclEditorManager.setMol(currentMolBlock);
            }
        } else {
            // If current editor was empty or failed, clear the new editor too
            if (this.activeEditor === 'jsme') {
                jsmeManager.setMol('');
            } else {
                oclEditorManager.setMol('');
            }
        }
    }

    /**
     * Update editor visibility based on active state
     */
    updateEditorVisibility() {
        const jsmeContainer = document.getElementById('jsme-container');
        const oclContainer = document.getElementById('ocl-editor-container');
        const btnJSME = document.getElementById('btn-editor-jsme');
        const btnOCL = document.getElementById('btn-editor-ocl');

        if (this.activeEditor === 'jsme') {
            if (jsmeContainer) jsmeContainer.style.display = 'block';
            if (oclContainer) oclContainer.style.display = 'none';

            if (btnJSME) {
                btnJSME.style.background = '#555';
                btnJSME.style.color = 'white';
            }
            if (btnOCL) {
                btnOCL.style.background = 'transparent';
                btnOCL.style.color = '#aaa';
            }
        } else {
            if (jsmeContainer) jsmeContainer.style.display = 'none';
            if (oclContainer) oclContainer.style.display = 'block';

            if (btnJSME) {
                btnJSME.style.background = 'transparent';
                btnJSME.style.color = '#aaa';
            }
            if (btnOCL) {
                btnOCL.style.background = '#555';
                btnOCL.style.color = 'white';
            }
        }
    }

    /**
     * Close JSME modal
     */
    closeJSME() {
        const modal = document.getElementById('jsme-modal');
        const backdrop = document.getElementById('modal-backdrop');

        if (!modal) return;

        // Reset maximize state
        if (modal.classList.contains('maximized')) {
            this.toggleJSMEMaximize();
        }

        modal.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';

        // Re-enable editor controls
        if (this.editor.renderer.controls) {
            this.editor.renderer.controls.enabled = true;
        }

        // Cleanup events
        const btnImport = document.getElementById('btn-jsme-import');
        const btnClose = document.getElementById('btn-jsme-close');
        const btnMinimize = document.getElementById('btn-jsme-minimize');
        const btnMaximize = document.getElementById('btn-jsme-maximize');

        if (btnImport) btnImport.onclick = null;
        if (btnClose) btnClose.onclick = null;
        if (btnMinimize) btnMinimize.onclick = null;
        if (btnMaximize) btnMaximize.onclick = null;
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
        const index = this.editor.molecule.atoms.indexOf(atom);
        label.dataset.atomIndex = index;

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
            const index = this.editor.molecule.atoms.indexOf(atom);

            if (mode === 'symbol') {
                label.textContent = atom.element;
            } else if (mode === 'number') {
                label.textContent = index.toString();
            } else if (mode === 'both') {
                label.textContent = `${atom.element}(${index})`;
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
        const camera = this.editor.renderer.activeCamera;
        const canvas = this.editor.canvas;
        const scene = this.editor.renderer.scene;
        const raycaster = new THREE.Raycaster();

        this.editor.molecule.atoms.forEach(atom => {
            if (!atom.label || !atom.mesh) return;

            // 1. Project 3D position to NDC (Normalized Device Coordinates)
            const pos = atom.mesh.position.clone();
            pos.project(camera);

            // 2. Check if behind camera or outside frustum (roughly)
            if (pos.z > 1 || Math.abs(pos.x) > 1.1 || Math.abs(pos.y) > 1.1) {
                atom.label.style.display = 'none';
                return;
            }

            // 3. Occlusion Check (Raycasting)
            raycaster.setFromCamera({ x: pos.x, y: pos.y }, camera);

            // Intersect with atoms and bonds
            // We filter objects to only include meshes that are atoms or bonds
            const objectsToCheck = [];
            scene.traverse(obj => {
                if (obj.isMesh && obj.userData && (obj.userData.type === 'atom' || obj.userData.type === 'bond')) {
                    objectsToCheck.push(obj);
                }
            });

            const intersects = raycaster.intersectObjects(objectsToCheck);

            if (intersects.length > 0) {
                // The first hit object
                const firstHit = intersects[0];

                // If the first hit is NOT the current atom's mesh, it's occluded
                // We allow a small tolerance or check if the object is the atom itself
                if (firstHit.object !== atom.mesh) {
                    // Check distance difference to avoid z-fighting flickering
                    // If the blocking object is significantly closer than the atom
                    if (firstHit.distance < intersects.find(hit => hit.object === atom.mesh)?.distance - 0.1) {
                        atom.label.style.display = 'none';
                        return;
                    }
                }
            }

            // 4. If visible, update position and scale
            const x = (pos.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (pos.y * -0.5 + 0.5) * canvas.clientHeight;

            // Calculate scale based on distance or zoom
            let scale = 1;
            if (camera.isPerspectiveCamera) {
                // Perspective: Scale inversely with distance
                const distance = atom.mesh.position.distanceTo(camera.position);
                const referenceDistance = 10; // Distance where scale is 1
                scale = referenceDistance / distance;
            } else {
                // Orthographic: Scale with zoom
                scale = camera.zoom;
            }

            // Clamp scale to reasonable limits (optional, but good for readability)
            scale = Math.max(0.5, Math.min(scale, 2.0));

            atom.label.style.display = 'block';
            atom.label.style.left = `${x}px`;
            atom.label.style.top = `${y}px`;
            atom.label.style.transform = `translate(-50%, -50%) scale(${scale})`;

            // Optional: Z-index based on depth so closer labels are on top
            // pos.z in NDC is -1 (near) to 1 (far)
            const zIndex = Math.floor((1 - pos.z) * 1000);
            atom.label.style.zIndex = zIndex;
        });
    }

    /**
     * Update atom count display
     */
    updateAtomCount() {
        const countElement = document.getElementById('atom-count');
        if (countElement) {
            const count = this.editor.molecule.atoms.length;
            countElement.textContent = `${count} atoms`;
        }
    }
}
