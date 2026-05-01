// Firebase initialisation and observers.
// Sets up listeners for two database paths: the `item` metadata doc and
// the `photo_store` collection.
async function setup_dbase() {
  await dbase_app_init(my); // connect to Firebase using my.fireb_config

  observe_meta();
  observe_photo_store();

  if (my.isScreen) {
    stopLoader(); // screen mode has no camera or mesh to wait for
  } else {
    my.waiting_for_first_mesh = 1; // phone mode: loader stays until faceMesh fires
  }
}

// Watches the `item` document for changes to the shared photo index counter.
function observe_meta() {
  dbase_app_observe({ observed_item }, 'item');
  function observed_item(item) {
    if (item.photo_index != undefined) {
      my.photo_index = item.photo_index;
    }
    photo_list_update(); // schedule a UI refresh on the next draw() tick
  }
}

// Watches the `photo_store` collection for added, changed, or removed entries.
// Updates my.photo_store in place and schedules a UI refresh.
function observe_photo_store() {
  dbase_app_observe({ observed_event }, 'photo_store');
  my.photo_store = {};
  function observed_event(event, key, item) {
    console.log('observed_event', event, key);
    switch (event) {
      case 'add':
      case 'change':
        my.photo_store[key] = item;
        break;
      case 'remove':
        delete my.photo_store[key];
        my.photo_prune_pending = 1; // tell draw() to clean up the gallery DOM
        break;
    }
    photo_list_update();
  }
}

// Called when faceMesh returns its first result — hides the loading spinner.
function first_mesh_check() {
  if (my.waiting_for_first_mesh) {
    my.waiting_for_first_mesh = 0;
    stopLoader();
  }
}

// Loader helpers that track nested start/stop calls so the spinner only
// disappears when every async operation that showed it has finished.
function add_action_startLoader() {
  startLoader();
  if (!my.add_action_loading) my.add_action_loading = 0;
  my.add_action_loading++;
  if (my.add_action_loading == 1) {
    my.add_action_startTime = Date.now();
  }
}

function add_action_stopLoader() {
  if (my.add_action_loading) {
    stopLoader();
    my.add_action_loading--;
  }
}
