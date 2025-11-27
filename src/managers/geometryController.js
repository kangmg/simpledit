import { GeometryEngine } from '../geometryEngine.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Controls geometry manipulation sliders and operations
 * Handles bond length, angle, and dihedral adjustments
 */
export class GeometryController {
    constructor(editor) {
        this.editor = editor;
        this.state = editor.state;
    }

    /**
     * Bind geometry slider events
     */
    bindGeometrySliders() {
        this.bindBondLengthSlider();
        this.bindAngleSlider();
        this.bindDihedralSlider();
    }

    /**
     * Bind bond length slider
     */
    bindBondLengthSlider() {
        const slider = document.getElementById('input-length');
        const display = document.getElementById('length-value');

        if (slider) {
            slider.oninput = () => {
                if (display) display.textContent = slider.value;
            };

            slider.onchange = () => {
                this.setBondLength(parseFloat(slider.value));
            };
        }
    }

    /**
     * Bind angle slider
     */
    bindAngleSlider() {
        const slider = document.getElementById('input-angle');
        const display = document.getElementById('angle-value');

        if (slider) {
            slider.oninput = () => {
                if (display) display.textContent = slider.value;
            };

            slider.onchange = () => {
                this.setAngle(parseFloat(slider.value));
            };
        }
    }

    /**
     * Bind dihedral slider
     */
    bindDihedralSlider() {
        const slider = document.getElementById('input-dihedral');
        const display = document.getElementById('dihedral-value');

        if (slider) {
            slider.oninput = () => {
                if (display) display.textContent = slider.value;
            };

            slider.onchange = () => {
                this.setDihedral(parseFloat(slider.value));
            };
        }
    }

    /**
     * Set bond length between two selected atoms
     * @param {number} targetDist - Target distance in Angstroms
     * @returns {Object} Result object
     */
    setBondLength(targetDist) {
        const selectionOrder = this.state.getSelectionOrder();

        if (selectionOrder.length !== 2) {
            return ErrorHandler.error('Select exactly 2 atoms for bond length adjustment');
        }

        const validation = ErrorHandler.validatePositive(targetDist, 'distance');
        if (validation) return validation;

        const [a1, a2] = selectionOrder;

        // Find fragment to move
        const fragmentToMove = this.getMovingFragment(a1, a2);
        const movingAtomPositions = Array.from(fragmentToMove).map(atom => atom.position.clone());

        // Calculate new positions
        const newPositions = GeometryEngine.getNewPositionsForBondLength(
            a1.position,
            a2.position,
            movingAtomPositions,
            targetDist
        );

        // Apply new positions
        Array.from(fragmentToMove).forEach((atom, i) => {
            atom.position.copy(newPositions[i]);
            this.editor.renderManager.updateAtomVisuals(atom);
        });

        this.editor.renderManager.updateBondVisuals();
        this.editor.uiManager.updateLabelPositions();
        this.editor.saveState();

        return ErrorHandler.success(`Bond length set to ${targetDist.toFixed(2)} Å`);
    }

    /**
     * Set angle between three selected atoms
     * @param {number} targetAngle - Target angle in degrees
     * @returns {Object} Result object
     */
    setAngle(targetAngle) {
        const selectionOrder = this.state.getSelectionOrder();

        if (selectionOrder.length !== 3) {
            return ErrorHandler.error('Select exactly 3 atoms for angle adjustment');
        }

        const validation = ErrorHandler.validateNumber(targetAngle, 'angle');
        if (validation) return validation;

        const [a1, pivot, a3] = selectionOrder;

        // Find fragment to move
        const fragmentToMove = this.getMovingFragment(pivot, a3);
        const movingAtomPositions = Array.from(fragmentToMove).map(atom => atom.position.clone());

        // Calculate new positions
        const newPositions = GeometryEngine.getNewPositionsForAngle(
            a1.position,
            pivot.position,
            a3.position,
            movingAtomPositions,
            targetAngle
        );

        // Apply new positions
        Array.from(fragmentToMove).forEach((atom, i) => {
            atom.position.copy(newPositions[i]);
            this.editor.renderManager.updateAtomVisuals(atom);
        });

        this.editor.renderManager.updateBondVisuals();
        this.editor.uiManager.updateLabelPositions();
        this.editor.saveState();

        return ErrorHandler.success(`Angle set to ${targetAngle.toFixed(1)}°`);
    }

    /**
     * Set dihedral angle between four selected atoms
     * @param {number} targetAngle - Target dihedral in degrees
     * @returns {Object} Result object
     */
    setDihedral(targetAngle) {
        const selectionOrder = this.state.getSelectionOrder();

        if (selectionOrder.length !== 4) {
            return ErrorHandler.error('Select exactly 4 atoms for dihedral adjustment');
        }

        const validation = ErrorHandler.validateNumber(targetAngle, 'dihedral');
        if (validation) return validation;

        const [a1, a2, a3, a4] = selectionOrder;

        // Find fragment to move (atoms on a4 side of a2-a3 bond)
        const fragmentToMove = this.getMovingFragment(a3, a4);
        const movingAtomPositions = Array.from(fragmentToMove).map(atom => atom.position.clone());

        // Calculate new positions
        const newPositions = GeometryEngine.getNewPositionsForDihedral(
            a1.position,
            a2.position,
            a3.position,
            a4.position,
            movingAtomPositions,
            targetAngle
        );

        // Apply new positions
        Array.from(fragmentToMove).forEach((atom, i) => {
            atom.position.copy(newPositions[i]);
            this.editor.renderManager.updateAtomVisuals(atom);
        });

        this.editor.renderManager.updateBondVisuals();
        this.editor.uiManager.updateLabelPositions();
        this.editor.saveState();

        return ErrorHandler.success(`Dihedral set to ${targetAngle.toFixed(1)}°`);
    }

    /**
     * Get moving fragment for geometry operation
     * @param {Object} pivot - Pivot atom
     * @param {Object} direction - Direction atom
     * @returns {Set} Set of atoms to move
     */
    getMovingFragment(pivot, direction) {
        const visited = new Set();
        const toMove = new Set();
        const queue = [direction];

        visited.add(pivot);

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;

            visited.add(current);
            toMove.add(current);

            // Find connected atoms
            const bonds = this.editor.molecule.bonds;
            for (const bond of bonds) {
                if (bond.atom1 === current.index) {
                    const neighbor = this.editor.molecule.atoms[bond.atom2];
                    if (neighbor && !visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                } else if (bond.atom2 === current.index) {
                    const neighbor = this.editor.molecule.atoms[bond.atom1];
                    if (neighbor && !visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
        }

        return toMove;
    }
}
