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
function figureBox(name, size, r = 8, y = 0.75) {
  const h = figureSize() * (SCALE[name] || 1) * size * depthAt(y);
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
  // Bobble and Ziggy are placed as one pair, side by side, with Ziggy
  // leaning towards Bobble. The others are placed one by one.
  const units = names.filter((n) => !SIGN_CARRIERS.includes(n)).map((n) => [n]);
  if (SIGN_CARRIERS.every((n) => names.includes(n))) units.unshift(SIGN_CARRIERS);
  units.forEach((unit, i) => {
    const pair = unit.length === 2;
    const size = pair ? 1 : 0.82 + rand() * 0.4;
    const r = pair ? 0 : (rand() - 0.5) * 16;
    const parts = pair
      ? [figureBox(unit[0], 1, 0), figureBox(unit[1], 1, PAIR_LEAN)]
      : [figureBox(unit[0], size, r)];
    const overlap = pair ? Math.min(parts[0].w, parts[1].w) * 0.12 : 0;
    const box = {
      w: parts.reduce((sum, b) => sum + b.w, 0) - overlap,
      h: Math.max(...parts.map((b) => b.h)),
    };
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
    if (!pair) {
      layout[unit[0]] = { ...best, r, z: i + 1, size };
      return;
    }
    const cx = best.x * innerWidth;
    layout[unit[0]] = { x: (cx - box.w / 2 + parts[0].w / 2) / innerWidth, y: best.y, r: 0, z: i + 1, size };
    layout[unit[1]] = { x: (cx + box.w / 2 - parts[1].w / 2) / innerWidth, y: best.y, r: PAIR_LEAN, z: i + 2, size };
  });
  return layout;
}

// Photo box

// Room left free at the top of the screen, above the title. Phones get
// more, so the title clears the notch and the status bar.
const TOP_GAP = matchMedia("(max-width: 640px)").matches ? 40 : 14;

const box = document.getElementById("box");
const boxPile = document.getElementById("box-pile");
const boxCount = document.getElementById("box-count");

const quickIn = document.getElementById("quick-in");
const quickBye = document.getElementById("quick-bye");

// Where the footer with the tickets and the photo stack sits, in pixels.
// MaWiLos do not start there and are not pushed onto it.
function boxRect() {
  const r = document.querySelector(".footer").getBoundingClientRect();
  return { left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 };
}

// MaWiLos that "bye" can pick. Bobble and Ziggy stay on the board.
function byeChoices() {
  return [...figures.values()].filter((f) => f.state === "resident" && !f.dragging && !SIGN_CARRIERS.includes(f.name));
}

// The buttons above the box bring in a surprise MaWiLo, or say bye to one.
quickIn.addEventListener("click", () => {
  const name = pick(offstage.filter((n) => !figures.has(n)));
  if (name) invite(name);
});

quickBye.addEventListener("click", () => {
  const f = pick(byeChoices());
  if (f) sendOff(f);
});

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
  quickIn.disabled = waiting.length === 0;
  quickBye.disabled = byeChoices().length === 0;
  box.setAttribute("aria-label", `Photo box, ${waiting.length} MaWiLos to meet`);
  if (card.classList.contains("open")) syncCardAction();
  if (album.classList.contains("open")) syncAlbum();
}

// The album lays out a photo of every MaWiLo with its name. Tapping one
// opens its card. MaWiLos on the board have a turquoise dot.
const album = document.getElementById("album");
const albumGrid = document.getElementById("album-grid");
const albumItems = new Map();

function buildAlbum() {
  const tilt = seededRandom(5);
  for (const m of MAWILO_DATA) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "album-photo";
    item.style.setProperty("--tilt", `${(tilt() - 0.5) * 7}deg`);
    item.innerHTML = `<img alt="" draggable="false" loading="lazy"><span class="album-name"></span><span class="album-dot" aria-hidden="true"></span>`;
    item.querySelector("img").src = `img/${m.file}.png`;
    item.querySelector(".album-name").textContent = m.name;
    item.addEventListener("click", () => openCard(m.file));
    albumGrid.append(item);
    albumItems.set(m.file, item);
  }
}

