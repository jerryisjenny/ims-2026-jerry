//

// !!@ flipH=true does not preview correctly
// unless capture is sized immediately
let flipH = true;
// let flipH = false;

async function video_init() {
  //
  await mediaDevices_preflight();

  await video_init_capture();
}

// Create the webcam video and hide it
//
async function video_init_capture() {
  // console.log('video_init_capture enter');
  //
  await mediaDevices_enum();

  if (!my.mediaDevices.length) {
    console.log('video_init_capture No my.mediaDevices');
    return;
  }

  let mediaDev = my.mediaDevices[0];

  let videoCapture = await mediaDevice_create_capture(mediaDev, { flipped: flipH });
  my.video = videoCapture.capture;

  my.video.hide();

  console.log('video_init_capture my.video.width, my.video.height', my.video.width, my.video.height);

  video_init_mask();
}

function video_init_mask(w, h) {
  my.videoMask = createGraphics(w, h);
  my.videoBuff = createGraphics(w, h);
}

function overlayEyesMouth() {
  if (!my.face1) return;
  overlayEyesMouthFace(my.face1, my.video.get());
}

function overlayEyesMouthBars() {
  my.bars.prepareOutput();
  let source = my.bars.output.get();
  overlayEyesMouthFace(my.face1, source);
}

function overlayEyesMouthFace(face, source) {
  if (!face) return;

  draw_shape_layer(face, my.videoMask);
  source.mask(my.videoMask);

  let xlen = my.videoBuff.width;
  let ylen = my.videoBuff.height;
  let { x: x0, y: y0 } = faceMesh_outputPtToInput({ x: 0, y: 0 });
  my.videoBuff.clear();
  my.videoBuff.image(source, 0, 0, xlen, ylen, x0, y0, xlen, ylen);

  let w = xlen * my.rx;
  let h = ylen * my.ry;
  image(my.videoBuff, 0, 0, w, h, 0, 0, xlen, ylen);
  // console.log('x0, y0, w, h', x0, y0, w, h);
}

// image(img, dx, dy, dWidth, dHeight, sx, sy, [sWidth], [sHeight]

// let capture = createCapture(VIDEO, function (stream)
// try {
// } catch (err) {
//   console.log('init_device_capture err', err);
//   alert('init_device_capture err=' + err);
// }
