// MaWiLos on the board stay where they are put. The rest wait offstage
// until they are invited in from the line. Pushing a MaWiLo to the edge
// sends it offstage again.

const SCALE = {
  "red-grey-striped-knit": 1.1,
  "pink-floral-dress-fringe": 1.05,
  "navy-head-red-knit-body-fringe-hair": 1.05,
  "pink-floral-brown-pink-fringe-hair": 1.15,
  "green-body-red-legs-yellow-horn": 1.15,
  "pink-red-patchwork-red-green-legs": 1.05,
  "tan-white-button-row": 1.1,
  "green-tartan-pants": 0.95,
  "green-lilac-striped-skirt": 0.95,
  "red-cable-knit-pink-scarf": 0.95,
  "lilac-purple-two-tone": 0.9,
  "light-blue-and-navy-pair-paisley-scarves": 0.85,
  "blue-anteater-shaggy-mane": 1.5,
  "teal-blue-curly-hair": 1.4,
};

const TAP_DISTANCE = 6;
// Pointer presses inside this fraction of a MaWiLo's half-width and
// half-height drag it. Presses outside turn it.
const DRAG_ZONE = 0.55;
const MAX_TURN = 40;
const MIN_SIZE = 0.5;
const MAX_SIZE = 2.2;
const WALK_SPEED = 70;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const byFile = new Map(MAWILO_DATA.map((m) => [m.file, m]));
const board = document.getElementById("board");
const figures = new Map();
let offstage = [];
let waiting = null;
let topZ = 1;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function figureSize() {
  return Math.min(innerHeight * 0.19, innerWidth * 0.23);
}

// Width divided by height for each image, filled in by loadAspects.
const ASPECT = {};

function loadAspects() {
  return Promise.all(
    MAWILO_DATA.map(
      (m) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            ASPECT[m.file] = img.naturalWidth / img.naturalHeight;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `img/${m.file}.png`;
        }),
    ),
  );
}

// Where the title rests below the line, in pixels.
function titleRect() {
  const title = document.getElementById("title");
  const w = title.offsetWidth;
  const h = title.offsetHeight;
  return { left: (innerWidth - w) / 2, top: TOP_GAP, right: (innerWidth + w) / 2, bottom: TOP_GAP + h };
}

// The size of a figure on screen, in pixels, including the extra room it
// takes up when tilted by `r` degrees.
function figureBox(name, size, r = 8) {
  const h = figureSize() * (SCALE[name] || 1) * size;
  const w = h * (ASPECT[name] || 1);
  const a = (Math.abs(r) * Math.PI) / 180;
  return { w: w * Math.cos(a) + h * Math.sin(a), h: w * Math.sin(a) + h * Math.cos(a) };
}

function overlapsTitle(p, box) {
  const margin = 10;
  const cx = p.x * innerWidth;
  const cy = p.y * innerHeight;
  const t = titleRect();
  return (
    cx - box.w / 2 < t.right + margin &&
    cx + box.w / 2 > t.left - margin &&
    cy - box.h / 2 < t.bottom + margin &&
    cy + box.h / 2 > t.top - margin
  );
}

// A spot is valid when the figure is fully on screen, below the line, and
// clear of the title.
function validSpot(p, box) {
  const cx = p.x * innerWidth;
  const cy = p.y * innerHeight;
  const left = cx - box.w / 2;
  const right = cx + box.w / 2;
  const top = cy - box.h / 2;
  const bottom = cy + box.h / 2;
  if (left < 8 || right > innerWidth - 8 || top < TOP_GAP + 4 || bottom > innerHeight - 36) {
    return false;
  }
  if (overlapsTitle(p, box)) return false;
  const b = boxRect();
  return !(left < b.right && right > b.left && top < b.bottom && bottom > b.top);
}

// How many MaWiLos fit on the board at the start, from about 4 on a phone
// to about 10 on a large screen. The line and the title take up room too.
function capacity() {
  const size = figureSize();
  const t = titleRect();
  const free = innerWidth * (innerHeight - TOP_GAP) - (t.right - t.left) * (t.bottom - t.top);
  return clamp(Math.round((free / (size * 1.5 * size * 1.35)) * 0.6), 4, 12);
}

