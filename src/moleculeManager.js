import { Molecule } from './molecule.js';
import { GeometryEngine } from './geometryEngine.js';
import * as THREE from 'three';
import { ELEMENTS, DEFAULT_ELEMENT } from './constants.js';

export class MoleculeManager {
    constructor(editor) {
        this.editor = editor;
        this.molecules = []; // Array of { id, name, molecule: Molecule, history, historyIndex, settings }
        this.activeMoleculeIndex = -1;
        this.nextId = 1;

        // Clipboard for copy/paste operations
        this.clipboard = {
            atoms: [],      // Atom data: { element, position }
            bonds: [],      // Bond data: { atom1Idx, atom2Idx, order }
            centerOfMass: null
        };

        // Initialize with one empty molecule
        this.createMolecule("Molecule 1");
    }

    createMolecule(name) {
        // Generate name if not provided
        if (!name) {
            name = `Molecule ${this.molecules.length + 1}`;
            // Ensure unique name
            let counter = 1;
            while (this.molecules.some(m => m.name === name)) {
                counter++;
                name = `Molecule ${this.molecules.length + counter}`;
            }
        } else {
            // Check for duplicate name
            if (this.molecules.some(m => m.name === name)) {
                return { error: `Molecule with name "${name}" already exists` };
            }
        }

        const molecule = new Molecule();
        const entry = {
            id: this.nextId++,
            name: name,
            molecule: molecule,
            history: [],
            historyIndex: -1,
            settings: {
                labelMode: 'none',
                colorScheme: 'jmol'
            }
        };

        this.molecules.push(entry);

        // Always switch to the newly created molecule
        const newIndex = this.molecules.length - 1;
        this.switchMolecule(newIndex);

        return entry;
    }

    removeMolecule(index) {
        if (index < 0 || index >= this.molecules.length) {
            return { error: `Invalid molecule index: ${index}` };
        }

        if (this.molecules.length === 1) {
            return { error: "Cannot remove the last molecule" };
        }

        const removed = this.molecules.splice(index, 1)[0];

        // Adjust active index
        if (index === this.activeMoleculeIndex) {
            // If removed active molecule, prevent saving state for it
            this.activeMoleculeIndex = -1;

            // Switch to the previous one (or 0)
            const newIndex = Math.max(0, index - 1);
            this.switchMolecule(newIndex);
        } else if (index < this.activeMoleculeIndex) {
            // If removed molecule was before active one, decrement index
            this.activeMoleculeIndex--;
        }

        this.updateUI();
        return { success: `Removed molecule "${removed.name}"` };
    }

    switchMolecule(index) {
        if (index < 0 || index >= this.molecules.length) {
            return { error: `Invalid molecule index: ${index}` };
        }

        // Save current molecule's state (history and settings)
        if (this.activeMoleculeIndex !== -1) {
            this.saveHistoryToActive();
            this.saveSettingsToActive();
        }

        // Switch to new molecule
        this.activeMoleculeIndex = index;
        const entry = this.molecules[index];

        // Update Editor's molecule reference
        this.editor.molecule = entry.molecule;

        // Load new molecule's state (history and settings)
        this.loadHistoryFromActive();
        this.loadSettingsFromActive();

        // Rebuild scene for the new molecule
        this.editor.rebuildScene();

        // Update UI
        this.updateUI();

        return { success: `Switched to "${entry.name}"` };
    }

    renameMolecule(index, newName) {
        if (index < 0 || index >= this.molecules.length) {
            return { error: `Invalid molecule index: ${index}` };
        }

        if (!newName) {
            return { error: "Name cannot be empty" };
        }

        const entry = this.molecules[index];
        const oldName = entry.name;
        entry.name = newName;

        this.updateUI();
        return { success: `Renamed "${oldName}" to "${newName}"` };
    }

