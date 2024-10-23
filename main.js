const materials = parseMTLData(mtlData);

function main() {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    const vsSource = `
        attribute vec4 aVertexPosition;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
        void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        }
    `;

    const fsSource = `
        precision mediump float;
        uniform vec4 uColor;
        
        void main(void) {
            gl_FragColor = uColor;
        }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        },
    };

    const buffers = initBuffers(gl, objectData);
    
    // Camera state
    const camera = {
        rotation: { x: 0, y: 0 },
        distance: 5,
        dragging: false,
        lastMousePos: { x: 0, y: 0 }
    };

    // Mouse event handlers
    canvas.addEventListener('mousedown', (e) => {
        camera.dragging = true;
        camera.lastMousePos = {
            x: e.clientX,
            y: e.clientY
        };
    });

    canvas.addEventListener('mouseup', () => {
        camera.dragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        camera.dragging = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!camera.dragging) return;
        
        const deltaX = e.clientX - camera.lastMousePos.x;
        const deltaY = e.clientY - camera.lastMousePos.y;
        
        camera.rotation.y += deltaX * 0.01;
        camera.rotation.x += deltaY * 0.01;
        
        // Limit vertical rotation to avoid flipping
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
        
        camera.lastMousePos = {
            x: e.clientX,
            y: e.clientY
        };
    });

    // Zoom with mouse wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.distance += e.deltaY * 0.01;
        // Limit zoom distance
        camera.distance = Math.max(2, Math.min(10, camera.distance));
    });


    // Create projection matrix
    const fieldOfView = 45 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = Matrix4.create();
    Matrix4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Create model-view matrix and translate object back
    const modelViewMatrix = Matrix4.create();
    Matrix4.translate(modelViewMatrix, 0.0, 0.0, -5.0);
    const parsedData = parseOBJData(objectData);
    // Render loop
    function render() {
        // Create fresh model-view matrix
        const modelViewMatrix = Matrix4.create();
        
        // Apply camera transformations
        Matrix4.translate(modelViewMatrix, 0, 0, -camera.distance);
        Matrix4.rotateX(modelViewMatrix, camera.rotation.x);
        Matrix4.rotateY(modelViewMatrix, camera.rotation.y);

        // Draw the object with the correct material colors
        drawScene(gl, programInfo, buffers, projectionMatrix, modelViewMatrix, parsedData.materialIndices, materials);

        requestAnimationFrame(render);
    }

    render();
}

function parseMTLData(data) {
    const materials = {};
    let currentMaterial = null;

    const lines = data.trim().split('\n');
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'newmtl') {
            currentMaterial = parts[1];
            materials[currentMaterial] = {};
        } else if (parts[0] === 'Kd' && currentMaterial) {
            materials[currentMaterial].Kd = parts.slice(1).map(parseFloat);
        }
    }

    return materials;
}

function parseOBJData(data) {
    const vertices = [];
    const vertexIndices = [];
    const materials = {};
    let currentMaterial = null;
    const materialIndices = [];

    const lines = data.trim().split('\n');
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
            vertices.push(
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            );
        } else if (parts[0] === 'f') {
            const faceIndices = parts.slice(1).map(f => parseInt(f.split('/')[0]) - 1);
            for (let i = 1; i < faceIndices.length - 1; i++) {
                vertexIndices.push(
                    faceIndices[0],
                    faceIndices[i],
                    faceIndices[i + 1]
                );
                materialIndices.push(currentMaterial);
            }
        } else if (parts[0] === 'usemtl') {
            currentMaterial = parts[1];
        } else if (parts[0] === 'mtllib') {
            // Load MTL file here if needed
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(vertexIndices),
        materials: materials,
        materialIndices: materialIndices
    };
}


function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initBuffers(gl, obj) {
    const { vertices, indices } = parseOBJData(obj);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        indices: indexBuffer,
        vertexCount: indices.length
    };
}

function drawScene(gl, programInfo, buffers, projectionMatrix, modelViewMatrix, materialIndices, materials) {
    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix
    );
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Draw each face with its corresponding material color
    for (let i = 0; i < buffers.vertexCount; i += 3) {
        const material = materialIndices[i / 3];
        const color = materials[material].Kd.concat(1.0); // Add alpha value
        gl.uniform4fv(gl.getUniformLocation(programInfo.program, 'uColor'), color);
        gl.drawElements(
            gl.TRIANGLES,
            3,
            gl.UNSIGNED_SHORT,
            i * 2
        );
    }
}

main();