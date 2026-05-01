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
    frameRate(5);
    id_tap_btn.textContent = 'Start Display';
    id_tap_btn.addEventListener('click', () => {
      id_tap_overlay.classList.add('hidden');
      my.audioUnlocked = true;
      for (let i = 0; i < my.SLOT_COUNT; i++) {
        let slotEl = document.getElementById('slot_' + i);
        if (slotEl && slotEl._audioUrl) slot_play_audio(slotEl);
      }
    });
  } else {
    id_tap_btn.addEventListener('click', async () => {
      id_tap_overlay.classList.add('hidden');
      try {
        my.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        dbg('mic ready');
      } catch (e) {
        dbg('no mic: ' + e.message);
        my.audioStream = null;
      }
      video_setup();
      add_action_block(5);
    });
  }

  create_ui();
  setup_dbase();
}

async function video_setup() {
  await mediaDevices_preflight();

  my.video = createCapture({
    video: {
      facingMode: 'user',
      width: { ideal: my.vwidth },
      height: { ideal: my.vheight },
    },
    audio: false,
  }, () => {
    my.video.elt.muted = true;
    let vw = my.video.width || my.vwidth;
    let vh = my.video.height || my.vheight;
    dbg('video ' + vw + 'x' + vh);
    video_init_mask(vw, vh);
    my.bars = new eff_bars({ width: vw, height: vh });
    my.input = my.video;
    faceMesh_init();
    my.bestill = new eff_bestill({ factor: 10, input: my.output });
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
    return;
  }

  if (my.faces.length > 0) {
    first_mesh_check();
    check_show_hide();
    if (my.show_mesh) {
      draw_mesh();
    }
  } else {
    if (!my.hiden_time) my.hiden_time = Date.now() / 1000;
    if (Date.now() / 1000 - my.hiden_time > 0.5) {
      my.face_hidden = 1;
    }
    // no face: keep last frame
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

function capture_frames_promise(count, interval_ms) {
  return new Promise(resolve => {
    let frames = [];
    let timer = setInterval(() => {
      my.canvas.elt.toBlob(blob => {
        frames.push(blob);
        if (frames.length >= count) {
          clearInterval(timer);
          resolve(frames);
        }
      }, 'image/jpeg', my.imageQuality);
    }, interval_ms);
  });
}

function show_recording_prompt() {
  let el = document.getElementById('id_rec_prompt');
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 3200);
}

function audio_record(duration_ms) {
  if (!my.audioStream) { dbg('audio_record: no stream'); return Promise.resolve(null); }
  let tracks = my.audioStream.getAudioTracks();
  dbg('audio_record tracks:' + tracks.length + ' state:' + (tracks[0]?.readyState || 'n/a'));
  return new Promise(resolve => {
    let mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
      .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch(e) { return false; } }) || '';
    dbg('audio mime:' + (mimeType || 'default'));
    try {
      let rec = new MediaRecorder(my.audioStream, mimeType ? { mimeType } : {});
      let chunks = [];
      rec.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        let blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
        dbg('audio blob:' + blob.size + 'B chunks:' + chunks.length);
        resolve(blob);
      };
      rec.start();
      setTimeout(() => rec.stop(), duration_ms);
    } catch(e) {
      dbg('rec err: ' + e.message);
      resolve(null);
    }
  });
}

window.addEventListener('pagehide', () => {
  if (my.video?.elt?.srcObject) {
    my.video.elt.srcObject.getTracks().forEach(t => t.stop());
  }
  if (my.audioStream) {
    my.audioStream.getTracks().forEach(t => t.stop());
  }
});