function syncAlbum() {
  for (const [name, item] of albumItems) {
    const onBoard = figures.get(name)?.state === "resident";
    item.classList.toggle("on-board", onBoard);
    item.setAttribute("aria-label", `${byFile.get(name).name}${onBoard ? ", on the board" : ""}`);
  }
}

function openAlbum() {
  syncAlbum();
  album.hidden = false;
  void album.offsetWidth;
  album.classList.add("open");
  if (!reducedMotion) {
    [...albumItems.values()].forEach((item, i) => {
      item.animate(
        [
          { transform: "translateY(24px) scale(0.9)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 350, delay: Math.min(i * 18, 500), easing: "ease-out", fill: "backwards" },
      );
    });
  }
  document.getElementById("album-close").focus({ preventScroll: true });
}

async function closeAlbum() {
  if (!album.classList.contains("open")) return;
  album.classList.remove("open");
  await wait(reducedMotion ? 0 : 300);
  if (!album.classList.contains("open")) album.hidden = true;
}

document.getElementById("album-close").addEventListener("click", closeAlbum);

box.addEventListener("click", () => {
  if (!reducedMotion) {
    boxPile.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0deg)" }],
      { duration: 500, easing: "ease-out" },
    );
  }
  openAlbum();
});

// A spot on the board away from the MaWiLos already there, clear of the
// title.
function freeSpot(name) {
  const others = [...figures.values()].filter((f) => f.state === "resident");
  return bestSpot(Math.random, figureBox(name, 1), others);
}

// Tapping a MaWiLo makes it do its signature move, and then its card
// opens.
async function tapMawilo(f) {
  await playSignature(f);
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

// Bring a MaWiLo in from offstage. It heads for the middle and bumps the
// others out of the way.
async function invite(name) {
  const f = figures.get(name);
  if (f?.state === "resident" || f?.state === "leaving") return;
  const spot = centreSpot(name);

  offstage = offstage.filter((n) => n !== name);
  const g = makeFigure(name, { x: 0.5, y: 2, r: rand(-6, 6), z: ++topZ, size: 1 }, "resident");
  await g.img.decode().catch(() => {});
  const { w } = extent(g);
  g.x = spot.x < 0.5 ? -w / 2 : 1 + w / 2;
  // Come in on a slight diagonal, from a little above or below.
  g.y = clamp(spot.y + rand(-0.14, 0.14), 0.2, 0.92);
  place(g);
  void g.el.offsetWidth;
  const px = Math.abs(spot.x - g.x) * innerWidth;
  await moveTo(g, spot.x, spot.y, "walk", clamp((px / 160) * 1000, 1400, 3200));
  // Once it has arrived, it does its signature move, unless someone has
  // already picked it up or sent it away.
  if (g.state === "resident" && !g.dragging && figures.get(name) === g) await playSignature(g);
}

// Perspective: a MaWiLo higher up the screen is further away, so it is
// drawn smaller and behind the ones lower down. One being dragged is always
// in front.
const NEAR = 1.12;
const FAR = 0.8;

function depthAt(y) {
  const top = (titleRect().bottom || 0) / innerHeight;
  const t = clamp((y - top) / Math.max(0.1, 1 - top), 0, 1);
  return FAR + (NEAR - FAR) * t;
}

function place(f) {
  f.el.style.setProperty("--x", f.x);
  f.el.style.setProperty("--y", f.y);
  f.el.style.setProperty("--r", `${f.r}deg`);
  f.el.style.setProperty("--depth", depthAt(f.y).toFixed(3));
  f.el.style.zIndex = f.dragging ? 5000 : Math.round(clamp(f.y, -1, 2) * 1000) + 1000;
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

// Move a figure with a waddle or a march, and resolve when it gets there.
// It takes `ms` when given, and otherwise goes at walking pace.
async function moveTo(f, x, y, how, ms) {
  if (reducedMotion) {
    f.x = x;
    f.y = y;
    place(f);
    return;
  }
  ms ||= Math.max(900, (Math.abs(x - f.x) * innerWidth * 1000) / WALK_SPEED);
  f.el.style.setProperty("--dur", `${ms}ms`);
  const cls = how === "march" ? "marching" : "walking";
  f.el.classList.add(cls);
  void f.el.offsetWidth;
  f.x = x;
  f.y = y;
  place(f);
  // Let the rocking die away over the last part of the walk, then stop.
  await wait(Math.max(0, ms - 700));
  f.el.classList.add("slowing");
  await wait(700);
  f.el.classList.remove("slowing", cls);
}

function nearestEdge(f) {
  const d = { left: f.x, right: 1 - f.x, bottom: 1 - f.y };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}

// A MaWiLo leaves quietly: it walks off the nearer side of the screen.
async function sendOff(f) {
  f.state = "leaving";
  syncBox();
  const { w } = extent(f);
  const x = f.x < 0.5 ? -w : 1 + w;
  await moveTo(f, x, f.y, "walk", clamp(Math.abs(x - f.x) * innerWidth * 4, 1200, 2400));
  f.el.remove();
  figures.delete(f.name);
  offstage.push(f.name);
  syncBox();
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
    // Stop any walk in progress so the figure follows the pointer.
    f.el.classList.remove("walking", "marching", "slowing");
    moved = 0;
    f.z = ++topZ;
    f.el.style.zIndex = 5000;
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
      sendOff(f);
      return;
    }
    syncBox();
  };
  f.el.addEventListener("pointerup", drop);
  f.el.addEventListener("pointercancel", drop);
}

