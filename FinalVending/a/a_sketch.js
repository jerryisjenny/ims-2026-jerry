// Main p5.js sketch — entry point for both modes.
// Phone mode  : camera + faceMesh + colour filters; opening mouth triggers capture.
// Screen mode : (?screen=1) shows vending machine image with 4 animated face slots.

let my = {};
let colorPalette = ['red', 'green', 'gold', 'black'];

function setup() {
  pixelDensity(1); // disable retina scaling so canvas pixels match screen pixels

  my_init(); // populate the global `my` config object

  // Canvas covers the top portion of the screen; height is a % set in my_init
  let nh = Math.floor(windowHeight * (my.top_percent / 100));
  my.canvas = createCanvas(windowWidth, nh);

  if (my.isScreen) {
    // Screen mode: low frame rate is enough since slots update via Firebase events
    frameRate(5);
    id_tap_btn.textContent = 'Start Display';
    id_tap_btn.addEventListener('click', () => {
      id_tap_overlay.classList.add('hidden');
      // Browser blocks audio until the user has interacted with the page.
      // Clicking "Start Display" is that gesture; we use it to unlock audio
      // and immediately play any clips that loaded before the click.
      my.audioUnlocked = true;
      for (let i = 0; i < my.SLOT_COUNT; i++) {
        let slotEl = document.getElementById('slot_' + i);
        if (slotEl && slotEl._audioUrl) slot_play_audio(slotEl);
      }
    });
  } else {
    // Phone mode: request microphone access on the first tap (requires user gesture),
    // then start the camera. Audio and video are requested separately so that a
    // mic-permission failure doesn't block the camera from starting.
    id_tap_btn.addEventListener('click', async () => {
      id_tap_overlay.classList.add('hidden');
      try {
        my.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        dbg('mic ready');
      } catch (e) {
        dbg('no mic: ' + e.message);
        my.audioStream = null; // app continues without audio recording
      }
      video_setup();
      add_action_block(5); // prevent accidental capture for 5 s after startup
    });
  }

  create_ui();
  setup_dbase(); // connect to Firebase and start listening for changes
}

// Sets up the camera capture and initialises faceMesh + visual effects.
async function video_setup() {
  await mediaDevices_preflight(); // iOS workaround: enumerate devices before capture

  my.video = createCapture({
    video: {
      facingMode: 'user',
      // Request a low resolution so mobile GPUs can process each frame in time.
      // Without this constraint, iOS defaults to native resolution (~1280×960)
      // which causes the draw loop to stall and the canvas to go black.
      width: { ideal: my.vwidth },
      height: { ideal: my.vheight },
    },
    audio: false, // p5.js 1.10 defaults audio:true — must be explicitly disabled
  }, () => {
    my.video.elt.muted = true; // prevent mic audio from feeding back through the speaker
    let vw = my.video.width || my.vwidth;
    let vh = my.video.height || my.vheight;
    dbg('video ' + vw + 'x' + vh);
    video_init_mask(vw, vh);
    my.bars = new eff_bars({ width: vw, height: vh });
    my.input = my.video;
    faceMesh_init(); // start ml5 face landmark detection
    my.bestill = new eff_bestill({ factor: 10, input: my.output });
  });
  my.video.hide(); // hide the raw <video> element; we draw to the canvas instead
  my.video.size(my.vwidth, my.vheight);
}

// p5.js draw loop — called every frame.
function draw() {
  if (my.isScreen) {
    photo_list_update_poll(); // check if Firebase pushed new photos
    return;
  }

  // ── Phone mode ──
  photo_list_update_poll();
  proto_prune_poll(); // remove gallery thumbnails for deleted photos

  // Show current photo count and index in the UI
  let str = my.photo_list.length + ' ' + my.photo_index;
  my.photo_count_span.html(str);

  my.lipsDiff = 0; // reset each frame; filled in by faceMesh render

  if (!my.faces) {
    // faceMesh hasn't returned its first result yet — wait silently
    return;
  }

  if (my.faces.length > 0) {
    first_mesh_check(); // hide the loading spinner on first successful detection
    check_show_hide();
    if (my.show_mesh) {
      draw_mesh();
    }
  } else {
    // No face detected. Wait 0.5 s before marking the face as hidden,
    // to avoid flickering on brief detection dropouts.
    if (!my.hiden_time) my.hiden_time = Date.now() / 1000;
    if (Date.now() / 1000 - my.hiden_time > 0.5) {
      my.face_hidden = 1;
    }
    // Keep the last rendered mesh frame on screen — don't flash the raw camera feed.
  }
}

// Shows or hides the canvas based on whether a face is present.
// Debounced with a 0.5 s grace period to avoid flicker on brief dropouts.
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

// Renders the faceMesh overlay with colour filter and visual effects.
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

  my.bestill.prepareOutput(); // motion-blur / still-life effect

  apply_filter_tint(); // overlay the selected colour filter
  image(my.bestill.output, 0, 0);
  noTint();

  overlayEyesMouthBars();
  overlayEyesMouth();
}

// Watches for the mouth staying open for longer than add_action_delay seconds
// and triggers a photo capture. State machine: 0=closed, 1=open timing, 2=fired.
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
        if (my.add_action_timeoutid) return; // still in cooldown
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

// Returns true when the lip gap exceeds the open threshold.
function lipsAreOpen() {
  return my.lipsDiff > 0.05;
}

// Returns how long (seconds) the mouth has been continuously open.
function lipsOpenLapseSecs() {
  if (!lipsAreOpen()) {
    my.lipsOpenStartTime = Date.now();
    return 0;
  }
  return (Date.now() - my.lipsOpenStartTime) / 1000;
}

// Blocks the capture trigger for `delay` seconds (prevents double-captures).
function add_action_block(delay) {
  let mdelay = delay * 1000;
  my.add_action_timeoutid = setTimeout(add_action_unblock, mdelay);
}

function add_action_unblock() {
  my.add_action_timeoutid = 0;
}

// Captures `count` JPEG frames from the canvas at `interval_ms` intervals.
// Uses toBlob() instead of captureStream() because captureStream() is not
// available on iOS Safari.
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

// Briefly shows the "Make Sound!" overlay during recording.
function show_recording_prompt() {
  let el = document.getElementById('id_rec_prompt');
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 3200);
}

// Records audio for duration_ms milliseconds using the MediaRecorder API.
// Tries iOS-compatible mimeTypes first (audio/mp4), then webm variants.
// Returns a Promise that resolves with a Blob, or null if mic is unavailable.
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

// Stop all media tracks when the page is closed to release the camera/mic.
window.addEventListener('pagehide', () => {
  if (my.video?.elt?.srcObject) {
    my.video.elt.srcObject.getTracks().forEach(t => t.stop());
  }
  if (my.audioStream) {
    my.audioStream.getTracks().forEach(t => t.stop());
  }
});
