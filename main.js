// Mawilos on the board stay where they are put. The rest wait offstage and
// arrive one at a time at the edge of the screen, where they can be dragged
// in. Pushing a mawilo to the edge sends it offstage again.

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

const STORAGE_KEY = "mawilo-layout-v3";
const TAP_DISTANCE = 6;
// Pointer presses inside this fraction of a mawilo's half-width and
// half-height drag it. Presses outside turn it.
const DRAG_ZONE = 0.55;
const MAX_TURN = 40;
const WALK_SPEED = 70;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const byFile = new Map(MAWILO_DATA.map((m) => [m.file, m]));
const board = document.getElementById("board");
const hint = document.getElementById("hint");
const figures = new Map();
let offstage = [];
let waiting = null;
let topZ = 1;
let hasDragged = false;

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

// How many mawilos fit on the board at the start, from about 4 on a phone
// to about 10 on a large screen.
function capacity() {
  const size = figureSize();
  const cols = Math.floor(innerWidth / (size * 1.5));
  const rows = Math.floor((innerHeight * 0.85) / (size * 1.35));
  return clamp(Math.round(cols * rows * 0.6), 4, 12);
}

// Scatter mawilos loosely over the board, the same way on every load. Each
// new spot is the best of several random tries, the one furthest from the
// mawilos already placed.
function scatterLayout(names) {
  const rand = seededRandom(7);
  const aspect = innerWidth / innerHeight;
  const placed = [];
  const layout = {};
  names.forEach((name, i) => {
    let best = null;
    let bestDist = -1;
    for (let k = 0; k < 12; k++) {
      const p = { x: 0.12 + rand() * 0.76, y: 0.14 + rand() * 0.68 };
      const dist = Math.min(
        Math.min(p.x, 1 - p.x) * aspect * 1.5,
        Math.min(p.y, 1 - p.y) * 1.5,
        ...placed.map((q) => Math.hypot((p.x - q.x) * aspect, p.y - q.y)),
      );
      if (dist > bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    placed.push(best);
    layout[name] = {
      ...best,
      r: (rand() - 0.5) * 16,
      z: i + 1,
      // Vary the sizes a little so the board does not look like a grid.
      size: 0.82 + rand() * 0.4,
    };
  });
  return layout;
}

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.stage) {
      hasDragged = Boolean(saved.hasDragged);
      return saved.stage;
    }
  } catch {
    // Storage can be blocked or hold bad data. Fall back to the default.
  }
  return null;
}

