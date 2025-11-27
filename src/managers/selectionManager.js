import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Manages atom selection state and UI
 * Handles selection highlighting, order tracking, and status updates
 */
export class SelectionManager {
    constructor(editor) {
        this.editor = editor;
        this.state = editor.state; // Reference to EditorState

        // Selection visualization (will be managed by this class)
        this.selectionMode = 'lasso'; // 'lasso' | 'rectangle'
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        // Clear state
        this.state.clearSelection();

        // Clear visual highlights
        this.editor.molecule.atoms.forEach(atom => {
            atom.selected = false;
            if (atom.mesh) {
                atom.mesh.material.emissive.setHex(0x000000);
            }
        });

        this.updateSelectionStatus();
    }

    /**
     * Select an atom
     * @param {Object} atom - Atom to select
     * @param {boolean} add - Whether to add to selection or replace
     */
    selectAtom(atom, add = false) {
        if (!atom) {
            return ErrorHandler.error('No atom provided');
        }

        // Clear previous selection if not adding
        if (!add) {
            this.clearSelection();
        }

        // Toggle selection
        if (atom.selected) {
            this.deselectAtom(atom);
        } else {
            atom.selected = true;
            this.state.addToSelection(atom.index, atom);

            // Visual highlight
            if (atom.mesh) {
                atom.mesh.material.emissive.setHex(0xffff00);
            }
        }

        this.updateSelectionStatus();
        return ErrorHandler.success(`Atom ${atom.index} selected`);
    }

    /**
     * Deselect an atom
     * @param {Object} atom - Atom to deselect
     */
    deselectAtom(atom) {
        if (!atom) return;

        atom.selected = false;
        this.state.removeFromSelection(atom.index);

        // Remove visual highlight
        if (atom.mesh) {
            atom.mesh.material.emissive.setHex(0x000000);
        }

        this.updateSelectionStatus();
    }

    /**
     * Select atoms by indices
     * @param {number[]} indices - Atom indices to select
     */
    selectByIndices(indices) {
        this.clearSelection();

        const atoms = this.editor.molecule.atoms;
        for (const idx of indices) {
            if (idx >= 0 && idx < atoms.length) {
                this.selectAtom(atoms[idx], true);
            }
        }
    }

    /**
     * Select atoms in a range (inclusive)
     * @param {number} start - Start index
     * @param {number} end - End index
     */
    selectRange(start, end) {
        const atoms = this.editor.molecule.atoms;
        const indices = [];

        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 0 && i < atoms.length) {
                indices.push(i);
            }
        }

        this.selectByIndices(indices);
    }

    /**
     * Select all atoms
     */
    selectAll() {
        const atoms = this.editor.molecule.atoms;
        this.selectByIndices(atoms.map((_, idx) => idx));
    }

    /**
     * Invert selection
     */
    invertSelection() {
        const atoms = this.editor.molecule.atoms;
        atoms.forEach((atom, idx) => {
            if (atom.selected) {
                this.deselectAtom(atom);
            } else {
                this.selectAtom(atom, true);
            }
        });
    }

    /**
     * Get selected atoms
     * @returns {Object[]} Array of selected atoms
     */
    getSelectedAtoms() {
        return this.editor.molecule.atoms.filter(atom => atom.selected);
    }

    /**
     * Get selection count
     * @returns {number} Number of selected atoms
     */
    getSelectionCount() {
        return this.state.getSelectionCount();
    }

    /**
     * Get selection order (for geometry operations)
     * @returns {Object[]} Array of atoms in selection order
     */
    getSelectionOrder() {
        return this.state.getSelectionOrder();
    }

    /**
     * Update selection mode
     * @param {string} mode - 'lasso' or 'rectangle'
     */
    setSelectionMode(mode) {
        const validModes = ['lasso', 'rectangle'];
        if (!validModes.includes(mode)) {
            return ErrorHandler.error(`Invalid selection mode: ${mode}`);
        }

        this.selectionMode = mode;
        this.updateSelectionStatus();
        return ErrorHandler.success(`Selection mode: ${mode}`);
    }

    /**
     * Cycle through selection modes
     */
    cycleSelectionMode() {
        this.selectionMode = this.selectionMode === 'lasso' ? 'rectangle' : 'lasso';
        this.updateSelectionStatus();
        return this.selectionMode;
    }

    /**
     * Update selection status display
     */
    updateSelectionStatus() {
        const btn = document.getElementById('btn-select');
        if (!btn) return;

        const sub = btn.querySelector('.btn-sublabel');

        if (sub) {
            sub.style.display = 'block';
            if (this.selectionMode === 'rectangle') {
                sub.innerText = 'Rectangle';
                sub.style.color = '#4a90e2';
            } else if (this.selectionMode === 'lasso') {
                sub.innerText = 'Lasso';
                sub.style.color = '#e2904a';
            }
        } else {
            if (this.selectionMode === 'rectangle') {
                btn.innerText = 'Select: Rectangle';
                btn.style.backgroundColor = '#4a90e2';
            } else if (this.selectionMode === 'lasso') {
                btn.innerText = 'Select: Lasso';
                btn.style.backgroundColor = '#e2904a';
            }
        }
    }

    /**
     * Clear selection status display
     */
    clearSelectionStatus() {
        const btn = document.getElementById('btn-select');
        if (!btn) return;

        const sub = btn.querySelector('.btn-sublabel');

        if (sub) {
            sub.style.display = 'none';
        } else {
            btn.innerText = 'Select (Lasso/Rect)';
            btn.style.backgroundColor = '';
        }
    }

    /**
     * Update highlights for all atoms (refresh visual state)
     */
    updateHighlights() {
        this.editor.molecule.atoms.forEach(atom => {
            if (atom.mesh) {
                if (atom.selected) {
                    atom.mesh.material.emissive.setHex(0xffff00);
                } else {
                    atom.mesh.material.emissive.setHex(0x000000);
                }
            }
        });
    }

    /**
     * Delete selected atoms
     */
    deleteSelected() {
        const selected = this.getSelectedAtoms();
        if (selected.length === 0) return;

        this.editor.saveState(); // Save before deleting

        // Remove labels first (DOM manipulation)
        selected.forEach(atom => {
            if (atom.label && atom.label.parentNode) {
                atom.label.parentNode.removeChild(atom.label);
                atom.label = null;
            }
            // Mesh removal is handled by rebuildScene, but good to be explicit if optimizing
            if (atom.mesh) {
                this.editor.renderer.scene.remove(atom.mesh);
            }
        });

        // Remove from molecule data
        this.editor.moleculeManager.removeAtoms(selected);

        // Rebuild scene to clean up bonds and update indices
        this.editor.rebuildScene();

        // Clear selection state
        this.clearSelection();
    }
}
