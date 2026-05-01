//
function image_scaled_pad(img, urect, flush_right) {
  if (!urect) urect = { width, height, x0: 0, y0: 0 };
  let pw = urect.width;
  let ph = urect.height;
  let iw = img.width;
  let ih = img.height;
  let rr = ih / iw;
  if (ph == ih) {
    // If pad height matches image don't scale - for data-posenet
  } else if (rr < 1) {
    ph = pw * rr;
  } else {
    pw = ph / rr;
  }
  // console.log('urect.width', urect.width, 'iw', iw, 'ih', ih, 'pw', pw, 'ph', ph);
  // urect.width 270 iw 640 ih 480 pw 270 ph 480
  let dx = urect.x0;
  let dy = urect.y0;
  if (flush_right) {
    dx = dx + (urect.width - pw) / 2;
  }
  image(img, dx, dy, pw, ph, 0, 0, iw, ih);
}

// image(img, x, y, [width], [height])

// image(img, dx, dy, dWidth, dHeight, sx, sy, [sWidth], [sHeight], [fit], [xAlign], [yAlign])

// copies the image to the src at full dimensions
function image_copy_to(to, from) {
  // console.log('image_copy to', to, 'from', from);
  // !!@ post p5js 1.8.0 in src/image/pixels.js/_copyHelper
  // loadPixels removed
  from.loadPixels();
  to.copy(from, 0, 0, from.width, from.height, 0, 0, to.width, to.height);
}
// image.copy(fromImage, sx, sy, sw, sh, dx, dy, dw, dh)