// Pick the best of many random spots: a valid one furthest from the other
// MaWiLos. If no try is valid, fall back to the middle below the title.
function bestSpot(rand, box, others) {
  const aspect = innerWidth / innerHeight;
  let best = null;
  let bestDist = -1;
  for (let k = 0; k < 80; k++) {
    const p = { x: rand(), y: rand() };
    if (!validSpot(p, box)) continue;
    const dist = Math.min(1, ...others.map((q) => Math.hypot((p.x - q.x) * aspect, p.y - q.y)));
    if (dist > bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  if (best) return best;
  const t = titleRect();
  return { x: 0.5, y: Math.min(0.85, (t.bottom + box.h / 2 + 12) / innerHeight) };
}

// True when a figure at `p` keeps a small gap to every placed figure.
function fitsAmong(p, box, placed) {
  const gap = 12;
  const cx = p.x * innerWidth;
  const cy = p.y * innerHeight;
  return placed.every(
    (q) =>
      Math.abs(cx - q.x * innerWidth) >= (box.w + q.box.w) / 2 + gap ||
      Math.abs(cy - q.y * innerHeight) >= (box.h + q.box.h) / 2 + gap,
  );
}

// Scatter MaWiLos loosely over the board, the same way on every load, with
// slightly varied sizes. None of them overlaps the title or another one.
// A MaWiLo that does not fit stays offstage, so on small screens fewer
// start on the board.
function scatterLayout(names) {
  const rand = seededRandom(7);
  const aspect = innerWidth / innerHeight;
  // The middle of the free space below the title.
  const centre = { x: 0.5, y: (titleRect().bottom / innerHeight + 1) / 2 };
  const placed = [];
  const layout = {};
  names.forEach((name, i) => {
    const size = 0.82 + rand() * 0.4;
    const r = (rand() - 0.5) * 16;
    const box = figureBox(name, size, r);
    let best = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 400; k++) {
      const p = { x: rand(), y: rand() };
      if (!validSpot(p, box) || !fitsAmong(p, box, placed)) continue;
      // Room around the spot counts only up to a point. Beyond that, spots
      // nearer the middle win, so the group stays together.
      const room = Math.min(0.24, ...placed.map((q) => Math.hypot((p.x - q.x) * aspect, p.y - q.y)));
      const fromCentre = Math.hypot((p.x - centre.x) * aspect, p.y - centre.y);
      const score = room - 0.8 * fromCentre;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (!best) return;
    placed.push({ ...best, box });
    layout[name] = { ...best, r, z: i + 1, size };
  });
  return layout;
}

// Photo box

// Room left free at the top of the screen, above the title.
const TOP_GAP = 12;

const box = document.getElementById("box");
const boxPile = document.getElementById("box-pile");
const boxCount = document.getElementById("box-count");

// Where the photo box sits, in pixels. MaWiLos do not start there.
function boxRect() {
  const r = box.getBoundingClientRect();
  return { left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 };
}

// Show the top three offstage MaWiLos on the pile and how many wait in all.
function syncBox() {
  const waiting = offstage.filter((n) => !figures.has(n));
  const shown = waiting.slice(0, 3);
  boxPile.querySelectorAll(".pile-photo").forEach((el, i) => {
    const img = el.querySelector("img");
    el.hidden = !shown[i];
    if (shown[i]) img.src = `img/${shown[i]}.png`;
  });
  boxCount.textContent = String(waiting.length);
  box.classList.toggle("empty", waiting.length === 0);
  box.setAttribute("aria-label", `Photo box, ${waiting.length} MaWiLos to meet`);
  if (card.classList.contains("open")) syncCardAction();
}

box.addEventListener("click", () => {
  const first = offstage.find((n) => !figures.has(n)) || MAWILO_DATA[0].file;
  if (!reducedMotion) {
    boxPile.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0deg)" }],
      { duration: 500, easing: "ease-out" },
    );
  }
  openCard(first);
});

function exitEdge(f) {
  return byFile.get(f.name).edge ? "bottom" : nearestEdge(f);
}

// A spot on the board away from the MaWiLos already there, clear of the
// title.
function freeSpot(name) {
  const others = [...figures.values()].filter((f) => f.state === "resident");
  return bestSpot(Math.random, figureBox(name, 1), others);
}

// Tapping a MaWiLo gives it a small wiggle and opens its card.
function tapMawilo(f) {
  if (!reducedMotion) playMove(f, "wiggle");
  openCard(f.name);
}

// A spot in the middle of the board, below the title.
function centreSpot(name) {
  const box = figureBox(name, 1);
  const t = titleRect();
  const top = Math.max(t.bottom, TOP_GAP) + box.h / 2 + 12;
  const bottom = innerHeight - 36 - box.h / 2;
  const p = { x: 0.5 + (Math.random() - 0.5) * 0.08, y: (top + bottom) / 2 / innerHeight };
  return validSpot(p, box) ? p : freeSpot(name);
}

