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
};

const STORAGE_KEY = "mawilo-layout-v2";
const TAP_DISTANCE = 6;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const byFile = new Map(MAWILO_DATA.map((m) => [m.file, m]));
const walkers = MAWILO_DATA.filter((m) => !m.edge).map((m) => m.file);
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

// How many mawilos fit on the board at the start, from about 4 on a phone
// to about 10 on a large screen.
function capacity() {
  const size = Math.min(innerHeight * 0.19, innerWidth * 0.23);
  const cols = Math.floor(innerWidth / (size * 1.5));
  const rows = Math.floor((innerHeight * 0.85) / (size * 1.35));
  return clamp(Math.round(cols * rows * 0.6), 4, 12);
}

// Place mawilos on a loose grid, the same way on every load.
function gridLayout(names) {
  const rand = seededRandom(42);
  const n = names.length;
  const aspect = innerWidth / innerHeight;
  const cols = Math.max(2, Math.round(Math.sqrt(n * aspect * 1.3)));
  const rows = Math.ceil(n / cols);
  const layout = {};
  names.forEach((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layout[name] = {
      x: 0.12 + ((col + 0.5 + (rand() - 0.5) * 0.4) / cols) * 0.76,
      y: 0.1 + ((row + 0.5 + (rand() - 0.5) * 0.3) / rows) * 0.78,
      r: (rand() - 0.5) * 12,
      z: i + 1,
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
    if (f.state === "resident") stage[name] = { x: f.x, y: f.y, r: f.r, z: f.z };
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
  el.style.setProperty("--s", SCALE[name] || 1);
  const img = document.createElement("img");
  img.src = `img/${name}.png`;
  img.alt = byFile.get(name).description;
  img.draggable = false;
  el.append(img);
  board.append(el);

  const f = { name, el, img, state, ...pos };
  topZ = Math.max(topZ, f.z);
  place(f);
  enableDrag(f);
  figures.set(name, f);
  return f;
}

// Move a figure with a waddle (sideways) or a pop (up and down), and resolve
// when it gets there.
async function moveTo(f, x, y, how) {
  if (reducedMotion) {
    f.x = x;
    f.y = y;
    place(f);
    return;
  }
  let ms;
  if (how === "walk") {
    ms = Math.max(600, (Math.abs(x - f.x) * innerWidth * 1000) / 120);
    f.el.style.setProperty("--dur", `${ms}ms`);
  } else {
    ms = how === "pop" ? 700 : 450;
  }
  const cls = { walk: "walking", pop: "popping", sink: "sinking" }[how];
  f.el.classList.add(cls);
  void f.el.offsetWidth;
  f.x = x;
  f.y = y;
  place(f);
  await wait(ms);
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
  if (edge === "left") await moveTo(f, -0.15, f.y, "walk");
  else if (edge === "right") await moveTo(f, 1.15, f.y, "walk");
  else await moveTo(f, f.x, 1.3, "sink");
  f.el.remove();
  figures.delete(f.name);
  offstage.push(f.name);
  saveLayout();
}

// One mawilo at a time comes to the edge and waits to be dragged in. If
// nobody takes it, it leaves the way it came after a while.
async function arrive() {
  if (waiting || offstage.length === 0) return;
  const name = offstage.shift();
  const edge = pick(["left", "right", "bottom"]);
  const y = rand(0.25, 0.75);
  const x = rand(0.2, 0.8);
  const start = {
    left: { x: -0.15, y },
    right: { x: 1.15, y },
    bottom: { x, y: 1.3 },
  }[edge];
  const f = makeFigure(name, { ...start, r: rand(-5, 5), z: ++topZ }, "waiting");
  waiting = f;
  void f.el.offsetWidth;
  if (edge === "left") await moveTo(f, 0.05, y, "walk");
  else if (edge === "right") await moveTo(f, 0.95, y, "walk");
  else await moveTo(f, x, 0.92, "pop");
  if (f.state !== "waiting") return;
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

function enableDrag(f) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let lastX = 0;
  let tilt = 0;
  let moved = 0;

  f.el.addEventListener("pointerdown", (event) => {
    if (f.state === "leaving") return;
    event.preventDefault();
    f.el.setPointerCapture(event.pointerId);
    f.dragging = true;
    // Stop any walk or pop in progress so the figure follows the pointer.
    f.el.classList.remove("walking", "popping", "sinking");
    moved = 0;
    f.z = ++topZ;
    f.el.style.zIndex = f.z;
    f.el.classList.add("lifted");
    startX = lastX = event.clientX;
    startY = event.clientY;
    originX = f.x;
    originY = f.y;
  });

  f.el.addEventListener("pointermove", (event) => {
    if (!f.dragging) return;
    moved = Math.max(moved, Math.hypot(event.clientX - startX, event.clientY - startY));
    f.x = clamp(originX + (event.clientX - startX) / innerWidth, -0.05, 1.05);
    f.y = clamp(originY + (event.clientY - startY) / innerHeight, 0.03, 1.05);
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
    f.el.classList.remove("lifted");

    if (moved < TAP_DISTANCE) {
      openCard(f.name);
      return;
    }
    if (!hasDragged) {
      hasDragged = true;
      hint.classList.add("done");
    }
    if (f.x < 0.035 || f.x > 0.965 || f.y > 0.95) {
      sendOff(f, nearestEdge(f));
      return;
    }
    if (f.state === "waiting") {
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
    pick(resting)?.img.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-3deg)" },
        { transform: "rotate(2.5deg)" },
        { transform: "rotate(-1.5deg)" },
        { transform: "rotate(0deg)" },
      ],
      { duration: 900, easing: "ease-in-out" },
    );
    setTimeout(nudge, rand(5000, 9000));
  };
  setTimeout(nudge, 2500);
}

function startPeekers() {
  const peekers = MAWILO_DATA.filter((m) => m.edge).map((m) => {
    const el = document.createElement("div");
    el.className = `peeker ${m.edge}`;
    const img = document.createElement("img");
    img.src = `img/${m.file}.png`;
    img.alt = m.description;
    img.draggable = false;
    el.append(img);
    el.addEventListener("click", () => openCard(m.file));
    document.body.append(el);
    return { el, img, wiggle: m.file === "blue-anteater-shaggy-mane" };
  });
  if (reducedMotion) return;

  const peek = (p) => {
    p.el.classList.add("up");
    if (p.wiggle) {
      setTimeout(() => {
        p.img.animate(
          [
            { transform: "rotate(0deg)" },
            { transform: "rotate(-5deg)" },
            { transform: "rotate(4deg)" },
            { transform: "rotate(-3deg)" },
            { transform: "rotate(2deg)" },
            { transform: "rotate(0deg)" },
          ],
          { duration: 1000, easing: "ease-in-out" },
        );
      }, 500);
    }
    setTimeout(() => p.el.classList.remove("up"), rand(4000, 6000));
  };
  const loop = () => {
    peek(pick(peekers));
    setTimeout(loop, rand(16000, 26000));
  };
  setTimeout(loop, rand(10000, 14000));
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

function start() {
  const saved = loadLayout();
  let onStage;
  let layout;
  if (saved && Object.keys(saved).length > 0) {
    onStage = Object.keys(saved).filter((n) => byFile.has(n) && !byFile.get(n).edge);
    layout = saved;
  } else {
    onStage = walkers.slice(0, capacity());
    layout = gridLayout(onStage);
  }
  for (const name of onStage) makeFigure(name, layout[name], "resident");
  offstage = shuffle(walkers.filter((n) => !onStage.includes(n)));

  if (hasDragged) hint.classList.add("done");
  startPeekers();
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
