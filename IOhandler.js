class Camera {
    camera = {
        rotation: { x: 0.4, y: 0 },
        distance: 5,
        dragging: false,
        lastMousePos: { x: 0, y: 2 },
    };
    constructor(canvas, updateCameraCallback) {
        this.canvas = canvas;
        this.updateCameraCallback = updateCameraCallback;
        this.initEventHandlers();
    }

    initEventHandlers() {
        this.canvas.addEventListener("mousedown", (e) => {
            this.camera.dragging = true;
            this.camera.lastMousePos = {
                x: e.clientX,
                y: e.clientY,
            };
        });
        this.canvas.addEventListener("mouseup", () => {
            this.camera.dragging = false;
        });
        this.canvas.addEventListener("mouseleave", () => {
            this.camera.dragging = false;
        });
        this.canvas.addEventListener("mousemove", (e) => {
            if (!this.camera.dragging) return;

            const deltaX = -e.clientX + this.camera.lastMousePos.x;
            const deltaY = e.clientY - this.camera.lastMousePos.y;

            this.camera.rotation.y += deltaX * 0.01;
            this.camera.rotation.x += deltaY * 0.01;

            // Limit vertical rotation to avoid flipping
            this.camera.rotation.x = Math.max(
                -Math.PI / 2 + 0.001,
                Math.min(Math.PI / 2 - 0.001, this.camera.rotation.x)
            );

            this.camera.lastMousePos = {
                x: e.clientX,
                y: e.clientY,
            };

            this.updateCameraCallback();
        });

        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.camera.distance += e.deltaY * 0.01;
            // Limit zoom distance
            this.camera.distance = Math.max(2, Math.min(10, this.camera.distance));
            this.updateCameraCallback();
        });
    }
}

class LightController {
    constructor(updateLightingParamsCallback) {
        this.lightDirection = [0, 0, 0];
        this.updateLightingParamsCallback = updateLightingParamsCallback;
        this.initSliders();
    }

    initSliders() {
        this.lightXSlider = document.getElementById('lightX');
        this.lightYSlider = document.getElementById('lightY');
        this.lightZSlider = document.getElementById('lightZ');
        this.ambientStrengthSlider = document.getElementById('ambientStrength');
        this.specularStrengthSlider = document.getElementById('specularStrength');

        this.lightXSlider.addEventListener('input', this.updateLightingParamsCallback);
        this.lightYSlider.addEventListener('input', this.updateLightingParamsCallback);
        this.lightZSlider.addEventListener('input', this.updateLightingParamsCallback);
    }

    updateLightingParams() {
        this.lightDirection[0] = parseFloat(this.lightXSlider.value);
        this.lightDirection[1] = parseFloat(this.lightYSlider.value);
        this.lightDirection[2] = parseFloat(this.lightZSlider.value);
    }
}

class RotationController {
    constructor() {
        this.isRotating = false;
        this.lasttime = 0;
        this.offset = 0;
        this.initToggle();
    }

    initToggle() {
        const rotationToggle = document.getElementById('rotationToggle');
        rotationToggle.addEventListener('change', (e) => {
            this.isRotating = e.target.checked;
        });
    }

    getRotationMatrix(time) {
        if (this.isRotating) {
            this.lasttime = time - this.offset;
            return m4.yRotation(time - this.offset);
        } 
        this.offset = time - this.lasttime;
        return m4.yRotation(this.lasttime);
    }
}