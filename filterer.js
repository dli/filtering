var FULLSCREEN_VERTEX_SOURCE = [
    'attribute vec2 a_position;',
    'varying vec2 v_coordinates;', //this might be phased out soon (no pun intended)
    'void main (void) {',
        'v_coordinates = a_position * 0.5 + 0.5;',
        'gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
].join('\n');

var SUBTRANSFORM_FRAGMENT_SOURCE = [
    'precision highp float;',

    'const float PI = 3.14159265;',

    'uniform sampler2D u_input;',

    'uniform float u_resolution;',
    'uniform float u_subtransformSize;',

    'uniform bool u_horizontal;',
    'uniform bool u_forward;',
    'uniform bool u_normalize;',

    'vec2 multiplyComplex (vec2 a, vec2 b) {',
        'return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);',
    '}',

    'void main (void) {',

        'float index = 0.0;',
        'if (u_horizontal) {',
            'index = gl_FragCoord.x - 0.5;',
        '} else {',
            'index = gl_FragCoord.y - 0.5;',
        '}',

        'float evenIndex = floor(index / u_subtransformSize) * (u_subtransformSize / 2.0) + mod(index, u_subtransformSize / 2.0);',
        
        'vec4 even = vec4(0.0), odd = vec4(0.0);',

        'if (u_horizontal) {',
            'even = texture2D(u_input, vec2(evenIndex + 0.5, gl_FragCoord.y) / u_resolution);',
            'odd = texture2D(u_input, vec2(evenIndex + u_resolution * 0.5 + 0.5, gl_FragCoord.y) / u_resolution);',
        '} else {',
            'even = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + 0.5) / u_resolution);',
            'odd = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + u_resolution * 0.5 + 0.5) / u_resolution);',
        '}',

        //normalisation
        'if (u_normalize) {',
            'even /= u_resolution * u_resolution;',
            'odd /= u_resolution * u_resolution;',
        '}',

        'float twiddleArgument = 0.0;',
        'if (u_forward) {',
            'twiddleArgument = 2.0 * PI * (index / u_subtransformSize);',
        '} else {',
            'twiddleArgument = -2.0 * PI * (index / u_subtransformSize);',
        '}',
        'vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));',

        'vec2 outputA = even.rg + multiplyComplex(twiddle, odd.rg);',
        'vec2 outputB = even.ba + multiplyComplex(twiddle, odd.ba);',

        'gl_FragColor = vec4(outputA, outputB);',

    '}'
].join('\n');

var FILTER_FRAGMENT_SOURCE = [
    'precision highp float;',

    'uniform sampler2D u_input;',
    'uniform float u_resolution;',

    'uniform float u_maxEditFrequency;',

    'uniform sampler2D u_filter;',

    'void main (void) {',
        'vec2 coordinates = gl_FragCoord.xy - 0.5;',
        'float xFrequency = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
        'float yFrequency = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',

        'float frequency = sqrt(xFrequency * xFrequency + yFrequency * yFrequency);',

        'float gain = texture2D(u_filter, vec2(frequency / u_maxEditFrequency, 0.5)).a;',
        'vec4 originalPower = texture2D(u_input, gl_FragCoord.xy / u_resolution);',

        'gl_FragColor = originalPower * gain;',

    '}',
].join('\n');

var POWER_FRAGMENT_SOURCE = [
    'precision highp float;',

    'varying vec2 v_coordinates;',

    'uniform sampler2D u_spectrum;',
    'uniform float u_resolution;',

    'vec2 multiplyByI (vec2 z) {',
        'return vec2(-z[1], z[0]);',
    '}',

    'vec2 conjugate (vec2 z) {',
        'return vec2(z[0], -z[1]);',
    '}',

    'vec4 encodeFloat (float v) {', //hack because WebGL cannot read back floats
        'vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;',
        'enc = fract(enc);',
        'enc -= enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);',
        'return enc;',
    '}',

    'void main (void) {',
        'vec2 coordinates = v_coordinates - 0.5;',

        'vec4 z = texture2D(u_spectrum, coordinates);',
        'vec4 zStar = texture2D(u_spectrum, 1.0 - coordinates + 1.0 / u_resolution);',
        'zStar = vec4(conjugate(zStar.xy), conjugate(zStar.zw));',

        'vec2 r = 0.5 * (z.xy + zStar.xy);',
        'vec2 g = -0.5 * multiplyByI(z.xy - zStar.xy);',
        'vec2 b = z.zw;',

        'float rPower = length(r);',
        'float gPower = length(g);',
        'float bPower = length(b);',

        'float averagePower = (rPower + gPower + bPower) / 3.0;',
        'gl_FragColor = encodeFloat(averagePower / (u_resolution * u_resolution));',
    '}',
].join('\n');

