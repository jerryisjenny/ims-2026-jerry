// Photo / slot management for both phone and screen modes.
//
// photo_store entries (Firebase): { uid, name, index, width, height, color, createdAt, frames, audio? }
// The store acts as a FIFO queue capped at SLOT_COUNT entries:
// when a new photo is taken and the queue is full, the oldest entry is deleted first.

// Returns the storage path for the first frame of an entry.
function photo_path_entry(entry) {
  return `${entry.key}/${entry.name}`;
}

// Builds a new photo_store metadata object for the current capture.
function photo_new_entry(index) {
  let uid = my.uid;
  let color = my.avg_color;
  let createdAt = new Date().toISOString();
  return { uid, name: 'frame_0.jpg', index, width, height, color, createdAt, frames: my.frame_count };
}

// Deletes all files for one entry from Firebase Storage and removes its
// database record. All frame files and the optional audio file are removed
// in parallel to minimise wait time.
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

// Called by the Firebase observer whenever photo_store changes.
// Sets a flag instead of acting immediately so that the update runs
// on the next draw() tick (safe from the Firebase callback thread).
function photo_list_update() {
  my.photo_list_update_pending = 1;
}

// Checked every frame from draw(). Dispatches to the correct handler
// depending on which mode is active.
function photo_list_update_poll() {
  if (my.photo_list_update_pending) {
    my.photo_list_update_pending = 0;
    if (my.isScreen) {
      update_slots_from_store(); // screen: fill the 4 display slots
    } else {
      photo_list_render();       // phone: refresh the thumbnail gallery
    }
  }
}

// ── Screen mode: fill the 4 face slots with the latest photos ──────────────────

// Iterates over photo_store and assigns each entry to a slot div.
// Skips slots whose currently-displayed key already matches the store entry
// to avoid redundant re-downloads.
async function update_slots_from_store() {
  let entries = Object.entries(my.photo_store);
  for (let i = 0; i < my.SLOT_COUNT; i++) {
    let slotEl = document.getElementById('slot_' + i);
    if (!slotEl) continue;

    if (i < entries.length) {
      let [key, photo] = entries[i];
      if (slotEl.dataset.slotKey === key) continue; // already showing this entry
      slotEl.dataset.slotKey = key;
      slot_stop(slotEl); // cancel any running animation/audio before loading new content

      try {
        if (photo.frames > 0) {
          // Multi-frame entry: download all frames then cycle through them.
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
          // Legacy single-frame entry
          let url = await fstorage_download_url({ path: photo_path_entry({ ...photo, key }) });
          slotEl.style.backgroundImage = `url(${url})`;
        }

        dbg('slot' + i + ' audio:' + (photo.audio||'none') + ' unlocked:' + !!my.audioUnlocked);
        if (photo.audio) {
          // Always fetch and store the audio URL so that if the user clicks
          // "Start Display" after the slot loads, we can play it immediately
          // without re-fetching. Browser autoplay policy requires a user
          // gesture before audio can play; my.audioUnlocked tracks that.
          let audioUrl = await fstorage_download_url({ path: photo_audio_path(key, photo.audio) });
          slotEl._audioUrl = audioUrl;
          if (my.audioUnlocked) slot_play_audio(slotEl);
        }
      } catch (err) {
        console.log('update_slots_from_store err', err);
      }
    } else {
      // Fewer photos than slots — clear the unused slot
      slot_stop(slotEl);
      slotEl.style.backgroundImage = 'none';
      slotEl.dataset.slotKey = '';
    }
  }
}

// Stops the frame animation and pauses audio for a slot,
// and clears the stored audio URL so stale clips don't replay.
function slot_stop(slotEl) {
  if (slotEl._animTimer) { clearInterval(slotEl._animTimer); slotEl._animTimer = null; }
  if (slotEl._audio) { slotEl._audio.pause(); slotEl._audio = null; }
  slotEl._audioUrl = null;
}

