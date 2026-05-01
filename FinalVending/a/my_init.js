// Global configuration — called once at the start of setup().
// All runtime state is stored on the `my` object to avoid global variable clutter.
function my_init() {
  my.version = '?v=74';
  my.appTitle = 'Vending';
  my.isRemote = 1;
  my.logLoud = 1;

  my.add_action_delay = 0.5; // seconds the mouth must stay open before capture triggers
  my.lipsDiff = 0; // updated each frame by the faceMesh renderer

  // Firebase project credentials
  my.fireb_config = {
    apiKey: 'AIzaSyDI6K5JejPFGTOWiQwujaUsqyCt8ofLhn0',
    authDomain: 'vendingmachine-bc1d3.firebaseapp.com',
    databaseURL: 'https://vendingmachine-bc1d3-default-rtdb.firebaseio.com',
    projectId: 'vendingmachine-bc1d3',
    storageBucket: 'vendingmachine-bc1d3.firebasestorage.app',
    messagingSenderId: '87289135886',
    appId: '1:87289135886:web:3691786de504bdab494d5f',
  };
  my.dbase_rootPath = 'vending'; // root key inside the Realtime Database
  my.mo_app = 'mo-vending';
  my.nameDevice = 'vending';
  my.frame_count = 10; // number of JPEG frames captured per mouth-open event

  // Slot / photo settings
  my.SLOT_COUNT = 4; // number of face slots on the big screen
  my.photo_max = 4; // max photos shown in the phone gallery
  my.photo_index = 0;
  my.photo_list = [];

  my.filter = 'none';

  // Camera capture resolution — kept low so mobile GPUs don't stall
  let scale = 0.5;
  my.vwidth = 480 * scale; // 240 px
  my.vheight = 640 * scale; // 320 px
  my.top_percent = 75; // canvas height as % of window height
  my.long = 0; // set to 1 via ?long=1 to swap width/height (landscape mode)

  my.imageQuality = 0.5; // JPEG quality for captured frames (0–1)
  my.imageExt = '.jpg';

  // Parse URL query parameters to allow runtime configuration without code changes.
  // e.g. ?screen=1&group=s1&room=myroom
  my.query = get_url_params();
  if (my.query) {
    if (my.query.app) {
      my.mo_app = my.query.app;
      my.nameDevice = my.mo_app.substring(3);
    }
    if (my.query.room) {
      my.mo_room = my.query.room + my.mo_app.substring(2);
    } else {
      my.mo_room = 'm4' + my.mo_app.substring(2); // default: m4-vending
    }
    if (my.query.group) {
      my.mo_group = my.query.group;
    }
    my.isRemote = parseFloat(my.query.remote || my.isRemote);
    my.photo_max = parseFloat(my.query.photo_max || my.photo_max);
    my.top_percent = parseFloat(my.query.top_percent || my.top_percent);
    my.long = parseFloat(my.query.long || my.long);
    my.showButtons = parseFloat(my.query.show_buttons || my.showButtons);
    my.showRemove = parseFloat(my.query.show_remove || my.showRemove);
    // ?screen=1 activates big-screen display mode (no camera, Firebase listener only)
    my.isScreen = parseFloat(my.query.screen || 0);
  }

  if (my.long) {
    [my.vwidth, my.vheight] = [my.vheight, my.vwidth]; // swap for landscape
  }

  // Default group/room when no query params are provided (local dev / standalone use)
  if (!my.mo_group) {
    my.mo_group = 's0';
    my.showButtons = 1;
    my.showRemove = 1;
  }
  if (!my.mo_room) {
    my.mo_room = my.mo_group + '-vending';
  }

  my.qrcode_url = () => `qrcode/${my.mo_group}.png`;
  // Keep false — disables the moLib built-in "scan QR code" overlay.
  // The QR code image is added manually in create_screen_ui() instead.
  my.showQRCode = () => false;

  if (my.showRemove) {
    my.photo_max = Number.MAX_SAFE_INTEGER; // unlimited gallery when remove buttons are shown
  }

  my.show_mesh = 1; // 1 = render faceMesh; toggled by the Mesh button

  window_resized();

  console.log('mo_room', my.mo_room, 'mo_group', my.mo_group, 'isScreen', my.isScreen);
}

window.addEventListener('resize', window_resized);

// Recalculates thumbnail width whenever the window is resized.
function window_resized() {
  let perRow = 4.4;
  my.thumbWidth = Math.floor(window.innerWidth) / perRow;
  if (my.thumbWidth < 120) {
    perRow = 4.5;
    my.thumbWidth = Math.floor(window.innerWidth) / perRow;
  }
}
