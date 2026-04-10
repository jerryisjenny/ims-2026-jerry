// https://editor.p5js.org/Natived_/sketches/aH_8W7zjU
let video;
let fragments = [];

function preload() {
// Replace with your video file or use createCapture(VIDEO) for webcam
  video = createVideo('io.mp4'); 
  video.hide();
}

function setup() {
  createCanvas(500, 500); // Adjust to match video size
  video.loop(); // Ensure continuous playback
  generateFragments();
}

function draw() {
  background(0);
  video.loadPixels();
  applyGlitchEffects();// Core logic: Render slices of the video with individual motion/color offsets
  if (random() < 0.02) distortColors();// Random Trigger: Horizontal color shifting and copying
  if (random() < 0.01) pixelSortGlitch();// Random Trigger:· Column-based sorting algorithm
  interactFragments();
}

/* ALGORITHM EXPLANATION:
  1. Object-Oriented Fragmentation: The 'generateFragments' function creates an array of 150 
     objects. Each object stores a fixed source coordinate (x, y) from the original video 
     but maintains dynamic 'offset' variables to move it around the screen.
     
  2. Multi-Mode Motion: A switch-case logic (applyGlitchEffects) assigns different mathematical 
     behaviors to fragments—ranging from linear motion and trigonometry-based oscillations 
     (sin/tan) to Perlin Noise for organic "floating" visuals.
     
  3. Image Sampling: The code uses the 8-parameter version of image(). This allows us to 
     "crop" a specific part of the video and "paste" it elsewhere, creating a shattered 
     mirror effect where the scene remains recognizable but structurally broken.
     
  4. Pixel Sorting: The pixelSortGlitch function directly accesses the 'pixels' array. It 
     compares the brightness/color values of adjacent pixels and swaps them (a basic 
     sorting step), which creates the characteristic "melting" or "streaking" glitch aesthetic.
*/

function generateFragments() {
  for (let i = 0; i < 150; i++) {
    let w = int(random(10, width / 3)); // Random width for the shard
    let h = int(random(10, height / 3)); // Random height for the shard
    let x = int(random(width - w));
    let y = int(random(height - h));
    let effectType = int(random(5)); // Randomly assign one of the 5 movement behaviors
    
    fragments.push({ 
      x, y, w, h, 
      offsetX: 0, offsetY: 0, 
      speedX: random(-3, 3), speedY: random(-3, 3), 
      effectType, 
      colorShift: 0, 
      alpha: 255 
    });
  }
}

function applyGlitchEffects() {
  for (let frag of fragments) {
    // Switch between different movement algorithms
    switch (frag.effectType) {
      case 0: // Basic linear drift
        frag.offsetX += frag.speedX;
        frag.offsetY += frag.speedY;
        break;
      case 1: // Circular oscillation using sine and cosine
        frag.offsetX = sin(frameCount * 0.15) * 50;
        frag.offsetY = cos(frameCount * 0.15) * 50;
        break;
      case 2: // Sudden jittery jumps
        if (random() < 0.1) frag.speedX = random(-8, 8);
        if (random() < 0.1) frag.speedY = random(-8, 8);
        frag.offsetX += frag.speedX;
        frag.offsetY += frag.speedY;
        break;
      case 3: // Extreme distortion using Tangent functions
        frag.offsetX = tan(frameCount * 0.05) * 30;
        frag.offsetY = atan(frameCount * 0.05) * 30;
        break;
      case 4: // Smooth, organic movement using Perlin Noise
        frag.offsetX = noise(frameCount * 0.01) * 100 - 50;
        frag.offsetY = noise(frameCount * 0.02) * 100 - 50;
        break;
    }
    
    // Cycle through colors for the tint effect
    let c = color(frag.colorShift, 255 - frag.colorShift, random(255));
    frag.colorShift = (frag.colorShift + random(-10, 10)) % 255;

    push();
    tint(c);
    // Draw only a sub-section of the video at a displaced position
    // Syntax: image(img, dx, dy, dW, dH, sx, sy, sW, sH)
    image(video, frag.x + frag.offsetX, frag.y + frag.offsetY, frag.w, frag.h, frag.x, frag.y, frag.w, frag.h);
    pop();
  }
}

function distortColors() {
  let glitchAmount = int(random(10, 30));
  for (let i = 0; i < glitchAmount; i++) {
    let y = int(random(height));
    let h = int(random(2, 20));
    let shiftX = int(random(-30, 30));
    // Copy a horizontal slice of the canvas and paste it with a horizontal offset
    copy(video, 0, y, width, h, shiftX, int(y + random(-5, 5)), width, h);
  }
}

function pixelSortGlitch() {
  let y = int(random(height)); // Pick a random row
  let h = int(random(5, 20));  // Thickness of the sort
  loadPixels();
  // Simple Bubble Sort logic applied to a single row of pixels
  for (let i = 0; i < width - 1; i++) {
    let index1 = (y * width + i) * 4;
    let index2 = (y * width + i + 1) * 4;
    // Compare Red channel values and swap if one is brighter
    if (pixels[index1] > pixels[index2]) {
      for (let j = 0; j < 4; j++) { // Swap R, G, B, and A channels
        let temp = pixels[index1 + j];
        pixels[index1 + j] = pixels[index2 + j];
        pixels[index2 + j] = temp;
      }
    }
  }
  updatePixels();
}

function interactFragments() {
  for (let i = 0; i < fragments.length; i++) {
    for (let j = i + 1; j < fragments.length; j++) {
      let f1 = fragments[i];
      let f2 = fragments[j];
      // Calculate distance between two fragment centers
      let d = dist(f1.x + f1.offsetX, f1.y + f1.offsetY, f2.x + f2.offsetX, f2.y + f2.offsetY);
      
      // If they are close, draw a connecting line and trigger a small reaction
      if (d < 50) {
        f1.colorShift = (f1.colorShift + 10) % 255;
        f2.colorShift = (f2.colorShift + 10) % 255;
        stroke(f1.colorShift, 255 - f1.colorShift, random(255));
        line(f1.x + f1.offsetX, f1.y + f1.offsetY, f2.x + f2.offsetX, f2.y + f2.offsetY);
        // Add a small repulsive "bounce" effect
        f1.offsetX += random(-2, 2);
        f1.offsetY += random(-2, 2);
        f2.offsetX += random(-2, 2);
        f2.offsetY += random(-2, 2);
      }
    }
  }
}

// Question: How can I synchronize the 'glitchAmount' trigger with the BPM of a sound track?
 