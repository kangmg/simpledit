import * as THREE from 'three';

export class AxisHelper {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
        this.camera.position.z = 100;
        this.camera.lookAt(0, 0, 0);

        this.container = document.createElement('div');
        this.container.id = 'axis-helper';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        this.container.style.width = '100px';
        this.container.style.height = '100px';
        this.container.style.pointerEvents = 'none'; // Let clicks pass through
        this.container.style.zIndex = '1000';
        document.body.appendChild(this.container);

        // Create a separate renderer for the axis helper
        // Actually, it's better to reuse the main renderer with autoClear=false
        // But to keep it simple and isolated, let's try a separate small renderer first
        // Or better: Use the main renderer but render to a viewport in the corner.
        // However, standard practice for HUD is often a second scene rendered on top.

        // Let's use a separate small renderer for the HUD to avoid clearing issues with main scene
        this.hudRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.hudRenderer.setSize(100, 100);
        this.container.appendChild(this.hudRenderer.domElement);

        this.axes = new THREE.AxesHelper(40);
        // Thicken axes? AxesHelper lines are 1px.
        // Let's make custom arrows for better visibility
        this.createCustomAxes();
    }

    createCustomAxes() {
        const axisLength = 40;
        const axisRadius = 2;
        const headLength = 10;
        const headRadius = 5;

        // X Axis (Red)
        const xArrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            axisLength,
            0xff0000,
            headLength,
            headRadius
        );
        this.scene.add(xArrow);

        // Y Axis (Green)
        const yArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            axisLength,
            0x00ff00,
            headLength,
            headRadius
        );
        this.scene.add(yArrow);

        // Z Axis (Blue)
        const zArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, 0),
            axisLength,
            0x0000ff,
            headLength,
            headRadius
        );
        this.scene.add(zArrow);

        // Add labels
        // We can use sprites for X, Y, Z labels
        this.addLabel('X', 50, 0, 0, 'red');
        this.addLabel('Y', 0, 50, 0, 'green');
        this.addLabel('Z', 0, 0, 50, 'blue');
    }

    addLabel(text, x, y, z, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.set(20, 20, 1);
        this.scene.add(sprite);
    }

    update(mainCamera) {
        // Sync rotation with main camera
        this.camera.position.copy(mainCamera.position);
        this.camera.position.sub(mainCamera.target || new THREE.Vector3(0, 0, 0)); // Relative to target
        this.camera.position.setLength(100); // Fixed distance
        this.camera.lookAt(0, 0, 0);

        // Or better: just copy the quaternion if it's an orbit camera
        // But OrbitControls moves the camera position.
        // The simplest way for HUD axis is:
        // Keep camera at (0,0,100) and rotate the SCENE (axes) inverse to camera?
        // No, easier to just rotate the camera to match main camera's orientation relative to target.

        this.camera.rotation.copy(mainCamera.rotation);
        this.camera.position.copy(mainCamera.position).normalize().multiplyScalar(100);
        this.camera.up.copy(mainCamera.up);
        this.camera.lookAt(0, 0, 0);

        this.hudRenderer.render(this.scene, this.camera);
    }
}
