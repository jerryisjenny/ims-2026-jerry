//
function my_init() {
  my.version = '?v=68';
  my.appTitle = 'Vending';
  my.isRemote = 1;
  my.logLoud = 1;

  my.add_action_delay = 0.5;
  my.lipsDiff = 0;

  my.fireb_config = {
    apiKey: 'AIzaSyDI6K5JejPFGTOWiQwujaUsqyCt8ofLhn0',
    authDomain: 'vendingmachine-bc1d3.firebaseapp.com',
    databaseURL: 'https://vendingmachine-bc1d3-default-rtdb.firebaseio.com',
    projectId: 'vendingmachine-bc1d3',
    storageBucket: 'vendingmachine-bc1d3.firebasestorage.app',
    messagingSenderId: '87289135886',
    appId: '1:87289135886:web:3691786de504bdab494d5f',
  };
  my.dbase_rootPath = 'vending';
  my.mo_app = 'mo-vending';
  my.nameDevice = 'vending';
  my.frame_count = 10;

  // Slot / photo settings
  my.SLOT_COUNT = 4;
  my.photo_max = 4;
  my.photo_index = 0;
  my.photo_list = [];

  my.filter = 'none';

  let scale = 0.5;
  my.vwidth = 480 * scale;
  my.vheight = 640 * scale;
  my.top_percent = 75;
  my.long = 0;

  my.imageQuality = 0.5;
  my.imageExt = '.jpg';

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
    my.isRemote   = parseFloat(my.query.remote     || my.isRemote);
    my.photo_max  = parseFloat(my.query.photo_max  || my.photo_max);
    my.top_percent = parseFloat(my.query.top_percent || my.top_percent);
    my.long        = parseFloat(my.query.long       || my.long);
    my.showButtons = parseFloat(my.query.show_buttons || my.showButtons);
    my.showRemove  = parseFloat(my.query.show_remove  || my.showRemove);
    // ?screen=1 → big screen display mode (no camera)
    my.isScreen = parseFloat(my.query.screen || 0);
  }

  if (my.long) {
    [my.vwidth, my.vheight] = [my.vheight, my.vwidth];
  }

  if (!my.mo_group) {
    my.mo_group = 's0';
    my.showButtons = 1;
    my.showRemove = 1;
  }
  if (!my.mo_room) {
    my.mo_room = my.mo_group + '-vending';
  }

  my.qrcode_url = () => `qrcode/${my.mo_group}.png`;
  my.showQRCode = () => window.innerWidth > 800;

  if (my.showRemove) {
    my.photo_max = Number.MAX_SAFE_INTEGER;
  }

  my.show_mesh = 1;

  window_resized();

  console.log('mo_room', my.mo_room, 'mo_group', my.mo_group, 'isScreen', my.isScreen);
}

window.addEventListener('resize', window_resized);

function window_resized() {
  let perRow = 4.4;
  my.thumbWidth = Math.floor(windowWidth) / perRow;
  if (my.thumbWidth < 120) {
    perRow = 4.5;
    my.thumbWidth = Math.floor(windowWidth) / perRow;
  }
}
