//
// photo_store entries: { uid, name, index, width, height, color, createdAt }
// FIFO queue of SLOT_COUNT faces: when a 5th is uploaded, the oldest is deleted first.

function photo_path_entry(entry) {
  return `${entry.key}/${entry.name}`;
}

function photo_new_entry(index) {
  let uid = my.uid;
  let color = my.avg_color;
  let createdAt = new Date().toISOString();
  return { uid, name: 'frame_0.jpg', index, width, height, color, createdAt, frames: my.frame_count };
}

async function photo_list_remove_entry(entry) {
  try {
    let n = entry.frames || 1;
    let removals = Array.from({ length: n }, (_, i) =>
      fstorage_remove({ path: `${entry.key}/frame_${i}.jpg` }).catch(() => {})
    );
    if (entry.audio) removals.push(fstorage_remove({ path: photo_audio_path(entry.key, entry.audio) }).catch(() => {}));
    await Promise.all(removals);
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
      if (slotEl.dataset.slotKey === key) continue; // already showing this entry
      slotEl.dataset.slotKey = key;
      slot_stop(slotEl);

      try {
        if (photo.frames > 0) {
          let urls = await Promise.all(
            Array.from({ length: photo.frames }, (_, j) =>
              fstorage_download_url({ path: `${key}/frame_${j}.jpg` })
            )
          );
          let fi = 0;
          slotEl.style.backgroundImage = `url(${urls[0]})`;
          slotEl._animTimer = setInterval(() => {
            fi = (fi + 1) % urls.length;
            slotEl.style.backgroundImage = `url(${urls[fi]})`;
          }, 300);
        } else {
          let url = await fstorage_download_url({ path: photo_path_entry({ ...photo, key }) });
          slotEl.style.backgroundImage = `url(${url})`;
        }

        dbg('slot' + i + ' audio:' + (photo.audio||'none') + ' unlocked:' + !!my.audioUnlocked);
        if (photo.audio) {
          let audioUrl = await fstorage_download_url({ path: photo_audio_path(key, photo.audio) });
          slotEl._audioUrl = audioUrl;
          if (my.audioUnlocked) slot_play_audio(slotEl);
        }
      } catch (err) {
        console.log('update_slots_from_store err', err);
      }
    } else {
      slot_stop(slotEl);
      slotEl.style.backgroundImage = 'none';
      slotEl.dataset.slotKey = '';
    }
  }
}

function slot_stop(slotEl) {
  if (slotEl._animTimer) { clearInterval(slotEl._animTimer); slotEl._animTimer = null; }
  if (slotEl._audio) { slotEl._audio.pause(); slotEl._audio = null; }
  slotEl._audioUrl = null;
}

function slot_play_audio(slotEl) {
  if (slotEl._audio) { slotEl._audio.pause(); slotEl._audio = null; }
  let aud = new Audio(slotEl._audioUrl);
  aud.loop = true;
  aud.volume = 0.6;
  aud.play().catch(e => dbg('play err:' + e));
  slotEl._audio = aud;
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

function photo_audio_path(key, ext) {
  return `${key}/audio.${ext}`;
}

async function fstorage_upload_blob({ path, blob }) {
  let fullPath = `${my.dbase_rootPath}/${my.mo_app}/${my.mo_room}/${path}`;
  let { getStorage, ref, uploadBytes } = fireb_.fstorage;
  return uploadBytes(ref(getStorage(), fullPath), blob);
}

async function dbase_photo_set_audio(photoKey, audioExt) {
  let opts = dbase_default_options('photo_store');
  let { getRefPath, update } = fireb_.fbase;
  let path = `${my.dbase_rootPath}/${my.mo_app}/${my.mo_room}/a_group/${opts.group}/photo_store/${photoKey}`;
  return update(getRefPath(path), { audio: audioExt });
}

// ── Capture frames + audio then upload (FIFO queue) ──

async function add_action() {
  add_action_startLoader();
  show_recording_prompt();

  let audioPromise = audio_record(3000);
  let framesPromise = capture_frames_promise(my.frame_count, 300);

  // FIFO: remove oldest if at capacity
  let entries = Object.entries(my.photo_store);
  if (entries.length >= my.SLOT_COUNT) {
    let [oldKey, oldPhoto] = entries[0];
    await photo_list_remove_entry({ ...oldPhoto, key: oldKey });
  }

  let entry = photo_new_entry(my.photo_index + 1);
  let key = await dbase_add_key('photo_store', entry);

  try {
    let [audioBlob, frames] = await Promise.all([audioPromise, framesPromise]);
    dbg('frames:' + frames.length + ' audio:' + (audioBlob ? audioBlob.size + 'B' : 'null'));

    await Promise.all(frames.map((blob, i) =>
      fstorage_upload_blob({ path: `${key}/frame_${i}.jpg`, blob })
    ));
    dbg('frames uploaded');
    dbase_update_item({ photo_index: dbase_increment(1) }, 'item');

    if (audioBlob && audioBlob.size > 0) {
      let ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      await fstorage_upload_blob({ path: photo_audio_path(key, ext), blob: audioBlob });
      await dbase_photo_set_audio(key, ext);
      dbg('audio uploaded ext:' + ext);
    } else {
      dbg('no audio to upload');
    }
  } catch (err) {
    dbg('add_action err:' + err);
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
