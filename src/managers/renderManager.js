import * as THREE from 'three';
import { ELEMENTS } from '../constants.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Manages 3D rendering of atoms and bonds
 * Handles mesh creation, color management, and scene updates
 */
export class RenderManager {
    constructor(editor) {
        this.editor = editor;
        this.renderer = editor.renderer;
        this.state = editor.state;
    }

    /**
     * Create mesh for an atom
     * @param {Object} atom - Atom object
     * @returns {THREE.Mesh} Atom mesh
     */
    createAtomMesh(atom) {
        const element = ELEMENTS[atom.element] || ELEMENTS['C'];
        const radius = element.radius;
        const color = this.getElementColor(atom.element);

        const geometry = new THREE.SphereGeometry(radius * 0.4, 16, 16);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: atom.selected ? 0xffff00 : 0x000000,
            shininess: 30,
            transparent: atom.selected,
            opacity: atom.selected ? 0.6 : 1.0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(atom.position);
        mesh.userData = { type: 'atom', index: atom.index, atom: atom }; // Added atom reference to userData

        return mesh;
    }

    /**
     * Create mesh for a bond
     * @param {Object} bond - Bond object
     * @returns {THREE.Mesh} Bond mesh
     */
    createBondMesh(bond) {
        const atom1 = bond.atom1;
        const atom2 = bond.atom2;

        if (!atom1 || !atom2) return null;

        const pos1 = atom1.position;
        const pos2 = atom2.position;

        const direction = new THREE.Vector3().subVectors(pos2, pos1);
        const length = direction.length();
        const midpoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);

        const geometry = new THREE.CylinderGeometry(0.1, 0.1, length, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x888888,
            shininess: 30
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(midpoint);

        // Align cylinder with bond direction
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize()
        );

        mesh.userData = { type: 'bond', atom1: atom1, atom2: atom2 };

        return mesh;
    }

    /**
     * Get color for an element based on current scheme
     * @param {string} element - Element symbol
     * @returns {number} Color hex value
     */
    getElementColor(element) {
        const scheme = this.state.ui.colorScheme;
        const elementData = ELEMENTS[element] || ELEMENTS['C'];

        return scheme === 'jmol' ? elementData.jmol : elementData.cpk;
    }

    /**
     * Get radius for an element
     * @param {string} element - Element symbol
     * @returns {number} Radius in Angstroms
     */
    getElementRadius(element) {
        const elementData = ELEMENTS[element] || ELEMENTS['C'];
        return elementData.radius;
    }

    /**
     * Update colors for all atoms based on current color scheme
     */
    updateAtomColors() {
        this.editor.molecule.atoms.forEach(atom => {
            if (atom.mesh) {
                const color = this.getElementColor(atom.element);
                atom.mesh.material.color.setHex(color);
            }
        });
    }

    /**
     * Update bond meshes
     */
    updateBondMeshes() {
        // Remove existing bond meshes
        this.renderer.scene.children
            .filter(obj => obj.userData && obj.userData.type === 'bond')
            .forEach(bond => this.renderer.scene.remove(bond));

        // Create new bond meshes
        this.editor.molecule.bonds.forEach(bond => {
            const mesh = this.createBondMesh(bond);
            if (mesh) {
                this.renderer.scene.add(mesh);
                bond.mesh = mesh;
            }
        });
    }

    /**
     * Rebuild entire scene from scratch
     */
    rebuildScene() {
        // Clear existing objects
        const toRemove = [];
        this.renderer.scene.traverse(obj => {
            if (obj.userData && (obj.userData.type === 'atom' || obj.userData.type === 'bond')) {
                toRemove.push(obj);
            }
        });
        toRemove.forEach(obj => this.renderer.scene.remove(obj));

        // Recreate atoms
        this.editor.molecule.atoms.forEach(atom => {
            const mesh = this.createAtomMesh(atom);
            this.renderer.scene.add(mesh);
            atom.mesh = mesh;

            // Recreate label if needed
            if (atom.label) {
                atom.label.remove();
            }
            const label = this.editor.uiManager.createAtomLabel(atom);
            this.editor.labelContainer.appendChild(label);
            atom.label = label;
        });

        // Recreate bonds
        this.updateBondMeshes();

        // Update labels
        this.editor.uiManager.updateAllLabels();
    }

    /**
     * Update single atom's visuals
     * @param {Object} atom - Atom to update
     */
    updateAtomVisuals(atom) {
        if (!atom.mesh) return;

        // Update position
        atom.mesh.position.copy(atom.position);

        // Update color
        const color = this.getElementColor(atom.element);
        atom.mesh.material.color.setHex(color);

        // Update selection highlight
        const material = atom.mesh.material;
        if (atom.selected) {
            material.emissive.setHex(0xffff00);
            material.transparent = true;
            material.opacity = 0.6;
        } else {
            material.emissive.setHex(0x000000);
            material.transparent = false;
            material.opacity = 1.0;
        }
    }

    /**
     * Update bond visuals
     */
    updateBondVisuals() {
        this.editor.molecule.bonds.forEach(bond => {
            if (!bond.mesh) return;

            const atom1 = bond.atom1;
            const atom2 = bond.atom2;

            if (!atom1 || !atom2) return;

            const pos1 = atom1.position;
            const pos2 = atom2.position;
            const direction = new THREE.Vector3().subVectors(pos2, pos1);
            const length = direction.length();
            const midpoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);

            bond.mesh.position.copy(midpoint);
            bond.mesh.scale.y = length / bond.mesh.geometry.parameters.height;
            bond.mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction.normalize()
            );

            // Update selection highlight
            const bothSelected = atom1.selected && atom2.selected;
            const material = bond.mesh.material;

            if (bothSelected) {
                material.color.setHex(0xffff00); // Yellow highlight
                material.emissive.setHex(0x222200);
            } else {
                material.color.setHex(0x000000); // Black (default)
                material.emissive.setHex(0x000000);
            }
        });
    }
}
