"use strict";

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;

  varying vec3 v_normal;
  varying vec3 v_fragPos;
  varying vec4 v_color;

  void main() {
    gl_Position = u_projection * u_view * u_world * a_position;
    v_normal = mat3(u_world) * a_normal;
    v_fragPos = (u_world * a_position).xyz;
    v_color = a_color;
  }
  `;

  const fs = `
  precision mediump float;

  varying vec3 v_normal;
  varying vec3 v_fragPos;
  varying vec4 v_color;

  uniform vec4 u_diffuse;
  uniform vec3 u_lightDirection;
  uniform vec3 u_viewPosition;   // Camera position for specular calculation
  
  // Phong lighting parameters
  uniform vec3 u_ambientColor;
  uniform vec3 u_lightColor;
  uniform float u_ambientStrength;
  uniform float u_specularStrength;
  uniform float u_shininess;

  void main() {
    vec3 normal = normalize(v_normal);
    
    // Ambient
    vec3 ambient = u_ambientStrength * u_ambientColor;

    // Diffuse
    vec3 lightDir = normalize(-u_lightDirection);
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * u_lightColor;

    // Specular
    vec3 viewDir = normalize(u_viewPosition - v_fragPos);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
    vec3 specular = u_specularStrength * spec * u_lightColor;

    // Combine all components
    vec3 result = (ambient + diffuse + specular) * v_color.rgb * u_diffuse.rgb;
    gl_FragColor = vec4(result, u_diffuse.a);
  }
  `;

  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  // Ensure objectData is defined
  if (typeof objectData === "undefined") {
    console.error("objectData is not defined");
    return;
  }

  const obj = webglUtils.parseOBJ(objectData);
  console.log(obj);

  webglUtils.parseMTLData(mtlData, obj);
  console.log(obj);
  const parts = obj.geometries.map(({ data }) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: {
        u_diffuse: [1, 1, 1, 1],
      },
      bufferInfo,
    };
  });

  const extents = webglUtils.getGeometriesExtents(obj.geometries);
  console.log(extents);
  const range = m4.subtractVectors(extents.max, extents.min);
  // amount to move the object so its center is at the origin
  const objOffset = m4.scaleVector(
    m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
    -1
  );
  const cameraTarget = [0, 0, 0];
  let cameraPosition = [0, 0, 0];

  function updateCamera() {
    const x = camera.camera.distance * Math.sin(camera.camera.rotation.y) * Math.cos(camera.camera.rotation.x);
    const y = camera.camera.distance * Math.sin(camera.camera.rotation.x);
    const z = camera.camera.distance * Math.cos(camera.camera.rotation.y) * Math.cos(camera.camera.rotation.x);
    cameraPosition = m4.addVectors(cameraTarget, [x, y, z]);
  }

  const camera = new Camera(canvas, updateCamera);
  updateCamera();

  const lightController = new LightController(() => {
    lightController.updateLightingParams();
  });
  lightController.updateLightingParams();

  const rotationController = new RotationController();

  // Set zNear and zFar to something hopefully appropriate
  // for the size of this object.
  const zNear = camera.camera.distance / 100;
  const zFar = camera.camera.distance * 3;

  function render(time) {
    time *= 0.001; // convert to seconds
    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = (60 * Math.PI) / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const cameraMatrix = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(cameraMatrix);

    const sharedUniforms = {
      u_lightDirection: m4.normalize(lightController.lightDirection),
      u_view: view,
      u_projection: projection,
      u_viewPosition: cameraPosition,
      u_lightColor: [1, 1, 1],
      u_ambientColor: [0.5, 0.5, 0.5],
      u_ambientStrength: parseFloat(lightController.ambientStrengthSlider.value),
      u_specularStrength: parseFloat(lightController.specularStrengthSlider.value),
      u_shininess: 100,
    };

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.
    let u_world = rotationController.getRotationMatrix(time);
    u_world = m4.translate(u_world, ...objOffset);

    for (const { bufferInfo, material } of parts) {
      // calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
      webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
      // calls gl.uniform
      webglUtils.setUniforms(meshProgramInfo, {
        u_world,
        u_diffuse: material.u_diffuse,
      });
      // calls gl.drawArrays or gl.drawElements
      webglUtils.drawBufferInfo(gl, bufferInfo);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
