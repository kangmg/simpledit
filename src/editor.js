import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { Molecule } from './molecule.js';
import { Interaction } from './interaction.js';
import { ELEMENTS, DEFAULT_ELEMENT } from './constants.js';

export class Editor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.renderer = new Renderer(this.canvas);
        this.molecule = new Molecule();
        this.interaction = new Interaction(this.renderer, this.canvas);

        this.mode = 'select';
        this.selectedElement = 'C';
        this.colorScheme = 'jmol'; // Default to Jmol colors
        this.manipulationMode = 'translate'; // For move mode: translate or rotate
        // this.selectedBondOrder = 1; // Removed

        // Track selection order for geometry adjustments
        this.selectionOrder = [];

        // Undo/Redo History
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        this.ghostBond = null;
        this.dragStartAtom = null;

        this.selectionBox = null;
        this.selectionStart = null;

        this.isManipulating = false;
        this.initialPositions = null;

        this.bindEvents();
        this.setupInteraction();

        // Render loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    init() {
        console.log('Editor initialized');
        // Add a test atom to verify rendering
        // this.addAtomToScene('C', new THREE.Vector3(0, 0, 0));
    }

    bindEvents() {
        // Toolbar buttons
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-redo').onclick = () => this.redo();

        document.getElementById('btn-add-atom').onclick = () => this.setMode('add-atom');
        document.getElementById('btn-bond').onclick = () => this.setMode('bond');
        document.getElementById('btn-select').onclick = () => this.setMode('select');
        document.getElementById('btn-move').onclick = () => this.setMode('move');

        // Camera Mode
        document.getElementById('camera-mode').onchange = (e) => {
            this.renderer.setCameraMode(e.target.value);
        };

        // Color Scheme
        document.getElementById('color-scheme').onchange = (e) => {
            this.colorScheme = e.target.value;
            this.updateAtomColors();
            if (document.getElementById('pt-modal').style.display === 'block') {
                this.renderPeriodicTable();
            }
        };

        // Projection Mode
        document.getElementById('projection-mode').onchange = (e) => {
            this.renderer.setProjection(e.target.value);
        };

        // Properties
        // document.getElementById('atom-element').onchange = (e) => this.selectedElement = e.target.value; // Replaced by button
        const btnElement = document.getElementById('btn-element-select');
        const ptModal = document.getElementById('pt-modal');
        const closePt = document.getElementsByClassName('close-pt')[0];

        btnElement.onclick = () => {
            this.renderPeriodicTable();
            ptModal.style.display = 'block';
        };
        closePt.onclick = () => ptModal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target === ptModal) ptModal.style.display = 'none';
            if (event.target === document.getElementById('xyz-modal')) document.getElementById('xyz-modal').style.display = 'none';
        };

        // Bond Threshold
        document.getElementById('bond-threshold').oninput = (e) => {
            document.getElementById('val-bond-threshold').innerText = e.target.value;
        };
        document.getElementById('bond-threshold').onchange = () => {
            // Optional: Auto-recalculate bonds on change?
            // Or just let user click "Auto Bond"?
            // User asked to "adjust threshold", implying dynamic update or setting it for future.
            // Let's just update the value. The autoBond function reads it.
            // But maybe we should trigger autoBond if the user wants to see effect immediately?
            // Let's add a button for Auto Bond explicitly in HTML (I added it in previous step).
            // And bind it here.
        };

        document.getElementById('btn-auto-bond').onclick = () => {
            this.saveState();
            this.molecule.bonds = []; // Clear bonds to re-calculate?
            this.rebuildScene(); // This calls autoBond which adds them back
            // Wait, rebuildScene calls autoBond.
            // So we just need to clear bonds and rebuild.
        };

        // Copy/Paste
        document.getElementById('btn-copy').onclick = () => this.copyXYZ();
        document.getElementById('btn-paste').onclick = () => this.pasteXYZ();

        // Geometry
        // Geometry Sliders
        document.getElementById('input-length').oninput = () => {
            this.updateSliderLabel('val-length', document.getElementById('input-length').value);
            this.setBondLength();
        };
        document.getElementById('input-length').onchange = () => this.saveState(); // Save on release

        document.getElementById('input-angle').oninput = () => {
            this.updateSliderLabel('val-angle', document.getElementById('input-angle').value);
            this.setBondAngle();
        };
        document.getElementById('input-angle').onchange = () => this.saveState();

        document.getElementById('input-dihedral').oninput = () => {
            this.updateSliderLabel('val-dihedral', document.getElementById('input-dihedral').value);
            this.setDihedralAngle();
        };
        document.getElementById('input-dihedral').onchange = () => this.saveState();

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Ignore shortcuts if modal is open or typing in input
            if (document.getElementById('xyz-modal').style.display === 'block') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }

            // Only handle these keys if not in modal
            if (document.getElementById('xyz-modal').style.display === 'block') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key.toLowerCase() === 't') {
                this.setMode('move');
                this.manipulationMode = 'translate';
                this.updateManipulationStatus();
            } else if (e.key.toLowerCase() === 'r') {
                this.setMode('move');
                this.manipulationMode = 'rotate';
                this.updateManipulationStatus();
            } else if (e.key.toLowerCase() === 'o') {
                this.setMode('move');
                this.manipulationMode = 'orbit';
                this.updateManipulationStatus();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelected();
            }
            if (e.key === 'Escape') {
                this.setMode('select');
                this.clearSelection();
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const btnMap = {
            'add-atom': 'btn-add-atom',
            'bond': 'btn-bond',
            'select': 'btn-select',
            'move': 'btn-move'
        };
        document.getElementById(btnMap[mode]).classList.add('active');

        if (mode === 'move') {
            if (!this.manipulationMode) this.manipulationMode = 'translate';
            this.updateManipulationStatus();
        } else {
            this.clearManipulationStatus();
        }
    }

    updateManipulationStatus() {
        const btn = document.getElementById('btn-move');
        if (this.manipulationMode === 'translate') {
            btn.innerText = 'Move: Translate';
            btn.style.backgroundColor = '#4a90e2';
        } else if (this.manipulationMode === 'rotate') {
            btn.innerText = 'Move: Trackball Rotate';
            btn.style.backgroundColor = '#e24a90';
        } else if (this.manipulationMode === 'orbit') {
            btn.innerText = 'Move: Orbit Rotate';
            btn.style.backgroundColor = '#90e24a';
        }
    }

    clearManipulationStatus() {
        const btn = document.getElementById('btn-move');
        btn.innerText = 'Move/Rotate';
        btn.style.backgroundColor = '';
    }



    setupInteraction() {
        this.interaction.callbacks.onClick = (e, raycaster) => this.handleClick(e, raycaster);
        this.interaction.callbacks.onRightClick = (e, raycaster) => this.handleRightClick(e, raycaster);
        this.interaction.callbacks.onDragStart = (e, raycaster) => this.handleDragStart(e, raycaster);
        this.interaction.callbacks.onDrag = (e, raycaster) => this.handleDrag(e, raycaster);
        this.interaction.callbacks.onDragEnd = (e, raycaster) => this.handleDragEnd(e, raycaster);
    }

    cleanupDrag() {
        this.renderer.controls.enabled = true;

        if (this.ghostBond) {
            this.renderer.scene.remove(this.ghostBond);
            this.ghostBond = null;
        }
        this.dragStartAtom = null;

        this.removeSelectionBox();
        this.selectionStart = null;

        this.isManipulating = false;
        this.initialPositions = null;
    }

    handleClick(event, raycaster) {
        this.cleanupDrag(); // Ensure any drag state is cleared (e.g. selection box from mousedown)

        // Also clear manipulation state from move mode
        if (this.initialPositions) {
            this.initialPositions = null;
            this.isManipulating = false;
            this.manipulationStartMouse = null;
            this.renderer.controls.enabled = true;
        }

        if (this.mode === 'add-atom') {
            // Create a plane perpendicular to the camera, passing through the origin (or a specific depth)
            // This ensures we can always draw, regardless of camera rotation.
            const normal = new THREE.Vector3();
            const camera = this.renderer.activeCamera || this.renderer.camera;
            camera.getWorldDirection(normal);

            // Plane normal should be parallel to camera direction.
            // We want the plane to pass through (0,0,0).
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, 0));

            const target = new THREE.Vector3();
            const intersection = raycaster.ray.intersectPlane(plane, target);

            console.log('Atom Placement:', {
                intersection: intersection,
                target: target,
                x: target.x,
                y: target.y,
                z: target.z
            });

            if (intersection) {
                this.addAtomToScene(this.selectedElement, target);
            }
        } else if (this.mode === 'select') {
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom');

            if (atomMesh) {
                const atom = atomMesh.object.userData.atom;
                this.toggleSelection(atom, event.ctrlKey || event.metaKey || event.shiftKey);
            } else {
                if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
                    this.clearSelection();
                }
            }
        }
    }

    toggleSelection(atom, multiSelect) {
        if (!multiSelect) {
            this.clearSelection();
        }

        atom.selected = !atom.selected;

        // Update selection order
        if (atom.selected) {
            // Add to selection order if not already there
            if (!this.selectionOrder.includes(atom)) {
                this.selectionOrder.push(atom);
            }
        } else {
            // Remove from selection order
            const idx = this.selectionOrder.indexOf(atom);
            if (idx !== -1) {
                this.selectionOrder.splice(idx, 1);
            }
        }

        this.updateAtomVisuals(atom);
        this.updateSelectionInfo();
    }

    clearSelection() {
        this.molecule.atoms.forEach(a => {
            a.selected = false;
            this.updateAtomVisuals(a);
        });
        this.selectionOrder = [];
        this.updateSelectionInfo();
    }

    updateAtomVisuals(atom) {
        if (atom.mesh) {
            const material = atom.mesh.material;
            if (atom.selected) {
                material.color.setHex(0xffff00); // Yellow
                material.emissive.setHex(0x222200);
                material.transparent = true;
                material.opacity = 0.6;
            } else {
                material.color.setHex(this.getElementColor(atom.element));
                material.emissive.setHex(0x000000);
                material.transparent = false;
                material.opacity = 1.0;
            }
        }
    }

    updateSliderLabel(id, value) {
        document.getElementById(id).innerText = value;
    }

    updateSelectionInfo() {
        const count = this.selectionOrder.length;
        document.getElementById('selection-info').innerText = `${count} atoms selected`;

        const geoControls = document.getElementById('geometry-controls');
        const lengthControl = document.getElementById('length-control');
        const angleControl = document.getElementById('angle-control');
        const dihedralControl = document.getElementById('dihedral-control');

        geoControls.style.display = count >= 2 ? 'block' : 'none';
        lengthControl.style.display = count === 2 ? 'block' : 'none';
        angleControl.style.display = count === 3 ? 'block' : 'none';
        dihedralControl.style.display = count === 4 ? 'block' : 'none';

        if (count === 2) {
            const dist = this.selectionOrder[0].position.distanceTo(this.selectionOrder[1].position);
            const val = dist.toFixed(3);
            document.getElementById('input-length').value = val;
            this.updateSliderLabel('val-length', val);
        } else if (count === 3) {
            const v1 = this.selectionOrder[0].position.clone().sub(this.selectionOrder[1].position);
            const v2 = this.selectionOrder[2].position.clone().sub(this.selectionOrder[1].position);
            const angle = v1.angleTo(v2) * (180 / Math.PI);
            const val = angle.toFixed(1);
            document.getElementById('input-angle').value = val;
            this.updateSliderLabel('val-angle', val);
        } else if (count === 4) {
            // Calculate current dihedral
            const a1 = this.selectionOrder[0];
            const a2 = this.selectionOrder[1];
            const a3 = this.selectionOrder[2];
            const a4 = this.selectionOrder[3];

            const axis = a3.position.clone().sub(a2.position).normalize();
            const v1 = a1.position.clone().sub(a2.position);
            const v2 = a4.position.clone().sub(a3.position);
            const p1 = v1.clone().sub(axis.clone().multiplyScalar(v1.dot(axis)));
            const p2 = v2.clone().sub(axis.clone().multiplyScalar(v2.dot(axis)));

            // Signed angle calculation
            const angleRad = Math.atan2(
                p1.clone().cross(p2).dot(axis),
                p1.dot(p2)
            );
            const angleDeg = angleRad * (180 / Math.PI);

            const val = angleDeg.toFixed(1);
            document.getElementById('input-dihedral').value = val;
            this.updateSliderLabel('val-dihedral', val);
        }
    }

    // Helper function to find all atoms connected to startAtom, excluding excludeBond
    getConnectedAtoms(startAtom, excludeBond = null) {
        const connected = new Set();
        const visited = new Set();
        const queue = [startAtom];

        // Temporarily remove the bond from both atoms' bond lists
        let removedFromAtom1 = false;
        let removedFromAtom2 = false;

        if (excludeBond) {
            const idx1 = excludeBond.atom1.bonds.indexOf(excludeBond);
            if (idx1 !== -1) {
                excludeBond.atom1.bonds.splice(idx1, 1);
                removedFromAtom1 = true;
            }

            const idx2 = excludeBond.atom2.bonds.indexOf(excludeBond);
            if (idx2 !== -1) {
                excludeBond.atom2.bonds.splice(idx2, 1);
                removedFromAtom2 = true;
            }
        }

        // BFS to find connected atoms
        while (queue.length > 0) {
            const atom = queue.shift();
            if (visited.has(atom)) continue;
            visited.add(atom);
            connected.add(atom);

            // Get all bonds for this atom
            atom.bonds.forEach(bond => {
                const otherAtom = bond.atom1 === atom ? bond.atom2 : bond.atom1;
                if (!visited.has(otherAtom)) {
                    queue.push(otherAtom);
                }
            });
        }

        // Restore the bond to both atoms' bond lists
        if (excludeBond) {
            if (removedFromAtom1) {
                excludeBond.atom1.bonds.push(excludeBond);
            }
            if (removedFromAtom2) {
                excludeBond.atom2.bonds.push(excludeBond);
            }
        }

        return connected;
    }

    setBondLength() {
        if (this.selectionOrder.length !== 2) return;

        const targetDist = parseFloat(document.getElementById('input-length').value);
        if (isNaN(targetDist)) return;

        // First selected atom is fixed, second atom's fragment moves
        const a1 = this.selectionOrder[0]; // Fixed
        const a2 = this.selectionOrder[1]; // Moving side

        // Find the bond between a1 and a2
        const bond = this.molecule.getBond(a1, a2);

        if (!bond) {
            console.error('No bond found between selected atoms');
            return;
        }

        // Get all atoms connected to a2 (excluding the a1-a2 bond)
        const fragmentToMove = this.getConnectedAtoms(a2, bond);

        console.log('Total atoms:', this.molecule.atoms.length);
        console.log('Fragment to move size:', fragmentToMove.size);
        console.log('a1 (fixed):', a1.element, 'a2 (moving):', a2.element);

        const dir = a2.position.clone().sub(a1.position).normalize();
        const oldA2Pos = a2.position.clone();
        const newA2Pos = a1.position.clone().add(dir.multiplyScalar(targetDist));
        const displacement = newA2Pos.clone().sub(oldA2Pos);

        // Move a2's fragment
        fragmentToMove.forEach(atom => {
            atom.position.add(displacement);
            if (atom.mesh) {
                atom.mesh.position.copy(atom.position);
                if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
            }
        });

        this.updateBonds();
    }

    setBondAngle() {
        if (this.selectionOrder.length !== 3) return;

        const targetAngle = parseFloat(document.getElementById('input-angle').value) * (Math.PI / 180);
        if (isNaN(targetAngle)) return;

        // a-b is fixed, c's fragment rotates around b
        const a1 = this.selectionOrder[0]; // Fixed side
        const a2 = this.selectionOrder[1]; // Vertex (pivot)
        const a3 = this.selectionOrder[2]; // Moving side

        // Find the bond between a2 and a3
        const bond23 = this.molecule.getBond(a2, a3);

        // Get all atoms connected to a3 (excluding the a2-a3 bond)
        const fragmentToRotate = this.getConnectedAtoms(a3, bond23);

        const v1 = a1.position.clone().sub(a2.position); // Vector from pivot to fixed atom
        const v2 = a3.position.clone().sub(a2.position); // Vector from pivot to moving atom
        const currentAngle = v1.angleTo(v2);

        const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();
        const diff = targetAngle - currentAngle;

        const rot = new THREE.Quaternion().setFromAxisAngle(axis, diff);

        // Rotate a3's fragment around a2
        fragmentToRotate.forEach(atom => {
            const relative = atom.position.clone().sub(a2.position);
            relative.applyQuaternion(rot);
            atom.position.copy(a2.position).add(relative);
            if (atom.mesh) {
                atom.mesh.position.copy(atom.position);
                if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
            }
        });

        this.updateBonds();
    }

    setDihedralAngle() {
        if (this.selectionOrder.length !== 4) return;

        const targetAngle = parseFloat(document.getElementById('input-dihedral').value) * (Math.PI / 180);
        if (isNaN(targetAngle)) return;

        // b-c is the axis, d's fragment rotates
        const a1 = this.selectionOrder[0]; // a
        const a2 = this.selectionOrder[1]; // b (axis start)
        const a3 = this.selectionOrder[2]; // c (axis end)
        const a4 = this.selectionOrder[3]; // d (moving side)

        // Find the bond between c and d
        const bond34 = this.molecule.getBond(a3, a4);

        // Get all atoms connected to d (excluding the c-d bond)  
        const fragmentToRotate = this.getConnectedAtoms(a4, bond34);

        const axis = a3.position.clone().sub(a2.position).normalize();
        const v1 = a1.position.clone().sub(a2.position);
        const v2 = a4.position.clone().sub(a3.position);

        const p1 = v1.clone().sub(axis.clone().multiplyScalar(v1.dot(axis)));
        const p2 = v2.clone().sub(axis.clone().multiplyScalar(v2.dot(axis)));

        // Current dihedral angle
        const currentAngle = Math.atan2(
            p1.clone().cross(p2).dot(axis),
            p1.dot(p2)
        );

        const diff = targetAngle - currentAngle;
        const rot = new THREE.Quaternion().setFromAxisAngle(axis, diff);

        // Rotate d's fragment around b-c axis (pivot at c)
        fragmentToRotate.forEach(atom => {
            const relative = atom.position.clone().sub(a3.position);
            relative.applyQuaternion(rot);
            atom.position.copy(a3.position).add(relative);
            if (atom.mesh) {
                atom.mesh.position.copy(atom.position);
                if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
            }
        });

        this.updateBonds();
    }

    handleRightClick(event, raycaster) {
        // TODO: Implement atom type cycling or context menu
    }

    getTrackballVector(x, y) {
        const p = new THREE.Vector3(
            (x / window.innerWidth) * 2 - 1,
            -(y / window.innerHeight) * 2 + 1,
            0
        );
        if (p.lengthSq() > 1) {
            p.normalize();
        } else {
            p.z = Math.sqrt(1 - p.lengthSq());
        }
        return p;
    }

    handleDragStart(event, raycaster) {
        // By default, allow controls (rotation)
        this.renderer.controls.enabled = true;

        if (this.mode === 'bond') {
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom');

            if (atomMesh) {
                this.dragStartAtom = atomMesh.object.userData.atom;
                this.ghostBond = this.createGhostBond(this.dragStartAtom.position);
                this.renderer.controls.enabled = false; // Disable rotation while dragging bond
            }
        } else if (this.mode === 'select') {
            // If clicking on an atom, maybe toggle selection? (Handled in Click)
            // If dragging empty space, Lasso.
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom');

            if (!atomMesh) {
                // Lasso
                this.selectionStart = new THREE.Vector2(event.clientX, event.clientY);
                this.createSelectionBox();
                this.renderer.controls.enabled = false; // Disable rotation while lassoing
            }
        } else if (this.mode === 'move') {
            const selectedAtoms = this.molecule.atoms.filter(a => a.selected);
            console.log('Move start. Selected:', selectedAtoms.length);

            // Check if we clicked ON a selected atom to start move?
            // Or if we just drag anywhere?
            // Usually move tool works by dragging anywhere if items are selected.
            // But if we want "empty space -> rotate", then we must click ON an atom to move.

            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom');

            // If we clicked an atom that is selected, OR if we have atoms selected and the tool implies moving them...
            // User requirement: "Default or empty space drag -> total rotation".
            // This implies moving fragments requires clicking ON them or using a specific handle?
            // Or maybe "Move" mode overrides rotation?
            // Let's assume: In Move mode, if you click ON an atom (or close to one), you move. If you click empty space, you rotate.

            if (selectedAtoms.length > 0 && atomMesh && atomMesh.object.userData.atom.selected) {
                this.saveState(); // Save before moving/rotating
                // Don't set isManipulating yet - wait for actual drag movement
                this.manipulationStartMouse = new THREE.Vector2(event.clientX, event.clientY);

                // Trackball start vector
                this.trackballStart = this.getTrackballVector(event.clientX, event.clientY);

                // Calculate centroid
                this.centroid = new THREE.Vector3();
                selectedAtoms.forEach(a => this.centroid.add(a.position));
                this.centroid.divideScalar(selectedAtoms.length);

                // Store initial positions relative to centroid
                this.initialPositions = new Map();
                selectedAtoms.forEach(a => {
                    this.initialPositions.set(a, a.position.clone());
                });
                this.renderer.controls.enabled = false; // Disable rotation while moving atoms
            }
        }
    }

    handleDrag(event, raycaster) {
        if (this.mode === 'bond' && this.ghostBond) {
            // Update ghost bond end
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const target = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, target);

            // Check for snap to atom
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom' && i.object.userData.atom !== this.dragStartAtom);

            const endPos = atomMesh ? atomMesh.object.position : target;
            this.updateGhostBond(endPos);
        } else if (this.mode === 'select' && this.selectionStart) {
            this.updateSelectionBox(event.clientX, event.clientY);
        } else if (this.mode === 'move' && this.initialPositions) {
            // Check if we've moved enough to start manipulation
            if (!this.isManipulating && this.manipulationStartMouse) {
                const dx = event.clientX - this.manipulationStartMouse.x;
                const dy = event.clientY - this.manipulationStartMouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Only start manipulating after 3 pixels of movement
                if (dist > 3) {
                    this.isManipulating = true;
                } else {
                    return; // Don't manipulate yet
                }
            }

            if (!this.isManipulating) return;

            const selectedAtoms = this.molecule.atoms.filter(a => a.selected);

            // Only manipulate if we actually started manipulation in handleDragStart
            if (!this.initialPositions || selectedAtoms.length === 0) return;

            if (this.manipulationMode === 'rotate' || event.altKey) {
                // Trackball Rotation
                const currentTrackball = this.getTrackballVector(event.clientX, event.clientY);
                const startTrackball = this.trackballStart;

                const axisView = new THREE.Vector3().crossVectors(startTrackball, currentTrackball).normalize();
                const angle = startTrackball.angleTo(currentTrackball);

                if (angle > 0.001) {
                    const axisWorld = axisView.clone().transformDirection(this.renderer.activeCamera.matrixWorld);
                    const quaternion = new THREE.Quaternion().setFromAxisAngle(axisWorld, angle * 2);

                    selectedAtoms.forEach(atom => {
                        const initialPos = this.initialPositions.get(atom);
                        const relative = initialPos.clone().sub(this.centroid);
                        relative.applyQuaternion(quaternion);
                        atom.position.copy(this.centroid).add(relative);
                        if (atom.mesh) {
                            atom.mesh.position.copy(atom.position);
                            if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
                        }
                    });
                }
            } else if (this.manipulationMode === 'orbit') {
                // Orbit Rotation - rotate around camera view direction
                const dx = event.clientX - this.manipulationStartMouse.x;
                const dy = event.clientY - this.manipulationStartMouse.y;

                // Get camera direction (Z axis in camera space)
                const camera = this.renderer.activeCamera;
                const cameraDir = new THREE.Vector3();
                camera.getWorldDirection(cameraDir);

                // Rotation angle based on mouse movement
                const angle = (dx + dy) * 0.01; // Adjust sensitivity

                // Rotate around camera direction axis
                const quaternion = new THREE.Quaternion().setFromAxisAngle(cameraDir, angle);

                selectedAtoms.forEach(atom => {
                    const initialPos = this.initialPositions.get(atom);
                    const relative = initialPos.clone().sub(this.centroid);
                    relative.applyQuaternion(quaternion);
                    atom.position.copy(this.centroid).add(relative);
                    if (atom.mesh) {
                        atom.mesh.position.copy(atom.position);
                        if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
                    }
                });
            } else {
                // Camera-Aligned Translation
                const dx = event.clientX - this.manipulationStartMouse.x;
                const dy = event.clientY - this.manipulationStartMouse.y;

                // Get Camera Basis Vectors
                const camera = this.renderer.activeCamera;
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

                // Scale factor (approximate based on distance)
                const dist = camera.position.distanceTo(this.centroid);
                // FOV scaling: tan(fov/2) * 2 * dist / height
                const vFov = camera.fov * Math.PI / 180;
                const scale = (2 * Math.tan(vFov / 2) * dist) / window.innerHeight;

                const delta = right.multiplyScalar(dx * scale).add(up.multiplyScalar(-dy * scale));

                selectedAtoms.forEach(atom => {
                    const initialPos = this.initialPositions.get(atom);
                    atom.position.copy(initialPos).add(delta);
                    if (atom.mesh) {
                        atom.mesh.position.copy(atom.position);
                        if (atom.outlineMesh) atom.outlineMesh.position.copy(atom.position);
                    }
                });
            }

            this.updateBonds();
        }
    }

    handleDragEnd(event, raycaster) {
        this.renderer.controls.enabled = true; // Always re-enable controls on drag end

        if (this.mode === 'bond' && this.ghostBond) {
            this.renderer.scene.remove(this.ghostBond);
            this.ghostBond = null;

            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom' && i.object.userData.atom !== this.dragStartAtom);

            if (atomMesh) {
                const endAtom = atomMesh.object.userData.atom;

                // Check if bond already exists
                const existingBond = this.molecule.getBond(this.dragStartAtom, endAtom);

                if (existingBond) {
                    // Remove existing bond
                    this.removeBond(existingBond);
                } else {
                    // Add new bond
                    this.addBondToScene(this.dragStartAtom, endAtom);
                }
            }
            this.dragStartAtom = null;
        } else if (this.mode === 'select' && this.selectionStart) {
            this.performBoxSelection(event.clientX, event.clientY, event.shiftKey || event.ctrlKey || event.metaKey);
            this.removeSelectionBox();
            this.selectionStart = null;
        } else if (this.mode === 'move') {
            this.isManipulating = false;
            this.initialPositions = null;
            this.manipulationStartMouse = null;
            this.renderer.controls.enabled = true;
        }
    }

    updateBonds() {
        this.molecule.bonds.forEach(bond => {
            if (bond.mesh) {
                const start = bond.atom1.position;
                const end = bond.atom2.position;
                const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                bond.mesh.position.copy(mid);

                // Align cylinder Y-axis to the bond direction
                const axis = new THREE.Vector3().subVectors(end, start).normalize();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
                bond.mesh.setRotationFromQuaternion(quaternion);

                const dist = start.distanceTo(end);
                bond.mesh.scale.set(1, dist, 1); // Scale Y (height) to distance
            }
        });
    }

    createSelectionBox() {
        const div = document.createElement('div');
        div.id = 'selection-box';
        div.style.position = 'absolute';
        div.style.border = '1px dashed #fff';
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        div.style.pointerEvents = 'none';
        document.body.appendChild(div);
        this.selectionBox = div;
    }

    updateSelectionBox(x, y) {
        const startX = this.selectionStart.x;
        const startY = this.selectionStart.y;

        const minX = Math.min(startX, x);
        const maxX = Math.max(startX, x);
        const minY = Math.min(startY, y);
        const maxY = Math.max(startY, y);

        this.selectionBox.style.left = minX + 'px';
        this.selectionBox.style.top = minY + 'px';
        this.selectionBox.style.width = (maxX - minX) + 'px';
        this.selectionBox.style.height = (maxY - minY) + 'px';
    }

    removeSelectionBox() {
        if (this.selectionBox) {
            document.body.removeChild(this.selectionBox);
            this.selectionBox = null;
        }
    }

    performBoxSelection(endX, endY, add) {
        // Convert screen coords to frustum check or project atoms to screen
        const startX = this.selectionStart.x;
        const startY = this.selectionStart.y;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        if (!add) this.clearSelection();

        const camera = this.renderer.activeCamera || this.renderer.camera;

        this.molecule.atoms.forEach(atom => {
            if (!atom.mesh) return;

            // Project atom position to screen
            const pos = atom.mesh.position.clone();
            pos.project(camera);

            const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
                atom.selected = true;
                // Add to selection order if not already there
                if (!this.selectionOrder.includes(atom)) {
                    this.selectionOrder.push(atom);
                }
                this.updateAtomVisuals(atom);
            }
        });
        this.updateSelectionInfo();
    }

    createGhostBond(startPos) {
        const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(startPos);
        this.renderer.scene.add(mesh);
        return mesh;
    }

    updateGhostBond(endPos) {
        if (!this.ghostBond || !this.dragStartAtom) return;

        const start = this.dragStartAtom.position;
        const dist = start.distanceTo(endPos);

        this.ghostBond.scale.set(1, dist, 1); // Scale Y to match distance (default height is 1)

        const mid = new THREE.Vector3().addVectors(start, endPos).multiplyScalar(0.5);
        this.ghostBond.position.copy(mid);
        this.ghostBond.lookAt(endPos);
        this.ghostBond.rotateX(Math.PI / 2);
    }

    addAtomToScene(element, position, existingAtom = null) {
        if (!existingAtom) this.saveState(); // Save before adding new atom

        const atom = existingAtom || this.molecule.addAtom(element, position);
        this.createAtomMesh(atom);
        return atom;
    }

    removeBond(bond) {
        this.saveState(); // Save before removing bond

        // Remove from scene
        if (bond.mesh) {
            this.renderer.scene.remove(bond.mesh);
        }

        // Remove from molecule
        this.molecule.removeBond(bond);
    }

    addBondToScene(atom1, atom2, save = true) {
        if (this.molecule.getBond(atom1, atom2)) return; // Already exists

        if (save) this.saveState(); // Save before adding
        const bond = this.molecule.addBond(atom1, atom2, 1); // Default single bond
        this.createBondMesh(bond);
    }

    saveState() {
        // Remove any future history if we are in the middle
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const state = this.molecule.toXYZ(); // Use XYZ as state snapshot for simplicity
        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        console.log('State saved. History size:', this.history.length, 'Index:', this.historyIndex);
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
        }
    }

    deleteSelected() {
        const selected = this.molecule.atoms.filter(a => a.selected);
        if (selected.length === 0) return;

        this.saveState(); // Save before deleting
        selected.forEach(atom => {
            this.molecule.removeAtom(atom);
            if (atom.mesh) this.renderer.scene.remove(atom.mesh);
        });
        // Also remove bonds
        this.rebuildScene(); // Simplest way to clean up bonds
    }

    restoreState(xyz) {
        this.molecule.fromXYZ(xyz);
        this.rebuildScene();
    }

    // Old getElementColor removed
    // getElementColor(element) { ... }

    copyXYZ() {
        const xyz = this.molecule.toXYZ();
        navigator.clipboard.writeText(xyz).then(() => {
            console.log('XYZ copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy XYZ:', err);
        });
    }

    pasteXYZ() {
        // Show modal instead of direct clipboard read
        const modal = document.getElementById('xyz-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const input = document.getElementById('xyz-input');
        const btnImport = document.getElementById('btn-xyz-import');
        const btnCancel = document.getElementById('btn-xyz-cancel');

        modal.style.display = 'block';
        backdrop.style.display = 'block';
        input.value = '';
        input.focus();

        // Disable editor interactions
        this.renderer.controls.enabled = false;

        // Temporary event handlers
        const close = () => {
            modal.style.display = 'none';
            backdrop.style.display = 'none';
            this.renderer.controls.enabled = true;
            btnImport.onclick = null;
            btnCancel.onclick = null;
        };

        btnCancel.onclick = close;

        btnImport.onclick = () => {
            const text = input.value;
            if (text) {
                this.saveState(); // Save before importing
                this.molecule.fromXYZ(text);
                this.rebuildScene();
            }
            close();
        };
    }

    rebuildScene() {
        // Clear existing meshes
        // Note: In a real app, we should track meshes better to dispose geometries/materials
        for (let i = this.renderer.scene.children.length - 1; i >= 0; i--) {
            const child = this.renderer.scene.children[i];
            if (child.type === 'Mesh' || child.type === 'LineSegments') {
                this.renderer.scene.remove(child);
            }
        }

        // Re-add atoms
        for (const atom of this.molecule.atoms) {
            this.addAtomToScene(atom.element, atom.position, atom);
        }

        // Clear all bond data before auto-bonding
        this.molecule.bonds = [];
        this.molecule.atoms.forEach(atom => {
            atom.bonds = [];
        });

        // Re-add bonds (if any were parsed, though standard XYZ doesn't have bonds)
        // We might need to auto-generate bonds based on distance here
        this.autoBond();
    }

    autoBond() {
        // Bonding based on covalent radii sum * threshold factor
        const thresholdFactor = parseFloat(document.getElementById('bond-threshold').value);
        const atoms = this.molecule.atoms;

        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const dist = atoms[i].position.distanceTo(atoms[j].position);

                // Get covalent radii for both atoms
                const r1 = this.getElementRadius(atoms[i].element);
                const r2 = this.getElementRadius(atoms[j].element);
                const bondThreshold = (r1 + r2) * thresholdFactor;

                if (dist < bondThreshold) {
                    this.addBondToScene(atoms[i], atoms[j], false); // Do not save state
                }
            }
        }
    }



    getElementColor(element) {
        const data = ELEMENTS[element] || DEFAULT_ELEMENT;
        return this.colorScheme === 'cpk' ? data.cpk : data.jmol;
    }

    getElementRadius(element) {
        const data = ELEMENTS[element] || DEFAULT_ELEMENT;
        return data.radius;
    }

    updateAtomColors() {
        this.molecule.atoms.forEach(atom => {
            if (atom.mesh) {
                const color = this.getElementColor(atom.element);
                atom.mesh.material.color.setHex(color);
            }
        });
    }

    renderPeriodicTable() {
        const container = document.getElementById('periodic-table');
        container.innerHTML = '';

        // Standard Periodic Table Layout (18 columns)
        // Map atomic number to position? Or just iterate elements and place them?
        // We have ELEMENTS map. We need to know row/col for grid.
        // Simplified layout:
        const layout = [
            ['H', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'He'],
            ['Li', 'Be', '', '', '', '', '', '', '', '', '', '', 'B', 'C', 'N', 'O', 'F', 'Ne'],
            ['Na', 'Mg', '', '', '', '', '', '', '', '', '', '', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
            ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
            ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
            ['Cs', 'Ba', 'La', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'],
            ['Fr', 'Ra', 'Ac', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', '', '', '', '', '', '', '', '', ''],
            // Lanthanides/Actinides omitted for brevity in main grid or added below?
            // Let's stick to main block for now or add them if needed.
            // The user provided data up to Mt.
        ];

        // Lanthanides (La-Lu) and Actinides (Ac-Lr) usually separate.
        // For this simple grid, let's just render the main block and handle La/Ac as placeholders or simple buttons.
        // Actually, let's just render a list of buttons if grid is too complex, 
        // BUT user asked for "Periodic Table". So grid is better.

        // Let's use the layout above.

        layout.forEach(row => {
            row.forEach(symbol => {
                const cell = document.createElement('div');
                cell.style.width = '100%';
                cell.style.aspectRatio = '1';

                if (symbol && ELEMENTS[symbol]) {
                    const data = ELEMENTS[symbol];
                    cell.style.border = '1px solid #555';
                    cell.style.cursor = 'pointer';
                    cell.style.display = 'flex';
                    cell.style.flexDirection = 'column';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontSize = '12px';

                    // Background color based on current scheme
                    const color = this.getElementColor(symbol);
                    const hex = color.toString(16).padStart(6, '0');
                    cell.style.backgroundColor = `#${hex}`;

                    // Text color contrast - simple logic
                    // If color is dark, white text; else black.
                    // Calculate luminance? Or just default to black/white based on hex.
                    // Simple approximation:
                    const r = (color >> 16) & 0xff;
                    const g = (color >> 8) & 0xff;
                    const b = color & 0xff;
                    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
                    cell.style.color = luma < 128 ? 'white' : 'black';

                    cell.innerText = symbol;
                    cell.title = `Atomic Number: ${data.atomicNumber}`;

                    cell.onclick = () => {
                        this.selectedElement = symbol;
                        document.getElementById('btn-element-select').innerText = symbol;
                        document.getElementById('pt-modal').style.display = 'none';
                    };
                }

                container.appendChild(cell);
            });
        });
    }

    createAtomMesh(atom) {
        const radius = this.getElementRadius(atom.element);
        const geometry = new THREE.SphereGeometry(1, 32, 32); // Base radius 1
        const color = this.getElementColor(atom.element);
        const material = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.scale.setScalar(radius * 0.5); // Scale factor

        mesh.position.copy(atom.position);
        mesh.userData = { type: 'atom', atom: atom };

        // Create black outline using backface technique
        const outlineGeometry = new THREE.SphereGeometry(1, 32, 32);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide
        });
        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outlineMesh.scale.setScalar(radius * 0.5 * 1.05); // 5% larger for outline
        outlineMesh.position.copy(atom.position);

        // Add both meshes
        atom.mesh = mesh;
        atom.outlineMesh = outlineMesh;
        this.renderer.scene.add(outlineMesh); // Add outline first (rendered behind)
        this.renderer.scene.add(mesh);
    }

    createBondMesh(bond) {
        const start = bond.atom1.position;
        const end = bond.atom2.position;

        const dist = start.distanceTo(end);
        // Create with height 1 for easy scaling
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const mesh = new THREE.Mesh(geometry, material);

        // Initial positioning will be handled by updateBonds or manually here
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mesh.position.copy(mid);

        const axis = new THREE.Vector3().subVectors(end, start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        mesh.setRotationFromQuaternion(quaternion);

        mesh.scale.set(1, dist, 1);

        mesh.userData = { type: 'bond', bond: bond };
        bond.mesh = mesh;
        this.renderer.scene.add(mesh);
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.renderer.render();
        this.updateMeasurements();
    }

    updateMeasurements() {
        const container = document.getElementById('measurements');
        container.innerHTML = ''; // Clear previous labels

        const selectedAtoms = this.molecule.atoms.filter(a => a.selected);
        const count = selectedAtoms.length;

        if (count === 2) {
            const a1 = selectedAtoms[0];
            const a2 = selectedAtoms[1];
            const dist = a1.position.distanceTo(a2.position);

            const mid = new THREE.Vector3().addVectors(a1.position, a2.position).multiplyScalar(0.5);
            this.createLabel(container, mid, `${dist.toFixed(3)} Å`);
        } else if (count === 3) {
            const a1 = selectedAtoms[0];
            const a2 = selectedAtoms[1];
            const a3 = selectedAtoms[2];

            const v1 = a1.position.clone().sub(a2.position);
            const v2 = a3.position.clone().sub(a2.position);
            const angle = v1.angleTo(v2) * (180 / Math.PI);

            this.createLabel(container, a2.position, `${angle.toFixed(1)}°`);
        } else if (count === 4) {
            // Dihedral
            // ... (calculation logic similar to setDihedralAngle but just reading)
            const a1 = selectedAtoms[0];
            const a2 = selectedAtoms[1];
            const a3 = selectedAtoms[2];
            const a4 = selectedAtoms[3];

            const axis = a3.position.clone().sub(a2.position).normalize();
            const v1 = a1.position.clone().sub(a2.position);
            const v2 = a4.position.clone().sub(a3.position);

            const p1 = v1.clone().sub(axis.clone().multiplyScalar(v1.dot(axis)));
            const p2 = v2.clone().sub(axis.clone().multiplyScalar(v2.dot(axis)));

            const angle = p1.angleTo(p2) * (180 / Math.PI);

            const mid = new THREE.Vector3().addVectors(a2.position, a3.position).multiplyScalar(0.5);
            this.createLabel(container, mid, `${angle.toFixed(1)}°`);
        }
    }

    createLabel(container, position, text) {
        const div = document.createElement('div');
        div.className = 'measurement-label';
        div.innerText = text;

        const pos = position.clone();
        pos.project(this.renderer.camera);

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

        div.style.left = `${x}px`;
        div.style.top = `${y}px`;

        container.appendChild(div);
    }
}
