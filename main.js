var main = function () {
    var currentImageIndex = 0;
    var images = [];

    var curve = new Curve(document.getElementById('editor'), {
        pointSize: 6,
        pointColor: 'white',
        selectionRadius: 20,
        addDistance: 20,
        overPointCursor: 'move',
        overCurveCursor: 'crosshair',
        defaultCursor: 'default',
        curveColor: 'white',
        backgroundColor: 'rgb(50, 50, 50)',
        minSpacing: 5
    });

    curve.add(200, 75);

    var chart = new Chart(document.getElementById('chart'));

    var filterer = new Filterer(document.getElementById('filterer'));

    curve.addChangeListener(function () {
        var filterArray = new Float32Array(CURVE_CANVAS_WIDTH);

        curve.iterate(0, CURVE_CANVAS_WIDTH - 1, 1, function (x, y) {
            filterArray[x] = Math.max(0.0, y / CURVE_CANVAS_HEIGHT * CURVE_SCALE);
        });

        chart.draw(curve);

        filterer.filter(filterArray);
    });
    curve.triggerChangeListeners();

    var imagesLoaded = 0;
    for (var i = 0; i < IMAGE_URLS.length; ++i) {
        var image = new Image();
        image.onload = function () {
            imagesLoaded += 1;
            if (imagesLoaded === IMAGE_URLS.length) { //all images have been loaded
                var powersByFrequency = filterer.setImage(images[0]);
                chart.setData(powersByFrequency, curve);
                curve.triggerChangeListeners();
            }
        };
        image.src = IMAGE_URLS[i];

        images[i] = image;
    }

    document.getElementById('next').onclick = function () {
        currentImageIndex = mod(currentImageIndex + 1, images.length);
        var powersByFrequency = filterer.setImage(images[currentImageIndex]);
        chart.setData(powersByFrequency, curve);
        curve.triggerChangeListeners();
    };

    document.getElementById('previous').onclick = function () {
        currentImageIndex = mod(currentImageIndex - 1, images.length);
        var powersByFrequency = filterer.setImage(images[currentImageIndex]);
        chart.setData(powersByFrequency, curve);
        curve.triggerChangeListeners();
    };

    document.getElementById('gaussian').onclick = function () {
        curve.setPoints([
            [11, 76],
            [56, 73],
            [187, 17],
            [314, 0]
        ]);
    };

    document.getElementById('sharpen').onclick = function () {
        curve.setPoints([
            [173, 74],
            [252, 79],
            [416, 134],
            [521, 142] 
        ]);
    };

    document.getElementById('edges').onclick = function () {
        curve.setPoints([
            [9, 0],
            [41, 2],
            [411, 122],
            [675, 150]
        ]);
    };

};

if (hasWebGLSupportWithExtensions(['OES_texture_float'])) {
    main();
} else {
    document.getElementById('columns').style.display = 'none';
    document.getElementById('unsupported').style.display = 'inline-block';
}