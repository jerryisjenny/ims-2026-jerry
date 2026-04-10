// https://editor.p5js.org/jerryisjenny/sketches/lYldWnUK6
let x, y, dx, dy;
let angle = 0;
let capture;
let motionFactor = 0;
let lastMaxBright = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  rectMode(CENTER);
  x = width / 2;
  y = height / 2;
  dx = 6;
  dy = 8;
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();
  background(0);
  noCursor();
}

function draw() {
  background(0, 10);

  // Detect the brightest spot (the focus of interaction)
  let brightestX = 0;
  let brightestY = 0;
  let maxBright = 0;
  capture.loadPixels();
  if (capture.pixels.length > 0) {
    for (let cy = 0; cy < capture.height; cy += 15) {
      for (let cx = 0; cx < capture.width; cx += 15) {
        let index = (cx + cy * capture.width) * 4;
        let brightness = (capture.pixels[index] + capture.pixels[index + 1] + capture.pixels[index + 2]) / 3;
        if (brightness > maxBright) {
          maxBright = brightness;
          brightestX = cx;
          brightestY = cy;
        }
      }
    }
  }

  // Calculate Motion Intensity (Motion Factor)
  // Compares current brightness peak to the previous frame
  let brightChange = abs(maxBright - lastMaxBright);
  motionFactor = lerp(motionFactor, map(brightChange, 0, 100, 0, 1), 0.1);
  lastMaxBright = maxBright;

  
  x += dx;
  y += dy;

 // Magnetic Attraction: Graphic leans toward the brightest spot if detected
  if (maxBright > 100) {
    let targetX = map(brightestX, capture.width, 0, 0, width);
    let targetY = map(brightestY, 0, capture.height, 0, height);
    x = lerp(x, targetX, 0.03); 
    y = lerp(y, targetY, 0.03);
  }

 
  let margin = isMobile() ? 50 : 200;
  if (x < margin || x > width - margin) {
    dx *= -1;
    x = constrain(x, margin, width - margin);
  }
  if (y < margin || y > height - margin) {
    dy *= -1;
    y = constrain(y, margin, height - margin);
  }

  // Time-based Color Evolution (Standalone Input: Clock)
  let h = hour();
  let baseHue = (h * 15 + frameCount * 0.2) % 360;
  push();
  translate(x, y);
  
  // Rotation speed slightly increases with interaction
  angle += 0.03 + (motionFactor * 0.1);
  rotate(angle);

  // Visual Feedback: Expand size and thickness during interaction
  noFill();
  let interactionScale = map(motionFactor, 0, 1, 1, 2);
  let sw = map(maxBright, 0, 255, 1, 10) * interactionScale;
  strokeWeight(sw);
  
  // Color Feedback: Flash bright/white during high-intensity motion
  if (motionFactor > 0.5) {
    stroke(0, 0, 100);
  } else {
    stroke(baseHue, 80, 100);
  }

  let baseSize = isMobile() ? width * 0.4 : 400;
  let currentSize = baseSize * interactionScale;
  rect(0, 0, currentSize, currentSize);
  rotate(-angle * 2.5);
  strokeWeight(2);
  stroke((baseHue + 180) % 360, 80, 100);
  rect(0, 0, currentSize, currentSize);
  pop();
}

function isMobile() {
  return windowWidth < 600;
}

function mousePressed() {
  let fs = fullscreen();
  fullscreen(!fs);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}