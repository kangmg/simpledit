import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 10;

    // Orthographic Camera
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    this.orthoCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    this.orthoCamera.position.z = 10;

    this.activeCamera = this.orthoCamera; // Start with Orthographic

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Controls
    this.orbitControls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance = 2;
    this.orbitControls.maxDistance = 50;
    this.orbitControls.enabled = false;

    this.trackballControls = new TrackballControls(this.activeCamera, this.renderer.domElement);
    this.trackballControls.rotateSpeed = 2.0;
    this.trackballControls.zoomSpeed = 1.2;
    this.trackballControls.panSpeed = 0.8;
    this.trackballControls.noZoom = false;
    this.trackballControls.noPan = false;
    this.trackballControls.staticMoving = true;
    this.trackballControls.dynamicDampingFactor = 0.3;
    this.trackballControls.enabled = true;

    this.controls = this.trackballControls; // Active controls reference

    // Lights - full ambient light to minimize shadows
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);

    // Axis Helper Scene (bottom-right corner)
    this.axisScene = new THREE.Scene();
    this.axisScene.background = new THREE.Color(0xffffff); // White background

    // Use orthographic camera to prevent perspective distortion
    const axisSize = 2.5;
    this.axisCamera = new THREE.OrthographicCamera(
      -axisSize, axisSize,  // left, right
      axisSize, -axisSize,  // top, bottom
      0.1, 100              // near, far
    );
    this.axisCamera.position.set(0, 0, 5);

    // Create custom thick axis arrows (X=red, Y=green, Z=blue)
    const axisLength = 2.0;      // Increased from 1.5
    const axisRadius = 0.08;     // Increased from 0.03 (much thicker)
    const arrowLength = 0.5;     // Increased from 0.3
    const arrowRadius = 0.15;    // Increased from 0.08

    // Helper function to create thick arrow
    const createArrow = (color) => {
      const group = new THREE.Group();

      // Arrow shaft (cylinder)
      const shaftGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 16);
      const shaftMaterial = new THREE.MeshBasicMaterial({ color });
      const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
      shaft.position.y = axisLength / 2;
      group.add(shaft);

      // Arrow head (cone)
      const headGeometry = new THREE.ConeGeometry(arrowRadius, arrowLength, 16);
      const headMaterial = new THREE.MeshBasicMaterial({ color });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = axisLength + arrowLength / 2;
      group.add(head);

      return group;
    };

    // X axis (red) - rotate to point right
    const xAxis = createArrow(0xff0000);
    xAxis.rotation.z = -Math.PI / 2;
    this.axisScene.add(xAxis);

    // Y axis (green) - already points up
    const yAxis = createArrow(0x00ff00);
    this.axisScene.add(yAxis);

    // Z axis (blue) - rotate to point forward
    const zAxis = createArrow(0x0000ff);
    zAxis.rotation.x = Math.PI / 2;
    this.axisScene.add(zAxis);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  setProjection(type) {
    if (type === 'perspective') {
      this.activeCamera = this.camera;
    } else if (type === 'orthographic') {
      this.activeCamera = this.orthoCamera;
      // Match position/rotation roughly or just reset?
      // For now, let's keep them independent or sync position if needed.
      // Syncing position is better for UX.
      this.orthoCamera.position.copy(this.camera.position);
      this.orthoCamera.quaternion.copy(this.camera.quaternion);
      this.orthoCamera.zoom = 1; // Reset zoom or calculate equivalent?
      this.orthoCamera.updateProjectionMatrix();
    }

    // Update controls to use new camera
    this.orbitControls.object = this.activeCamera;
    this.trackballControls.object = this.activeCamera;

    // Reset controls to prevent momentum carrying over
    this.orbitControls.reset();
    this.trackballControls.reset();

    // Explicitly clear to prevent ghosting artifacts
    this.renderer.clear();

    this.orbitControls.update();
    this.trackballControls.update();
  }

  setCameraMode(mode) {
    if (mode === 'orbit') {
      this.orbitControls.enabled = true;
      this.trackballControls.enabled = false;
      this.controls = this.orbitControls;
      // Reset camera up for orbit mode to prevent weird orientation
      this.activeCamera.up.set(0, 1, 0);
    } else if (mode === 'trackball') {
      this.orbitControls.enabled = false;
      this.trackballControls.enabled = true;
      this.controls = this.trackballControls;
    }
  }

  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;

    // Update Perspective
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Update Orthographic
    const frustumSize = 20;
    this.orthoCamera.left = -frustumSize * aspect / 2;
    this.orthoCamera.right = frustumSize * aspect / 2;
    this.orthoCamera.top = frustumSize / 2;
    this.orthoCamera.bottom = -frustumSize / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.trackballControls.handleResize();
  }

  render() {
    this.controls.update();

    // Render main scene
    this.renderer.render(this.scene, this.activeCamera);

    // Render axis helper in bottom-right (relative to sidebar)
    const size = 180; // Increased size for better visibility
    const margin = 30;
    const sidebarWidth = 240;

    // Position just to the right of sidebar (around 20% from left edge)
    const x = sidebarWidth + margin;
    const y = margin;

    // Clear depth buffer for overlay
    this.renderer.clearDepth();

    // Set viewport to bottom-right corner
    this.renderer.setViewport(x, y, size, size);
    this.renderer.setScissor(x, y, size, size);
    this.renderer.setScissorTest(true);

    // Sync axis camera rotation with main camera
    this.axisCamera.position.copy(this.activeCamera.position);
    this.axisCamera.position.sub(this.controls.target || new THREE.Vector3());
    this.axisCamera.position.setLength(5);
    this.axisCamera.lookAt(this.axisScene.position);

    // Render axis scene
    this.renderer.render(this.axisScene, this.axisCamera);

    // Reset viewport and scissor
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }

  /**
   * Capture molecule snapshot
   * @param {THREE.Object3D[]} objects - Array of objects to capture (atoms, bonds, labels)
   * @param {boolean} transparentBg - Whether to use transparent background
   * @param {number} padding - Padding multiplier (default: 1.3)
   * @returns {string} - Data URL of the captured image
   */
  captureSnapshot(objects, transparentBg = false, padding = 1.3) {
    if (objects.length === 0) {
      return null;
    }

    // Calculate bounding box of all objects
    const box = new THREE.Box3();
    objects.forEach(obj => {
      if (obj.geometry) {
        obj.geometry.computeBoundingBox();
        const objBox = obj.geometry.boundingBox.clone();
        objBox.applyMatrix4(obj.matrixWorld);
        box.union(objBox);
      }
    });

    // Get box dimensions
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Calculate max dimension for framing
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return null;

    // Create offscreen canvas for high-resolution capture
    const captureWidth = 1920;
    const captureHeight = 1920;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = captureWidth;
    offscreenCanvas.height = captureHeight;

    // Create temporary renderer
    const tempRenderer = new THREE.WebGLRenderer({
      canvas: offscreenCanvas,
      antialias: true,
      alpha: transparentBg,
      preserveDrawingBuffer: true
    });
    tempRenderer.setSize(captureWidth, captureHeight);
    tempRenderer.setPixelRatio(1);

    // Set background
    const originalBackground = this.scene.background;
    if (transparentBg) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(0xffffff);
    }

    // Create camera for snapshot
    const aspect = captureWidth / captureHeight;
    let snapshotCamera;

    if (this.activeCamera.isOrthographicCamera) {
      const frustumHeight = maxDim * padding;
      const frustumWidth = frustumHeight * aspect;
      snapshotCamera = new THREE.OrthographicCamera(
        -frustumWidth / 2,
        frustumWidth / 2,
        frustumHeight / 2,
        -frustumHeight / 2,
        0.1,
        1000
      );
    } else {
      snapshotCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    }

    // Position camera to frame molecule while preserving view direction
    // Use quaternion to get exact direction
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(this.activeCamera.quaternion);

    snapshotCamera.position.copy(center).add(direction.multiplyScalar(maxDim * padding * 2.5));
    snapshotCamera.quaternion.copy(this.activeCamera.quaternion);
    snapshotCamera.updateMatrixWorld();

    // Handle Labels: Convert HTML labels to Sprites for capture
    const tempSprites = [];
    objects.forEach(obj => {
      if (obj.userData && obj.userData.atom) {
        const atom = obj.userData.atom;
        if (atom.label && atom.label.style.display !== 'none' && atom.label.innerText) {
          const sprite = this.createTextSprite(atom.label.innerText);
          sprite.position.copy(obj.position);
          // Center label on atom (no offset)
          this.scene.add(sprite);
          tempSprites.push(sprite);
        }
      }
    });

    // Render to offscreen canvas
    tempRenderer.render(this.scene, snapshotCamera);

    // Cleanup Sprites
    tempSprites.forEach(sprite => {
      this.scene.remove(sprite);
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
    });

    // Restore background
    this.scene.background = originalBackground;

    // Capture image
    const dataURL = offscreenCanvas.toDataURL('image/png');

    // Cleanup
    tempRenderer.dispose();

    return dataURL;
  }

  createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 64; // High resolution for snapshot
    const font = `Bold ${fontSize}px Arial`;
    context.font = font;

    const metrics = context.measureText(text);
    const width = metrics.width;
    const height = fontSize * 1.2;

    canvas.width = width;
    canvas.height = height;

    // Redraw after resizing
    context.font = font;
    context.fillStyle = '#ff0000'; // Red color to match editor
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw text centered
    context.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);

    // Scale sprite to match scene units
    const scale = 0.005 * fontSize; // Reduced scale for better fit
    sprite.scale.set(scale * (width / height), scale, 1);

    return sprite;
  }
}