// Signature moves. Each MaWiLo has one, named by `move` in data.js, and
// makes it when it arrives and when it is tapped. Each move runs on the
// image, so it does not disturb the figure's place on the board.
const SIGNATURE_MOVES = {
  bounce: [
    ["translateY(0) scale(1, 1)", "translateY(0) scale(1.08, 0.9)", "translateY(-16%) scale(0.95, 1.06)", "translateY(0) scale(1.05, 0.94)", "translateY(-7%) scale(0.98, 1.02)", "translateY(0) scale(1, 1)"],
    900,
  ],
  hop: [["translateY(0)", "translateY(-12%)", "translateY(0)", "translateY(-5%)", "translateY(0)"], 700],
  jump: [
    ["translateY(0) scale(1, 1)", "translateY(4%) scale(1.06, 0.9)", "translateY(-26%) scale(0.96, 1.06)", "translateY(0) scale(1.06, 0.92)", "translateY(0) scale(1, 1)"],
    800,
  ],
  spin: [["rotate(0deg)", "rotate(360deg)"], 800],
  twirl: [["rotate(0deg) scaleX(1)", "rotate(0deg) scaleX(-1)", "rotate(0deg) scaleX(1)"], 700],
  flip: [["scaleX(1)", "scaleX(-1)", "scaleX(-1)", "scaleX(1)"], 1100],
  roll: [["translateX(0) rotate(0deg)", "translateX(12%) rotate(80deg)", "translateX(-6%) rotate(-30deg)", "translateX(0) rotate(0deg)"], 1000],
  wiggle: [["rotate(0deg)", "rotate(-8deg)", "rotate(7deg)", "rotate(-5deg)", "rotate(3deg)", "rotate(0deg)"], 800],
  wobble: [["skewX(0deg)", "skewX(-9deg)", "skewX(8deg)", "skewX(-5deg)", "skewX(3deg)", "skewX(0deg)"], 900],
  shimmy: [["translateX(0)", "translateX(-5%)", "translateX(5%)", "translateX(-5%)", "translateX(5%)", "translateX(0)"], 700],
  shiver: [["translateX(0)", "translateX(-2%)", "translateX(2%)", "translateX(-2%)", "translateX(2%)", "translateX(-1%)", "translateX(1%)", "translateX(0)"], 600],
  sway: [["rotate(0deg)", "rotate(-10deg)", "rotate(10deg)", "rotate(0deg)"], 1400],
  wave: [["rotate(0deg)", "rotate(12deg)", "rotate(-4deg)", "rotate(12deg)", "rotate(0deg)"], 1000],
  nod: [["rotate(0deg) translateY(0)", "rotate(6deg) translateY(3%)", "rotate(0deg) translateY(0)", "rotate(6deg) translateY(3%)", "rotate(0deg) translateY(0)"], 900],
  bow: [["rotate(0deg) scaleY(1)", "rotate(14deg) scaleY(0.94)", "rotate(14deg) scaleY(0.94)", "rotate(0deg) scaleY(1)"], 1100],
  tip: [["rotate(0deg)", "rotate(-12deg)", "rotate(-12deg)", "rotate(0deg)"], 900],
  stretch: [["scale(1, 1)", "scale(0.92, 1.14)", "scale(0.92, 1.14)", "scale(1.04, 0.96)", "scale(1, 1)"], 1000],
  stomp: [["translateY(0) rotate(0deg)", "translateY(-6%) rotate(-5deg)", "translateY(0) rotate(0deg)", "translateY(-6%) rotate(5deg)", "translateY(0) rotate(0deg)"], 800],
  headbang: [["rotate(0deg)", "rotate(10deg)", "rotate(-4deg)", "rotate(10deg)", "rotate(-4deg)", "rotate(0deg)"], 800],
  flutter: [["scaleX(1)", "scaleX(0.9)", "scaleX(1.06)", "scaleX(0.9)", "scaleX(1.06)", "scaleX(1)"], 700],
};

