//

function faceMesh_init() {
  //
  let options = {
    maxFaces: 1,
    refineLandmarks: false,
    flipHorizontal: flipH,
  };

  my.faceMesh = ml5.faceMesh(options, function () {
    console.log('ml5.faceMesh loaded');
    // console.log('ml5.faceMesh loaded my.video', my.video);
    // Start detecting faces from the webcam video
    my.faceMesh.detectStart(my.video, function (results) {
      // Callback function for when faceMesh outputs data
      // Save the output to the faces variable
      if (!my.faces) {
        console.log('faceMesh.detectStart results.length', results.length);
      }
      my.faces = results;
    });
  });

  // my.input = my.video;
  my.output = createGraphics(width, height);
  my.output.noStroke();
  my.mar_h = 5; // height margin in percent
  my.mar_w = 5;
  // my.align = "center";
  my.alpha = 255;
  my.avg_color = [0, 0, 0];
  my.strokeWeight = width * 0.015; // strokeWeight
  my.strokeWeightEyes = my.strokeWeight * 1.5;
  my.strokeWeightLips = my.strokeWeight;

  faceMesh_pairsToNits();

  my.lipsOpenCount = 0;
  my.lipsOpenState = 0;
}

function faceMesh_pairsToNits() {
  // Extract the x coordinate from FACE_MESH_PAIRS
  mesh_nits = FACE_MESH_PAIRS.map((xy) => xy[0]);
}

function faceMesh_inputPtToOutput(pt) {
  let { x, y } = pt;
  x = (x - my.x0k) * my.rx + my.x0;
  y = (y - my.y0k) * my.ry + my.y0;
  return { x, y };
}

function faceMesh_outputPtToInput(pt) {
  let { x, y } = pt;
  x = my.x0k + (x - my.x0) / my.rx;
  y = my.y0k + (y - my.y0) / my.ry;
  return { x, y };
}
