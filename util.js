class webglUtils {
  static defaultShaderType = ["VERTEX_SHADER", "FRAGMENT_SHADER"];

  static createAttributeSetters(gl, program) {
    const attribSetters = {};

    function createAttribSetter(index) {
      return function (b) {
        if (b.value) {
          gl.disableVertexAttribArray(index);
          switch (b.value.length) {
            case 4:
              gl.vertexAttrib4fv(index, b.value);
              break;
            case 3:
              gl.vertexAttrib3fv(index, b.value);
              break;
            case 2:
              gl.vertexAttrib2fv(index, b.value);
              break;
            case 1:
              gl.vertexAttrib1fv(index, b.value);
              break;
            default:
              throw new Error(
                "the length of a float constant value must be between 1 and 4!"
              );
          }
        } else {
          gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
          gl.enableVertexAttribArray(index);
          gl.vertexAttribPointer(
            index,
            b.numComponents || b.size,
            b.type || gl.FLOAT,
            b.normalize || false,
            b.stride || 0,
            b.offset || 0
          );
        }
      };
    }

    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let ii = 0; ii < numAttribs; ++ii) {
      const attribInfo = gl.getActiveAttrib(program, ii);
      if (!attribInfo) {
        break;
      }
      const index = gl.getAttribLocation(program, attribInfo.name);
      attribSetters[attribInfo.name] = createAttribSetter(index);
    }

    return attribSetters;
  }

  static createUniformSetters(gl, program) {
    let textureUnit = 0;

    /**
     * Creates a setter for a uniform of the given program with it's
     * location embedded in the setter.
     * @param {WebGLProgram} program
     * @param {WebGLUniformInfo} uniformInfo
     * @returns {function} the created setter.
     */
    function createUniformSetter(program, uniformInfo) {
      const location = gl.getUniformLocation(program, uniformInfo.name);
      const type = uniformInfo.type;
      // Check if this uniform is an array
      const isArray =
        uniformInfo.size > 1 && uniformInfo.name.substr(-3) === "[0]";
      if (type === gl.FLOAT && isArray) {
        return function (v) {
          gl.uniform1fv(location, v);
        };
      }
      if (type === gl.FLOAT) {
        return function (v) {
          gl.uniform1f(location, v);
        };
      }
      if (type === gl.FLOAT_VEC2) {
        return function (v) {
          gl.uniform2fv(location, v);
        };
      }
      if (type === gl.FLOAT_VEC3) {
        return function (v) {
          gl.uniform3fv(location, v);
        };
      }
      if (type === gl.FLOAT_VEC4) {
        return function (v) {
          gl.uniform4fv(location, v);
        };
      }
      if (type === gl.INT && isArray) {
        return function (v) {
          gl.uniform1iv(location, v);
        };
      }
      if (type === gl.INT) {
        return function (v) {
          gl.uniform1i(location, v);
        };
      }
      if (type === gl.INT_VEC2) {
        return function (v) {
          gl.uniform2iv(location, v);
        };
      }
      if (type === gl.INT_VEC3) {
        return function (v) {
          gl.uniform3iv(location, v);
        };
      }
      if (type === gl.INT_VEC4) {
        return function (v) {
          gl.uniform4iv(location, v);
        };
      }
      if (type === gl.BOOL) {
        return function (v) {
          gl.uniform1iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC2) {
        return function (v) {
          gl.uniform2iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC3) {
        return function (v) {
          gl.uniform3iv(location, v);
        };
      }
      if (type === gl.BOOL_VEC4) {
        return function (v) {
          gl.uniform4iv(location, v);
        };
      }
      if (type === gl.FLOAT_MAT2) {
        return function (v) {
          gl.uniformMatrix2fv(location, false, v);
        };
      }
      if (type === gl.FLOAT_MAT3) {
        return function (v) {
          gl.uniformMatrix3fv(location, false, v);
        };
      }
      if (type === gl.FLOAT_MAT4) {
        return function (v) {
          gl.uniformMatrix4fv(location, false, v);
        };
      }
      if ((type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) && isArray) {
        const units = [];
        for (let ii = 0; ii < info.size; ++ii) {
          units.push(textureUnit++);
        }
        return (function (bindPoint, units) {
          return function (textures) {
            gl.uniform1iv(location, units);
            textures.forEach(function (texture, index) {
              gl.activeTexture(gl.TEXTURE0 + units[index]);
              gl.bindTexture(bindPoint, texture);
            });
          };
        })(getBindPointForSamplerType(gl, type), units);
      }
      if (type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) {
        return (function (bindPoint, unit) {
          return function (texture) {
            gl.uniform1i(location, unit);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(bindPoint, texture);
          };
        })(getBindPointForSamplerType(gl, type), textureUnit++);
      }
      throw "unknown type: 0x" + type.toString(16); // we should never get here.
    }

    const uniformSetters = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (let ii = 0; ii < numUniforms; ++ii) {
      const uniformInfo = gl.getActiveUniform(program, ii);
      if (!uniformInfo) {
        break;
      }
      let name = uniformInfo.name;
      // remove the array suffix.
      if (name.substr(-3) === "[0]") {
        name = name.substr(0, name.length - 3);
      }
      const setter = createUniformSetter(program, uniformInfo);
      uniformSetters[name] = setter;
    }
    return uniformSetters;
  }

  static createProgram(
    gl,
    shaders,
    opt_attribs,
    opt_locations,
    opt_errorCallback
  ) {
    const errFn = opt_errorCallback || this.error;
    const program = gl.createProgram();
    shaders.forEach(function (shader) {
      gl.attachShader(program, shader);
    });
    if (opt_attribs) {
      opt_attribs.forEach(function (attrib, ndx) {
        gl.bindAttribLocation(
          program,
          opt_locations ? opt_locations[ndx] : ndx,
          attrib
        );
      });
    }
    gl.linkProgram(program);

    // Check the link status
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
      // something went wrong with the link
      const lastError = gl.getProgramInfoLog(program);
      errFn("Error in program linking:" + lastError);

      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  static createProgramFromSources(
    gl,
    shaderSources,
    opt_attribs,
    opt_locations,
    opt_errorCallback
  ) {
    const shaders = [];
    for (let ii = 0; ii < shaderSources.length; ++ii) {
      shaders.push(
        this.loadShader(
          gl,
          shaderSources[ii],
          gl[this.defaultShaderType[ii]],
          opt_errorCallback
        )
      );
    }
    return this.createProgram(
      gl,
      shaders,
      opt_attribs,
      opt_locations,
      opt_errorCallback
    );
  }

  static createProgramInfo(
    gl,
    shaderSources,
    opt_attribs,
    opt_locations,
    opt_errorCallback
  ) {
    shaderSources = shaderSources.map(function (source) {
      const script = document.getElementById(source);
      return script ? script.text : source;
    });
    const program = this.createProgramFromSources(
      gl,
      shaderSources,
      opt_attribs,
      opt_locations,
      opt_errorCallback
    );
    if (!program) {
      return null;
    }
    const uniformSetters = this.createUniformSetters(gl, program);
    const attribSetters = this.createAttributeSetters(gl, program);
    return {
      program: program,
      uniformSetters: uniformSetters,
      attribSetters: attribSetters,
    };
  }

  static createBufferFromTypedArray(gl, array, type, drawType) {
    type = type || gl.ARRAY_BUFFER;
    const buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, array, drawType || gl.STATIC_DRAW);
    return buffer;
  }

  static allButIndices(name) {
    return name !== "indices";
  }

  static createMapping(obj) {
    const mapping = {};
    Object.keys(obj)
      .filter(this.allButIndices)
      .forEach(function (key) {
        mapping["a_" + key] = key;
      });
    return mapping;
  }

  static isArrayBuffer(a) {
    return a.buffer && a.buffer instanceof ArrayBuffer;
  }

  static guessNumComponentsFromName(name, length) {
    let numComponents;
    if (name.indexOf("coord") >= 0) {
      numComponents = 2;
    } else if (name.indexOf("color") >= 0) {
      numComponents = 4;
    } else {
      numComponents = 3; // position, normals, indices ...
    }

    if (length % numComponents > 0) {
      throw "can not guess numComponents. You should specify it.";
    }

    return numComponents;
  }

  static makeTypedArray(array, name) {
    if (this.isArrayBuffer(array)) {
      return array;
    }

    if (array.data && this.isArrayBuffer(array.data)) {
      return array.data;
    }

    if (Array.isArray(array)) {
      array = {
        data: array,
      };
    }

    if (!array.numComponents) {
      array.numComponents = this.guessNumComponentsFromName(name, array.length);
    }

    let type = array.type;
    if (!type) {
      if (name === "indices") {
        type = Uint16Array;
      }
    }
    const typedArray = this.createAugmentedTypedArray(
      array.numComponents,
      (array.data.length / array.numComponents) | 0,
      type
    );
    typedArray.push(array.data);
    return typedArray;
  }

  static createAugmentedTypedArray(numComponents, numElements, opt_type) {
    const Type = opt_type || Float32Array;
    return this.augmentTypedArray(
      new Type(numComponents * numElements),
      numComponents
    );
  }

  static augmentTypedArray(typedArray, numComponents) {
    let cursor = 0;
    typedArray.push = function () {
      for (let ii = 0; ii < arguments.length; ++ii) {
        const value = arguments[ii];
        if (
          value instanceof Array ||
          (value.buffer && value.buffer instanceof ArrayBuffer)
        ) {
          for (let jj = 0; jj < value.length; ++jj) {
            typedArray[cursor++] = value[jj];
          }
        } else {
          typedArray[cursor++] = value;
        }
      }
    };
    typedArray.reset = function (opt_index) {
      cursor = opt_index || 0;
    };
    typedArray.numComponents = numComponents;
    Object.defineProperty(typedArray, "numElements", {
      get: function () {
        return (this.length / this.numComponents) | 0;
      },
    });
    return typedArray;
  }

  static getGLTypeForTypedArray(gl, typedArray) {
    if (typedArray instanceof Int8Array) {
      return gl.BYTE;
    } // eslint-disable-line
    if (typedArray instanceof Uint8Array) {
      return gl.UNSIGNED_BYTE;
    } // eslint-disable-line
    if (typedArray instanceof Int16Array) {
      return gl.SHORT;
    } // eslint-disable-line
    if (typedArray instanceof Uint16Array) {
      return gl.UNSIGNED_SHORT;
    } // eslint-disable-line
    if (typedArray instanceof Int32Array) {
      return gl.INT;
    } // eslint-disable-line
    if (typedArray instanceof Uint32Array) {
      return gl.UNSIGNED_INT;
    } // eslint-disable-line
    if (typedArray instanceof Float32Array) {
      return gl.FLOAT;
    } // eslint-disable-line
    throw "unsupported typed array type";
  }

  static createAttribsFromArrays(gl, arrays, opt_mapping) {
    const mapping = opt_mapping || this.createMapping(arrays);
    const attribs = {};
    Object.keys(mapping).forEach(function (attribName) {
      const bufferName = mapping[attribName];
      const origArray = arrays[bufferName];
      if (origArray.value) {
        attribs[attribName] = {
          value: origArray.value,
        };
      } else {
        const array = webglUtils.makeTypedArray(origArray, bufferName);
        attribs[attribName] = {
          buffer: webglUtils.createBufferFromTypedArray(gl, array),
          numComponents:
            origArray.numComponents ||
            array.numComponents ||
            webglUtils.guessNumComponentsFromName(bufferName),
          type: webglUtils.getGLTypeForTypedArray(gl, array),
          normalize: webglUtils.getNormalizationForTypedArray(array),
        };
      }
    });
    return attribs;
  }

  static createBufferInfoFromArrays(gl, arrays, opt_mapping) {
    const bufferInfo = {
      attribs: this.createAttribsFromArrays(gl, arrays, opt_mapping),
    };
    let indices = arrays.indices;
    if (indices) {
      indices = this.makeTypedArray(indices, "indices");
      bufferInfo.indices = this.createBufferFromTypedArray(
        gl,
        indices,
        gl.ELEMENT_ARRAY_BUFFER
      );
      bufferInfo.numElements = indices.length;
    } else {
      bufferInfo.numElements = this.getNumElementsFromNonIndexedArrays(arrays);
    }

    return bufferInfo;
  }

  static positionKeys = ["position", "positions", "a_position"];

  static getArray(array) {
    return array.length ? array : array.data;
  }

  static getNumComponents(array, arrayName) {
    return (
      array.numComponents ||
      array.size ||
      this.guessNumComponentsFromName(arrayName, this.getArray(array).length)
    );
  }

  static getNumElementsFromNonIndexedArrays(arrays) {
    let key;
    for (const k of this.positionKeys) {
      if (k in arrays) {
        key = k;
        break;
      }
    }
    key = key || Object.keys(arrays)[0];
    const array = arrays[key];
    const length = array.length;
    const numComponents = this.getNumComponents(array, key);
    const numElements = length / numComponents;
    if (length % numComponents > 0) {
      throw new Error(
        `numComponents ${numComponents} not correct for length ${length}`
      );
    }
    return numElements;
  }

  static drawBufferInfo(gl, bufferInfo, primitiveType, count, offset) {
    const indices = bufferInfo.indices;
    primitiveType = primitiveType === undefined ? gl.TRIANGLES : primitiveType;
    const numElements = count === undefined ? bufferInfo.numElements : count;
    offset = offset === undefined ? 0 : offset;
    if (indices) {
      gl.drawElements(primitiveType, numElements, gl.UNSIGNED_SHORT, offset);
    } else {
      gl.drawArrays(primitiveType, offset, numElements);
    }
  }

  static setAttributes(setters, attribs) {
    setters = setters.attribSetters || setters;
    Object.keys(attribs).forEach(function (name) {
      const setter = setters[name];
      if (setter) {
        setter(attribs[name]);
      }
    });
  }

  static setBuffersAndAttributes(gl, setters, buffers) {
    this.setAttributes(setters, buffers.attribs);
    if (buffers.indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    }
  }

  static resizeCanvasToDisplaySize(canvas, multiplier) {
    multiplier = multiplier || 1;
    const width = (canvas.clientWidth * multiplier) | 0;
    const height = (canvas.clientHeight * multiplier) | 0;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  static setUniforms(setters, ...values) {
    setters = setters.uniformSetters || setters;
    for (const uniforms of values) {
      Object.keys(uniforms).forEach(function (name) {
        const setter = setters[name];
        if (setter) {
          setter(uniforms[name]);
        }
      });
    }
  }

  static loadShader(gl, shaderSource, shaderType, opt_errorCallback) {
    const errFn = opt_errorCallback || this.error;
    // Create the shader object
    const shader = gl.createShader(shaderType);

    // Load the shader source
    gl.shaderSource(shader, shaderSource);

    // Compile the shader
    gl.compileShader(shader);

    // Check the compile status
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      const lastError = gl.getShaderInfoLog(shader);
      errFn(
        "*** Error compiling shader '" +
          shader +
          "':" +
          lastError +
          `\n` +
          shaderSource
            .split("\n")
            .map((l, i) => `${i + 1}: ${l}`)
            .join("\n")
      );
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  static getNormalizationForTypedArray(typedArray) {
    if (typedArray instanceof Int8Array) {
      return true;
    } // eslint-disable-line
    if (typedArray instanceof Uint8Array) {
      return true;
    } // eslint-disable-line
    return false;
  }

  static error(msg) {
    console.error(msg);
  }

  static parseMTLData(data, obj) {
    console.log(data);
    const materials = {};
    let currentMaterial = null;
  
    const lines = data.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === "newmtl") {
        currentMaterial = parts[1];
        materials[currentMaterial] = {};
      } else if (parts[0] === "Kd" && currentMaterial) {
        materials[currentMaterial].Kd = parts.slice(1).map(parseFloat);
        // materials[currentMaterial].Kd = [1, ...temp]
      }
    }
    console.log(materials);
  
    console.log(obj);
    obj.geometries.forEach((geometry) => {
      console.log(geometry);
      // geometry.data.color = materials[geometry.material].Kd;
      let temp = [];
      for (let i = 0; i < geometry.data.normal.length / 3; i++) {
        temp.push(...materials[geometry.material].Kd);
      }
      geometry.data.color = temp;
    });
  
    return obj;
  }
  
  static parseOBJ(text) {
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
    const objColors = [[0, 0, 0]];
  
    // same order as `f` indices
    const objVertexData = [objPositions, objTexcoords, objNormals, objColors];
  
    // same order as `f` indices
    let webglVertexData = [
      [], // positions
      [], // texcoords
      [], // normals
      [], // colors
    ];
  
    const materialLibs = [];
    const geometries = [];
    let geometry;
    let groups = ["default"];
    let material = "default";
    let object = "default";
  
    const noop = () => {};
  
    function newGeometry() {
      // If there is an existing geometry and it's
      // not empty then start a new one.
      if (geometry && geometry.data.position.length) {
        geometry = undefined;
      }
    }
  
    function setGeometry() {
      if (!geometry) {
        const position = [];
        const texcoord = [];
        const normal = [];
        const color = [];
        webglVertexData = [position, texcoord, normal, color];
        geometry = {
          object,
          groups,
          material,
          data: {
            position,
            texcoord,
            normal,
            color,
          },
        };
        geometries.push(geometry);
      }
    }
  
    function addVertex(vert) {
      const ptn = vert.split("/");
      ptn.forEach((objIndexStr, i) => {
        if (!objIndexStr) {
          return;
        }
        const objIndex = parseInt(objIndexStr);
        const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
        webglVertexData[i].push(...objVertexData[i][index]);
        // if this is the position index (index 0) and we parsed
        // vertex colors then copy the vertex colors to the webgl vertex color data
        if (i === 0 && objColors.length > 1) {
          geometry.data.color.push(...objColors[index]);
        }
      });
    }
  
    const keywords = {
      v(parts) {
        // if there are more than 3 values here they are vertex colors
        if (parts.length > 3) {
          objPositions.push(parts.slice(0, 3).map(parseFloat));
          objColors.push(parts.slice(3).map(parseFloat));
        } else {
          objPositions.push(parts.map(parseFloat));
        }
      },
      vn(parts) {
        objNormals.push(parts.map(parseFloat));
      },
      vt(parts) {
        // should check for missing v and extra w?
        objTexcoords.push(parts.map(parseFloat));
      },
      f(parts) {
        setGeometry();
        const numTriangles = parts.length - 2;
        for (let tri = 0; tri < numTriangles; ++tri) {
          addVertex(parts[0]);
          addVertex(parts[tri + 1]);
          addVertex(parts[tri + 2]);
        }
      },
      s: noop, // smoothing group
      mtllib(parts, unparsedArgs) {
        // the spec says there can be multiple filenames here
        // but many exist with spaces in a single filename
        materialLibs.push(unparsedArgs);
      },
      usemtl(parts, unparsedArgs) {
        material = unparsedArgs;
        newGeometry();
      },
      g(parts) {
        groups = parts;
        newGeometry();
      },
      o(parts, unparsedArgs) {
        object = unparsedArgs;
        newGeometry();
      },
    };
  
    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split("\n");
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
      const line = lines[lineNo].trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const m = keywordRE.exec(line);
      if (!m) {
        continue;
      }
      const [, keyword, unparsedArgs] = m;
      const parts = line.split(/\s+/).slice(1);
      const handler = keywords[keyword];
      if (!handler) {
        console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
        continue;
      }
      handler(parts, unparsedArgs);
    }
  
    // remove any arrays that have no entries.
    for (const geometry of geometries) {
      geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0)
      );
    }
  
    return {
      geometries,
      materialLibs,
    };
  }

  static getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return { min, max };
  }

  static getGeometriesExtents(geometries) {
    return geometries.reduce(
      ({ min, max }, { data }) => {
        const minMax = this.getExtents(data.position);
        return {
          min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
          max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
        };
      },
      {
        min: Array(3).fill(Number.POSITIVE_INFINITY),
        max: Array(3).fill(Number.NEGATIVE_INFINITY),
      }
    );
  }
}
