const Matrix4 = {
    create: function() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },
    
    perspective: function(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) * nf;
        out[11] = -1;
        
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * far * near) * nf;
        out[15] = 0;
    },

    translate: function(out, x, y, z) {
        out[12] += out[0] * x + out[4] * y + out[8] * z;
        out[13] += out[1] * x + out[5] * y + out[9] * z;
        out[14] += out[2] * x + out[6] * y + out[10] * z;
        out[15] += out[3] * x + out[7] * y + out[11] * z;
    },

    rotateX: function(out, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a10 = out[4];
        const a11 = out[5];
        const a12 = out[6];
        const a13 = out[7];
        const a20 = out[8];
        const a21 = out[9];
        const a22 = out[10];
        const a23 = out[11];

        out[4] = a10 * c + a20 * s;
        out[5] = a11 * c + a21 * s;
        out[6] = a12 * c + a22 * s;
        out[7] = a13 * c + a23 * s;
        out[8] = a20 * c - a10 * s;
        out[9] = a21 * c - a11 * s;
        out[10] = a22 * c - a12 * s;
        out[11] = a23 * c - a13 * s;
    },

    rotateY: function(out, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = out[0];
        const a01 = out[1];
        const a02 = out[2];
        const a03 = out[3];
        const a20 = out[8];
        const a21 = out[9];
        const a22 = out[10];
        const a23 = out[11];

        out[0] = a00 * c - a20 * s;
        out[1] = a01 * c - a21 * s;
        out[2] = a02 * c - a22 * s;
        out[3] = a03 * c - a23 * s;
        out[8] = a00 * s + a20 * c;
        out[9] = a01 * s + a21 * c;
        out[10] = a02 * s + a22 * c;
        out[11] = a03 * s + a23 * c;
    }
};