var IMAGE_FRAGMENT_SOURCE = [
    'precision highp float;',

    'varying vec2 v_coordinates;',

    'uniform float u_resolution;',

    'uniform sampler2D u_texture;',
    'uniform sampler2D u_spectrum;',

    'void main (void) {',
        'vec3 image = texture2D(u_texture, v_coordinates).rgb;',

        'gl_FragColor = vec4(image, 1.0);',
    '}',
].join('\n');

var Filterer = function (canvas) {
    var canvas = canvas;
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    canvas.width = RESOLUTION;
    canvas.height = RESOLUTION;

    gl.getExtension('OES_texture_float');
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    var imageTexture,
        pingTexture = buildTexture(gl, PING_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, RESOLUTION, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST),
        pongTexture = buildTexture(gl, PONG_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, RESOLUTION, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST),
        filterTexture = buildTexture(gl, FILTER_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, 1, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST),
        originalSpectrumTexture = buildTexture(gl, ORIGINAL_SPECTRUM_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, RESOLUTION, null, gl.REPEAT, gl.REPEAT, gl.NEAREST, gl.NEAREST),
        filteredSpectrumTexture = buildTexture(gl, FILTERED_SPECTRUM_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, RESOLUTION, null, gl.REPEAT, gl.REPEAT, gl.NEAREST, gl.NEAREST),
        filteredImageTexture = buildTexture(gl, FILTERED_IMAGE_TEXTURE_UNIT, gl.RGBA, gl.FLOAT, RESOLUTION, RESOLUTION, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST),
        readoutTexture = buildTexture(gl, READOUT_TEXTURE_UNIT, gl.RGBA, gl.UNSIGNED_BYTE, RESOLUTION, RESOLUTION, null, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.NEAREST, gl.NEAREST);

    var pingFramebuffer = buildFramebuffer(gl, pingTexture),
        pongFramebuffer = buildFramebuffer(gl, pongTexture),
        originalSpectrumFramebuffer = buildFramebuffer(gl, originalSpectrumTexture),
        filteredSpectrumFramebuffer = buildFramebuffer(gl, filteredSpectrumTexture),
        filteredImageFramebuffer = buildFramebuffer(gl, filteredImageTexture),
        readoutFramebuffer = buildFramebuffer(gl, readoutTexture);

    var fullscreenVertexShader = buildShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SOURCE);

    var subtransformProgramWrapper = buildProgramWrapper(gl, 
        fullscreenVertexShader,
        buildShader(gl, gl.FRAGMENT_SHADER, SUBTRANSFORM_FRAGMENT_SOURCE), {
        'a_position': 0
    });
    gl.useProgram(subtransformProgramWrapper.program);
    gl.uniform1f(subtransformProgramWrapper.uniformLocations['u_resolution'], RESOLUTION);

    var readoutProgram = buildProgramWrapper(gl, 
        fullscreenVertexShader,
        buildShader(gl, gl.FRAGMENT_SHADER, POWER_FRAGMENT_SOURCE), {
        'a_position': 0
    });
    gl.useProgram(readoutProgram.program);
    gl.uniform1i(readoutProgram.uniformLocations['u_spectrum'], ORIGINAL_SPECTRUM_TEXTURE_UNIT);
    gl.uniform1f(readoutProgram.uniformLocations['u_resolution'], RESOLUTION);

    var imageProgram = buildProgramWrapper(gl, 
        fullscreenVertexShader,
        buildShader(gl, gl.FRAGMENT_SHADER, IMAGE_FRAGMENT_SOURCE), {
        'a_position': 0
    });
    gl.useProgram(imageProgram.program);
    gl.uniform1i(imageProgram.uniformLocations['u_texture'], FILTERED_IMAGE_TEXTURE_UNIT);

    var filterProgram = buildProgramWrapper(gl, 
        fullscreenVertexShader,
        buildShader(gl, gl.FRAGMENT_SHADER, FILTER_FRAGMENT_SOURCE), {
        'a_position': 0
    });
    gl.useProgram(filterProgram.program);
    gl.uniform1i(filterProgram.uniformLocations['u_input'], ORIGINAL_SPECTRUM_TEXTURE_UNIT);
    gl.uniform1i(filterProgram.uniformLocations['u_filter'], FILTER_TEXTURE_UNIT);
    gl.uniform1f(filterProgram.uniformLocations['u_resolution'], RESOLUTION);
    gl.uniform1f(filterProgram.uniformLocations['u_maxEditFrequency'], END_EDIT_FREQUENCY);

    var fullscreenVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    var iterations = log2(RESOLUTION) * 2;

    var fft = function (inputTextureUnit, outputFramebuffer, width, height, direction) {
        gl.useProgram(subtransformProgramWrapper.program);
        gl.viewport(0, 0, RESOLUTION, RESOLUTION);
        gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_horizontal'], 1);
        gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_forward'], direction === FORWARD ? 1 : 0);
        for (var i = 0; i < iterations; i += 1) {
            if (i === 0) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, pingFramebuffer);
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_input'], inputTextureUnit);
            } else if (i === iterations - 1) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_input'], PING_TEXTURE_UNIT);
            } else if (i % 2 === 1) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, pongFramebuffer);
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_input'], PING_TEXTURE_UNIT);
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, pingFramebuffer);
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_input'], PONG_TEXTURE_UNIT);
            }

            if (direction === INVERSE && i === 0) {
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_normalize'], 1);
            } else if (direction === INVERSE && i === 1) {
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_normalize'], 0);
            }

            if (i === iterations / 2) {
                gl.uniform1i(subtransformProgramWrapper.uniformLocations['u_horizontal'], 0);
            }

            gl.uniform1f(subtransformProgramWrapper.uniformLocations['u_subtransformSize'], Math.pow(2, (i % (iterations / 2)) + 1));
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    };

    this.setImage = function (image) {
        gl.activeTexture(gl.TEXTURE0 + IMAGE_TEXTURE_UNIT);
        imageTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.activeTexture(gl.TEXTURE0 + ORIGINAL_SPECTRUM_TEXTURE_UNIT);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RESOLUTION, RESOLUTION, 0, gl.RGBA, gl.FLOAT, null);

        fft(IMAGE_TEXTURE_UNIT, originalSpectrumFramebuffer, RESOLUTION, RESOLUTION, FORWARD);

        output();

        gl.viewport(0, 0, RESOLUTION, RESOLUTION);

        gl.bindFramebuffer(gl.FRAMEBUFFER, readoutFramebuffer);
        gl.useProgram(readoutProgram.program);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        var pixels = new Uint8Array(RESOLUTION * RESOLUTION * 4);
        gl.readPixels(0, 0, RESOLUTION, RESOLUTION, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        var powersByFrequency = {};

        var pixelIndex = 0;
        for (var yIndex = 0; yIndex < RESOLUTION; yIndex += 1) {
           for (var xIndex = 0; xIndex < RESOLUTION; xIndex += 1) {
                var x = xIndex - RESOLUTION / 2,
                    y = yIndex - RESOLUTION / 2;

                var r = pixels[pixelIndex] / 255,
                    g = pixels[pixelIndex + 1] / 255,
                    b = pixels[pixelIndex + 2] / 255,
                    a = pixels[pixelIndex + 3] / 255;

                var average = r + g / 255 + b / 65025 + a / 160581375; //unpack float from rgb

                var frequency = Math.sqrt(x * x + y * y);

                if (powersByFrequency[frequency] === undefined) {
                    powersByFrequency[frequency] = [];
                }
                powersByFrequency[frequency].push(average);

                pixelIndex += 4;
            }
        }

        return powersByFrequency;
    };

    this.filter = function (filterArray) {
        gl.activeTexture(gl.TEXTURE0 + FILTER_TEXTURE_UNIT);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, filterArray.length, 1, 0, gl.ALPHA, gl.FLOAT, filterArray);

        gl.useProgram(filterProgram.program);

        gl.bindFramebuffer(gl.FRAMEBUFFER, filteredSpectrumFramebuffer);
        gl.viewport(0, 0, RESOLUTION, RESOLUTION);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        fft(FILTERED_SPECTRUM_TEXTURE_UNIT, filteredImageFramebuffer, RESOLUTION, RESOLUTION, INVERSE);

        output();
    };

    var output = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(0, 0, RESOLUTION, RESOLUTION);
        gl.useProgram(imageProgram.program);
        gl.uniform1f(imageProgram.uniformLocations['u_resolution'], RESOLUTION);
        gl.uniform1i(imageProgram.uniformLocations['u_texture'], FILTERED_IMAGE_TEXTURE_UNIT);
        gl.uniform1i(imageProgram.uniformLocations['u_spectrum'], FILTERED_SPECTRUM_TEXTURE_UNIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
};