function saveLayout() {
  const stage = {};
  for (const [name, f] of figures) {
    if (f.state === "resident") stage[name] = { x: f.x, y: f.y, r: f.r, z: f.z, size: f.size };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasDragged, stage }));
  } catch {
    // The layout only lasts for this visit.
  }
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
  const cls = { walk: "walking", pop: "popping", sink: "sinking" }[how];
  f.el.classList.add(cls);
  void f.el.offsetWidth;
  f.x = x;
  f.y = y;
  place(f);
  if (how === "walk") {
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
  const { w, h } = extent(f);
  if (edge === "left") await moveTo(f, -w, f.y, "walk");
  else if (edge === "right") await moveTo(f, 1 + w, f.y, "walk");
  else await moveTo(f, f.x, 1 + h, "sink");
  f.el.remove();
  figures.delete(f.name);
  offstage.push(f.name);
  saveLayout();
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

// One mawilo at a time comes to the edge and waits to be dragged in. It
// peeks in first, waits a moment, and then comes a little further. If
// nobody takes it, it leaves the way it came after a while.
async function arrive(forceEdge) {
  if (waiting || offstage.length === 0) return;
  const name = offstage.shift();
  const m = byFile.get(name);
  const edge = m.edge ? "bottom" : forceEdge || pick(["left", "right", "bottom"]);
  const f = makeFigure(name, { x: 0.5, y: 2, r: rand(-4, 4), z: ++topZ }, "waiting");
  waiting = f;
  // The width is only known once the image has loaded.
  await f.img.decode().catch(() => {});
  const { w, h } = extent(f);
  const x = m.edge === "left" ? 0.12 : m.edge === "right" ? 0.86 : rand(0.2, 0.8);
  const y = rand(0.3, 0.7);
  const start = {
    left: { x: -w / 2, y },
    right: { x: 1 + w / 2, y },
    bottom: { x, y: 1 + h / 2 },
  }[edge];
  f.x = start.x;
  f.y = start.y;
  place(f);
  void f.el.offsetWidth;

  // The peek shows about a third of the figure, and the wait spot shows
  // most of it. Photos cut off at the bottom keep the cut below the screen.
  if (edge === "left") {
    await moveTo(f, -w / 2 + w * 0.35, y, "walk");
    await wait(1400);
    if (f.state === "waiting" && !f.grabbed) await moveTo(f, w * 0.45, y, "walk");
  } else if (edge === "right") {
    await moveTo(f, 1 + w / 2 - w * 0.35, y, "walk");
    await wait(1400);
    if (f.state === "waiting" && !f.grabbed) await moveTo(f, 1 - w * 0.45, y, "walk");
  } else {
    await moveTo(f, x, 1 + h / 2 - h * 0.3, "pop");
    await wait(1200);
    const rest = m.edge ? 1 - h * 0.2 : 1 - h * 0.4;
    if (f.state === "waiting" && !f.grabbed) await moveTo(f, x, rest, "pop");
    if (name === "blue-anteater-shaggy-mane" && !reducedMotion) smallWiggle(f.img);
  }
  if (f.state !== "waiting" || f.grabbed) return;
  f.leaveTimer = setTimeout(() => {
    if (f.state === "waiting" && !f.dragging) sendOff(f, edge);
  }, rand(20000, 30000));
}

function startArrivals() {
  const loop = () => {
    arrive();
    setTimeout(loop, rand(9000, 16000));
  };
  setTimeout(loop, rand(4000, 7000));
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
    f.el.classList.toggle("edge-zone", pointerZone(f, event) > DRAG_ZONE);
  });
  f.el.addEventListener("pointerleave", () => {
    if (!f.dragging) f.el.classList.remove("edge-zone");
  });

  f.el.addEventListener("pointerdown", (event) => {
    if (f.state === "leaving") return;
    event.preventDefault();
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
    mode = pointerZone(f, event) > DRAG_ZONE ? "turn" : "drag";
    f.el.classList.add(mode === "turn" ? "turning" : "lifted");
  });

  f.el.addEventListener("pointermove", (event) => {
    if (!f.dragging) return;
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
    tilt = clamp(tilt * 0.8 + (event.clientX - lastX) * 0.5, -7, 7);
    lastX = event.clientX;
    f.el.style.setProperty("--tilt", `${tilt}deg`);
    place(f);
  });

  const drop = () => {
    if (!f.dragging) return;
    f.dragging = false;
    tilt = 0;
    f.el.style.setProperty("--tilt", "0deg");
    f.el.classList.remove("lifted", "turning");

    if (moved < TAP_DISTANCE) {
      openCard(f.name);
      return;
    }
    if (!hasDragged) {
      hasDragged = true;
      hint.classList.add("done");
    }
    if (mode === "drag" && (f.x < 0.035 || f.x > 0.965 || f.y > 0.95)) {
      sendOff(f, nearestEdge(f));
      return;
    }
    if (f.state === "waiting") {
      if (mode === "turn") return;
      clearTimeout(f.leaveTimer);
      waiting = null;
    }
    f.state = "resident";
    saveLayout();
  };
  f.el.addEventListener("pointerup", drop);
  f.el.addEventListener("pointercancel", drop);
}