// MaWiLos standing where a newcomer is heading step aside. Each one tries
// several directions, starting with straight away from the newcomer, and
// takes the shortest step that clears the newcomer, stays on the board and
// does not land on another MaWiLo. If no step avoids every other MaWiLo, it
// takes the shortest step that at least clears the newcomer.
function makeRoom(name, spot) {
  const pad = 16;
  const boxOf = (f) => figureBox(f.name, f.size || 1, f.r);
  const placed = [{ x: spot.x * innerWidth, y: spot.y * innerHeight, box: figureBox(name, 1, 0), name }];
  const residents = [...figures.values()].filter(
    (f) => f.name !== name && f.state === "resident" && !f.dragging,
  );
  for (const f of residents) {
    placed.push({ x: f.x * innerWidth, y: f.y * innerHeight, box: boxOf(f), name: f.name });
  }
  const clash = (a, x, y, box) =>
    Math.abs(x - a.x) < (box.w + a.box.w) / 2 + pad && Math.abs(y - a.y) < (box.h + a.box.h) / 2 + pad;

  let delay = 0;
  for (const f of residents) {
    const me = placed.find((p) => p.name === f.name);
    const newcomer = placed[0];
    if (!clash(newcomer, me.x, me.y, me.box)) continue;
    const away = Math.atan2(me.y - newcomer.y, me.x - newcomer.x || (Math.random() - 0.5));
    let best = null;
    let fallback = null;
    for (const turn of [0, 40, -40, 80, -80, 120, -120, 180]) {
      const angle = away + (turn * Math.PI) / 180;
      for (let step = 15; step <= 520; step += 15) {
        const x = me.x + Math.cos(angle) * step;
        const y = me.y + Math.sin(angle) * step;
        if (clash(newcomer, x, y, me.box)) continue;
        if (!validSpot({ x: x / innerWidth, y: y / innerHeight }, me.box)) continue;
        if (!fallback || step < fallback.step) fallback = { x, y, step };
        const crowded = placed.some((p) => p !== me && p !== newcomer && clash(p, x, y, me.box));
        if (!crowded) {
          if (!best || step < best.step) best = { x, y, step };
          break;
        }
      }
    }
    const target = best || fallback;
    if (!target) continue;
    me.x = target.x;
    me.y = target.y;
    const wait = delay;
    delay += 120;
    setTimeout(async () => {
      if (f.dragging || f.state !== "resident") return;
      await moveTo(f, target.x / innerWidth, target.y / innerHeight, "walk", 1100);
    }, wait);
  }
}

// Bring a MaWiLo in from offstage. It heads for the middle, the others make
// room, and its card opens once it has arrived.
async function invite(name) {
  const f = figures.get(name);
  if (f?.state === "resident" || f?.state === "leaving") return;
  const spot = centreSpot(name);
  if (!byFile.get(name).edge) makeRoom(name, spot);

  offstage = offstage.filter((n) => n !== name);
  const m = byFile.get(name);
  const g = makeFigure(name, { x: 0.5, y: 2, r: rand(-6, 6), z: ++topZ, size: 1 }, "resident");
  g.grabbed = true;
  await g.img.decode().catch(() => {});
  const { w, h } = extent(g);
  if (m.edge) {
    const x = m.edge === "left" ? 0.12 : 0.86;
    g.x = x;
    g.y = 1 + h / 2;
    place(g);
    void g.el.offsetWidth;
    await moveTo(g, x, 1 - h * 0.2, "pop");
  } else {
    const fromLeft = spot.x < 0.5;
    g.x = fromLeft ? -w / 2 : 1 + w / 2;
    g.y = spot.y;
    place(g);
    void g.el.offsetWidth;
    const px = Math.abs(spot.x - g.x) * innerWidth;
    await moveTo(g, spot.x, spot.y, "walk", clamp((px / 160) * 1000, 1400, 3200));
  }
  // Once it has arrived, show its card, unless someone has already picked
  // it up or sent it away.
  await wait(250);
  if (g.state === "resident" && !g.dragging && figures.get(name) === g) openCard(name);
}

function place(f) {
  f.el.style.setProperty("--x", f.x);
  f.el.style.setProperty("--y", f.y);
  f.el.style.setProperty("--r", `${f.r}deg`);
  f.el.style.zIndex = f.z;
}

function makeFigure(name, pos, state) {
  const el = document.createElement("div");
  el.className = "mawilo";
  const size = pos.size || 1;
  el.style.setProperty("--s", (SCALE[name] || 1) * size);
  const img = document.createElement("img");
  img.src = `img/${name}.png`;
  img.alt = byFile.get(name).description;
  img.draggable = false;
  el.append(img);
  board.append(el);

  const f = { name, el, img, state, ...pos, size };
  topZ = Math.max(topZ, f.z);
  place(f);
  enableDrag(f);
  figures.set(name, f);
  syncBox();
  return f;
}

// Width and height of a figure as fractions of the board.
function extent(f) {
  return { w: f.el.offsetWidth / innerWidth, h: f.el.offsetHeight / innerHeight };
}

// Move a figure with a waddle (sideways), a pop (up) or a sink (down), and
// resolve when it gets there. A waddle takes `ms` when given, and otherwise
// goes at walking pace.
async function moveTo(f, x, y, how, ms) {
  if (reducedMotion) {
    f.x = x;
    f.y = y;
    place(f);
    return;
  }
  if (ms) {
    // Use the given duration.
  } else if (how === "walk") {
    ms = Math.max(900, (Math.abs(x - f.x) * innerWidth * 1000) / WALK_SPEED);
  } else {
    ms = how === "pop" ? 900 : 600;
  }
  f.el.style.setProperty("--dur", `${ms}ms`);
  const cls = { walk: "walking", march: "marching", pop: "popping", sink: "sinking" }[how];
  f.el.classList.add(cls);
  void f.el.offsetWidth;
  f.x = x;
  f.y = y;
  place(f);
  if (how === "walk" || how === "march") {
    // Let the rocking die away over the last part of the walk, then stop.
    await wait(Math.max(0, ms - 700));
    f.el.classList.add("slowing");
    await wait(700);
    f.el.classList.remove("slowing");
  } else {
    await wait(ms);
  }
  f.el.classList.remove(cls);
}

