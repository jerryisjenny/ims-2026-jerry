// sketch.js
// 摄像头 → faceMesh 检测人脸 → 脸部像素化，背景压暗 → 按钮上传

let faceMesh;
let faces   = [];
let video;
let PIXEL_SIZE = 10; // 像素块大小

// ── setup ─────────────────────────────────────────────────
function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);

  // 摄像头，前置，镜像
  video = createCapture(
    { video: { facingMode: 'user', width: 640, height: 480 }, audio: false }
  );
  video.size(640, 480);
  video.hide();

  // ml5 faceMesh，只需要检测到人脸位置，不需要 mesh 渲染
  ml5.setBackend('webgl');
  faceMesh = ml5.faceMesh(
    { maxFaces: 1, refineLandmarks: false, flipHorizontal: true },
    () => {
      document.getElementById('status').style.display = 'none';
      faceMesh.detectStart(video, results => { faces = results; });
    }
  );

  // Firebase 初始化
  firebase_init();

  // 拍摄按钮
  document.getElementById('capture-btn')
    .addEventListener('click', on_capture);
}

// ── draw ──────────────────────────────────────────────────
function draw() {
  background(0);

  if (faces.length === 0) {
    // 没检测到脸，显示压暗的摄像头原画
    tint(255, 80);
    image(video, 0, 0, width, height);
    noTint();
    return;
  }

  let kp = faces[0].keypoints;

  // 1. 先画整帧压暗底图
  tint(255, 55);
  image(video, 0, 0, width, height);
  noTint();

  // 2. 算出脸在 canvas 上的位置和缩放
  //    用四个边界点：顶(10)、底(152)、左(234)、右(454)
  let scaleX = width  / video.width;
  let scaleY = height / video.height;

  let faceLeft   = kp[234].x * scaleX;
  let faceRight  = kp[454].x * scaleX;
  let faceTop    = kp[10].y  * scaleY;
  let faceBottom = kp[152].y * scaleY;

  // 3. 在脸的边界框内按像素块采样，覆盖上去
  noStroke();
  for (let px = faceLeft; px < faceRight; px += PIXEL_SIZE) {
    for (let py = faceTop; py < faceBottom; py += PIXEL_SIZE) {

      // canvas坐标 → 视频坐标
      let srcX = constrain(px / scaleX, 0, video.width  - 1);
      let srcY = constrain(py / scaleY, 0, video.height - 1);

      let col = video.get(srcX, srcY);
      fill(col[0], col[1], col[2]);
      rect(px, py, PIXEL_SIZE, PIXEL_SIZE);
    }
  }
}

// ── 拍摄按钮 ──────────────────────────────────────────────
function on_capture() {
  // canvas 截图转 base64，压缩到 0.4 质量
  let dataURL = document.querySelector('canvas').toDataURL('image/jpeg', 0.4);
  upload_frame(dataURL); // firebase.js
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}