// Until the first drag, one mawilo now and then gives a small wiggle to
// show that they can be moved.
function startNudges() {
  const nudge = () => {
    if (hasDragged) return;
    const resting = [...figures.values()].filter((f) => f.state === "resident" && !f.dragging);
    const f = pick(resting);
    if (f) smallWiggle(f.img);
    setTimeout(nudge, rand(6000, 10000));
  };
  setTimeout(nudge, 3000);
}

// Card

const card = document.getElementById("card");
const cardImg = document.getElementById("card-img");
const cardToggle = document.getElementById("card-toggle");
let cardFile = null;
let showingPhoto = false;
let returnFocus = null;

function showCardPicture() {
  cardImg.src = showingPhoto ? `img/photo/${cardFile}.jpg` : `img/${cardFile}.png`;
  cardToggle.textContent = showingPhoto ? "see the cut-out" : "see the photo";
}

function openCard(file) {
  const m = byFile.get(file);
  cardFile = file;
  showingPhoto = false;
  showCardPicture();
  cardImg.alt = m.description;
  document.getElementById("card-title").textContent = m.name || m.description;
  document.getElementById("card-fabrics").textContent = m.fabrics;
  document.getElementById("card-story").textContent = m.story;
  returnFocus = document.activeElement;
  card.hidden = false;
  void card.offsetWidth;
  card.classList.add("open");
  document.getElementById("card-close").focus({ preventScroll: true });
}

async function closeCard() {
  if (!card.classList.contains("open")) return;
  card.classList.remove("open");
  returnFocus?.focus?.({ preventScroll: true });
  await wait(reducedMotion ? 0 : 450);
  if (!card.classList.contains("open")) card.hidden = true;
}

cardToggle.addEventListener("click", () => {
  showingPhoto = !showingPhoto;
  showCardPicture();
});
document.getElementById("card-close").addEventListener("click", closeCard);
addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCard();
});
board.addEventListener("pointerdown", (event) => {
  if (event.target === board) closeCard();
});

// The title shows alone in the middle first, then moves up into the
// background, and the starting mawilos waddle in one after another from the
// nearest side or from below.
async function intro(onStage, layout) {
  const title = document.getElementById("title");
  const entering = onStage.map((name) => {
    const target = layout[name];
    const f = makeFigure(name, { ...target, y: 2 }, "resident");
    return { f, target };
  });
  if (reducedMotion) {
    title.classList.add("up");
    for (const { f, target } of entering) {
      Object.assign(f, target);
      place(f);
    }
    return;
  }
  await Promise.all([document.fonts.ready, ...entering.map(({ f }) => f.img.decode().catch(() => {}))]);
  title.classList.add("shown");
  await wait(1600);
  title.classList.add("up");
  await wait(700);

  const order = entering.sort((a, b) => a.target.x - b.target.x);
  await Promise.all(
    order.map(async ({ f, target }, i) => {
      await wait(i * 260);
      const { w, h } = extent(f);
      const edge = nearestEdge(target);
      f.x = edge === "left" ? -w / 2 : edge === "right" ? 1 + w / 2 : target.x;
      f.y = edge === "bottom" ? 1 + h / 2 : target.y;
      place(f);
      void f.el.offsetWidth;
      await moveTo(f, target.x, target.y, "walk", rand(1700, 2300));
    }),
  );
}

async function start() {
  const saved = loadLayout();
  const walkers = MAWILO_DATA.filter((m) => !m.edge).map((m) => m.file);
  let onStage;
  let layout;
  if (saved && Object.keys(saved).length > 0) {
    onStage = Object.keys(saved).filter((n) => byFile.has(n));
    layout = saved;
  } else {
    onStage = walkers.slice(0, capacity());
    layout = scatterLayout(onStage);
  }
  offstage = shuffle(MAWILO_DATA.map((m) => m.file).filter((n) => !onStage.includes(n)));
  if (hasDragged) hint.classList.add("done");
  await intro(onStage, layout);
  document.body.classList.add("ready");
  startArrivals();
  if (!reducedMotion) startNudges();
}

document.getElementById("reset").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
  location.reload();
});

start();