function nearestEdge(f) {
  const d = { left: f.x, right: 1 - f.x, bottom: 1 - f.y };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}

async function sendOff(f, edge) {
  f.state = "leaving";
  if (waiting === f) waiting = null;
  clearTimeout(f.leaveTimer);
  syncBox();
  const { w, h } = extent(f);
  if (edge === "left") await moveTo(f, -w, f.y, "walk");
  else if (edge === "right") await moveTo(f, 1 + w, f.y, "walk");
  else await moveTo(f, f.x, 1 + h, "sink");
  f.el.remove();
  figures.delete(f.name);
  offstage.push(f.name);
  syncBox();
}

function smallWiggle(img) {
  img.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-2deg)" },
      { transform: "rotate(1.5deg)" },
      { transform: "rotate(-1deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 1200, easing: "ease-in-out" },
  );
}

// Where a pointer is on a figure, as a fraction of its half-width and
// half-height from its centre. Values above 1 are outside the box.
function pointerZone(f, event) {
  const box = f.el.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return Math.max(
    Math.abs(event.clientX - cx) / (box.width / 2),
    Math.abs(event.clientY - cy) / (box.height / 2),
  );
}

// True when the whole figure is inside the screen. Figures that are partly
// off screen can only be dragged, not turned or resized.
function fullyOnScreen(f) {
  const box = f.el.getBoundingClientRect();
  return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
}

function setSize(f, size) {
  f.size = clamp(size, MIN_SIZE, MAX_SIZE);
  f.el.style.setProperty("--s", (SCALE[f.name] || 1) * f.size);
}

// Pinch to resize on touch screens. The first finger on a MaWiLo grabs it,
// and a second finger anywhere on the screen turns the grab into a pinch.
// These listeners run in the capture phase so they see the second finger
// before the MaWiLo under it does.
const touches = new Map();
let pinch = null;

function touchDistance() {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType !== "touch") return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size !== 2 || pinch) return;
    const f = [...figures.values()].find((g) => g.dragging && g.touchId !== undefined);
    if (!f || f.fromEdge) return;
    f.pinched = true;
    pinch = { f, startDist: touchDistance() || 1, startSize: f.size };
  },
  true,
);

addEventListener(
  "pointermove",
  (event) => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && touches.size >= 2) {
      setSize(pinch.f, (pinch.startSize * touchDistance()) / pinch.startDist);
    }
  },
  true,
);

for (const type of ["pointerup", "pointercancel"]) {
  addEventListener(
    type,
    (event) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) pinch = null;
    },
    true,
  );
}

