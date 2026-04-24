let faceMesh;
let faces = [];
let video;
let PIXEL_SIZE = 14;

// 复用的临时 canvas，避免每帧创建
let tmpCanvas, tmpCtx;

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);

  video = createCapture(
    { video: { facingMode: 'user', width: 320, height: 240 }, audio: false }
  );
  video.size(320, 240);
  video.hide();

  // 一次性创建，draw 里复用
  tmpCanvas        = document.createElement('canvas');
  tmpCanvas.width  = 320;
  tmpCanvas.height = 240;
  tmpCtx           = tmpCanvas.getContext('2d');

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
  image(video, 0, 0, width, height);

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

  // 读当前帧像素（复用 tmpCtx）
  tmpCtx.drawImage(video.elt, 0, 0, 320, 240);
  let pixels = tmpCtx.getImageData(0, 0, 320, 240).data;

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
  let dataURL = document.querySelector('canvas').toDataURL('image/jpeg', 0.4);
  upload_frame(dataURL);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}