// Play a MaWiLo's stop-motion trick by swapping its image through the
// frames in img/frames/, then back to the first one.
function playTrick(f) {
  const count = byFile.get(f.name).frames;
  return new Promise((resolve) => {
    let i = 1;
    const step = () => {
      i += 1;
      if (i > count || f.state !== "resident") {
        f.img.src = `img/${f.name}.png`;
        resolve();
        return;
      }
      f.img.src = `img/frames/${f.name}-${i}.png`;
      setTimeout(step, 450);
    };
    setTimeout(step, 100);
  });
}

// Load the trick frames early so they swap in without a flicker.
for (const m of MAWILO_DATA) {
  for (let i = 1; i <= (m.frames || 0); i++) new Image().src = `img/frames/${m.file}-${i}.png`;
}

// Play a MaWiLo's signature move, and resolve when it is done.
async function playSignature(f) {
  if (reducedMotion || f.dragging || f.moving) return;
  const m = byFile.get(f.name);
  f.moving = true;
  if (m.move === "trick") {
    await playTrick(f);
  } else {
    const [frames, duration] = SIGNATURE_MOVES[m.move] || SIGNATURE_MOVES.wiggle;
    await f.img
      .animate(frames.map((transform) => ({ transform })), { duration, easing: "ease-in-out" })
      .finished.catch(() => {});
  }
  f.moving = false;
}

// Now and then, one MaWiLo on the board breathes or wiggles a little, to
// invite play. The same one never moves twice in a row.
const IDLE_MOVES = [
  [["rotate(0deg)", "rotate(-1deg)", "rotate(0.8deg)", "rotate(-0.5deg)", "rotate(0deg)"], 2600],
  [["scale(1, 1)", "scale(1.01, 1.02)", "scale(1, 1)"], 3400],
];

function startIdleMoves() {
  let last = null;
  const tick = () => {
    const resting = [...figures.values()].filter(
      (f) => f.state === "resident" && !f.dragging && !f.moving && f !== last,
    );
    const f = pick(resting);
    if (f) {
      const [frames, duration] = pick(IDLE_MOVES);
      f.img.animate(frames.map((transform) => ({ transform })), { duration, easing: "ease-in-out" });
      last = f;
    }
    setTimeout(tick, rand(4000, 8000));
  };
  setTimeout(tick, 3000);
}

// Bumping

