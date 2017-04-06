'use strict';

module.exports = function(Chart) {
	var helpers = Chart.helpers;
	var globalDefaults = Chart.defaults.global;

	Chart.defaults.scale.border = {
		display: false,
		color: 'rgba(0, 0, 0, 0.4)',
		lineWidth: 1,
		borderDash: [],
		borderDashOffset: 0.0
	};

	function bordersOverlap(b) {
		return b.undefinedBorder === false
			&& b.x1 === this.x1
			&& b.x2 === this.x2
			&& b.y1 === this.y1
			&& b.y2 === this.y2;
	}

	function drawLine(context, x1, x2, y1, y2) {
		context.beginPath();

		context.moveTo(x1, y1);
		context.lineTo(x2, y2);

		context.stroke();
		context.restore();
	}

	function drawGridLines(chart, scale, undefinedBorderOptions, bordersToDraw) {
		var context = chart.ctx;
		var chartArea = chart.chartArea;

		var gridLines = scale.options.gridLines;

		var isHorizontal = scale.isHorizontal();

		var lineWidth, lineColor, borderDash, borderDashOffset;

		for (var index = 0; index < scale.ticks.length; index++) {
			if (!gridLines.display) {
				break;
			}

			// Set visual settings for current gridLine
			if (index === (typeof scale.zeroLineIndex !== 'undefined' ? scale.zeroLineIndex : 0)) {
				lineWidth = gridLines.zeroLineWidth;
				lineColor = gridLines.zeroLineColor;
				borderDash = gridLines.zeroLineBorderDash;
				borderDashOffset = gridLines.zeroLineBorderDashOffset;
			} else {
				lineWidth = helpers.getValueAtIndexOrDefault(gridLines.lineWidth, index);
				lineColor = helpers.getValueAtIndexOrDefault(gridLines.color, index);
				borderDash = helpers.getValueOrDefault(gridLines.borderDash, globalDefaults.borderDash);
				borderDashOffset = helpers.getValueOrDefault(gridLines.borderDashOffset, globalDefaults.borderDashOffset);
			}

			// Get position of current gridLine
			var x1, x2, y1, y2;
			if (isHorizontal) {
				var xLineValue = scale.getPixelForTick(index);
				xLineValue += helpers.aliasPixel(lineWidth);

				x1 = x2 = xLineValue;
				y1 = chartArea.top;
				y2 = chartArea.bottom;
			} else {
				var yLineValue = scale.getPixelForTick(index) + helpers.aliasPixel(lineWidth);

				x1 = chartArea.left;
				x2 = chartArea.right;
				y1 = y2 = yLineValue;
			}

			// First and last gridLine of first found axis for each direction are marked as undefined borders.
			// First and last gridLines are never drawn for any scale to ensure that there won't be any overlapping on chartArea borders.
			// All four sides of chartArea have to be marked, to be sure there will always be some border. If the border is defined by
			// any axis, that border will be preferred
			if (index === 0) {
				// The undefinedBorder variables are used to determine if the undefinedBorders for the
				// specific direction is already set, as every direction can only have them set once.
				if (isHorizontal && undefinedBorderOptions.horizontal === undefined) {
					undefinedBorderOptions.horizontal = {
						lineWidth: lineWidth,
						lineColor: lineColor,
						borderDash: borderDash,
						borderDashOffset: borderDashOffset
					};
				} else if (!isHorizontal && undefinedBorderOptions.vertical === undefined) {
					undefinedBorderOptions.vertical = {
						lineWidth: lineWidth,
						lineColor: lineColor,
						borderDash: borderDash,
						borderDashOffset: borderDashOffset
					};
				} else {
					continue;
				}

				// Add first gridLine of this scale as an undefined border
				bordersToDraw.push({
					x1: x1,
					x2: x2,
					y1: y1,
					y2: y2,
					isHorizontal: isHorizontal,
					undefinedBorder: true
				});
				// Add last gridLine of this scale as an undefined border
				bordersToDraw.push({
					x1: isHorizontal ? chartArea.right : x1,
					x2: isHorizontal ? chartArea.right : x2,
					y1: isHorizontal ? y1 : chartArea.bottom,
					y2: isHorizontal ? y2 : chartArea.bottom,
					isHorizontal: isHorizontal,
					undefinedBorder: true
				});
			} else if (index !== scale.ticks.length-1) {
				context.lineWidth = lineWidth;
				context.strokeStyle = lineColor;
				if (context.setLineDash) {
					context.setLineDash(borderDash);
					context.lineDashOffset = borderDashOffset;
				}

				// Draw current gridLine
				drawLine(context, x1, x2, y1, y2);
			}
		}
	}

	function getScaleBorder(scale, borderOptions) {
		// Get position of the border
		var bx1 = scale.left,
			bx2 = scale.right,
			by1 = scale.top,
			by2 = scale.bottom;

		var borderAliasPixel = helpers.aliasPixel(borderOptions.lineWidth);

		if (scale.isHorizontal()) {
			by1 = by2 = scale.position === 'top' ? scale.bottom : scale.top;
			by1 += borderAliasPixel;
			by2 += borderAliasPixel;
		} else {
			bx1 = bx2 = scale.position === 'left' ? scale.right : scale.left;
			bx1 += borderAliasPixel;
			bx2 += borderAliasPixel;
		}

		// Axis border(the line near ticks) is defined when border.display option is true or undefined otherwise
		// Undefined borders may not be drawn in the end if there is any defined border overlapping them,
		// therefore they must be drawn after all the scales are iterated
		// The direction has to be flipped because the border line of an axis has the opposite direction than
		// its gridLines. For visual explanation check the issue #4041
		return {
			x1: bx1,
			x2: bx2,
			y1: by1,
			y2: by2,
			isHorizontal: !scale.isHorizontal(),
			lineWidth: borderOptions.lineWidth,
			lineColor: borderOptions.color,
			borderDash: helpers.getValueOrDefault(borderOptions.borderDash, globalDefaults.borderDash),
			borderDashOffset: helpers.getValueOrDefault(borderOptions.borderDashOffset, globalDefaults.borderDashOffset),
			undefinedBorder: !borderOptions.display
		};
	}

	function drawBorders(context, bordersToDraw, undefinedBorderOptions) {
		// Draws all the borders. Skips undefined orders which would be overlapped by a defined border
		helpers.each(bordersToDraw, function(borderToDraw) {
			// When the border is undefined, check if there isn't a defined border on the same place, if there is one dont draw this border
			if (!borderToDraw.undefinedBorder || bordersToDraw.findIndex(bordersOverlap, borderToDraw) === -1) {
				context.save();

				// Sets properties for an undefined border from the common properties depending on its direction.
				if (borderToDraw.undefinedBorder) {
					var _undefinedBorderOptions = borderToDraw.isHorizontal ? undefinedBorderOptions.horizontal : undefinedBorderOptions.vertical;

					context.lineWidth = _undefinedBorderOptions.lineWidth;
					context.strokeStyle = _undefinedBorderOptions.lineColor;
					if (context.setLineDash) {
						context.setLineDash(_undefinedBorderOptions.borderDash);
						context.lineDashOffset = _undefinedBorderOptions.borderDashOffset;
					}
				} else {
					context.lineWidth = borderToDraw.lineWidth;
					context.strokeStyle = borderToDraw.lineColor;
					if (context.setLineDash) {
						context.setLineDash(borderToDraw.borderDash);
						context.lineDashOffset = borderToDraw.borderDashOffset;
					}
				}

				// Draw the border
				drawLine(context, borderToDraw.x1, borderToDraw.x2, borderToDraw.y1, borderToDraw.y2);
			}
		});
	}

	function setUndefinedBorderOptionsToDefault(undefinedBorderOptions) {
		var gridLineDefaults = Chart.defaults.scale.gridLines;

		if (undefinedBorderOptions.horizontal === undefined) {
			undefinedBorderOptions.horizontal = {
				lineWidth: gridLineDefaults.lineWidth,
				lineColor: gridLineDefaults.color,
				borderDash: gridLineDefaults.borderDash,
				borderDashOffset: gridLineDefaults.borderDashOffset
			};
		}

		if (undefinedBorderOptions.vertical === undefined) {
			undefinedBorderOptions.vertical = {
				lineWidth: gridLineDefaults.lineWidth,
				lineColor: gridLineDefaults.color,
				borderDash: gridLineDefaults.borderDash,
				borderDashOffset: gridLineDefaults.borderDashOffset
			};
		}
	}

	return {
		id: 'gridLines',

		beforeDatasetsDraw: function(chart) {
			// Shut down the plugin if the chart is radar or polarArea
			if (chart.scale !== undefined && chart.scale.options.type === 'radialLinear') {
				return;
			}

			var bordersToDraw = [];

			// Properties used by all undefined borders. They are set by the first axis of the corresponding
			// orientation (y = horizontal, x = vertical)
			var undefinedBorderOptions = {horizontal: undefined, vertical: undefined};

			helpers.each(chart.scales, function(scale) {
				var borderOptions = scale.options.border;

				if (scale.options.display) {
					// Draw gridLines and mark undefined borders
					drawGridLines(chart, scale, undefinedBorderOptions, bordersToDraw);

					// Adds the border of this scale to the array to be drawn later after all the gridLines are drawn
					if (borderOptions.display) {
						bordersToDraw.push(getScaleBorder(scale, borderOptions));
					}
				}
			});

			// Set common undefinedBorder properties to default gridLines options if no axis for the specific
			// direction was found
			setUndefinedBorderOptionsToDefault(undefinedBorderOptions);

			drawBorders(chart.ctx, bordersToDraw, undefinedBorderOptions);
		}
	};
};
