import * as THREE from 'three';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Manages file import/export operations
 * Handles XYZ format and coordinate conversions
 */
export class FileIOManager {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Import XYZ format string
     * @param {string} xyzString - XYZ format data
     * @returns {Object} Result object
     */
    importXYZ(xyzString) {
        try {
            const lines = xyzString.trim().split('\n');

            if (lines.length < 2) {
                return ErrorHandler.error('Invalid XYZ format: too few lines');
            }

            const atomCount = parseInt(lines[0].trim());
            if (isNaN(atomCount)) {
                return ErrorHandler.error('Invalid XYZ format: first line must be atom count');
            }

            // Line 1 is comment
            const atoms = [];

            for (let i = 2; i < Math.min(2 + atomCount, lines.length); i++) {
                const parts = lines[i].trim().split(/\s+/);

                if (parts.length < 4) continue;

                const element = parts[0];
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);

                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    return ErrorHandler.error(`Invalid coordinates on line ${i + 1}`);
                }

                atoms.push({ element, x, y, z });
            }

            if (atoms.length === 0) {
                return ErrorHandler.error('No valid atoms found in XYZ data');
            }

            // Clear current molecule and add atoms
            this.editor.molecule.atoms = [];
            this.editor.molecule.bonds = [];

            atoms.forEach(({ element, x, y, z }) => {
                this.editor.addAtomToScene(element, new THREE.Vector3(x, y, z));
            });

            // Auto-detect bonds
            this.editor.autoDetectBonds();

            return ErrorHandler.success(`Imported ${atoms.length} atoms`);

        } catch (error) {
            ErrorHandler.logError('FileIOManager.importXYZ', error);
            return ErrorHandler.error('Failed to import XYZ data', error.message);
        }
    }

    /**
     * Export molecule as XYZ format
     * @returns {string|null} XYZ format string or null on error
     */
    exportXYZ() {
        const atoms = this.editor.molecule.atoms;

        if (atoms.length === 0) {
            return null;
        }

        let xyz = `${atoms.length}\n`;
        xyz += `Exported from Simpledit\n`;

        atoms.forEach(atom => {
            const x = atom.position.x.toFixed(6);
            const y = atom.position.y.toFixed(6);
            const z = atom.position.z.toFixed(6);
            xyz += `${atom.element.padEnd(3)} ${x.padStart(12)} ${y.padStart(12)} ${z.padStart(12)}\n`;
        });

        return xyz;
    }

    /**
     * Convert atoms array to XYZ string
     * @param {Object[]} atoms - Array of atom objects
     * @returns {string} XYZ format string
     */
    atomsToXYZ(atoms) {
        if (!atoms || atoms.length === 0) {
            return '';
        }

        let xyz = `${atoms.length}\n`;
        xyz += `\n`; // Comment line

        atoms.forEach(atom => {
            const x = atom.position.x.toFixed(6);
            const y = atom.position.y.toFixed(6);
            const z = atom.position.z.toFixed(6);
            xyz += `${atom.element} ${x} ${y} ${z}\n`;
        });

        return xyz;
    }

    /**
     * Convert atoms to JSON format
     * @param {Object[]} atoms - Array of atom objects
     * @returns {string} JSON string
     */
    atomsToJSON(atoms) {
        const data = atoms.map(atom => ({
            element: atom.element,
            position: {
                x: atom.position.x,
                y: atom.position.y,
                z: atom.position.z
            },
            index: atom.index
        }));

        return JSON.stringify(data, null, 2);
    }

    /**
     * Download XYZ file
     */
    downloadXYZ() {
        const xyz = this.exportXYZ();

        if (!xyz) {
            return ErrorHandler.error('No atoms to export');
        }

        const blob = new Blob([xyz], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `molecule_${Date.now()}.xyz`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        return ErrorHandler.success('XYZ file downloaded');
    }

    /**
     * Load XYZ from file input
     * @param {File} file - File object
     * @returns {Promise<Object>} Result object
     */
    async loadXYZFile(file) {
        try {
            const text = await file.text();
            return this.importXYZ(text);
        } catch (error) {
            ErrorHandler.logError('FileIOManager.loadXYZFile', error);
            return ErrorHandler.error('Failed to read file', error.message);
        }
    }
}
