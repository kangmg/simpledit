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

    // If switching to ortho, orbit controls zoom works differently (changes zoom prop), 
    // but OrbitControls handles Ortho cameras automatically.
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
    this.renderer.render(this.scene, this.activeCamera);
  }
}
