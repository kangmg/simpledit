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
        // Toolbar buttons
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-redo').onclick = () => this.redo();

        document.getElementById('btn-edit').onclick = () => this.setMode('edit');
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

        // Toggle Labels - cycle through modes
        document.getElementById('btn-toggle-labels').onclick = () => {
            const modes = ['none', 'symbol', 'number', 'both'];
            const currentIndex = modes.indexOf(this.labelMode);
            this.labelMode = modes[(currentIndex + 1) % modes.length];

            const buttonText = {
                'none': 'Show Labels',
                'symbol': 'Labels: Symbol',
                'number': 'Labels: Number',
                'both': 'Labels: Both'
            };
            document.getElementById('btn-toggle-labels').innerText = buttonText[this.labelMode];
            this.updateAllLabels();
        };

        // Export PNG button
        document.getElementById('btn-export-png').onclick = () => {
            const molecule = this.molecule;
            if (molecule.atoms.length === 0) {
                alert('No atoms to export');
                return;
            }

            // Collect all objects (atoms, bonds, labels)
            const objects = [];
            this.renderer.scene.traverse(obj => {
                if (obj.userData && (obj.userData.type === 'atom' || obj.userData.type === 'bond' || obj.userData.type === 'label')) {
                    objects.push(obj);
                }
            });

            // Capture snapshot (with white background by default)
            const dataURL = this.renderer.captureSnapshot(objects, false);

            if (!dataURL) {
                alert('Failed to capture snapshot');
                return;
            }

            // Download as PNG
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const molName = this.moleculeManager.getActive().name.replace(/\s/g, '_');
            link.download = `${molName}_${timestamp}.png`;
            link.href = dataURL;
            link.click();
        };

        // Sidebar Toggle
        const sidebar = document.querySelector('.floating-sidebar');
        const toggleBtn = document.getElementById('btn-toggle-sidebar');

        const iconCollapse = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 1.5033V3.5033L13 3.5033V7.6749L14.8285 5.84644L16.2427 7.26066L12 11.5033L7.75739 7.26066L9.17161 5.84644L11 7.67483V3.5033L6 3.5033V1.5033L18 1.5033Z" fill="currentColor" /><path d="M18 20.4967V22.4967H6V20.4967H11V16.3251L9.17154 18.1536L7.75732 16.7393L12 12.4967L16.2426 16.7393L14.8284 18.1536L13 16.3252V20.4967H18Z" fill="currentColor" /></svg>`;
        const iconExpand = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 1V3L7 3V1L17 1Z" fill="currentColor" /><path d="M16.2427 8.44772L14.8285 9.86194L13 8.03347L13 15.9665L14.8285 14.138L16.2427 15.5522L12 19.7949L7.75742 15.5522L9.17163 14.138L11 15.9664L11 8.03357L9.17163 9.86194L7.75742 8.44772L12 4.20508L16.2427 8.44772Z" fill="currentColor" /><path d="M17 23V21H7V23H17Z" fill="currentColor" /></svg>`;

        if (toggleBtn) {
            toggleBtn.onclick = () => {
                sidebar.classList.toggle('collapsed');
                toggleBtn.innerHTML = sidebar.classList.contains('collapsed') ? iconExpand : iconCollapse;
                toggleBtn.style.transform = 'none';
            };
        }

        // Properties
        // Properties
        const btnElement = document.getElementById('btn-element-select');
        const ptModal = document.getElementById('pt-modal');

        // Bind all close buttons for PT
        const closePtBtns = document.querySelectorAll('.close-pt');
        closePtBtns.forEach(btn => {
            btn.onclick = () => {
                // Reset maximize state before closing
                if (ptModal.classList.contains('maximized')) {
                    this.toggleMaximize(ptModal);
                }
                ptModal.style.display = 'none';
            };
        });

        // Bind maximize button for PT
        const maximizePt = document.querySelector('.maximize-pt');
        if (maximizePt) {
            maximizePt.onclick = () => this.toggleMaximize(ptModal);
        }

        btnElement.onclick = () => {
            // Reset maximize state before opening
            if (ptModal.classList.contains('maximized')) {
                this.toggleMaximize(ptModal);
            }
            this.renderPeriodicTable();
            ptModal.style.display = 'block';
        };

        window.onclick = (event) => {
            if (event.target === ptModal) {
                // Reset maximize state before closing
                if (ptModal.classList.contains('maximized')) {
                    this.toggleMaximize(ptModal);
                }
                ptModal.style.display = 'none';
            }
            if (event.target === document.getElementById('coord-modal')) {
                this.closeCoordinateEditor();
            }
        };

        // Bind Coordinate Editor window controls
        const coordModal = document.getElementById('coord-modal');
        document.getElementById('coord-close').onclick = () => this.closeCoordinateEditor();
        document.getElementById('coord-minimize').onclick = () => this.closeCoordinateEditor();
        document.getElementById('coord-maximize').onclick = () => this.toggleMaximize(coordModal);

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

        // Atomic Coordinate Editor
        document.getElementById('btn-coord-editor').onclick = () => this.openCoordinateEditor();

        // Geometry
        // Geometry Sliders
        document.getElementById('input-length').oninput = () => {
            // Save state before first change
            if (!this.lengthAdjusting) {
                this.saveState();
                this.lengthAdjusting = true;
            }
            this.updateSliderLabel('val-length', document.getElementById('input-length').value);
            this.setBondLength();
        };
        document.getElementById('input-length').onchange = () => {
            this.lengthAdjusting = false; // Reset flag when slider is released
        };

        document.getElementById('input-angle').oninput = () => {
            // Save state before first change
            if (!this.angleAdjusting) {
                this.saveState();
                this.angleAdjusting = true;
            }
            this.updateSliderLabel('val-angle', document.getElementById('input-angle').value);
            this.setBondAngle();
        };
        document.getElementById('input-angle').onchange = () => {
            this.angleAdjusting = false; // Reset flag when slider is released
        };

        document.getElementById('input-dihedral').oninput = () => {
            // Save state before first change
            if (!this.dihedralAdjusting) {
                this.saveState();
                this.dihedralAdjusting = true;
            }
            this.updateSliderLabel('val-dihedral', document.getElementById('input-dihedral').value);
            this.setDihedralAngle();
        };
        document.getElementById('input-dihedral').onchange = () => {
            this.dihedralAdjusting = false; // Reset flag when slider is released
        };

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

        if (this.mode === 'edit') {
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
                planePoint = camera.position.clone().add(normal.clone().multiplyScalar(-distance));
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
                this.addAtom(this.selectedElement, target);
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
        this.selectionManager.clearSelection();
        this.updateSelectionInfo();
        this.updateBondVisuals();
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

        // Update bond visuals if both atoms are selected
        this.updateBondVisuals();
    }

    updateBondVisuals() {
        this.renderManager.updateBondVisuals();
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

        // Find the bond between b and c (axis)
        const bond23 = this.molecule.getBond(a2, a3);

        // Get all atoms connected to c (excluding the b-c bond)
        // This ensures that ALL atoms attached to c (including d and others) rotate together
        const fragmentToRotate = this.getConnectedAtoms(a3, bond23);

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
                this.selectionStart = new THREE.Vector2(event.clientX, event.clientY);
                this.lassoPath = [{ x: event.clientX, y: event.clientY }]; // Initialize lasso path
                this.createSelectionBox();
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
        } else if (this.mode === 'select' && this.selectionStart) {
            this.performBoxSelection(event.clientX, event.clientY, event.shiftKey || event.ctrlKey || event.metaKey);
            this.removeSelectionBox();
            this.selectionStart = null;
            this.lassoPath = []; // Clear lasso path
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
        div.style.pointerEvents = 'none';

        if (this.selectionMode === 'rectangle') {
            div.style.border = '2px dashed #ff8800';
            div.style.backgroundColor = 'rgba(255, 136, 0, 0.15)';
        } else if (this.selectionMode === 'lasso') {
            // For lasso, we'll draw using SVG
            div.innerHTML = '<svg style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;"><path id="lasso-path" stroke="#ff8800" stroke-width="2" stroke-dasharray="5,5" fill="rgba(255, 136, 0, 0.15)" /></svg>';
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.top = '0';
            div.style.left = '0';
        }

        document.body.appendChild(div);
        this.selectionBox = div;
    }

    updateSelectionBox(x, y) {
        if (this.selectionMode === 'rectangle') {
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
        } else if (this.selectionMode === 'lasso') {
            // Add current point to lasso path
            this.lassoPath.push({ x, y });

            // Update SVG path
            const path = this.selectionBox.querySelector('#lasso-path');
            if (path && this.lassoPath.length > 0) {
                let pathData = `M ${this.lassoPath[0].x} ${this.lassoPath[0].y} `;
                for (let i = 1; i < this.lassoPath.length; i++) {
                    pathData += ` L ${this.lassoPath[i].x} ${this.lassoPath[i].y} `;
                }
                path.setAttribute('d', pathData);
            }
        }
    }

    removeSelectionBox() {
        if (this.selectionBox) {
            document.body.removeChild(this.selectionBox);
            this.selectionBox = null;
        }
    }

    performBoxSelection(endX, endY, add) {
        if (!add) this.clearSelection();

        const camera = this.renderer.activeCamera || this.renderer.camera;

        if (this.selectionMode === 'rectangle') {
            // Rectangle selection
            const startX = this.selectionStart.x;
            const startY = this.selectionStart.y;
            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            this.molecule.atoms.forEach(atom => {
                if (!atom.mesh) return;

                // Project atom position to screen
                const pos = atom.mesh.position.clone();
                pos.project(camera);

                const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
                const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

                if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
                    atom.selected = true;
                    if (!this.selectionOrder.includes(atom)) {
                        this.selectionOrder.push(atom);
                    }
                    this.updateAtomVisuals(atom);
                }
            });
        } else if (this.selectionMode === 'lasso') {
            // Lasso selection - check if point is inside polygon
            if (this.lassoPath.length < 3) return; // Need at least 3 points for a polygon

            this.molecule.atoms.forEach(atom => {
                if (!atom.mesh) return;

                // Project atom position to screen
                const pos = atom.mesh.position.clone();
                pos.project(camera);

                const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
                const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

                if (this.isPointInPolygon(screenX, screenY, this.lassoPath)) {
                    atom.selected = true;
                    if (!this.selectionOrder.includes(atom)) {
                        this.selectionOrder.push(atom);
                    }
                    this.updateAtomVisuals(atom);
                }
            });
        }

        this.updateSelectionInfo();
    }

    // Point-in-polygon test using ray casting algorithm
    isPointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    createGhostBond(startPos) {
        const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 });
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

    addAtom(element, position, existingAtom = null) {
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
            // Remove label from DOM if it exists
            if (atom.label && atom.label.parentNode) {
                atom.label.parentNode.removeChild(atom.label);
                atom.label = null;
            }
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
        this.renderManager.updateAtomColors();
    }

    renderPeriodicTable() {
        const container = document.getElementById('periodic-table');
        container.innerHTML = '';

        // Standard Periodic Table Layout (18 columns)
        // Map atomic number to position? Or just iterate elements and place them?
        // We have ELEMENTS map. We need to know row/col for grid.
        // Simplified layout:
        const layout = [
            ['X', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // Dummy atom
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
                cell.className = 'pt-cell'; // Use CSS class

                if (symbol && ELEMENTS[symbol]) {
                    const data = ELEMENTS[symbol];
                    cell.classList.add('active'); // Mark as active element

                    // Background color based on current scheme
                    const color = this.getElementColor(symbol);
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
                        this.selectedElement = symbol;
                        const symbolSpan = document.getElementById('current-element-symbol');
                        if (symbolSpan) {
                            symbolSpan.innerText = symbol;
                        } else {
                            document.getElementById('btn-element-select').innerText = symbol;
                        }
                        const ptModal = document.getElementById('pt-modal');
                        // Reset maximize state before closing
                        if (ptModal.classList.contains('maximized')) {
                            this.toggleMaximize(ptModal);
                        }
                        ptModal.style.display = 'none';
                    };
                } else {
                    cell.classList.add('empty'); // Mark as empty
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

        // Create label (initially hidden)
        this.createAtomLabel(atom);
    }

    createAtomLabel(atom) {
        const label = document.createElement('div');
        label.className = 'atom-label';
        label.style.position = 'absolute';
        label.style.color = '#ff0000'; // Red color
        label.style.fontSize = '16px';
        label.style.fontWeight = 'normal'; // Thinner font
        label.style.fontFamily = 'Arial, sans-serif';
        label.style.pointerEvents = 'none';
        label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)'; // Outline for visibility
        label.style.display = 'none';

        if (this.labelContainer) {
            this.labelContainer.appendChild(label);
        } else {
            document.body.appendChild(label);
        }

        atom.label = label;
        this.updateAtomLabelText(atom);
    }

    updateAtomLabelText(atom) {
        if (!atom.label) return;

        const idx = this.molecule.atoms.indexOf(atom);
        let text = '';

        switch (this.labelMode) {
            case 'symbol':
                text = atom.element;
                break;
            case 'number':
                text = idx.toString();
                break;
            case 'both':
                text = `${atom.element} (${idx})`;
                break;
            default:
                text = '';
        }

        atom.label.innerText = text;
    }

    updateAllLabels() {
        this.uiManager.updateAllLabels();
    }

    updateLabelPositions() {
        this.uiManager.updateLabelPositions();
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
        if (!element) return;

        if (element.classList.contains('maximized')) {
            element.classList.remove('maximized');

            // Reset to default modal styles (from HTML)
            element.style.position = 'fixed';
            element.style.top = '50%';
            element.style.left = '50%';
            element.style.transform = 'translate(-50%, -50%)';
            element.style.zIndex = '1000';
            element.style.padding = '25px';

            // Remove maximize-specific properties
            element.style.right = '';
            element.style.bottom = '';

            if (element.id === 'coord-modal') {
                element.style.width = '600px';
                element.style.maxWidth = '90%';
                element.style.height = '';
                element.style.maxHeight = '';
            } else if (element.id === 'pt-modal') {
                element.style.width = '';
                element.style.height = '';
                element.style.maxWidth = '';
                element.style.maxHeight = '80vh';
                element.style.overflowY = 'auto';
            }
        } else {
            element.classList.add('maximized');
            // Maximize style - center with 90vw/90vh
            element.style.position = 'fixed';
            element.style.width = '90vw';
            element.style.height = '90vh';
            element.style.maxWidth = '90vw';
            element.style.maxHeight = '90vh';
            element.style.top = '50%';
            element.style.left = '50%';
            element.style.transform = 'translate(-50%, -50%)';
            element.style.overflowY = '';
        }
    }