// MaWiLos on the board do not overlap by more than a little. Every frame,
// any two that overlap push each other apart, like a collision force in a
// force layout. A MaWiLo that is walking in or being dragged pushes but is
// not pushed, so it shoves the others out of its way, and they shove the
// ones behind them. A MaWiLo that gets pushed gives a small squish.

// Only this much of each MaWiLo's box counts, so a small overlap is fine.
const SOLID = 0.8;
// The share of an overlap that is undone in one frame. Lower is softer.
const STIFFNESS = 0.22;

function solidBox(f) {
  const r = f.el.getBoundingClientRect();
  const w = r.width * SOLID;
  const h = r.height * SOLID;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return { cx, cy, w, h, full: r };
}

function squish(f, horizontal) {
  const now = performance.now();
  if (reducedMotion || now - (f.squishedAt || 0) < 600) return;
  f.squishedAt = now;
  const squashed = horizontal ? "scale(0.93, 1.05)" : "scale(1.05, 0.93)";
  f.img.animate([{ transform: "scale(1, 1)" }, { transform: squashed }, { transform: "scale(1, 1)" }], {
    duration: 380,
    easing: "ease-out",
    composite: "add",
  });
}

function startBumping() {
  const step = () => {
    const bodies = [...figures.values()]
      .filter((f) => f.state === "resident")
      .map((f) => ({
        f,
        box: solidBox(f),
        fixed: f.dragging || f.el.classList.contains("walking") || f.el.classList.contains("marching"),
        dx: 0,
        dy: 0,
      }));
    // The title and the photo box are solid too, but never move.
    const t = titleRect();
    const k = boxRect();
    for (const r of [t, k]) {
      bodies.push({
        box: { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.right - r.left, h: r.bottom - r.top },
        fixed: true,
        dx: 0,
        dy: 0,
      });
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.fixed && b.fixed) continue;
        // Bobble and Ziggy stand close on purpose, and do not push apart.
        if (a.f && b.f && SIGN_CARRIERS.includes(a.f.name) && SIGN_CARRIERS.includes(b.f.name)) continue;
        const ox = (a.box.w + b.box.w) / 2 - Math.abs(a.box.cx - b.box.cx);
        const oy = (a.box.h + b.box.h) / 2 - Math.abs(a.box.cy - b.box.cy);
        if (ox <= 0 || oy <= 0) continue;
        // Push apart along the line between their centres, measured against
        // their sizes, so a crowd spreads out evenly in every direction.
        let nx = (a.box.cx - b.box.cx) / ((a.box.w + b.box.w) / 2);
        let ny = (a.box.cy - b.box.cy) / ((a.box.h + b.box.h) / 2);
        const len = Math.hypot(nx, ny) || 1;
        if (len < 1e-3) nx = 1;
        nx /= len;
        ny /= len;
        const amount = Math.min(ox, oy) * STIFFNESS * 2;
        const horizontal = Math.abs(nx) > Math.abs(ny);
        const shareA = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const shareB = 1 - shareA;
        a.dx += nx * amount * shareA;
        a.dy += ny * amount * shareA;
        b.dx -= nx * amount * shareB;
        b.dy -= ny * amount * shareB;
        if (amount > 1.2) {
          if (shareA) squish(a.f, horizontal);
          if (shareB) squish(b.f, horizontal);
        }
      }
    }
    // A soft spring keeps Ziggy beside Bobble, wherever the pair is pushed.
    const [bobble, ziggy] = SIGN_CARRIERS.map((n) => bodies.find((body) => body.f?.name === n));
    if (bobble && ziggy) {
      const gap = (bobble.box.w + ziggy.box.w) / 2 / SOLID * 0.88;
      const ex = bobble.box.cx + gap - ziggy.box.cx;
      const ey = bobble.box.cy - ziggy.box.cy;
      const pull = 0.08;
      const shareB = bobble.fixed ? 0 : ziggy.fixed ? 1 : 0.5;
      bobble.dx -= ex * pull * shareB;
      bobble.dy -= ey * pull * shareB;
      ziggy.dx += ex * pull * (1 - shareB);
      ziggy.dy += ey * pull * (1 - shareB);
    }
    for (const body of bodies) {
      if (!body.f || (!body.dx && !body.dy)) continue;
      const { full } = body.box;
      // Keep every MaWiLo on the screen while it is pushed.
      const dx = clamp(body.dx, 8 - full.left, innerWidth - 8 - full.right);
      const dy = clamp(body.dy, TOP_GAP - full.top, innerHeight - 8 - full.bottom);
      body.f.x += dx / innerWidth;
      body.f.y += dy / innerHeight;
      place(body.f);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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

// The card button brings an offstage MaWiLo in, or says bye to one on the
// board.
const cardAction = document.getElementById("card-action");

function syncCardAction() {
  if (!cardFile) return;
  const f = figures.get(cardFile);
  const onBoard = f && f.state !== "leaving";
  cardAction.textContent = onBoard ? "bye" : "come in";
  cardAction.classList.toggle("home", Boolean(onBoard));
}

cardAction.addEventListener("click", async () => {
  const name = cardFile;
  const f = figures.get(name);
  // Put the card and the album away first, so the walk can be seen.
  await Promise.all([closeCard(), closeAlbum()]);
  if (f && f.state !== "leaving") sendOff(f);
  else invite(name);
});

// The first time a card opens, the right arrow steps out a little to the
// right and back twice, to show that the cards can be flicked through.
let nudged = false;

function nudgeCard() {
  if (nudged || reducedMotion) return;
  nudged = true;
  document.getElementById("card-next").animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(7px)" },
      { transform: "translateX(0)" },
      { transform: "translateX(7px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 1200, delay: 900, easing: "ease-in-out" },
  );
}

function openCard(file) {
  fillCard(file);
  nudgeCard();
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
  if (event.key === "Escape") {
    if (card.classList.contains("open")) closeCard();
    else closeAlbum();
  }
  if (event.key === "ArrowLeft") stepCard(-1);
  if (event.key === "ArrowRight") stepCard(1);
});
board.addEventListener("pointerdown", (event) => {
  if (event.target === board) closeCard();
});