function enableDrag(f) {
  let mode = null;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let originR = 0;
  let startAngle = 0;
  let centreX = 0;
  let centreY = 0;
  let lastX = 0;
  let tilt = 0;
  let moved = 0;

  f.el.addEventListener("pointermove", (event) => {
    if (f.dragging) return;
    f.el.classList.toggle("edge-zone", fullyOnScreen(f) && pointerZone(f, event) > DRAG_ZONE);
  });
  f.el.addEventListener("pointerleave", () => {
    if (f.dragging) return;
    f.el.classList.remove("edge-zone");
  });

  // Greet a mouse that comes over, at most once every 1.5 seconds.
  let lastGreeting = 0;
  f.el.addEventListener("pointerenter", (event) => {
    if (reducedMotion || event.pointerType !== "mouse" || f.dragging) return;
    if (f.state !== "resident" && f.state !== "waiting") return;
    if (performance.now() - lastGreeting < 1500) return;
    lastGreeting = performance.now();
    playMove(f, pick(["wiggle", "hop"]));
  });

  // Scroll the wheel or pinch the trackpad over a MaWiLo to resize it.
  f.el.addEventListener(
    "wheel",
    (event) => {
      if (f.state === "leaving") return;
      event.preventDefault();
      if (!fullyOnScreen(f)) return;
      // Trackpad pinches arrive as wheel events with ctrlKey set, in
      // smaller steps than a mouse wheel.
      const rate = event.ctrlKey ? 0.01 : 0.0008;
      setSize(f, f.size * Math.exp(-event.deltaY * rate));
    },
    { passive: false },
  );

  f.el.addEventListener("pointerdown", (event) => {
    if (f.state === "leaving") return;
    event.preventDefault();
    // A second finger on the same MaWiLo is part of a pinch, not a new grab.
    if (f.dragging) return;
    f.touchId = event.pointerType === "touch" ? event.pointerId : undefined;
    f.el.setPointerCapture(event.pointerId);
    f.dragging = true;
    f.grabbed = true;
    // Stop any walk or pop in progress so the figure follows the pointer.
    f.el.classList.remove("walking", "popping", "sinking", "slowing");
    moved = 0;
    f.z = ++topZ;
    f.el.style.zIndex = f.z;
    startX = lastX = event.clientX;
    startY = event.clientY;
    originX = f.x;
    originY = f.y;
    originR = f.r;
    const box = f.el.getBoundingClientRect();
    centreX = box.left + box.width / 2;
    centreY = box.top + box.height / 2;
    startAngle = Math.atan2(event.clientY - centreY, event.clientX - centreX);
    f.fromEdge = !fullyOnScreen(f);
    mode = !f.fromEdge && pointerZone(f, event) > DRAG_ZONE ? "turn" : "drag";
    f.el.classList.add(mode === "turn" ? "turning" : "lifted");
    f.el.classList.toggle("from-edge", f.fromEdge);
  });

  f.el.addEventListener("pointermove", (event) => {
    if (!f.dragging || f.pinched) return;
    if (f.touchId !== undefined && event.pointerId !== f.touchId) return;
    moved = Math.max(moved, Math.hypot(event.clientX - startX, event.clientY - startY));
    if (mode === "turn") {
      const angle = Math.atan2(event.clientY - centreY, event.clientX - centreX);
      let delta = ((angle - startAngle) * 180) / Math.PI;
      delta = ((delta + 540) % 360) - 180;
      f.r = clamp(originR + delta, -MAX_TURN, MAX_TURN);
      place(f);
      return;
    }
    f.x = clamp(originX + (event.clientX - startX) / innerWidth, -0.05, 1.05);
    f.y = clamp(originY + (event.clientY - startY) / innerHeight, 0.03, 1.1);
    // Lean a little in the direction of travel, and ease back when still.
    // A figure pulled in from the edge stays upright.
    if (f.fromEdge) {
      place(f);
      return;
    }
    tilt = clamp(tilt * 0.8 + (event.clientX - lastX) * 0.5, -7, 7);
    lastX = event.clientX;
    f.el.style.setProperty("--tilt", `${tilt}deg`);
    place(f);
  });

  const drop = (event) => {
    if (!f.dragging) return;
    if (f.touchId !== undefined && event.pointerId !== f.touchId) return;
    f.dragging = false;
    tilt = 0;
    f.el.style.setProperty("--tilt", "0deg");
    f.el.classList.remove("lifted", "turning", "from-edge");
    f.fromEdge = false;

    if (f.pinched) {
      f.pinched = false;
      return;
    }
    if (moved < TAP_DISTANCE) {
      tapMawilo(f);
      return;
    }
    if (mode === "drag" && (f.x < 0.035 || f.x > 0.965 || f.y > 0.95)) {
      sendOff(f, exitEdge(f));
      return;
    }
    if (f.state === "waiting") {
      if (mode === "turn") return;
      clearTimeout(f.leaveTimer);
      waiting = null;
    }
    f.state = "resident";
    syncBox();
  };
  f.el.addEventListener("pointerup", drop);
  f.el.addEventListener("pointercancel", drop);
}

// Small moves that invite someone to play. Each one runs on the image, so
// it does not disturb the figure's place on the board.
const IDLE_MOVES = {
  wiggle: [
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-1deg)" },
      { transform: "rotate(0.8deg)" },
      { transform: "rotate(-0.5deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 2600, easing: "ease-in-out" },
  ],
  breathe: [
    [
      { transform: "scale(1, 1)" },
      { transform: "scale(1.01, 1.02)" },
      { transform: "scale(1, 1)" },
    ],
    { duration: 3400, easing: "ease-in-out" },
  ],
  hop: [
    [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(0) scale(1.015, 0.98)", offset: 0.2 },
      { transform: "translateY(-3%) scale(0.99, 1.015)", offset: 0.5 },
      { transform: "translateY(0) scale(1.01, 0.99)", offset: 0.8 },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    { duration: 1300, easing: "ease-in-out" },
  ],
  lean: [
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(var(--lean))", offset: 0.3 },
      { transform: "rotate(var(--lean))", offset: 0.7 },
      { transform: "rotate(0deg)" },
    ],
    { duration: 3800, easing: "ease-in-out" },
  ],
  shiver: [
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-0.4%)" },
      { transform: "translateX(0.4%)" },
      { transform: "translateX(-0.3%)" },
      { transform: "translateX(0.3%)" },
      { transform: "translateX(-0.15%)" },
      { transform: "translateX(0)" },
    ],
    { duration: 1100, easing: "ease-in-out" },
  ],
};

// Play a MaWiLo's stop-motion trick by swapping its image through the
// frames in img/frames/, then back to the first one.
function playTrick(f) {
  const count = byFile.get(f.name).frames;
  f.moving = true;
  let i = 1;
  const step = () => {
    i += 1;
    if (i > count || f.state !== "resident") {
      f.img.src = `img/${f.name}.png`;
      f.moving = false;
      return;
    }
    f.img.src = `img/frames/${f.name}-${i}.png`;
    setTimeout(step, 550);
  };
  setTimeout(step, 150);
}

