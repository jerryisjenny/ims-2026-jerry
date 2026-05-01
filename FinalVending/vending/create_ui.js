//
function create_ui() {
  if (my.isScreen) {
    create_screen_ui();
  } else {
    create_phone_ui();
  }
}

// ── Big screen: vending machine image + 4 face slots ──────────────────────────

function create_screen_ui() {
  // Hide the p5 canvas - screen mode is pure HTML
  let canvas = document.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';

  // Container sized to the image, centered on screen
  let container = createDiv('');
  container.id('id_vending_container');

  // Vending machine background image
  // IMPORTANT: rename your image file to "vending.jpg" and place it in src/vending/
  let img = createImg('vending.jpg', 'vending machine');
  img.id('id_vending_img');
  container.child(img);

  // 4 circular face slots positioned over the machine compartments.
  // ADJUST left/top/width (as % of the image) to align with your vending.jpg.
  // Current defaults target a 2x2 block in rows 2-3 of a portrait machine.
  const slotPositions = [
    { left: '21%', top: '22%', width: '22%' }, // row 2, col 1
    { left: '43%', top: '22%', width: '22%' }, // row 2, col 2
    { left: '21%', top: '41%', width: '22%' }, // row 3, col 1
    { left: '43%', top: '41%', width: '22%' }, // row 3, col 2
  ];

  for (let i = 0; i < my.SLOT_COUNT; i++) {
    let pos = slotPositions[i];
    let slot = createDiv('');
    slot.id('slot_' + i);
    slot.addClass('vending-slot');
    slot.style(`left:${pos.left}; top:${pos.top}; width:${pos.width}; aspect-ratio:1;`);
    container.child(slot);
  }
}

// ── Phone mode: filter buttons + camera + thumbnail gallery ───────────────────

function create_phone_ui() {
  ui_begin();

  my.ui_container = createDiv('').id('id_dash_buttons');
  my.ui_container.style('position:fixed; z-index:100;');

  // Version label
  let ver = ui_span(0, my.mo_group + my.version);
  ver.elt.style.backgroundColor = 'white';

  // Filter selection row
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
  filter_set('none'); // highlight default

  // Take photo button
  let takeBtn = ui_createButton('Take');
  takeBtn.mousePressed(take_action);

  // Show/Hide (optional debug controls)
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

  my.photo_count_span = ui_span(0, '');
  my.photo_count_span.elt.style.backgroundColor = 'white';

  // Move canvas below buttons
  let body_elt = document.querySelector('body');
  let main_elt = document.querySelector('main');
  body_elt.insertBefore(main_elt, null);

  // Thumbnail gallery below canvas
  my.ui_container = null;
  my.gallery_div = ui_div_empty('id_gallery');
  my.gallery_div.elt.style.margin = '0px 20px';
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function img_remove_all() {
  for (;;) {
    let child = my.gallery_div.elt.firstChild;
    if (!child) break;
    child.remove();
  }
  my.gallery_items = {};
}

function find_img(key) {
  let id = 'id_img_' + key;
  let img = select('#' + id);
  if (!img) {
    let span = createSpan();
    span.id(id);
    img = createImg('', 'image');
    span.child(img);
    my.gallery_div.elt.prepend(span.elt);
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

function show_action() {
  id_main.classList.remove('hidden');
  my.face_hidden = 0;
}

function hide_action() {
  id_main.classList.add('hidden');
  my.face_hidden = 1;
}
