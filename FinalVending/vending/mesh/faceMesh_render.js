//

// my.output
// my.mar_w
// my.mar_h
// my.align
// my.alpha
// my.avg_color[]

// function faceMesh_render(my, input, predictions) {
function faceMesh_render(my, keypoints) {
  let input = my.input.get();
  if (!input) return;

  let layer = my.output;
  let out_w = layer.width;
  let out_h = layer.height;
  let mar_w = out_w * (my.mar_w / 100);
  let mar_h = out_h * (my.mar_h / 100);
  let rr = out_h / input.height;
  let align_none = my.align === 'none';
  let align_left = my.align === 'left';
  let align_right = my.align === 'right';
  // let align_center = my.align === 'center';

  let col_sum = [0, 0, 0];
  let ncol = 0;

  let y1k = keypoints[10].y;
  let y2k = keypoints[152].y;
  let x1k = keypoints[234].x;
  let x2k = keypoints[454].x;

  let x0k = x1k;
  let y0k = y1k;
  let xlen = x2k - x1k;
  let ylen = y2k - y1k;
  let ry = (out_h - mar_h * 2) / ylen;
  // let rx = (out_w - mar_w * 2) / xlen;
  let rx = ry;
  let x0 = 0; // flush left
  let y0 = mar_h;

  if (align_right) {
    x0 = out_w - xlen * rx;
  } else if (align_left) {
    x0 = mar_w;
  } else if (align_none) {
    rx = rr;
    ry = rr;
    x0k = 0;
    y0k = 0;
  } else {
    // align_center
    x0 = (out_w - xlen * rx) / 2;
  }

  // layer.strokeWeight(0);
  layer.noStroke();
  let n = mesh_nits.length;
  for (let j = 0; j < n; j += 3) {
    let { x: x1, y: y1 } = keypoints[mesh_nits[j]];
    let { x: x2, y: y2 } = keypoints[mesh_nits[j + 1]];
    let { x: x3, y: y3 } = keypoints[mesh_nits[j + 2]];
    let col = input.get(x1, y1);
    col[3] = my.alpha;
    col_sum[0] += col[0];
    col_sum[1] += col[1];
    col_sum[2] += col[2];
    ncol++;
    x1 = (x1 - x0k) * rx + x0;
    y1 = (y1 - y0k) * ry + y0;
    x2 = (x2 - x0k) * rx + x0;
    y2 = (y2 - y0k) * ry + y0;
    x3 = (x3 - x0k) * rx + x0;
    y3 = (y3 - y0k) * ry + y0;
    layer.fill(col);
    layer.triangle(x1, y1, x2, y2, x3, y3);
  }
  if (ncol > 0) {
    my.avg_color[0] = int(col_sum[0] / ncol);
    my.avg_color[1] = int(col_sum[1] / ncol);
    my.avg_color[2] = int(col_sum[2] / ncol);
  }
  my.x0 = x0;
  my.y0 = y0;
  my.x0k = x0k;
  my.y0k = y0k;
  my.rx = rx;
  my.ry = ry;
  my.xlen = xlen;
  my.ylen = ylen;

  let { y: y1 } = keypoints[13];
  let { y: y2 } = keypoints[14];
  my.lipsDiff = (y2 - y1) / ylen;
  // console.log('my.lipsDiff', my.lipsDiff);
}

// lips_in_top 13
// lips_in_bot 14
