//
// photo_store entries: { uid, name, index, width, height, color, createdAt }
// FIFO queue of SLOT_COUNT faces: when a 5th is uploaded, the oldest is deleted first.

function photo_path_entry(entry) {
  return `${entry.key}/${entry.name}`;
}

function photo_new_entry(index) {
  let order = index.toString().padStart(4, '0');
  let name = order + my.imageExt;
  let uid = my.uid;
  let color = my.avg_color;
  let createdAt = new Date().toISOString();
  return { uid, name, index, width, height, color, createdAt };
}

async function photo_list_remove_entry(entry) {
  let path = photo_path_entry(entry);
  try {
    await fstorage_remove({ path });
    await dbase_remove_key('photo_store', entry.key);
  } catch (err) {
    console.log('photo_list_remove_entry err', err);
  }
}

// Called by Firebase observer whenever photo_store changes
function photo_list_update() {
  my.photo_list_update_pending = 1;
}

// Polled every frame from draw()
function photo_list_update_poll() {
  if (my.photo_list_update_pending) {
    my.photo_list_update_pending = 0;
    if (my.isScreen) {
      update_slots_from_store();
    } else {
      photo_list_render();
    }
  }
}

// ── Screen mode: push latest photos into the 4 circular slots ──

async function update_slots_from_store() {
  let entries = Object.entries(my.photo_store);
  for (let i = 0; i < my.SLOT_COUNT; i++) {
    let slotEl = document.getElementById('slot_' + i);
    if (!slotEl) continue;
    if (i < entries.length) {
      let [key, photo] = entries[i];
      let path = photo_path_entry({ ...photo, key });
      try {
        let url = await fstorage_download_url({ path });
        slotEl.style.backgroundImage = `url(${url})`;
      } catch (err) {
        console.log('update_slots_from_store err', err);
      }
    } else {
      slotEl.style.backgroundImage = 'none';
    }
  }
}

// ── Phone mode: small thumbnail gallery ──

async function photo_list_render() {
  my.photo_list = [];
  let entries = Object.entries(my.photo_store);
  let nlast = entries.length;
  let istart = Math.max(0, nlast - my.photo_max);
  for (let i = istart; i < nlast; i++) {
    let [key, photo] = entries[i];
    photo.key = key;
    my.photo_list.push(photo);
  }
  for (let entry of my.photo_list) {
    let path = photo_path_entry(entry);
    try {
      let url = await fstorage_download_url({ path });
      url_result(url, entry.key);
    } catch (err) {
      console.log('photo_list_render err', err);
    }
  }
  function url_result(url, key) {
    let img = find_img(key);
    img.elt.src = url;
  }
  add_action_stopLoader();
}

function proto_prune_poll() {
  if (my.photo_prune_pending) {
    my.photo_prune_pending = 0;
    photo_list_prune();
  }
}

function photo_list_prune() {
  let photos_present = {};
  for (let entry of my.photo_list) {
    photos_present[entry.key] = 1;
  }
  for (let key in my.gallery_items) {
    let span = my.gallery_items[key];
    if (!photos_present[key]) {
      span.remove();
      delete my.gallery_items[key];
    }
  }
}

// ── Upload a new face photo (FIFO: remove oldest if at capacity) ──

async function add_action() {
  console.log('add_action');
  add_action_startLoader();

  // FIFO: if already at SLOT_COUNT, delete the oldest entry first
  let entries = Object.entries(my.photo_store);
  if (entries.length >= my.SLOT_COUNT) {
    let [oldKey, oldPhoto] = entries[0];
    await photo_list_remove_entry({ ...oldPhoto, key: oldKey });
  }

  let entry = photo_new_entry(my.photo_index + 1);
  let layer = my.canvas;
  let imageQuality = my.imageQuality;

  let key = await dbase_add_key('photo_store', entry);
  entry.key = key;
  let path = photo_path_entry(entry);

  try {
    await fstorage_upload({ path, layer, imageQuality });
    dbase_update_item({ photo_index: dbase_increment(1) }, 'item');
  } catch (err) {
    console.log('add_action err', err);
  }
}

async function take_action() {
  add_action();
}

async function remove_action() {
  let response = confirm('Remove last photo?');
  if (response) remove_action_confirmed();
}

async function remove_action_confirmed() {
  let n = my.photo_list.length;
  if (n < 1) {
    dbase_update_item({ photo_index: 0 }, 'item');
    return;
  }
  startLoader();
  let photo = my.photo_list[n - 1];
  await photo_list_remove_entry(photo);
  stopLoader();
}

async function remove_all_action() {
  let response = confirm('Remove all ' + my.photo_list.length + ' photos?');
  if (response) remove_all_action_confirmed();
}

async function remove_all_action_confirmed() {
  startLoader();
  for (let photo of my.photo_list) {
    await photo_list_remove_entry(photo);
  }
  dbase_update_item({ photo_index: 0 }, 'item');
  stopLoader();
}
