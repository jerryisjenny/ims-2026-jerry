// Builds the page UI depending on which mode is active.
function create_ui() {
  if (my.isScreen) {
    create_screen_ui();
  } else {
    create_phone_ui();
  }
}

// ── Big screen: vending machine image + 4 face slots ──────────────────────────

function create_screen_ui() {
  // The p5 canvas is not needed in screen mode — all UI is plain HTML
  let canvas = document.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';

  // A fixed container centred on screen; its size is driven by the image inside
  let container = createDiv('');
  container.id('id_vending_container');

  // The vending machine background image
  let img = createImg('vending.jpg', 'vending machine');
  img.id('id_vending_img');
  container.child(img);

  // Four face slots positioned over the machine compartments.
  // Adjust left/top/width (as % of the image dimensions) to align with vending.jpg.
  const slotPositions = [
    { left: '21%', top: '22%', width: '22%' }, // slot 0 — top left
    { left: '43%', top: '22%', width: '22%' }, // slot 1 — top right
    { left: '21%', top: '41%', width: '22%' }, // slot 2 — bottom left
    { left: '43%', top: '41%', width: '22%' }, // slot 3 — bottom right
  ];

  for (let i = 0; i < my.SLOT_COUNT; i++) {
    let pos = slotPositions[i];
    let slot = createDiv('');
    slot.id('slot_' + i);
    slot.addClass('vending-slot');
    slot.style(`left:${pos.left}; top:${pos.top}; width:${pos.width}; aspect-ratio:1;`);
    container.child(slot);
  }

  // QR code fixed to the bottom-right corner so phone users know where to scan
  let qr = document.createElement('img');
  qr.src = 'qrvending.png';
  qr.style.cssText = 'position:fixed; bottom:2%; right:2%; width:150px; z-index:9000;';
  document.body.appendChild(qr);
}

// ── Phone mode: filter buttons + camera canvas + thumbnail gallery ─────────────

function create_phone_ui() {
  ui_begin();

  my.ui_container = createDiv('').id('id_dash_buttons');
  my.ui_container.style('position:fixed; z-index:100;');

  // Version label — useful for confirming which build is deployed
  let ver = ui_span(0, my.mo_group + my.version);
  ver.elt.style.backgroundColor = 'white';

  // Colour filter selector
  let filterRow = createDiv('');
  filterRow.id('id_filter_row');
  let lbl = createSpan('Filter:');
  lbl.parent(filterRow);

  my.filterBtns = {};
  for (let f of FILTER_OPTIONS) {
    let btn = createButton(f.label);
    btn.addClass('filter-btn');
    btn.mousePressed(() => filter_set(f.name));
    btn.parent(filterRow);
    my.filterBtns[f.name] = btn;
  }
  my.ui_container.child(filterRow);
  filter_set('none'); // highlight the default selection

  // Manual capture button (also triggered automatically by mouth-open)
  let takeBtn = ui_createButton('Take');
  takeBtn.mousePressed(take_action);

  // Debug / admin controls (shown when ?show_buttons=1)
  if (my.showButtons) {
    let showBtn = ui_createButton('Show');
    showBtn.mousePressed(show_action_ui);

    let hideBtn = ui_createButton('Hide');
    hideBtn.mousePressed(hide_action_ui);

    let meshBtn = ui_createButton('Mesh');
    meshBtn.mousePressed(() => { my.show_mesh = !my.show_mesh; });
  }

  if (my.showRemove) {
    let removeBtn = ui_createButton('Remove');
    removeBtn.mousePressed(remove_action);

    let removeAllBtn = ui_createButton('Remove All');
    removeAllBtn.mousePressed(remove_all_action);
  }

  // Shows the count of photos currently in the gallery
  my.photo_count_span = ui_span(0, '');
  my.photo_count_span.elt.style.backgroundColor = 'white';

  // Move the p5 canvas below the button bar
  let body_elt = document.querySelector('body');
  let main_elt = document.querySelector('main');
  body_elt.insertBefore(main_elt, null);

  // Thumbnail gallery appears below the canvas
  my.ui_container = null;
  my.gallery_div = ui_div_empty('id_gallery');
  my.gallery_div.elt.style.margin = '0px 20px';
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

// Removes all thumbnail elements from the gallery DOM.
function img_remove_all() {
  for (;;) {
    let child = my.gallery_div.elt.firstChild;
    if (!child) break;
    child.remove();
  }
  my.gallery_items = {};
}

// Returns the <img> element for a given photo key, creating it if needed.
function find_img(key) {
  let id = 'id_img_' + key;
  let img = select('#' + id);
  if (!img) {
    let span = createSpan();
    span.id(id);
    img = createImg('', 'image');
    span.child(img);
    my.gallery_div.elt.prepend(span.elt); // newest photos appear at the top
    img.style('width:' + my.thumbWidth + 'px;');
    if (!my.gallery_items) my.gallery_items = {};
    my.gallery_items[key] = span;
  }
  return img;
}

function show_action_ui() {
  first_mesh_check();
  my.show_hide_taken = 0;
  show_action();
}

function hide_action_ui() {
  first_mesh_check();
  my.show_hide_taken = 1;
  hide_action();
}

// Shows the canvas / mesh overlay
function show_action() {
  id_main.classList.remove('hidden');
  my.face_hidden = 0;
}

// Hides the canvas / mesh overlay
function hide_action() {
  id_main.classList.add('hidden');
  my.face_hidden = 1;
}
