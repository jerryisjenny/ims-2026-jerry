// Colour filter tints applied to the face mesh before capture.
// Called from draw_mesh() in a_sketch.js.

const FILTER_OPTIONS = [
  { name: 'none',  label: 'Normal' },
  { name: 'red',   label: 'Red'    },
  { name: 'blue',  label: 'Blue'   },
  { name: 'gold',  label: 'Gold'   },
  { name: 'green', label: 'Green'  },
];

function apply_filter_tint() {
  switch (my.filter) {
    case 'red':   tint(255, 90,  90);  break;
    case 'blue':  tint(90,  110, 255); break;
    case 'gold':  tint(255, 210, 50);  break;
    case 'green': tint(90,  255, 140); break;
    default:      noTint();            break;
  }
}

function filter_set(name) {
  my.filter = name;
  // Update button highlight
  if (!my.filterBtns) return;
  for (let [fn, btn] of Object.entries(my.filterBtns)) {
    if (fn === name) {
      btn.elt.classList.add('active');
    } else {
      btn.elt.classList.remove('active');
    }
  }
}