// Starts looping audio for a slot using the URL stored on the element.
function slot_play_audio(slotEl) {
  if (slotEl._audio) { slotEl._audio.pause(); slotEl._audio = null; }
  let aud = new Audio(slotEl._audioUrl);
  aud.loop = true;
  aud.volume = 0.6;
  aud.play().catch(e => dbg('play err:' + e));
  slotEl._audio = aud;
}

// ── Phone mode: thumbnail gallery ──────────────────────────────────────────────

// Rebuilds my.photo_list from the current photo_store snapshot and
// updates each thumbnail <img> with a fresh download URL.
async function photo_list_render() {
  my.photo_list = [];
  let entries = Object.entries(my.photo_store);
  let nlast = entries.length;
  let istart = Math.max(0, nlast - my.photo_max); // show only the most recent photo_max entries
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

// Checked every frame; removes gallery DOM elements for photos that no
// longer exist in photo_store (e.g. after a delete).
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

// Returns the Firebase Storage path for the audio file of a photo entry.
function photo_audio_path(key, ext) {
  return `${key}/audio.${ext}`;
}

// Uploads a raw Blob to Firebase Storage under the app/room path prefix.
async function fstorage_upload_blob({ path, blob }) {
  let fullPath = `${my.dbase_rootPath}/${my.mo_app}/${my.mo_room}/${path}`;
  let { getStorage, ref, uploadBytes } = fireb_.fstorage;
  return uploadBytes(ref(getStorage(), fullPath), blob);
}

// Updates the `audio` field of a photo_store entry in the Realtime Database
// after the audio file has been successfully uploaded to Storage.
async function dbase_photo_set_audio(photoKey, audioExt) {
  let opts = dbase_default_options('photo_store');
  let { getRefPath, update } = fireb_.fbase;
  let path = `${my.dbase_rootPath}/${my.mo_app}/${my.mo_room}/a_group/${opts.group}/photo_store/${photoKey}`;
  return update(getRefPath(path), { audio: audioExt });
}

// ── Capture: record audio + frames simultaneously, then upload ─────────────────

// Main capture flow triggered when the user opens their mouth.
// Audio and frame capture run in parallel to stay within the 3-second window.
// A database entry is created first so the screen side shows a slot immediately;
// the actual media files are uploaded afterwards.
async function add_action() {
  add_action_startLoader();
  show_recording_prompt(); // show "Make Sound!" overlay

  // Start both captures at the same time
  let audioPromise = audio_record(3000);
  let framesPromise = capture_frames_promise(my.frame_count, 300);

  // FIFO: evict the oldest slot before adding a new one
  let entries = Object.entries(my.photo_store);
  if (entries.length >= my.SLOT_COUNT) {
    let [oldKey, oldPhoto] = entries[0];
    await photo_list_remove_entry({ ...oldPhoto, key: oldKey });
  }

  // Reserve a key in the database immediately so the slot appears on screen
  let entry = photo_new_entry(my.photo_index + 1);
  let key = await dbase_add_key('photo_store', entry);

  try {
    let [audioBlob, frames] = await Promise.all([audioPromise, framesPromise]);
    dbg('frames:' + frames.length + ' audio:' + (audioBlob ? audioBlob.size + 'B' : 'null'));

    // Upload all frames in parallel
    await Promise.all(frames.map((blob, i) =>
      fstorage_upload_blob({ path: `${key}/frame_${i}.jpg`, blob })
    ));
    dbg('frames uploaded');
    dbase_update_item({ photo_index: dbase_increment(1) }, 'item');

    if (audioBlob && audioBlob.size > 0) {
      // Detect container format from the MIME type reported by MediaRecorder
      let ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      await fstorage_upload_blob({ path: photo_audio_path(key, ext), blob: audioBlob });
      await dbase_photo_set_audio(key, ext); // update DB so the screen side knows audio exists
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

// Prompts the user then removes the most recent photo.
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

// Prompts the user then removes every photo in the gallery.
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