// Load the trick frames early so they swap in without a flicker.
for (const m of MAWILO_DATA) {
  for (let i = 1; i <= (m.frames || 0); i++) new Image().src = `img/frames/${m.file}-${i}.png`;
}

function playMove(f, name) {
  if (f.dragging || f.moving) return;
  // A MaWiLo with a trick does its trick instead of a small move.
  if (byFile.get(f.name).frames) {
    playTrick(f);
    return;
  }
  const [frames, options] = IDLE_MOVES[name];
  if (name === "lean") f.img.style.setProperty("--lean", `${pick([-2.5, 2.5])}deg`);
  f.moving = true;
  const animation = f.img.animate(frames, options);
  animation.onfinish = animation.oncancel = () => {
    f.moving = false;
  };
}

// Now and then, one MaWiLo on the board does a small move. The same one
// never moves twice in a row.
function startIdleMoves() {
  let last = null;
  const tick = () => {
    const resting = [...figures.values()].filter(
      (f) => f.state === "resident" && !f.dragging && f !== last,
    );
    const f = pick(resting);
    if (f) {
      playMove(f, pick(Object.keys(IDLE_MOVES)));
      last = f;
    }
    setTimeout(tick, rand(4000, 8000));
  };
  setTimeout(tick, 3000);
}

// Card

const card = document.getElementById("card");
const cardImg = document.getElementById("card-img");
const cardToggle = document.getElementById("card-toggle");
let cardFile = null;
let showingPhoto = false;
let returnFocus = null;

// The card shows two instant photos in a stack: the cut-out and the
// original photo. The toggle shuffles them: the top one slides out to the
// side and tucks in behind, and the other one comes forward.
const TOP_POSE = "rotate(-2.5deg)";
const BACK_POSE = "translate(14px, -8px) rotate(5deg)";

function showCardPicture(animate = false) {
  const front = document.querySelector(".card-photo.front");
  const back = document.querySelector(".card-photo.back");
  const [top, under] = showingPhoto ? [back, front] : [front, back];
  cardToggle.textContent = showingPhoto ? "see the cut-out" : "see the photo";
  front.setAttribute("aria-hidden", String(showingPhoto));
  back.setAttribute("aria-hidden", String(!showingPhoto));
  if (!animate || reducedMotion || top.classList.contains("on-top")) {
    top.classList.add("on-top");
    under.classList.remove("on-top");
    return;
  }
  const options = { duration: 700, easing: "ease-in-out" };
  under.animate(
    [
      { transform: TOP_POSE },
      { transform: "translate(-58%, 4px) rotate(-9deg)", offset: 0.45 },
      { transform: BACK_POSE },
    ],
    options,
  );
  top.animate(
    [
      { transform: BACK_POSE },
      { transform: "translate(16%, -4px) rotate(6deg)", offset: 0.45 },
      { transform: TOP_POSE },
    ],
    options,
  );
  // Swap which photo is on top halfway, while they are apart.
  setTimeout(() => {
    top.classList.add("on-top");
    under.classList.remove("on-top");
  }, 315);
}

// On the card, a MaWiLo with a trick plays it on a loop.
let cardTrick = 0;

function loopCardTrick(m) {
  clearInterval(cardTrick);
  if (!m?.frames || reducedMotion) return;
  let i = 1;
  cardTrick = setInterval(() => {
    i = (i % m.frames) + 1;
    cardImg.src = `img/frames/${m.file}-${i}.png`;
  }, 600);
}

function fillCard(file) {
  const m = byFile.get(file);
  cardFile = file;
  showingPhoto = false;
  cardImg.src = `img/${file}.png`;
  document.getElementById("card-img-back").src = `img/photo/${file}.jpg`;
  showCardPicture();
  cardImg.alt = m.description;
  document.getElementById("card-title").textContent = m.name || m.description;
  document.getElementById("card-title-back").textContent = m.name || m.description;
  document.getElementById("card-description").textContent = m.name ? m.description : "";
  document.getElementById("card-fabrics").textContent = m.fabrics;
  document.getElementById("card-story").textContent = m.story;
  syncCardAction();
  loopCardTrick(m);
}

// The card button invites an offstage MaWiLo in or sends one on the board
// home.
const cardAction = document.getElementById("card-action");

function syncCardAction() {
  if (!cardFile) return;
  const f = figures.get(cardFile);
  const onBoard = f && f.state !== "leaving";
  cardAction.textContent = onBoard ? "send home" : "invite in";
  cardAction.classList.toggle("home", Boolean(onBoard));
}

cardAction.addEventListener("click", async () => {
  const name = cardFile;
  const f = figures.get(name);
  if (f && f.state !== "leaving") {
    sendOff(f, exitEdge(f));
    syncCardAction();
    return;
  }
  // Step out of the way while the MaWiLo walks in, then come back.
  await closeCard();
  await invite(name);
});