const SIGN_CARRIERS = ["blue-tassels-striped-body", "blue-striped-dress"];
// Ziggy, on the right, leans this far towards Bobble.
const PAIR_LEAN = -40;

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
  const carriers = SIGN_CARRIERS.map((name, i) => {
    const target = layout[name];
    const f = makeFigure(name, { ...(target || { r: 0, z: ++topZ }), y: 2 }, target ? "resident" : "leaving");
    // The right carrier leans left so the two face each other.
    f.r = i === 1 ? PAIR_LEAN : 0;
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
    if (!target) return sendOff(f);
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
      f.y = edge === "bottom" ? 1 + h / 2 : clamp(target.y + rand(-0.14, 0.14), 0.2, 0.92);
      place(f);
      void f.el.offsetWidth;
      await moveTo(f, target.x, target.y, "walk", rand(1700, 2300));
    }),
  ]);

  // Once everyone is in, three of them do their moves, one after another.
  const performers = shuffle(entering.map(({ f }) => f)).slice(0, 3);
  for (const f of performers) {
    await wait(350);
    await playSignature(f);
  }
}

async function start() {
  buildAlbum();
  await Promise.all([loadAspects(), document.fonts.ready]);
  const walkers = MAWILO_DATA.map((m) => m.file);
  const others = shuffle(walkers.filter((n) => !SIGN_CARRIERS.includes(n)));
  const wanted = [...SIGN_CARRIERS, ...others.slice(0, capacity() - SIGN_CARRIERS.length)];
  const layout = scatterLayout(wanted);
  const onStage = wanted.filter((n) => layout[n]);
  offstage = shuffle(MAWILO_DATA.map((m) => m.file).filter((n) => !onStage.includes(n)));
  await intro(onStage, layout);
  document.body.classList.add("ready");
  syncBox();
  startBumping();
  if (!reducedMotion) startIdleMoves();
}

start();
