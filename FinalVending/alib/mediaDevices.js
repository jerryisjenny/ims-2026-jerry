//

// mediaDev
// my.mediaDevices = [
//    { label, deviceId, capture, stream }]

// !!@ to lib mediaDevices.js
// mediaDevices_preflight
// mediaDevices_enum
// mediaDevice_create_capture

// Ask for default video to prevent video permission
// and avoid overly constrain error
//
async function mediaDevices_preflight() {
  // console.log('video_preflight enter');
  return new Promise(function (resolve, reject) {
    let video = createCapture(VIDEO, function (stream) {
      // console.log('video_preflight stream', stream);
      video.remove();
      resolve();
    });
  });
}

// Optional: dim = { width, height} for capture size
//
function mediaDevices_enum() {
  // console.log('mediaDevices_enum enter');
  my.mediaDevices = [];
  return new Promise(function (resolve, reject) {
    mediaDevices_enum_promise(resolve, reject);
  });
}

function mediaDevices_enum_promise(resolve, reject) {
  // console.log('mediaDevices_enum_promise enter');
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.log('enumerateDevices() not supported.');
    reject(new Error('enumerateDevices() not supported.'));
  }
  // List cameras and microphones.
  navigator.mediaDevices
    .enumerateDevices()
    .then(function (devices) {
      devices.forEach(function (device) {
        // console.log('device', device);
        // console.log(
        //   device.kind + ': ' + device.label + ' id=|' + device.deviceId + '|'
        // );
        if (device.kind == 'videoinput') {
          // console.log('media_enumdevice.deviceId=' + device.deviceId);
          console.log('media_enum label=' + device.label);
          console.log('media_enum deviceId=' + device.deviceId);
          let { label, deviceId } = device;
          if (!deviceId) {
            label = 'No-id-' + random();
          }
          my.mediaDevices.push({ label, deviceId });
        }
      });
      // console.log('a_mediaDevices', a_mediaDevices);
      resolve();
    })
    .catch(function (err) {
      console.log(err.name + ': ' + err.message);
      reject(err);
    });
}

// options = { dim, flipped, audio }
//    dim = { width, height }
//
function mediaDevice_create_capture(mediaDev, options) {
  // console.log('mediaDevice_create_capture enter');
  return new Promise(function (resolve, reject) {
    create_capture_promise(mediaDev, options, resolve, reject);
  });
}

function create_capture_promise(mediaDev, options, resolve, reject) {
  // console.log('mediaDevice_capture_init enter');
  let { dim, flipped, audio } = options;
  let vcap = {
    audio,
    video: {
      deviceId: { exact: mediaDev.deviceId },
    },
  };
  if (dim && dim.width && dim.height) {
    vcap.video.width = { exact: dim.width };
    vcap.video.height = { exact: dim.height };
  }
  // console.log('create_mediaDevices dim', dim);
  // console.log('create_mediaDevices vcap', vcap);

  // !!@ flipH=true does not take unless capture is sized immediately
  // let capture = createCapture(VIDEO, { flipped: flipH });
  // capture.size(capture.width, capture.height);

  let capture = createCapture(vcap, { flipped }, function (stream) {
    mediaDev.stream = stream;
    console.log('create_mediaDevices mediaDev', mediaDev);
    // console.log('create_mediaDevices capture.loadedmetadata', capture.loadedmetadata);
    // console.log('create_mediaDevices capture.width', capture.width);
    // console.log('create_mediaDevices capture.elt.width', capture.elt.width);
    // capture.width and height now valid
    // resolve(capture);
    resolve(mediaDev);
    // alert('init_device_capture DONE deviceId=|' + mediaDevice.deviceId + '|');
  });

  capture.elt.muted = true;
  mediaDev.capture = capture;
}