function openCard(file) {
  fillCard(file);
  returnFocus = document.activeElement;
  card.hidden = false;
  void card.offsetWidth;
  card.classList.add("open");
  document.getElementById("card-close").focus({ preventScroll: true });
}

async function closeCard() {
  if (!card.classList.contains("open")) return;
  card.classList.remove("open");
  clearInterval(cardTrick);
  returnFocus?.focus?.({ preventScroll: true });
  await wait(reducedMotion ? 0 : 550);
  if (!card.classList.contains("open")) card.hidden = true;
}

function shufflePhotos() {
  showingPhoto = !showingPhoto;
  showCardPicture(true);
}

cardToggle.addEventListener("click", shufflePhotos);

// Step to the previous or next MaWiLo's card, in the order of the line,
// going round at the ends. The card's contents slide out one way and the
// next MaWiLo's slide in from the other.
let stepping = false;

async function stepCard(direction) {
  if (stepping || !card.classList.contains("open")) return;
  stepping = true;
  const n = MAWILO_DATA.length;
  const i = MAWILO_DATA.findIndex((m) => m.file === cardFile);
  const next = MAWILO_DATA[(i + direction + n) % n].file;
  const parts = [card.querySelector(".card-picture"), card.querySelector(".card-text")];
  if (reducedMotion) {
    fillCard(next);
  } else {
    const out = { duration: 180, easing: "ease-in", fill: "forwards" };
    await Promise.all(
      parts.map(
        (el) =>
          el.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-direction * 48}px)`, opacity: 0 }], out)
            .finished,
      ),
    );
    fillCard(next);
    await Promise.all(
      parts.map((el) => {
        el.getAnimations().forEach((a) => a.cancel());
        return el.animate(
          [{ transform: `translateX(${direction * 48}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
          { duration: 260, easing: "ease-out" },
        ).finished;
      }),
    );
  }
  stepping = false;
}

document.getElementById("card-prev").addEventListener("click", () => stepCard(-1));
document.getElementById("card-next").addEventListener("click", () => stepCard(1));

// Swipe left or right on the card to step, and tap the photo to shuffle.
// A swipe does not count as a tap.
let swipeStart = null;
let swiped = false;
card.addEventListener("pointerdown", (event) => {
  swipeStart = { x: event.clientX, y: event.clientY };
  swiped = false;
});
card.addEventListener("pointerup", (event) => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swiped = true;
    stepCard(dx < 0 ? 1 : -1);
  }
});
document.getElementById("card-flip").addEventListener("click", () => {
  if (!swiped) shufflePhotos();
});
document.getElementById("card-close").addEventListener("click", closeCard);
addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCard();
  if (event.key === "ArrowLeft") stepCard(-1);
  if (event.key === "ArrowRight") stepCard(1);
});
board.addEventListener("pointerdown", (event) => {
  if (event.target === board) closeCard();
});

const SIGN_CARRIERS = ["blue-tassels-striped-body", "blue-striped-dress"];

function titleRestingPlace(title) {
  return { x: (innerWidth - title.offsetWidth) / 2, y: TOP_GAP };
}