    saveHistoryToActive() {
        if (this.activeMoleculeIndex === -1) return;

        const entry = this.molecules[this.activeMoleculeIndex];
        entry.history = [...this.editor.history];
        entry.historyIndex = this.editor.historyIndex;
    }

    loadHistoryFromActive() {
        if (this.activeMoleculeIndex === -1) return;

        const entry = this.molecules[this.activeMoleculeIndex];
        this.editor.history = [...entry.history];
        this.editor.historyIndex = entry.historyIndex;
    }

    saveSettingsToActive() {
        if (this.activeMoleculeIndex === -1) return;

        const entry = this.molecules[this.activeMoleculeIndex];
        entry.settings.labelMode = this.editor.labelMode;
        entry.settings.colorScheme = this.editor.colorScheme;
    }

    loadSettingsFromActive() {
        if (this.activeMoleculeIndex === -1) return;

        const entry = this.molecules[this.activeMoleculeIndex];
        this.editor.labelMode = entry.settings.labelMode;
        this.editor.colorScheme = entry.settings.colorScheme;

        // Apply settings
        this.editor.updateAllLabels();
    }

    copySelection() {
        const activeMol = this.getActive();
        if (!activeMol) return { error: 'No active molecule' };

        const selectedAtoms = activeMol.molecule.atoms.filter(a => a.selected);
        if (selectedAtoms.length === 0) {
            return { error: 'No atoms selected' };
        }

        // Store atom data
        this.clipboard.atoms = selectedAtoms.map(atom => ({
            element: atom.element,
            position: atom.position.clone()
        }));

        // Calculate center of mass
        this.clipboard.centerOfMass = GeometryEngine.getCenterOfMass(selectedAtoms);

        // Store bond data (only bonds between selected atoms)
        this.clipboard.bonds = [];
        activeMol.molecule.bonds.forEach(bond => {
            const idx1 = selectedAtoms.indexOf(bond.atom1);
            const idx2 = selectedAtoms.indexOf(bond.atom2);

            if (idx1 !== -1 && idx2 !== -1) {
                this.clipboard.bonds.push({
                    atom1Idx: idx1,
                    atom2Idx: idx2,
                    order: bond.order
                });
            }
        });

        return { success: `Copied ${selectedAtoms.length} atom(s) to clipboard` };
    }

    pasteClipboard(minDistance = 0) {
        if (this.clipboard.atoms.length === 0) {
            return { error: 'Clipboard is empty' };
        }

        const activeMol = this.getActive();
        if (!activeMol) return { error: 'No active molecule' };

        this.editor.saveState();

        // Calculate smart offset
        const currentAtoms = activeMol.molecule.atoms;
        const incomingAtoms = this.clipboard.atoms; // Simple objects with position
        const offset = GeometryEngine.calculateSmartOffset(incomingAtoms, currentAtoms, minDistance);

        // Create new atoms with offset
        const newAtoms = [];
        this.clipboard.atoms.forEach(atomData => {
            const pos = atomData.position.clone().add(offset);
            const atom = this.editor.addAtomToScene(atomData.element, pos);
            newAtoms.push(atom);
        });

        // Create bonds
        this.clipboard.bonds.forEach(bondData => {
            const atom1 = newAtoms[bondData.atom1Idx];
            const atom2 = newAtoms[bondData.atom2Idx];

            if (atom1 && atom2) {
                activeMol.molecule.addBond(atom1, atom2, bondData.order);
            }
        });

        this.editor.rebuildScene();

        return { success: `Pasted ${newAtoms.length} atom(s)` };
    }

