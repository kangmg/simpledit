import { ErrorHandler } from '../utils/errorHandler.js';

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
     * Open coordinate editor modal
     */
    openCoordinateEditor() {
        const modal = document.getElementById('coord-modal');
        if (modal) {
            modal.style.display = 'block';
            this.editor.updateCoordinateEditor();
        }
    }

    /**
     * Close coordinate editor modal
     */
    closeCoordinateEditor() {
        const modal = document.getElementById('coord-modal');
        if (modal) {
            modal.style.display = 'none';
        }
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
