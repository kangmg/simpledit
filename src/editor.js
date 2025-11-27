import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { MoleculeManager } from './moleculeManager.js';
import { GeometryEngine } from './geometryEngine.js';
import { AxisHelper } from './axisHelper.js';
import { ELEMENTS, DEFAULT_ELEMENT } from './constants.js';
import { Console } from './console.js';
import { Interaction } from './interaction.js';

// Manager classes
import { EditorState } from './editorState.js';
import { SelectionManager } from './managers/selectionManager.js';
import { UIManager } from './managers/uiManager.js';
import { FileIOManager } from './managers/fileIOManager.js';
import { RenderManager } from './managers/renderManager.js';
import { GeometryController } from './managers/geometryController.js';

export class Editor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'editor-canvas';
            document.getElementById('app').appendChild(this.canvas);
        }
        this.renderer = new Renderer(this.canvas);

        // Initialize centralized state
        this.state = new EditorState();

        // IMPORTANT: Initialize Manager classes BEFORE MoleculeManager
        // because MoleculeManager.createMolecule() calls updateAllLabels()
        this.selectionManager = new SelectionManager(this);
        this.uiManager = new UIManager(this);
        this.fileIOManager = new FileIOManager(this);
        this.renderManager = new RenderManager(this);
        this.geometryController = new GeometryController(this);

        // Now safe to initialize MoleculeManager (will call updateAllLabels)
        this.moleculeManager = new MoleculeManager(this);

        this.interaction = new Interaction(this.renderer, this.canvas);

        // Legacy properties (will be migrated gradually)
        this.selectedElement = 'C';
        this.manipulationMode = 'translate'; // For move mode: translate or rotate

        // Undo/Redo History
        this.history = [];
        this.historyIndex = -1;

        // Flags to track if we're currently adjusting geometry (for undo/redo)
        this.lengthAdjusting = false;
        this.angleAdjusting = false;
        this.dihedralAdjusting = false;
        this.maxHistory = 50;

        this.ghostBond = null;
        this.dragStartAtom = null;

        this.selectionBox = null;
        this.selectionStart = null;
        this.lassoPath = []; // For lasso selection

        this.isManipulating = false;
        this.initialPositions = null;

        this.bindEvents();
        this.setupInteraction();

        // Initialize label container
        this.labelContainer = document.createElement('div');
        this.labelContainer.id = 'label-container';
        this.labelContainer.style.position = 'absolute';
        this.labelContainer.style.top = '0';
        this.labelContainer.style.left = '0';
        this.labelContainer.style.width = '100%';
        this.labelContainer.style.height = '100%';
        this.labelContainer.style.pointerEvents = 'none';
        this.labelContainer.style.overflow = 'hidden';
        this.labelContainer.style.zIndex = '5'; // Ensure below UI (Sidebar is 10)
        document.body.appendChild(this.labelContainer);

        // Initialize console
        this.console = new Console(this);

        this.axisHelper = new AxisHelper(this.renderer.renderer);

        // Start animation loop
        this.animate = this.animate.bind(this);
        this.animate();
    }

    // Compatibility layer: proxy properties to state
    // This allows gradual migration from this.mode to this.state.mode
    get mode() {
        return this.state.mode;
    }
    set mode(value) {
        this.state.setMode(value);
    }

    get labelMode() {
        return this.state.ui.labelMode;
    }
    set labelMode(value) {
        this.state.setLabelMode(value);
    }

    get selectionOrder() {
        return this.state.selection.order;
    }
    set selectionOrder(value) {
        this.state.selection.order = value;
    }

    get colorScheme() {
        return this.state.ui.colorScheme;
    }
    set colorScheme(value) {
        this.state.setColorScheme(value);
    }

    get selectionMode() {
        return this.selectionManager.selectionMode;
    }
    set selectionMode(value) {
        this.selectionManager.selectionMode = value;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // Update controls
        this.renderer.controls.update();

        // Update axis helper
        if (this.axisHelper) {
            this.axisHelper.update(this.renderer.camera);
        }

        // Render scene
        this.renderer.render();
    }

    init() {
        console.log('Editor initialized');
        // Add a test atom to verify rendering
        // this.addAtomToScene('C', new THREE.Vector3(0, 0, 0));
    }

    bindEvents() {
        // Delegate UI events to UIManager
        this.uiManager.bindToolbarEvents();

        // Delegate Geometry events to GeometryController
        this.geometryController.bindGeometrySliders();

        // Bind canvas interaction events
        this.setupInteraction();

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Ignore shortcuts if modal is open or typing in input
            if (document.getElementById('coord-modal').style.display === 'block') return;
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
            if (document.getElementById('coord-modal').style.display === 'block') return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key.toLowerCase() === 't') {
                this.setMode('move');
                this.manipulationMode = 'translate';
                this.updateManipulationStatus();
            } else if (e.key.toLowerCase() === 'r') {
                if (this.mode === 'select') {
                    // In select mode, 'r' switches to rectangle selection
                    this.selectionMode = 'rectangle';
                    this.updateSelectionStatus();
                } else {
                    // In other modes, 'r' switches to move rotate mode
                    this.setMode('move');
                    this.manipulationMode = 'rotate';
                    this.updateManipulationStatus();
                }
            } else if (e.key.toLowerCase() === 'l') {
                if (this.mode === 'select') {
                    // In select mode, 'l' switches to lasso selection
                    this.selectionMode = 'lasso';
                    this.updateSelectionStatus();
                }
            } else if (e.key.toLowerCase() === 's') {
                // Toggle to symbol mode
                this.labelMode = 'symbol';
                document.getElementById('btn-toggle-labels').innerText = 'Labels: Symbol';
                this.updateAllLabels();
            } else if (e.key.toLowerCase() === 'n') {
                // Toggle to number mode
                this.labelMode = 'number';
                document.getElementById('btn-toggle-labels').innerText = 'Labels: Number';
                this.updateAllLabels();
            } else if (e.key.toLowerCase() === 'a') {
                // Toggle to both mode
                this.labelMode = 'both';
                document.getElementById('btn-toggle-labels').innerText = 'Labels: Both';
                this.updateAllLabels();
            } else if (e.key.toLowerCase() === 'c') {
                // Toggle console
                e.preventDefault(); // Prevent 'c' from being typed into console input
                this.console.toggle();
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

        // Molecule Management UI
        const btnNew = document.getElementById('btn-new-molecule');
        if (btnNew) {
            btnNew.onclick = () => {
                this.moleculeManager.createMolecule();
            };
        }

        const btnDelete = document.getElementById('btn-delete-molecule');
        if (btnDelete) {
            btnDelete.onclick = () => {
                if (confirm('Are you sure you want to delete the current molecule?')) {
                    const result = this.moleculeManager.removeMolecule(this.moleculeManager.activeMoleculeIndex);
                    if (result.error) alert(result.error);
                }
            };
        }
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.tool-btn, .icon-btn').forEach(btn => btn.classList.remove('active'));
        const btnMap = {
            'edit': 'btn-edit',
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

        if (mode === 'select') {
            this.updateSelectionStatus();
        } else {
            this.clearSelectionStatus();
        }
    }

    updateManipulationStatus() {
        const btn = document.getElementById('btn-move');
        const sub = btn.querySelector('.btn-sublabel');

        if (sub) {
            sub.style.display = 'block';
            if (this.manipulationMode === 'translate') {
                sub.innerText = 'Translate';
                sub.style.color = '#4a90e2';
            } else if (this.manipulationMode === 'rotate') {
                sub.innerText = 'Trackball Rotate';
                sub.style.color = '#e24a90';
            } else if (this.manipulationMode === 'orbit') {
                sub.innerText = 'Orbit Rotate';
                sub.style.color = '#90e24a';
            }
        } else {
            // Fallback for old design
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
    }

    clearManipulationStatus() {
        const btn = document.getElementById('btn-move');
        const sub = btn.querySelector('.btn-sublabel');

        if (sub) {
            sub.style.display = 'none';
        } else {
            btn.innerText = 'Move/Rotate';
            btn.style.backgroundColor = '';
        }
    }

    updateSelectionStatus() {
        this.selectionManager.updateSelectionStatus();
    }

    clearSelectionStatus() {
        this.selectionManager.clearSelectionStatus();
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

        this.selectionManager.removeSelectionBox();
        this.selectionManager.selectionStart = null;
        this.selectionManager.lassoPath = [];

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

        if (this.mode === 'edit') {
            // Check for atom intersection first
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom');

            if (atomMesh) {
                const atom = atomMesh.object.userData.atom;
                // If selected element is different, substitute
                if (this.selectedElement && atom.element !== this.selectedElement) {
                    this.saveState();
                    atom.element = this.selectedElement;
                    this.rebuildScene();
                    return;
                }
                // If same element, maybe we want to add a neighbor? 
                // For now, let's just return to avoid adding an atom on top or in background.
                // Or if we want to support "click to add neighbor", we need logic for that.
                // But user specifically asked for substitution.
                return;
            }

            // In edit mode, clicking empty space adds an atom
            // Create a plane perpendicular to the camera at an appropriate depth
            const normal = new THREE.Vector3();
            const camera = this.renderer.activeCamera || this.renderer.camera;
            camera.getWorldDirection(normal);

            // Determine the plane position based on existing atoms or camera distance
            let planePoint = new THREE.Vector3(0, 0, 0);

            if (this.molecule.atoms.length > 0) {
                // Calculate centroid of existing atoms
                const centroid = new THREE.Vector3();
                this.molecule.atoms.forEach(atom => {
                    centroid.add(atom.position);
                });
                centroid.divideScalar(this.molecule.atoms.length);
                planePoint = centroid;
            } else {
                // No atoms yet - place at a reasonable distance from camera
                const distance = camera.position.length() * 0.5; // Halfway to camera
                // Normal points INTO the scene (away from camera). So we add normal * distance.
                planePoint = camera.position.clone().add(normal.clone().multiplyScalar(distance));
            }

            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePoint);

            const target = new THREE.Vector3();
            const intersection = raycaster.ray.intersectPlane(plane, target);

            console.log('Atom Placement:', {
                intersection: intersection,
                target: target,
                planePoint: planePoint,
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
        this.selectionManager.toggleSelection(atom, multiSelect);
        this.updateSelectionInfo();
    }

    clearSelection() {
        this.selectionManager.clearSelection();
        this.updateSelectionInfo();
        this.updateBondVisuals();
    }

    updateAtomVisuals(atom) {
        this.renderManager.updateAtomVisuals(atom);
        // Update bond visuals if both atoms are selected
        this.updateBondVisuals();
    }

    updateBondVisuals() {
        this.renderManager.updateBondVisuals();
    }

    updateSliderLabel(id, value) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT') {
                el.value = value;
            } else {
                el.innerText = value;
            }
        }
    }

    updateSelectionInfo() {
        const count = this.selectionOrder.length;
        document.getElementById('selection-info').innerText = `${count} atoms selected`;

        const geoControls = document.getElementById('geometry-controls');
        const lengthControl = document.getElementById('length-control');
        const angleControl = document.getElementById('angle-control');
        const dihedralControl = document.getElementById('dihedral-control');
        const measurementInfo = document.getElementById('measurement-info');

        geoControls.style.display = count >= 2 ? 'block' : 'none';
        lengthControl.style.display = count === 2 ? 'block' : 'none';
        angleControl.style.display = count === 3 ? 'block' : 'none';
        dihedralControl.style.display = count === 4 ? 'block' : 'none';

        // Update measurement info display
        if (count === 2) {
            const a1 = this.selectionOrder[0];
            const a2 = this.selectionOrder[1];
            const dist = a1.position.distanceTo(a2.position);
            const val = dist.toFixed(3);
            document.getElementById('input-length').value = val;
            this.updateSliderLabel('val-length', val);

            // Display in top-left corner
            const idx1 = this.molecule.atoms.indexOf(a1);
            const idx2 = this.molecule.atoms.indexOf(a2);
            measurementInfo.innerHTML = `${a1.element} (${idx1}) - ${a2.element} (${idx2}): ${dist.toFixed(2)} Å`;
            measurementInfo.style.display = 'block';
        } else if (count === 3) {
            const a1 = this.selectionOrder[0];
            const a2 = this.selectionOrder[1];
            const a3 = this.selectionOrder[2];
            const v1 = a1.position.clone().sub(a2.position);
            const v2 = a3.position.clone().sub(a2.position);
            const angle = v1.angleTo(v2) * (180 / Math.PI);
            const val = angle.toFixed(1);
            document.getElementById('input-angle').value = val;
            this.updateSliderLabel('val-angle', val);

            // Display in top-left corner
            const idx1 = this.molecule.atoms.indexOf(a1);
            const idx2 = this.molecule.atoms.indexOf(a2);
            const idx3 = this.molecule.atoms.indexOf(a3);
            measurementInfo.innerHTML = `${a1.element} (${idx1}) - ${a2.element} (${idx2}) - ${a3.element} (${idx3}): ${angle.toFixed(1)}°`;
            measurementInfo.style.display = 'block';
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

            // Display in top-left corner
            const idx1 = this.molecule.atoms.indexOf(a1);
            const idx2 = this.molecule.atoms.indexOf(a2);
            const idx3 = this.molecule.atoms.indexOf(a3);
            const idx4 = this.molecule.atoms.indexOf(a4);
            measurementInfo.innerHTML = `${a1.element} (${idx1}) - ${a2.element} (${idx2}) - ${a3.element} (${idx3}) - ${a4.element} (${idx4}): ${angleDeg.toFixed(1)}°`;
            measurementInfo.style.display = 'block';
        } else {
            measurementInfo.style.display = 'none';
        }
    }



    setBondLength() {
        const targetDist = parseFloat(document.getElementById('input-length').value);
        if (isNaN(targetDist)) return { error: 'Invalid distance value' };
        return this.geometryController.setBondLength(targetDist);
    }

    setBondAngle() {
        const targetAngle = parseFloat(document.getElementById('input-angle').value);
        if (isNaN(targetAngle)) return { error: 'Invalid angle value' };
        return this.geometryController.setAngle(targetAngle);
    }

    setDihedralAngle() {
        const targetAngle = parseFloat(document.getElementById('input-dihedral').value);
        if (isNaN(targetAngle)) return { error: 'Invalid dihedral value' };
        return this.geometryController.setDihedral(targetAngle);
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

        if (this.mode === 'edit') {
            // In edit mode, dragging from an atom creates a bond
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
                // Start selection (rectangle or lasso)
                this.selectionManager.startSelection(event.clientX, event.clientY);
                this.renderer.controls.enabled = false; // Disable rotation while selecting
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
        if (this.mode === 'edit' && this.ghostBond) {
            // Update ghost bond end
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const target = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, target);

            // Check for snap to atom
            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom' && i.object.userData.atom !== this.dragStartAtom);

            const endPos = atomMesh ? atomMesh.object.position : target;
            this.updateGhostBond(endPos);
        } else if (this.mode === 'select') {
            this.selectionManager.updateSelection(event.clientX, event.clientY);
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
                // Orbit Rotation - rotate around camera view direction (follows mouse continuously)
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

                // Update initial positions to current positions for continuous rotation
                selectedAtoms.forEach(atom => {
                    this.initialPositions.set(atom, atom.position.clone());
                });
                // Update start mouse position for next frame
                this.manipulationStartMouse.set(event.clientX, event.clientY);
            } else {
                // Camera-Aligned Translation
                const dx = event.clientX - this.manipulationStartMouse.x;
                const dy = event.clientY - this.manipulationStartMouse.y;

                // Get Camera Basis Vectors
                const camera = this.renderer.activeCamera;
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

                // Scale factor (different for perspective vs orthographic)
                let scale;
                if (camera.isPerspectiveCamera) {
                    // Perspective: FOV scaling
                    const dist = camera.position.distanceTo(this.centroid);
                    const vFov = camera.fov * Math.PI / 180;
                    scale = (2 * Math.tan(vFov / 2) * dist) / window.innerHeight;
                } else {
                    // Orthographic: use zoom and frustum size
                    const frustumHeight = (camera.top - camera.bottom) / camera.zoom;
                    scale = frustumHeight / window.innerHeight;
                }

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

        if (this.mode === 'edit' && this.ghostBond) {
            this.renderer.scene.remove(this.ghostBond);
            this.ghostBond = null;

            const intersects = raycaster.intersectObjects(this.renderer.scene.children);
            const atomMesh = intersects.find(i => i.object.userData.type === 'atom' && i.object.userData.atom !== this.dragStartAtom);

            if (atomMesh) {
                // Dragged to an existing atom
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
            } else {
                // Dragged to empty space - create new atom and bond
                // Calculate position on a plane perpendicular to camera, passing through start atom
                const camera = this.renderer.activeCamera || this.renderer.camera;
                const normal = new THREE.Vector3();
                camera.getWorldDirection(normal);

                const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, this.dragStartAtom.position);
                const target = new THREE.Vector3();
                const intersection = raycaster.ray.intersectPlane(plane, target);

                if (intersection) {
                    // Create new atom at the target position
                    const newAtom = this.addAtomToScene(this.selectedElement, target);
                    // Create bond between start atom and new atom
                    this.addBondToScene(this.dragStartAtom, newAtom);
                }
            }
            this.dragStartAtom = null;
        } else if (this.mode === 'select') {
            this.selectionManager.endSelection(event.clientX, event.clientY, event.shiftKey || event.ctrlKey || event.metaKey);
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

    createGhostBond(startPos) {
        const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(geometry, material);
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

        // Create mesh via RenderManager
        const mesh = this.renderManager.createAtomMesh(atom);
        if (mesh) {
            this.renderer.scene.add(mesh);
            atom.mesh = mesh;
        }

        return atom;
    }

    removeBond(bond) {
        this.saveState(); // Save before removing bond

        // Remove from molecule
        this.molecule.removeBond(bond);

        // Update scene
        this.rebuildScene();
    }

    addBondToScene(atom1, atom2) {
        this.saveState(); // Save before adding bond

        // Add to molecule
        this.molecule.addBond(atom1, atom2);

        // Update scene
        this.rebuildScene();
    }

    saveState() {
        // Remove any future history if we are in the middle
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const state = this.molecule.toJSON(); // Use JSON to preserve bonds
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
        this.selectionManager.deleteSelected();
    }

    restoreState(state) {
        this.molecule.fromJSON(state);
        this.rebuildScene();
    }

    // Old getElementColor removed
    // getElementColor(element) { ... }

    openCoordinateEditor(initialFormat = 'xyz') {
        this.uiManager.openCoordinateEditor(initialFormat);
    }

    closeCoordinateEditor() {
        this.uiManager.closeCoordinateEditor();
    }



    rebuildScene() {
        this.renderManager.rebuildScene();
    }

    autoBond() {
        const thresholdFactor = parseFloat(document.getElementById('bond-threshold').value);
        this.saveState();

        // Delegate to MoleculeManager
        const bondsAdded = this.moleculeManager.autoBond(thresholdFactor);

        if (bondsAdded > 0) {
            this.rebuildScene();
        }
    }



    // getElementColor and getElementRadius removed (moved to RenderManager)



    updateAtomColors() {
        this.renderManager.updateAtomColors();
    }

    renderPeriodicTable() {
        this.uiManager.renderPeriodicTable();
    }

    // createAtomMesh removed (duplicate)
    // createAtomLabel removed (moved to UIManager)

    // updateAtomLabelText removed (moved to UIManager)

    updateAllLabels() {
        this.uiManager.updateAllLabels();
    }

    updateLabelPositions() {
        this.uiManager.updateLabelPositions();
    }

    // createBondMesh moved to RenderManager

    animate() {
        requestAnimationFrame(this.animate);
        this.renderer.render();

        // Update label positions if visible
        if (this.labelMode !== 'none') {
            this.updateLabelPositions();
        }
    }

    updateMeasurements() {
        // Measurements are now displayed in the top-left corner via updateSelectionInfo
        // This function is kept for compatibility but does nothing
    }

    toggleMaximize(element) {
        this.uiManager.toggleMaximize(element);
    }

}
