var Curve = function (canvas, options) {
    var canvas = canvas,
        context = canvas.getContext('2d');

    var width = canvas.width,
        height = canvas.height;

    var activePoint = null,
        draggingPoint = null;

    var pointColor = options.pointColor,
        pointSize = options.pointSize,
        resolution = options.resolution,
        curveWidth = options.curveWidth,
        curveColor = options.curveColor,
        selectionRadius = options.selectionRadius,
        addDistance = options.addDistance,
        backgroundColor = options.backgroundColor,

        overPointCursor = options.overPointCursor,
        overCurveCursor = options.overCurveCursor,
        defaultCursor = options.defaultCursor,

        minSpacing = options.minSpacing;

    var head = null,
        tail = null,
        length = 0;

    var changeListeners = [];

    //recomputes correct second derivatives for all points
    var recompute = function () {
        var n = length;

        var x = [],
            y = [];
        iteratePoints(function (point) {
            x.push(point.x);
            y.push(point.y);
        });

        var a = [],
            b = [],
            c = [],
            d = [];

        //second derivatives of endpoints = 0
        a[0] = 0.0;
        b[0] = 1.0;
        c[0] = 0.0;
        d[0] = 0.0;
        a[n - 1] = 0.0;
        b[n - 1] = 1.0;
        c[n - 1] = 0.0;
        d[n - 1] = 0.0;

        for (var i = 1; i < n - 1; i += 1) {
            a[i] = x[i] - x[i - 1];
            b[i] = 2.0 * (x[i + 1] - x[i - 1]);
            c[i] = x[i + 1] - x[i];
            d[i] = 6.0 * ((y[i + 1] - y[i]) / (x[i + 1] - x[i]) - (y[i] - y[i - 1]) / (x[i] - x[i - 1]));
        }

        c[0] = c[0] / b[0];
        d[0] = d[0] / b[0];
        for (var i = 1; i < n; i += 1) {
            var m = 1.0 / (b[i] - a[i] * c[i - 1]);
            c[i] *= m;
            d[i] = (d[i] - a[i] * d[i - 1]) * m;
        }

        for (var i = n - 2; i >= 0; i -= 1) {
            d[i] = d[i] - c[i] * d[i + 1];
        }

        d[0] = 0.0;
        d[n - 1] = 0.0;

        var i = 0;
        iteratePoints(function (point) {
            point.secondDerivative = d[i];
            i += 1;
        });
    };

    var evaluateBetween = function (x, left, right) {
        var A = (right.x - x) / (right.x - left.x),
            B = 1 - A,
            C = ((A * A * A - A) * (right.x - left.x) * (right.x - left.x)) / 6.0,
            D = ((B * B * B - B) * (right.x - left.x) * (right.x - left.x)) / 6.0;

        return clamp(A * left.y + B * right.y + C * left.secondDerivative + D * right.secondDerivative, 1, canvas.height);
    };

    var createPoint = function (x_, y_, next_, previous_) {
        return {
            x: x_,
            y: y_,
            next: next_,
            previous: previous_
        };
    };

    this.add = function (x, y) {
        var point;
        if (head === null) { //empty curve
            point = createPoint(x, y, null, null);
            head = point;
            tail = point;
        } else if (x < head.x) {
            point = createPoint(x, y, head, null);
            head.previous = point;
            head = point;
        } else if (x > tail.x) {
            point = createPoint(x, y, null, tail);
            tail.next = point;
            tail = point;
        } else {
            var current = head.next,
                previous = head;
            while (x > current.x) {
                current = current.next;
                previous = previous.next;
            }
            var point = createPoint(x, y, current, previous);
            previous.next = point;
            current.previous = point;
        }
        length += 1;

        this.triggerChangeListeners();

        return point;
    };

    this.setPoints = function (points) {
        head = null;
        tail = null;
        length = 0;

        for (var i = 0; i < points.length; ++i) {
            this.add(points[i][0], points[i][1]);
        }
    };

    this.remove = function (point) {
        if (head === point) {
            head = point.next;
            point.next.previous = null;
        } else if (tail === point) {
            tail = point.previous;
            point.previous.next = null;
        } else {
            point.previous.next = point.next;
            point.next.previous = point.previous;
        }
        length -= 1;
        
        this.triggerChangeListeners();
    };

    this.evaluate = function (x) {
        if (head === tail) { //only one point in curve
            return head.y;
        }

        if (x <= head.x) {
            var derivative = (head.next.y - head.y) / (head.next.x - head.x) - (1 / 6) * (head.next.x - head.x) * head.next.secondDerivative;
            return clamp(head.y + derivative * (x - head.x), 1, canvas.height);
        } else if (x >= tail.x) {
            var derivative = (tail.y - tail.previous.y) / (tail.x - tail.previous.x) + (1 / 6) * (tail.x - tail.previous.x) * tail.previous.secondDerivative;
            return clamp(tail.y + derivative * (x - tail.x), 1, canvas.height);
        }
        var current = head.next,
            previous = head;
        while (x > current.x) {
            current = current.next;
            previous = previous.next;
        }
        var left = previous;
        var right = current;

        return evaluateBetween(x, left, right);
    };

    this.iterate = function (start, end, step, callback) {
        var left = head,
            right = head.next;

        var i = 0;

        for (var x = start; x <= end; x += step) {
            if (head === tail) { //only one point
                callback(x, head.y);
                continue;
            }

            if (x <= head.x) {
                var derivative = (head.next.y - head.y) / (head.next.x - head.x) - (1 / 6) * (head.next.x - head.x) * head.next.secondDerivative;
                callback(x, clamp(head.y + derivative * (x - head.x), 1, canvas.height));
                continue;
            } else if (x >= tail.x) {
                var derivative = (tail.y - tail.previous.y) / (tail.x - tail.previous.x) + (1 / 6) * (tail.x - tail.previous.x) * tail.previous.secondDerivative;
                callback(x, clamp(tail.y + derivative * (x - tail.x), 1, canvas.height));
                continue;
            }

            if (x > right.x) {
                right = right.next;
                left = left.next;
            }

            i += 1;

            callback(x, evaluateBetween(x, left, right), i);
        }
    };

    var iteratePoints = function (callback) {
        var current = head;
        while (current !== null) {
            callback(current);
            current = current.next;
        }
    };

    this.addChangeListener = function (callback) {
        changeListeners.push(callback);
    };

    this.triggerChangeListeners = function () {
        for (var i = 0; i < changeListeners.length; i += 1) {
            changeListeners[i]();
        }
    };

    this.addChangeListener(recompute);

    var that = this;
    canvas.addEventListener('mousedown', function (event) {
        event.preventDefault();

        var mousePosition = getMousePosition(event, canvas),
            size = selectionRadius;

        mousePosition.y = height - mousePosition.y;

        iteratePoints(function (point) {
             if (mousePosition.x > point.x - size * 0.5 && mousePosition.x < point.x + size * 0.5 &&
                mousePosition.y > point.y - size * 0.5 && mousePosition.y < point.y + size * 0.5) {

                //activate point
                activePoint = point;
                draggingPoint = point;
                redraw();
             }
        });

        if (draggingPoint === null) { 
            if (length === 0 || Math.abs(mousePosition.y - that.evaluate(mousePosition.x)) < addDistance) {
                //add a point
                var point = that.add(mousePosition.x, mousePosition.y);

                activePoint = point;
                draggingPoint = point;
            } else { //deselect points
                activePoint = null;
                redraw();
            }
        }
    });

    document.addEventListener('mousemove', function (event) {
        event.preventDefault();

        var mousePosition = getMousePosition(event, canvas);
        mousePosition.y = height - mousePosition.y;

        if (draggingPoint !== null) { //move point being dragged

            var x = clamp(mousePosition.x, 0, canvas.width);
            var y = clamp(mousePosition.y, 0, canvas.height);

            if (draggingPoint.previous === null && draggingPoint.next === null) {
                draggingPoint.x = x;
            } else if (draggingPoint.previous === null) {
                draggingPoint.x = Math.min(x, draggingPoint.next.x - minSpacing);
            } else if (draggingPoint.next === null) {
                draggingPoint.x = Math.max(x, draggingPoint.previous.x + minSpacing);
            } else {
                draggingPoint.x = clamp(x, draggingPoint.previous.x + minSpacing, draggingPoint.next.x - minSpacing);
            }
            draggingPoint.y = y;

            that.triggerChangeListeners();

        } else { //set appropriate cursor
            var size = selectionRadius;

            var overCurve = false;
            if (Math.abs(mousePosition.y - that.evaluate(mousePosition.x)) < addDistance) {
                overCurve = true;
            }

            var overPoint = false;
            iteratePoints(function (point) {
                if (mousePosition.x > point.x - size * 0.5 && mousePosition.x < point.x + size * 0.5 &&
                mousePosition.y > point.y - size * 0.5 && mousePosition.y < point.y + size * 0.5) {
                    overPoint = true;
                }
            });
                
            if (overPoint) {
                canvas.style.cursor = overPointCursor;
            } else if (overCurve) {
                canvas.style.cursor = overCurveCursor;
            } else {
                canvas.style.cursor = defaultCursor;
            }
        }
    });

    document.addEventListener('mouseup', function (event) {
        event.preventDefault();

        //trigger event for curve change end

        if (draggingPoint !== null) {
            draggingPoint = null;
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.keyCode === 46 && activePoint !== null && length > 1) {
            that.remove(activePoint);
        }
    });

    var clearCanvas = function () {
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
    };

    var drawCurve = function () {
        context.strokeStyle = curveColor;

        context.moveTo(0, head.y);
        context.beginPath();

        that.iterate(0, width, 1, function (x, y) {
            context.lineTo(x + 0.5, height - y + 0.5);
        });

        context.stroke();
    };

    var drawPoints = function () {
        context.lineWidth = 1; 

        context.fillStyle = pointColor;

        iteratePoints(function (point) {
            if (point === activePoint) {
                context.fillRect(point.x - pointSize * 0.5, height - point.y - pointSize * 0.5, pointSize, pointSize);
                context.strokeRect(point.x - pointSize * 0.5 + 0.5, height - point.y - pointSize * 0.5 + 0.5, pointSize, pointSize);
            } else {
                context.strokeRect(point.x - pointSize * 0.5 + 0.5, height -  point.y - pointSize * 0.5 + 0.5, pointSize, pointSize);
            }

        });
    };

    var redraw = function () {
        clearCanvas();

        context.strokeStyle = 'rgb(100, 100, 100);';
        context.beginPath();
        context.moveTo(0 + 0.5, canvas.height / 2 + 0.5);
        context.lineTo(canvas.width + 0.5, canvas.height / 2 + 0.5);
        context.stroke();

        drawPoints();
        drawCurve();
    };

    this.addChangeListener(redraw);
};