function moveTitle(title, x, y, scale = 1) {
  title.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

// The sign is carried at this size and grows to full size as it floats up.
const CARRIED_SCALE = 0.9;

// Two MaWiLos carry the title up from the bottom edge, stop in the middle,
// and push it up so it floats to the top. Then the other starting MaWiLos
// waddle in one after another from the nearest side or from below.
async function intro(onStage, layout) {
  const title = document.getElementById("title");
  const others = onStage.filter((n) => !SIGN_CARRIERS.includes(n));
  const entering = others.map((name) => ({
    f: makeFigure(name, { ...layout[name], y: 2 }, "resident"),
    target: layout[name],
  }));
  offstage = offstage.filter((n) => !SIGN_CARRIERS.includes(n));
  // Each carrier goes to its place on the board afterwards, or offstage if
  // it has no place.
  const carriers = SIGN_CARRIERS.map((name) => {
    const target = layout[name];
    const f = makeFigure(name, { ...(target || { r: 0, z: ++topZ }), y: 2 }, target ? "resident" : "leaving");
    f.r = 0;
    // Carry the sign a little bigger than normal.
    setSize(f, 1.15);
    return { f, target };
  });

  addEventListener("resize", () => {
    if (!title.classList.contains("floating")) return;
    const top = titleRestingPlace(title);
    moveTitle(title, top.x, top.y);
  });

  const leave = (f) => {
    f.el.remove();
    figures.delete(f.name);
    offstage.push(f.name);
  };

  if (reducedMotion) {
    const top = titleRestingPlace(title);
    moveTitle(title, top.x, top.y);
    title.classList.add("shown", "floating");
    for (const { f, target } of [...entering, ...carriers]) {
      if (!target) {
        leave(f);
        continue;
      }
      Object.assign(f, target);
      setSize(f, target.size || 1);
      place(f);
    }
    return;
  }

  await Promise.all([
    document.fonts.ready,
    ...[...carriers, ...entering].map(({ f }) => f.img.decode().catch(() => {})),
  ]);

  // The carriers walk side by side under the sign, close enough to touch.
  const widths = carriers.map(({ f }) => extent(f).w);
  const gap = -0.004;
  const total = widths.reduce((a, b) => a + b, 0) + gap;
  const offsets = [-total / 2 + widths[0] / 2, total / 2 - widths[1] / 2];
  const h = Math.max(...carriers.map(({ f }) => extent(f).h));
  const moveCarriers = (y, how, ms) =>
    Promise.all(carriers.map(({ f }, i) => moveTo(f, 0.5 + offsets[i], y, how, ms)));

  // Carry the sign up from below the bottom edge. The sign follows the
  // carriers every frame and bobs in time with their steps.
  const signHeight = (title.offsetHeight * CARRIED_SCALE) / innerHeight;
  const walkY = 1 - h / 2 - 0.03;
  const startY = 1 + h / 2 + signHeight + 0.02;
  carriers.forEach(({ f }, i) => {
    f.x = 0.5 + offsets[i];
    f.y = startY;
    place(f);
    void f.el.offsetWidth;
  });
  title.classList.add("shown");
  let carrying = true;
  const follow = (time) => {
    if (!carrying) return;
    const boxes = carriers.map(({ f }) => f.el.getBoundingClientRect());
    const left = Math.min(...boxes.map((b) => b.left));
    const right = Math.max(...boxes.map((b) => b.right));
    const top = Math.min(...boxes.map((b) => b.top));
    const bob = Math.sin((time / 520) * Math.PI) * 3;
    moveTitle(title, (left + right) / 2 - title.offsetWidth / 2, top - title.offsetHeight * 0.85 + bob, CARRIED_SCALE);
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
  // Peek: only the top of the sign comes up, and it waits a moment.
  await moveCarriers(startY - signHeight * 0.85 - 0.02, "walk", 900);
  await wait(1300);
  // Then a firm march up until the carriers are in view.
  await moveCarriers(walkY, "march", 1800);
  await wait(300);

  // Dip together, then push the sign up so it floats to the top with a
  // little sway.
  for (const { f } of carriers) {
    f.img.animate(
      [
        { transform: "translateY(0) scale(1, 1)" },
        { transform: "translateY(3%) scale(1.04, 0.92)", offset: 0.45 },
        { transform: "translateY(-10%) scale(0.97, 1.05)", offset: 0.75 },
        { transform: "translateY(0) scale(1, 1)" },
      ],
      { duration: 900, easing: "ease-in-out" },
    );
  }
  await wait(650);
  carrying = false;
  title.classList.add("floating");
  const top = titleRestingPlace(title);
  moveTitle(title, top.x, top.y);
  title.firstElementChild.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-2.5deg)" },
      { transform: "rotate(2deg)" },
      { transform: "rotate(-1.2deg)" },
      { transform: "rotate(0.6deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 2800, easing: "ease-in-out" },
  );
  await wait(900);

  // Shrink and tilt to their places on the board while they walk there, so
  // they do not snap to them at the end.
  const carriersDone = carriers.map(({ f, target }, i) => {
    if (!target) return sendOff(f, i === 0 ? "left" : "right");
    const done = moveTo(f, target.x, target.y, "walk", 2000);
    f.r = target.r;
    setSize(f, target.size || 1);
    place(f);
    return done;
  });

  const order = entering.sort((a, b) => a.target.x - b.target.x);
  await Promise.all([
    ...carriersDone,
    ...order.map(async ({ f, target }, i) => {
      await wait(i * 260);
      const { w, h } = extent(f);
      const edge = nearestEdge(target);
      f.x = edge === "left" ? -w / 2 : edge === "right" ? 1 + w / 2 : target.x;
      f.y = edge === "bottom" ? 1 + h / 2 : target.y;
      place(f);
      void f.el.offsetWidth;
      await moveTo(f, target.x, target.y, "walk", rand(1700, 2300));
    }),
  ]);
}

async function start() {
  await Promise.all([loadAspects(), document.fonts.ready]);
  const walkers = MAWILO_DATA.filter((m) => !m.edge).map((m) => m.file);
  const others = shuffle(walkers.filter((n) => !SIGN_CARRIERS.includes(n)));
  const wanted = [...SIGN_CARRIERS, ...others.slice(0, capacity() - SIGN_CARRIERS.length)];
  const layout = scatterLayout(wanted);
  const onStage = wanted.filter((n) => layout[n]);
  offstage = shuffle(MAWILO_DATA.map((m) => m.file).filter((n) => !onStage.includes(n)));
  await intro(onStage, layout);
  document.body.classList.add("ready");
  syncBox();
  if (!reducedMotion) startIdleMoves();
}

start();