    mergeMolecule(sourceIndex, minDistance = 0) {
        if (sourceIndex < 0 || sourceIndex >= this.molecules.length) {
            return { error: `Invalid molecule index: ${sourceIndex}` };
        }

        if (sourceIndex === this.activeMoleculeIndex) {
            return { error: 'Cannot merge molecule with itself' };
        }

        const sourceMol = this.molecules[sourceIndex];
        const targetMol = this.getActive();

        if (!targetMol) return { error: 'No active molecule' };

        this.editor.saveState();

        // Calculate offset to avoid overlap
        const currentAtoms = targetMol.molecule.atoms;
        const incomingAtoms = sourceMol.molecule.atoms; // Atom objects
        const offset = GeometryEngine.calculateSmartOffset(incomingAtoms, currentAtoms, minDistance);

        // Copy atoms from source to target
        const atomMap = new Map(); // Map source atoms to new atoms
        sourceMol.molecule.atoms.forEach(sourceAtom => {
            const pos = sourceAtom.position.clone().add(offset);
            const newAtom = this.editor.addAtomToScene(sourceAtom.element, pos);
            atomMap.set(sourceAtom, newAtom);
        });

        // Copy bonds
        sourceMol.molecule.bonds.forEach(bond => {
            const newAtom1 = atomMap.get(bond.atom1);
            const newAtom2 = atomMap.get(bond.atom2);

            if (newAtom1 && newAtom2) {
                targetMol.molecule.addBond(newAtom1, newAtom2, bond.order);
            }
        });

        this.editor.rebuildScene();

        // Remove source molecule
        const sourceAtomCount = sourceMol.molecule.atoms.length;
        this.removeMolecule(sourceIndex);

        return { success: `Merged ${sourceAtomCount} atoms from "${sourceMol.name}" into "${targetMol.name}"` };
    }

    getActive() {
        return this.molecules[this.activeMoleculeIndex];
    }

    getActiveIndex() {
        return this.activeMoleculeIndex;
    }

    updateUI() {
        const container = document.getElementById('molecule-list');
        if (!container) return;

        container.innerHTML = '';

        this.molecules.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = `molecule-item ${index === this.activeMoleculeIndex ? 'active' : ''}`;
            item.innerHTML = `
                <span class="molecule-name">${entry.name}</span>
                <span class="molecule-info">${entry.molecule.atoms.length} atoms</span>
            `;

            item.onclick = () => {
                this.switchMolecule(index);
            };

            container.appendChild(item);
        });
    }

    /**
     * Auto-generate bonds based on distance
     * @param {number} thresholdFactor - Factor to multiply covalent radii sum
     * @returns {number} Number of bonds added
     */
    autoBond(thresholdFactor = 1.1) {
        const activeMol = this.getActive();
        if (!activeMol) return 0;

        const atoms = activeMol.molecule.atoms;
        let bondsAdded = 0;

        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const dist = atoms[i].position.distanceTo(atoms[j].position);

                // Get covalent radii
                const r1 = this.getElementRadius(atoms[i].element);
                const r2 = this.getElementRadius(atoms[j].element);
                const bondThreshold = (r1 + r2) * thresholdFactor;

                if (dist < bondThreshold) {
                    // Check if bond already exists
                    if (!activeMol.molecule.getBond(atoms[i], atoms[j])) {
                        activeMol.molecule.addBond(atoms[i], atoms[j], 1);
                        bondsAdded++;
                    }
                }
            }
        }

        return bondsAdded;
    }

    /**
     * Remove specific atoms from the active molecule
     * @param {Object[]} atomsToRemove - Array of atom objects to remove
     * @returns {number} Number of atoms removed
     */
    removeAtoms(atomsToRemove) {
        const activeMol = this.getActive();
        if (!activeMol || !atomsToRemove || atomsToRemove.length === 0) return 0;

        let count = 0;
        atomsToRemove.forEach(atom => {
            if (activeMol.molecule.removeAtom(atom)) {
                count++;
            }
        });

        return count;
    }

    /**
     * Get element radius
     * @param {string} element - Element symbol
     * @returns {number} Radius
     */
    getElementRadius(element) {
        const data = ELEMENTS[element] || DEFAULT_ELEMENT;
        return data.radius;
    }
}
