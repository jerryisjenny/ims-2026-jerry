// vending machine face display
// Phone mode: camera + faceMesh + filters, mouth-open triggers photo upload
// Screen mode (?screen=1): vending machine image + 4 face slots, Firebase listener

let my = {};
let colorPalette = ['red', 'green', 'gold', 'black'];

function setup() {
  pixelDensity(1);

  my_init();

  let nh = Math.floor(windowHeight * (my.top_percent / 100));
  my.canvas = createCanvas(windowWidth, nh);

  if (my.isScreen) {
    // Screen: lower frame rate, canvas not needed for display
    frameRate(5);
  } else {
    video_setup();
  }

  create_ui();
  setup_dbase();

  if (!my.isScreen) {
    add_action_block(5); // delay first auto-capture on startup
  }
}

function video_setup() {
  my.video = createCapture(VIDEO, () => {
    video_init_mask();
    my.bars = new eff_bars({ width: my.video.width, height: my.video.height });
    my.input = my.video;
    ml5.setBackend('webgl');
    faceMesh_init();
    my.bestill = new eff_bestill({ factor: 10, input: my.output });
    console.log('video_setup done');
  });
  my.video.hide();
  my.video.size(my.vwidth, my.vheight);
}

function draw() {
  if (my.isScreen) {
    photo_list_update_poll();
    return;
  }

  // ── Phone mode ──
  photo_list_update_poll();
  proto_prune_poll();

  let str = my.photo_list.length + ' ' + my.photo_index;
  my.photo_count_span.html(str);

  my.lipsDiff = 0;

  if (!my.faces) {
    if (my.video) image(my.video, 0, 0);
    return;
  }

  if (my.faces.length > 0) {
    first_mesh_check();
  }

  check_show_hide();

  if (my.show_mesh) {
    draw_mesh();
  } else {
    image(my.video, 0, 0);
  }
}

function check_show_hide() {
  if (!my.show_hide_taken) {
    if (my.faces.length == 0) {
      hide_action();
      my.hiden_time = Date.now() / 1000;
    } else {
      if (my.hiden_time) {
        let now = Date.now() / 1000;
        let diff = now - my.hiden_time;
        if (diff > 0.5) {
          my.hiden_time = 0;
          show_action();
        }
      } else {
        my.hiden_time = 0;
        show_action();
      }
    }
  }
}

function draw_mesh() {
  my.output.background(my.avg_color);

  for (let face of my.faces) {
    draw_face_mesh(face);
    draw_mouth_shape(face);
    draw_lips_line(face);
    draw_eye_shape(face);
    draw_eye_lines(face);
    my.face1 = face;
  }

  my.bestill.prepareOutput();

  // Apply the selected colour filter as a tint
  apply_filter_tint();
  image(my.bestill.output, 0, 0);
  noTint();

  overlayEyesMouthBars();
  overlayEyesMouth();
}

function trackLipsDiff() {
  if (my.face_hidden) {
    let lapse = lipsOpenLapseSecs();
    if (lapse < my.add_action_delay) {
      if (!lipsAreOpen()) my.lipsOpenState = 0;
      return;
    }
  }

  if (lipsAreOpen()) {
    if (my.lipsOpenState == 0) {
      my.lipsOpenStartTime = Date.now();
      my.lipsOpenCount++;
      my.lipsOpenState = 1;
    } else if (my.lipsOpenState == 1) {
      let lapse = lipsOpenLapseSecs();
      if (lapse > my.add_action_delay) {
        if (my.add_action_timeoutid) return;
        console.log('lips open → add_action');
        add_action();
        add_action_block(my.add_action_delay);
        my.lipsOpenState = 2;
      }
    }
  } else {
    if (my.lipsOpenState) lipsOpenLapseSecs();
    my.lipsOpenState = 0;
  }
}

function lipsAreOpen() {
  return my.lipsDiff > 0.05;
}

function lipsOpenLapseSecs() {
  if (!lipsAreOpen()) {
    my.lipsOpenStartTime = Date.now();
    return 0;
  }
  return (Date.now() - my.lipsOpenStartTime) / 1000;
}

function add_action_block(delay) {
  let mdelay = delay * 1000;
  my.add_action_timeoutid = setTimeout(add_action_unblock, mdelay);
}

function add_action_unblock() {
  my.add_action_timeoutid = 0;
}
