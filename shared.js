//all images by Trey Ratcliff
var IMAGE_URLS = [
    'images/fields.jpg',
    'images/desert.jpg',
    'images/milky.jpg',
    'images/valley.jpg',
];

var PING_TEXTURE_UNIT = 0,
    PONG_TEXTURE_UNIT = 1,
    FILTER_TEXTURE_UNIT = 2,
    ORIGINAL_SPECTRUM_TEXTURE_UNIT = 3,
    FILTERED_SPECTRUM_TEXTURE_UNIT = 4,
    IMAGE_TEXTURE_UNIT = 5,
    FILTERED_IMAGE_TEXTURE_UNIT = 6,
    READOUT_TEXTURE_UNIT = 7;

var RESOLUTION = 512;

var FORWARD = 0,
    INVERSE = 1;

var END_EDIT_FREQUENCY = 150.0;

var CHART_SCALE = 100000;

var CURVE_CANVAS_WIDTH = 720;
var CURVE_CANVAS_HEIGHT = 150.0;
var CURVE_SCALE = 2.0;

var CHART_BACKGROUND_COLOR = 'rgb(50, 50, 50)';

var CHART_PRIMARY_COLOR = 'rgb(150, 150, 150)';
var CHART_SECONDARY_COLOR = 'rgb(75, 75, 75)';

var log2 = function (x) {
    return Math.log(x) / Math.log(2);
};

var buildShader = function (gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    console.log(gl.getShaderInfoLog(shader));
    return shader;
};

var buildProgramWrapper = function (gl, vertexShader, fragmentShader, attributeLocations) {
    var programWrapper = {};

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    for (var attributeName in attributeLocations) {
        gl.bindAttribLocation(program, attributeLocations[attributeName], attributeName);
    }
    gl.linkProgram(program);
    var uniformLocations = {};
    var numberOfUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < numberOfUniforms; i += 1) {
        var activeUniform = gl.getActiveUniform(program, i),
            uniformLocation = gl.getUniformLocation(program, activeUniform.name);
        uniformLocations[activeUniform.name] = uniformLocation;
    }

    programWrapper.program = program;
    programWrapper.uniformLocations = uniformLocations;

    return programWrapper;
};

var buildTexture = function (gl, unit, format, type, width, height, data, wrapS, wrapT, minFilter, magFilter) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    return texture;
};

var buildFramebuffer = function (gl, attachment) {
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, attachment, 0);
    return framebuffer;
};

var getMousePosition = function (event, element) {
    var boundingRect = element.getBoundingClientRect();
    return {
        x: event.clientX - boundingRect.left,
        y: event.clientY - boundingRect.top
    };
};

var clamp = function (x, min, max) {
    return Math.min(Math.max(x, min), max);
};

var averageArray = function (array) {
    var sum = 0;
    for (var i = 0; i < array.length; i += 1) {
        sum += array[i];
    }
    return sum / array.length;
};

var hasWebGLSupportWithExtensions = function (extensions) {
    var canvas = document.createElement('canvas');
    var gl = null;
    try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) {
        return false;
    }
    if (gl === null) {
        return false;
    }

    for (var i = 0; i < extensions.length; ++i) {
        if (gl.getExtension(extensions[i]) === null) {
            return false
        }
    }

    return true;
};

var mod = function (x, n) { //positive modulo
    var m = x % n;
    return m < 0 ? m + n : m;
};