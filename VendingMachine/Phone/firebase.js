const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDI6K5JejPFGTOWiQwujaUsqyCt8ofLhn0",
    authDomain: "vendingmachine-bc1d3.firebaseapp.com",
    databaseURL: "https://vendingmachine-bc1d3-default-rtdb.firebaseio.com",
    projectId: "vendingmachine-bc1d3",
    storageBucket: "vendingmachine-bc1d3.firebasestorage.app",
    messagingSenderId: "87289135886",
    appId: "1:87289135886:web:3691786de504bdab494d5f"
  };
  
  const SLOT_COUNT = 4;
  const SLOT_PATH  = 'slot_store';
  
  let db;
  
  function firebase_init() {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    console.log('firebase ready');
  }
  
  async function upload_frame(base64frame) {
    try {
      let snapshot = await db.ref(SLOT_PATH).once('value');
      let slots    = snapshot.val() || {};
  
      let oldest_key  = 'slot_0';
      let oldest_time = Infinity;
  
      for (let i = 0; i < SLOT_COUNT; i++) {
        let key  = 'slot_' + i;
        let slot = slots[key];
        if (!slot) { oldest_key = key; break; }
        if (slot.timestamp < oldest_time) {
          oldest_time = slot.timestamp;
          oldest_key  = key;
        }
      }
  
      await db.ref(SLOT_PATH + '/' + oldest_key).set({
        frame:     base64frame,
        timestamp: Date.now()
      });
  
      console.log('uploaded to', oldest_key);
    } catch (err) {
      console.error('upload_frame error', err);
    }
  }
  
  function observe_slots(callback) {
    db.ref(SLOT_PATH).on('value', snapshot => {
      callback(snapshot.val() || {});
    });
  }