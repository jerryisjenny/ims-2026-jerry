class eff_bars {
  // props = { width, height }
  constructor(props) {
    Object.assign(this, props);
    this.init();
  }
  init() {
    this.scrollSeconds = 30;
    this.nbars = colorPalette.length;
    // =0 for left to right, else right to left scroll
    this.xtoLeft = 1;
    this.output = createGraphics(this.width, this.height);
    this.xlen = this.width / this.nbars;
    this.ylen = this.height;
    this.items = [];
    let n = this.nbars + 1;
    this.wide = this.xlen * n;
    for (let i = 0; i < n; i++) {
      let xpos = this.xlen * i;
      let color = colorPalette[i % colorPalette.length];
      this.items[i] = { xpos, color };
    }
  }
  prepareOutput() {
    let deltaSecs = deltaTime / 1000;
    this.xstep = (width * deltaSecs) / this.scrollSeconds;
    // console.log('this.xstep', this.xstep);
    let layer = this.output;
    layer.clear();
    for (let item of this.items) {
      let { xpos, color } = item;
      item.xpos = (xpos + this.xstep) % this.wide;
      layer.fill(color);
      let x = xpos - this.xlen;
      let y = 0;
      if (this.xtoLeft) {
        x = layer.width - x;
      }
      layer.rect(x, y, this.xlen, this.ylen);
    }
  }
}

// --
// https://editor.p5js.org/jht9629-nyu/sketches/ZpoPuHXRo
// ims04-jht scroll color bars - no pop

// https://editor.p5js.org/jht9629-nyu/sketches/3VKJ-q8ar
// ims03-jht scrolling color bars
// color pops on at wrap around

// From
// https://editor.p5js.org/jht1493/sketches/5LgILr8RF

// function full_screen_action() {
//   fullScreenBtn.remove();
//   fullscreen(1);
//   let delay = 3000;
//   setTimeout(ui_present_window, delay);
// }

// function ui_present_window() {
//   resizeCanvas(windowWidth, windowHeight);
//   my_setup();
// }

// https://editor.p5js.org/jht9629-nyu/sketches/3VKJ-q8ar
// ims03-jht scrolling color bars

// https://editor.p5js.org/jht9629-nyu/sketches/2pxhnehBV
// ims04-jht scroll color rate
