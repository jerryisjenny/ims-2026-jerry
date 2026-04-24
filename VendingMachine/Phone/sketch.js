let faceMesh;
let faces = [];
let video;
let PIXEL_SIZE = 14;
let tmpGfx;

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);

  video = createCapture(
    { video: { facingMode: 'user', width: 320, height: 240 }, audio: false }
  );
  video.size(320, 240);
  video.hide();

  tmpGfx = createGraphics(320, 240);

  ml5.setBackend('webgl');
  faceMesh = ml5.faceMesh(
    { maxFaces: 1, refineLandmarks: false, flipHorizontal: true },
    () => {
      document.getElementById('status').style.display = 'none';
      faceMesh.detectStart(video, results => { faces = results; });
    }
  );

  try { firebase_init(); }
  catch(e) { console.error('firebase:', e); }

  document.getElementById('capture-btn')
    .addEventListener('click', on_capture);
}

function draw() {
  background(0);

  // 翻转画视频帧，和 faceMesh 坐标保持一致
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (faces.length === 0) {
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);
    return;
  }

  let kp     = faces[0].keypoints;
  let scaleX = width  / video.width;
  let scaleY = height / video.height;

  let fl = kp[234].x * scaleX;
  let fr = kp[454].x * scaleX;
  let ft = kp[10].y  * scaleY;
  let fb = kp[152].y * scaleY;

  // 脸外压暗
  fill(0, 0, 0, 170);
  noStroke();
  rect(0,  0,  width,      ft);
  rect(0,  fb, width,      height - fb);
  rect(0,  ft, fl,         fb - ft);
  rect(fr, ft, width - fr, fb - ft);

  // tmpGfx 也翻转，颜色采样才正确
  tmpGfx.push();
  tmpGfx.translate(320, 0);
  tmpGfx.scale(-1, 1);
  tmpGfx.image(video, 0, 0);
  tmpGfx.pop();
  tmpGfx.loadPixels();
  let pixels = tmpGfx.pixels;

  noStroke();
  for (let px = fl; px < fr; px += PIXEL_SIZE) {
    for (let py = ft; py < fb; py += PIXEL_SIZE) {
      let srcX = constrain(floor(px / scaleX), 0, 319);
      let srcY = constrain(floor(py / scaleY), 0, 239);
      let idx  = (srcY * 320 + srcX) * 4;
      fill(pixels[idx], pixels[idx+1], pixels[idx+2]);
      rect(px, py, PIXEL_SIZE, PIXEL_SIZE);
    }
  }
}

function on_capture() {
  let btn = document.getElementById('capture-btn');
  btn.style.background = 'rgba(255,255,255,0.7)';
  setTimeout(() => { btn.style.background = 'rgba(255,255,255,0.15)'; }, 300);

  if (faces.length === 0) return;

  let kp     = faces[0].keypoints;
  let scaleX = width  / video.width;
  let scaleY = height / video.height;

  let fl = kp[234].x * scaleX;
  let fr = kp[454].x * scaleX;
  let ft = kp[10].y  * scaleY;
  let fb = kp[152].y * scaleY;

  let OUTPUT_SIZE = 400;
  let exportGfx   = createGraphics(OUTPUT_SIZE, OUTPUT_SIZE);

  exportGfx.image(
    get(fl, ft, fr - fl, fb - ft),
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE
  );

  let dataURL = exportGfx.elt.toDataURL('image/jpeg', 0.4);
  upload_frame(dataURL);
  exportGfx.remove();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}