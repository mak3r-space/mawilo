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
const MIN_SIZE = 0.5;
const MAX_SIZE = 2.2;
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

// Pinch to resize on touch screens. The first finger on a mawilo grabs it,
// and a second finger anywhere on the screen turns the grab into a pinch.
// These listeners run in the capture phase so they see the second finger
// before the mawilo under it does.
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
    if (!f.dragging) f.el.classList.remove("edge-zone");
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

  // Scroll the wheel or pinch the trackpad over a mawilo to resize it.
  let saveTimer = 0;
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
      clearTimeout(saveTimer);
      if (f.state === "resident") saveTimer = setTimeout(saveLayout, 300);
    },
    { passive: false },
  );

  f.el.addEventListener("pointerdown", (event) => {
    if (f.state === "leaving") return;
    event.preventDefault();
    // A second finger on the same mawilo is part of a pinch, not a new grab.
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
      if (f.state === "resident") saveLayout();
      return;
    }
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

function playMove(f, name) {
  if (f.dragging || f.moving) return;
  const [frames, options] = IDLE_MOVES[name];
  if (name === "lean") f.img.style.setProperty("--lean", `${pick([-2.5, 2.5])}deg`);
  f.moving = true;
  const animation = f.img.animate(frames, options);
  animation.onfinish = animation.oncancel = () => {
    f.moving = false;
  };
}

// Now and then, one mawilo on the board does a small move. The same one
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
  document.getElementById("card-description").textContent = m.name ? m.description : "";
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

const SIGN_CARRIERS = "light-blue-and-navy-pair-paisley-scarves";

function titleRestingPlace(title) {
  return { x: (innerWidth - title.offsetWidth) / 2, y: innerHeight * 0.04 };
}

function moveTitle(title, x, y, scale = 1) {
  title.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

// The sign is carried at this size and grows to full size as it floats up.
const CARRIED_SCALE = 0.9;

// Two mawilos carry the title in from the left along the bottom edge, stop
// in the middle, and push it up so it floats to the top. Then the other
// starting mawilos waddle in one after another from the nearest side or
// from below.
async function intro(onStage, layout) {
  const title = document.getElementById("title");
  const carriersStay = onStage.includes(SIGN_CARRIERS);
  const others = onStage.filter((n) => n !== SIGN_CARRIERS);
  const entering = others.map((name) => ({
    f: makeFigure(name, { ...layout[name], y: 2 }, "resident"),
    target: layout[name],
  }));
  offstage = offstage.filter((n) => n !== SIGN_CARRIERS);
  const carriers = makeFigure(
    SIGN_CARRIERS,
    { ...(layout[SIGN_CARRIERS] || { r: 0, z: ++topZ }), y: 2 },
    carriersStay ? "resident" : "leaving",
  );
  const carriersTarget = layout[SIGN_CARRIERS];
  carriers.r = 0;
  // Carry the sign at the carriers' normal size, and take on the saved
  // size once the sign is up.
  setSize(carriers, 1);

  addEventListener("resize", () => {
    if (!title.classList.contains("floating")) return;
    const top = titleRestingPlace(title);
    moveTitle(title, top.x, top.y);
  });

  if (reducedMotion) {
    const top = titleRestingPlace(title);
    moveTitle(title, top.x, top.y);
    title.classList.add("shown", "floating");
    for (const { f, target } of entering) {
      Object.assign(f, target);
      place(f);
    }
    if (carriersStay) {
      Object.assign(carriers, carriersTarget);
      place(carriers);
    } else {
      carriers.el.remove();
      figures.delete(SIGN_CARRIERS);
      offstage.push(SIGN_CARRIERS);
    }
    return;
  }

  await Promise.all([
    document.fonts.ready,
    carriers.img.decode().catch(() => {}),
    ...entering.map(({ f }) => f.img.decode().catch(() => {})),
  ]);

  // Carry the sign up from below the bottom edge. The sign follows the
  // carriers every frame and bobs in time with their steps.
  const { h } = extent(carriers);
  const signHeight = (title.offsetHeight * CARRIED_SCALE) / innerHeight;
  const walkY = 1 - h / 2 - 0.03;
  carriers.x = 0.5;
  carriers.y = 1 + h / 2 + signHeight + 0.02;
  place(carriers);
  void carriers.el.offsetWidth;
  title.classList.add("shown");
  let carrying = true;
  const follow = (time) => {
    if (!carrying) return;
    const box = carriers.el.getBoundingClientRect();
    const bob = Math.sin((time / 520) * Math.PI) * 3;
    moveTitle(
      title,
      box.left + box.width / 2 - title.offsetWidth / 2,
      box.top - title.offsetHeight * 0.85 + bob,
      CARRIED_SCALE,
    );
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
  // Peek: only the top of the sign comes up, and it waits a moment.
  await moveTo(carriers, 0.5, carriers.y - signHeight * 0.85 - 0.02, "walk", 900);
  await wait(1300);
  // Then a firm march up until the carriers are in view.
  await moveTo(carriers, 0.5, walkY, "march", 1800);
  await wait(300);

  // Dip, then push the sign up so it floats to the top with a little sway.
  carriers.img.animate(
    [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(3%) scale(1.04, 0.92)", offset: 0.45 },
      { transform: "translateY(-10%) scale(0.97, 1.05)", offset: 0.75 },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    { duration: 900, easing: "ease-in-out" },
  );
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

  const carriersDone = carriersStay
    ? moveTo(carriers, carriersTarget.x, carriersTarget.y, "walk", 2000).then(() => {
        carriers.r = carriersTarget.r;
        setSize(carriers, carriersTarget.size || 1);
        place(carriers);
      })
    : sendOff(carriers, "right");

  const order = entering.sort((a, b) => a.target.x - b.target.x);
  await Promise.all([
    carriersDone,
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

// Temporary font picker for choosing the body font to go with the Slackey
// headings. It shows only on localhost or with ?dev in the URL, and
// remembers the choice in this browser.
const BODY_FONTS = [
  "Fredoka",
  "Nunito",
  "Quicksand",
  "Baloo 2",
  "Varela Round",
  "Lexend",
  "DM Sans",
  "Outfit",
];
const FONT_KEY = "mawilo-dev-body-font";
const isDev = location.hostname === "localhost" || new URLSearchParams(location.search).has("dev");

function applyBodyFont(family) {
  document.body.style.fontFamily = `"${family}", system-ui, sans-serif`;
}

function setupFontPicker() {
  if (!isDev) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  const families = BODY_FONTS.slice(1).map((f) => {
    const name = f.replaceAll(" ", "+");
    // Varela Round has a single weight.
    return f === "Varela Round" ? `family=${name}` : `family=${name}:wght@400;600`;
  });
  link.href = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  document.head.append(link);

  const picker = document.getElementById("font-picker");
  for (const family of BODY_FONTS) picker.add(new Option(family, family));
  let saved = null;
  try {
    saved = localStorage.getItem(FONT_KEY);
  } catch {
    // Use the default font.
  }
  picker.value = BODY_FONTS.includes(saved) ? saved : BODY_FONTS[0];
  applyBodyFont(picker.value);
  picker.hidden = false;
  picker.addEventListener("change", () => {
    try {
      localStorage.setItem(FONT_KEY, picker.value);
    } catch {
      // The choice only lasts for this visit.
    }
    applyBodyFont(picker.value);
  });
}

async function start() {
  setupFontPicker();
  const saved = loadLayout();
  const walkers = MAWILO_DATA.filter((m) => !m.edge).map((m) => m.file);
  let onStage;
  let layout;
  if (saved && Object.keys(saved).length > 0) {
    onStage = Object.keys(saved).filter((n) => byFile.has(n));
    layout = saved;
  } else {
    onStage = [SIGN_CARRIERS, ...walkers.filter((n) => n !== SIGN_CARRIERS).slice(0, capacity() - 1)];
    layout = scatterLayout(onStage);
  }
  offstage = shuffle(MAWILO_DATA.map((m) => m.file).filter((n) => !onStage.includes(n)));
  if (hasDragged) hint.classList.add("done");
  await intro(onStage, layout);
  document.body.classList.add("ready");
  startArrivals();
  if (!reducedMotion) startIdleMoves();
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
