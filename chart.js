var Chart = function (canvas) {
    var context = canvas.getContext('2d');
    var data = [];

    this.setData = function (powersByFrequency, curve) {
        for (var i = 0; i < END_EDIT_FREQUENCY; i += 1) {
            data[i] = [];
        }

        for (var frequency in powersByFrequency) {
            if (frequency < END_EDIT_FREQUENCY) {
                for (var i = 0; i < powersByFrequency[frequency].length; ++i) {
                    data[Math.floor(frequency)].push(powersByFrequency[frequency][i]);
                }
            }
        }

        for (var i = 0; i < data.length; i += 1) {
            data[i] = averageArray(data[i]) * CHART_SCALE;
        }

        this.draw(curve);
    };

    this.draw = function (curve) {
        context.fillStyle = CHART_BACKGROUND_COLOR;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = CHART_SECONDARY_COLOR;

        context.beginPath();
        context.moveTo(0, canvas.height);

        for (var i = 0; i < data.length; i += 1) {
            var x = (i / END_EDIT_FREQUENCY) * canvas.width;

            var power = data[i];
            context.lineTo(x + 0.5, canvas.height - power + 0.5); //left side of bar (also right side of previous bar)
            context.lineTo(x + canvas.width / END_EDIT_FREQUENCY + 0.5, canvas.height - power + 0.5);
        }

        context.lineTo(canvas.width, canvas.height);

        context.closePath();
        context.fill();


        context.fillStyle = CHART_PRIMARY_COLOR;

        context.beginPath();
        context.moveTo(0, canvas.height);

        for (var i = 0; i < data.length; i += 1) {
            var x = (i / END_EDIT_FREQUENCY) * canvas.width;

            var scale = (curve.evaluate(CURVE_CANVAS_WIDTH * i / END_EDIT_FREQUENCY) / CURVE_CANVAS_HEIGHT) * CURVE_SCALE;
            var power = data[i] * scale;

            context.lineTo(x + 0.5, canvas.height - power + 0.5); //left side of bar (also right side of previous bar)
            context.lineTo(x + canvas.width / END_EDIT_FREQUENCY + 0.5, canvas.height - power + 0.5);
        }

        context.lineTo(canvas.width, canvas.height);

        context.closePath();
        context.fill();


        context.beginPath();
        context.moveTo(0, canvas.height);

        for (var i = 0; i < data.length; i += 1) {
            var x = (i / END_EDIT_FREQUENCY) * canvas.width;

            var power = data[i];
            context.lineTo(x + 0.5, canvas.height - power + 0.5); //left side of bar (also right side of previous bar)
            context.lineTo(x + canvas.width / END_EDIT_FREQUENCY + 0.5, canvas.height - power + 0.5);
        }

        context.strokeStyle = CHART_SECONDARY_COLOR;
        context.stroke();

    };
};