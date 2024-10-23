const materials = parseMTLData(mtlData);

function main() {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Updated vertex shader with lighting calculations
    const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aNormal;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vFragPos;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vFragPos = vec3(uModelViewMatrix * aVertexPosition);
        vNormal = mat3(uNormalMatrix) * aNormal;
    }
    `;

    // Updated fragment shader with Phong lighting
    const fsSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vFragPos;

    uniform vec3 uLightPos;
    uniform vec3 uViewPos;
    uniform vec4 uBaseColor;

    uniform float uAmbientStrength;
    uniform float uSpecularStrength;
    uniform float uShininess;

    void main(void) {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightPos - vFragPos);

        // Ambient - increased base ambient light
        vec3 ambient = uAmbientStrength * vec3(1.0, 1.0, 1.0);

        // Diffuse - modified to create more contrast
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * vec3(1.0, 1.0, 1.0);

        // Specular - adjusted for better highlights
        vec3 viewDir = normalize(uViewPos - vFragPos);
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0), uShininess);
        vec3 specular = uSpecularStrength * spec * vec3(1.0, 1.0, 1.0);

        // Final color calculation with increased contrast
        vec3 result = (ambient + diffuse + specular) * vec3(uBaseColor);
        
        // Optional: Add gamma correction for better contrast
        result = pow(result, vec3(1.0/1.5));
        
        gl_FragColor = vec4(result, uBaseColor.a);
    }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            normal: gl.getAttribLocation(shaderProgram, 'aNormal'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
            lightPos: gl.getUniformLocation(shaderProgram, 'uLightPos'),
            viewPos: gl.getUniformLocation(shaderProgram, 'uViewPos'),
            baseColor: gl.getUniformLocation(shaderProgram, 'uBaseColor'),
            ambientStrength: gl.getUniformLocation(shaderProgram, 'uAmbientStrength'),
            specularStrength: gl.getUniformLocation(shaderProgram, 'uSpecularStrength'),
            shininess: gl.getUniformLocation(shaderProgram, 'uShininess'),
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
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

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

        // Calculate light position based on camera rotation
        const lightPos = [
            5 * Math.cos(camera.rotation.x) * Math.cos(camera.rotation.y),
            5 * Math.sin(camera.rotation.x),
            5 * Math.cos(camera.rotation.x) * Math.sin(camera.rotation.y)
        ];

        // Draw the object with the correct material colors
        drawScene(gl, programInfo, buffers, projectionMatrix, modelViewMatrix, parsedData.materialIndices, materials, lightPos);
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
    const normals = [];
    const vertexIndices = [];
    const normalIndices = [];
    const materials = {};
    let currentMaterial = null;
    const materialIndices = [];

    const normalData = [];
    
    const lines = data.trim().split('\n');
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
            vertices.push(
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            );
        } else if (parts[0] === 'vn') {
            normalData.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            ]);
        } else if (parts[0] === 'f') {
            const faceVertices = parts.slice(1).map(f => {
                const indices = f.split('/');
                return {
                    vertex: parseInt(indices[0]) - 1,
                    normal: indices[2] ? parseInt(indices[2]) - 1 : null
                };
            });

            for (let i = 1; i < faceVertices.length - 1; i++) {
                vertexIndices.push(
                    faceVertices[0].vertex,
                    faceVertices[i].vertex,
                    faceVertices[i + 1].vertex
                );
                if (faceVertices[0].normal !== null) {
                    normalIndices.push(
                        faceVertices[0].normal,
                        faceVertices[i].normal,
                        faceVertices[i + 1].normal
                    );
                }
                materialIndices.push(currentMaterial);
            }
        } else if (parts[0] === 'usemtl') {
            currentMaterial = parts[1];
        }
    }

    // If no normals in file, calculate them
    if (normalData.length === 0) {
        // Calculate normals for each vertex
        for (let i = 0; i < vertexIndices.length; i += 3) {
            const i0 = vertexIndices[i] * 3;
            const i1 = vertexIndices[i + 1] * 3;
            const i2 = vertexIndices[i + 2] * 3;

            const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
            const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
            const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

            const vec1 = [
                v1[0] - v0[0],
                v1[1] - v0[1],
                v1[2] - v0[2]
            ];
            const vec2 = [
                v2[0] - v0[0],
                v2[1] - v0[1],
                v2[2] - v0[2]
            ];

            const normal = [
                vec1[1] * vec2[2] - vec1[2] * vec2[1],
                vec1[2] * vec2[0] - vec1[0] * vec2[2],
                vec1[0] * vec2[1] - vec1[1] * vec2[0]
            ];

            // Normalize
            const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;

            normals.push(...normal, ...normal, ...normal);
        }
    } else {
        // Use normals from file
        normalIndices.forEach(index => {
            normals.push(...normalData[index]);
        });
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(vertexIndices),
        normals: new Float32Array(normals),
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
    const { vertices, indices, normals } = parseOBJData(obj);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        normal: normalBuffer,
        indices: indexBuffer,
        vertexCount: indices.length
    };
}

function drawScene(gl, programInfo, buffers, projectionMatrix, modelViewMatrix, materialIndices, materials, lightPos) {
    // Light and material settings with adjusted values
    const lightSettings = {
        position: lightPos,
        ambientStrength: 0.3,    // Increased ambient light to see dark regions
        specularStrength: 1,   // Reduced specular to make it less shiny
        shininess: 16          // Adjusted shininess
    };

    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Enable face culling
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);  // Counter-clockwise winding

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set up vertex attributes
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

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(
        programInfo.attribLocations.normal,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.normal);

    gl.useProgram(programInfo.program);

    // Set matrices
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

    // Calculate and set normal matrix
    const normalMatrix = Matrix4.create();
    Matrix4.invert(normalMatrix, modelViewMatrix);
    Matrix4.transpose(normalMatrix, normalMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.normalMatrix,
        false,
        normalMatrix
    );

    // Set lighting uniforms
    gl.uniform3fv(programInfo.uniformLocations.lightPos, lightSettings.position);
    gl.uniform3fv(programInfo.uniformLocations.viewPos, [0, 0, 5]);
    gl.uniform1f(programInfo.uniformLocations.ambientStrength, lightSettings.ambientStrength);
    gl.uniform1f(programInfo.uniformLocations.specularStrength, lightSettings.specularStrength);
    gl.uniform1f(programInfo.uniformLocations.shininess, lightSettings.shininess);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Draw each face with its corresponding material color
    for (let i = 0; i < buffers.vertexCount; i += 3) {
        const material = materialIndices[i / 3];
        const color = materials[material].Kd.concat(1.0);
        gl.uniform4fv(programInfo.uniformLocations.baseColor, color);
        gl.drawElements(
            gl.TRIANGLES,
            3,
            gl.UNSIGNED_SHORT,
            i * 2
        );
    }
}

main();