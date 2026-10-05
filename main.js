// MaWiLos on the board stay where they are put. The rest wait in the photo
// stack until the "come in" ticket brings them in. Pushing a MaWiLo to the
// edge of the screen, or the "bye" ticket, sends one back.

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
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const byFile = new Map(MAWILO_DATA.map((m) => [m.file, m]));
const board = document.getElementById("board");
const figures = new Map();
let offstage = [];

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

// Keep in step with --size in style.css.
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

// Where the title rests at the top, in pixels. The title's size only
// changes when the screen or the font changes, so it is measured once and
// again after a resize, not on every frame.
let titleSize = null;
addEventListener("resize", () => (titleSize = null));
document.fonts?.addEventListener?.("loadingdone", () => (titleSize = null));

function titleRect() {
  if (!titleSize) {
    const title = document.getElementById("title");
    titleSize = { w: title.offsetWidth, h: title.offsetHeight };
  }
  const { w, h } = titleSize;
  return { left: (innerWidth - w) / 2, top: TOP_GAP, right: (innerWidth + w) / 2, bottom: TOP_GAP + h };
}

// The size of a figure on screen, in pixels, including the extra room it
// takes up when tilted by `r` degrees.
function figureBox(name, size, r = 8) {
  const h = figureSize() * (SCALE[name] || 1) * size * depthAt(0.75);
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

// A spot is valid when the figure is fully on screen, clear of the title,
// and clear of the footer.
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
  const b = footerRect();
  return !(left < b.right && right > b.left && top < b.bottom && bottom > b.top);
}

// How many MaWiLos fit on the board at the start, from 4 on a small phone
// to 12 on a large screen. The title takes up room too.
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

// Scatter MaWiLos loosely over the board, with slightly varied sizes. The
// spots are the same on every load. None of them overlaps the title or
// another one. A MaWiLo that does not fit stays offstage, so on small
// screens fewer start on the board.
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
  units.forEach((unit) => {
    const pair = unit.length === 2;
    // The MaWiLos with stop-motion tricks start a little bigger, more so on
    // phones, so their tricks are easy to see.
    const trick = byFile.get(unit[0]).move === "trick";
    const trickSize = matchMedia("(max-width: 640px)").matches ? 1.3 : 1.1;
    const size = pair ? 1 : trick ? trickSize : 0.82 + rand() * 0.4;
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
      layout[unit[0]] = { ...best, r, size };
      return;
    }
    const cx = best.x * innerWidth;
    layout[unit[0]] = { x: (cx - box.w / 2 + parts[0].w / 2) / innerWidth, y: best.y, r: 0, size };
    layout[unit[1]] = { x: (cx + box.w / 2 - parts[1].w / 2) / innerWidth, y: best.y, r: PAIR_LEAN, size };
  });
  return layout;
}

// Footer: the photo stack and the tickets

// The footer is a little bigger on large screens, and shrinks to fit on
// narrow phones, so the stack and both tickets are always fully on screen.
const footer = document.querySelector(".footer");

function fitFooter() {
  const wanted = innerWidth >= 900 ? 1.3 : 1;
  const fits = (innerWidth - 16) / footer.offsetWidth;
  footer.style.transform = `translateX(-50%) scale(${Math.min(wanted, fits).toFixed(3)})`;
}

addEventListener("resize", fitFooter);

// Room left free at the top of the screen, above the title. Phones get
// more, so the title clears the notch and the status bar.
const TOP_GAP = matchMedia("(max-width: 640px)").matches ? 40 : 14;

const stack = document.getElementById("stack");
const stackPile = document.getElementById("stack-pile");
const ticketNumber = document.getElementById("ticket-number");

const ticketIn = document.getElementById("ticket-in");
const ticketBye = document.getElementById("ticket-bye");

// Where the footer with the tickets and the photo stack sits, in pixels.
// MaWiLos do not start there and are not pushed onto it.
function footerRect() {
  const r = footer.getBoundingClientRect();
  return { left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 };
}

// MaWiLos that "bye" can pick. Bobble and Ziggy stay on the board.
function byeChoices() {
  return [...figures.values()].filter(
    (f) =>
      f.state === "resident" &&
      !f.parked &&
      !f.dragging &&
      !f.el.matches(".walking") &&
      !SIGN_CARRIERS.includes(f.name),
  );
}

// The tickets bring in the MaWiLo on top of the stack, or say bye to a
// surprise one.
ticketIn.addEventListener("click", () => {
  if (!document.body.classList.contains("footer-in")) return;
  // The ticket brings in the MaWiLo on top of the photo stack. If that one
  // is still walking off after a "bye", it turns round once it is gone.
  const name = offstage[0];
  const leaving = figures.get(name);
  if (leaving?.state === "leaving") leaving.gone.then(() => invite(name));
  else if (name) invite(name);
});

ticketBye.addEventListener("click", () => {
  if (!document.body.classList.contains("footer-in")) return;
  const f = pick(byeChoices());
  if (f) sendOff(f);
});

// When the top photo changes, it slides out to the side and the next one
// comes forward, like the shuffle on the cards. The new photos are put in
// half way, while the top one is out of the way.
let pileTop;

function shufflePile(showPile) {
  const top = stackPile.lastElementChild;
  top.getAnimations().forEach((a) => a.finish());
  top.animate(
    [
      { translate: "0 0", rotate: "0deg" },
      { translate: "-46px 4px", rotate: "-16deg", offset: 0.45 },
      { translate: "0 0", rotate: "0deg" },
    ],
    { duration: 620, easing: "ease-in-out", composite: "add" },
  );
  setTimeout(showPile, 280);
}

// Show the top three offstage MaWiLos on the pile and how many wait in all.
function syncStack() {
  // Count a MaWiLo as gone the moment it is told to leave, so the count
  // keeps up with quick taps instead of waiting for the walk off.
  const waiting = MAWILO_DATA.map((m) => m.file).filter((n) => figures.get(n)?.state !== "resident");
  const order = (n) => (offstage.includes(n) ? offstage.indexOf(n) : Infinity);
  waiting.sort((a, b) => order(a) - order(b));
  // The photo on top of the pile, the last one, is the next to come in.
  const shown = waiting.slice(0, 3).reverse();
  const photos = [...stackPile.querySelectorAll(".pile-photo")];
  const showPile = () =>
    photos.forEach((el, i) => {
      const name = shown[i - (photos.length - shown.length)];
      el.hidden = !name;
      if (name) el.querySelector("img").src = `img/${name}.png`;
    });
  const nextTop = shown[shown.length - 1] || null;
  if (nextTop !== pileTop && pileTop !== undefined && !reducedMotion) {
    shufflePile(showPile);
  } else {
    showPile();
  }
  pileTop = nextTop;
  ticketNumber.textContent = String(waiting.length);
  ticketNumber.hidden = waiting.length === 0;
  // The tear line sits just right of the number.
  ticketIn.style.setProperty("--stub", `${ticketNumber.offsetWidth}px`);
  // With everyone on the board, the "come in" ticket turns pale and says
  // so instead.
  ticketIn.querySelector(".ticket-text").textContent = waiting.length ? "come in" : "all here!";
  ticketIn.classList.toggle("all-here", waiting.length === 0);
  fitFooter();
  ticketIn.setAttribute("aria-label", waiting.length ? `come in, ${waiting.length} MaWiLos to meet` : "all here");
  ticketIn.disabled = waiting.length === 0;
  ticketBye.disabled = byeChoices().length === 0;
  stack.setAttribute("aria-label", `Photo stack, ${waiting.length} MaWiLos to meet`);
  if (album.classList.contains("open")) syncAlbum();
}

// The album lays out a photo of every MaWiLo with its name. Tapping one
// opens its card.
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
    item.innerHTML = `<img alt="" draggable="false" loading="lazy"><span class="album-name"></span>`;
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
    item.setAttribute("aria-label", `${byFile.get(name).name}${onBoard ? ", on the board" : ""}`);
  }
}

function openAlbum() {
  syncAlbum();
  album.hidden = false;
  syncInert();
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
  syncInert();
}

document.getElementById("album-close").addEventListener("click", closeAlbum);

stack.addEventListener("click", () => {
  if (!reducedMotion) {
    stackPile.animate(
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

// Tapping a MaWiLo starts its signature move, and its card opens shortly
// after, while a longer move finishes behind it.
async function tapMawilo(f) {
  playSignature(f);
  await wait(reducedMotion ? 0 : 700);
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

// A height to walk in from, anywhere between just under the title and the
// bottom of the screen.
function entryY() {
  return rand(titleRect().bottom / innerHeight + 0.04, 0.94);
}

// Bring a MaWiLo in from offstage. It heads for the middle and bumps the
// others out of the way.
// Arrivals that start while another is still walking in.
let arriving = 0;
let lastInvite = 0;

async function invite(name) {
  const f = figures.get(name);
  if (f?.state === "resident" || f?.state === "leaving") return;
  // A lone arrival heads for the middle. When several come in quickly, each
  // takes the freest spot, so they do not all shove for the middle.
  const spot = arriving ? freeSpot(name) : centreSpot(name);
  arriving += 1;
  const invitedAt = (lastInvite = performance.now());

  offstage = offstage.filter((n) => n !== name);
  const g = makeFigure(name, { x: 0.5, y: 2, r: rand(-6, 6), size: 1 }, "resident");
  await g.img.decode().catch(() => {});
  const { w } = extent(g);
  g.x = spot.x < 0.5 ? -w / 2 : 1 + w / 2;
  // Come in from anywhere between just under the title and the bottom.
  g.y = entryY();
  place(g);
  void g.el.offsetWidth;
  const px = Math.abs(spot.x - g.x) * innerWidth;
  await moveTo(g, spot.x, spot.y, "walk", clamp((px / 160) * 1000, 1400, 3200));
  arriving -= 1;
  // Once it has arrived, it does its signature move, unless someone has
  // already picked it up or sent it away. In a quick run of arrivals only
  // the last one does.
  const latest = lastInvite === invitedAt;
  if (latest && g.state === "resident" && !g.dragging && figures.get(name) === g) await playSignature(g);
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
  place(f);
  enableDrag(f);
  figures.set(name, f);
  syncStack();
  return f;
}

// Width and height of a figure as fractions of the board.
function extent(f) {
  return { w: f.el.offsetWidth / innerWidth, h: f.el.offsetHeight / innerHeight };
}

// Move a figure with a waddle or a march over `ms`, and resolve when it
// gets there. A newer move or a drag takes over from an older one.
async function moveTo(f, x, y, how, ms) {
  if (reducedMotion) {
    f.x = x;
    f.y = y;
    place(f);
    return;
  }
  const id = (f.moveId = (f.moveId || 0) + 1);
  f.el.style.setProperty("--dur", `${ms}ms`);
  const cls = how === "march" ? "marching" : "walking";
  f.el.classList.add(cls);
  void f.el.offsetWidth;
  f.x = x;
  f.y = y;
  place(f);
  // Let the rocking die away over the last part of the walk, then stop.
  await wait(Math.max(0, ms - 700));
  if (f.moveId !== id) return;
  f.el.classList.add("slowing");
  await wait(700);
  if (f.moveId !== id) return;
  f.el.classList.remove("slowing", cls);
}

// A MaWiLo leaves quietly: it walks off the nearer side of the screen.
function sendOff(f) {
  f.gone ??= walkOff(f);
  return f.gone;
}

async function walkOff(f) {
  f.state = "leaving";
  // Its photo goes back on top of the stack straight away.
  offstage = [f.name, ...offstage.filter((n) => n !== f.name)];
  syncStack();
  const { w } = extent(f);
  const x = f.x < 0.5 ? -w : 1 + w;
  await moveTo(f, x, f.y, "walk", clamp(Math.abs(x - f.x) * innerWidth * 4, 1200, 2400));
  f.el.remove();
  figures.delete(f.name);
  syncStack();
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
      if (touches.size < 2 && pinch) {
        // If the first finger is still down, it carries on dragging from
        // where the MaWiLo is now.
        pinch.f.pinched = false;
        pinch.f.rebase = true;
        pinch = null;
      }
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
    if (f.state === "leaving" || f.carrying) return;
    event.preventDefault();
    // A second finger is part of a pinch, not a new grab, whether it lands
    // on the same MaWiLo or another one.
    if (f.dragging || pinch) return;
    f.touchId = event.pointerType === "touch" ? event.pointerId : undefined;
    f.el.setPointerCapture(event.pointerId);
    f.dragging = true;
    // Stop any walk in progress so the figure follows the pointer from
    // where it is now, not from where the walk was heading.
    if (f.el.matches(".walking, .marching")) {
      const now = f.el.getBoundingClientRect();
      f.moveId = (f.moveId || 0) + 1;
      f.el.classList.remove("walking", "marching", "slowing");
      f.x = (now.left + now.width / 2) / innerWidth;
      f.y = (now.top + now.height / 2) / innerHeight;
      place(f);
    }
    moved = 0;
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
    if (f.rebase) {
      f.rebase = false;
      startX = lastX = event.clientX;
      startY = event.clientY;
      originX = f.x;
      originY = f.y;
    }
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

    if (f.pinched || f.rebase) {
      f.pinched = false;
      f.rebase = false;
      return;
    }
    if (moved < TAP_DISTANCE) {
      tapMawilo(f);
      return;
    }
    // Bobble and Ziggy stay on the board, so they cannot be pushed off.
    const atEdge = f.x < 0.035 || f.x > 0.965 || f.y > 0.95;
    if (mode === "drag" && atEdge && !SIGN_CARRIERS.includes(f.name)) {
      sendOff(f);
      return;
    }
    syncStack();
  };
  f.el.addEventListener("pointerup", drop);
  f.el.addEventListener("pointercancel", drop);
}

// Signature moves. Each MaWiLo has one, named by `move` in data.js, and
// makes it when it arrives and when it is tapped. A move is a function of
// time from 0 to 1 that returns a transform for the image, and an optional
// pivot. The moves are built from springs: they squash, overshoot and
// settle. Spins turn around the middle of the MaWiLo, other moves around
// its feet.

// A spring that starts at full strength and dies away: `wobbles` swings in
// all, and `fade` is how fast they die down.
const spring = (t, wobbles, fade) => Math.exp(-fade * t) * Math.sin(2 * Math.PI * wobbles * t);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
// A part of the move from `a` to `b`, as 0 to 1.
const part = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

const SIGNATURE_MOVES = {
  // Crouch, jump up stretched, and land with a jelly squash.
  boing: {
    ms: 1100,
    at(t) {
      const crouch = Math.sin(Math.PI * part(t, 0, 0.18)) * 0.14;
      const air = part(t, 0.18, 0.55);
      const up = Math.sin(Math.PI * air) * 30;
      const land = t > 0.55 ? spring(part(t, 0.55, 1), 2.5, 4) * 0.16 : 0;
      const sy = 1 - crouch + (air > 0 && air < 1 ? 0.08 : 0) - land;
      return `translateY(${-up}%) scale(${1 + crouch * 0.8 + land}, ${sy})`;
    },
  },
  // Wobble like jelly on the spot.
  jelly: {
    ms: 1100,
    at(t) {
      const k = spring(t, 4, 3.5) * 0.15;
      return `scale(${1 + k}, ${1 - k})`;
    },
  },
  // Stretch up tall with a springy overshoot, then settle.
  stretch: {
    ms: 1300,
    at(t) {
      const k = spring(t, 2.2, 3) * 0.24;
      return `scale(${1 - k * 0.45}, ${1 + k})`;
    },
  },
  // Jump and spin all the way round in the air, then land with a squash.
  spinjump: {
    ms: 1100,
    origin: "50% 50%",
    at(t) {
      const air = part(t, 0, 0.7);
      const up = Math.sin(Math.PI * air) * 26;
      const land = t > 0.7 ? spring(part(t, 0.7, 1), 1.5, 4) * 0.12 : 0;
      return `translateY(${-up}%) rotate(${ease(air) * 360}deg) scale(${1 + land}, ${1 - land})`;
    },
  },
  // Spin round on the spot, puffing up a little half way.
  twirl: {
    ms: 1000,
    origin: "50% 50%",
    at(t) {
      const puff = Math.sin(Math.PI * t) * 0.1;
      return `rotate(${ease(t) * 360}deg) scale(${1 + puff})`;
    },
  },
  // Rock from side to side like a spring toy on a base.
  wobble: {
    ms: 1300,
    at(t) {
      return `rotate(${spring(t, 3, 3) * 16}deg)`;
    },
  },
  // Three hops, each lower than the last.
  pogo: {
    ms: 1200,
    at(t) {
      const hop = Math.floor(t * 3);
      const u = t * 3 - hop;
      const up = Math.sin(Math.PI * u) * [22, 14, 7][Math.min(hop, 2)];
      const squash = u < 0.12 || u > 0.88 ? 0.08 : 0;
      return `translateY(${-up}%) scale(${1 + squash}, ${1 - squash})`;
    },
  },
  // Shake quickly from side to side, faster at first.
  shake: {
    ms: 800,
    at(t) {
      return `translateX(${spring(t, 6, 4) * 7}%) rotate(${spring(t, 6, 4) * 3}deg)`;
    },
  },
  // Roll a little to one side round the middle and spring back.
  rock: {
    ms: 1300,
    origin: "50% 50%",
    at(t) {
      return `translateX(${spring(t, 1.5, 2.5) * 10}%) rotate(${spring(t, 1.5, 2.5) * 30}deg)`;
    },
  },
  // Swing from the top like a pendulum.
  swing: {
    ms: 1400,
    origin: "50% 5%",
    at(t) {
      return `rotate(${spring(t, 2, 2.5) * 14}deg)`;
    },
  },
  // Rise up on tiptoe twice, springy.
  tiptoe: {
    ms: 1200,
    at(t) {
      const lift = Math.abs(Math.sin(2 * Math.PI * t)) * Math.exp(-1.5 * t);
      return `translateY(${-lift * 8}%) scale(${1 - lift * 0.05}, ${1 + lift * 0.1})`;
    },
  },
  // A heavy bounce, slow and low, for the big ones.
  bob: {
    ms: 1400,
    at(t) {
      const k = spring(t, 2, 3);
      return `translateY(${-Math.max(0, k) * 9}%) scale(${1 - k * 0.07}, ${1 + k * 0.07})`;
    },
  },
  // Lean forward in a bow and spring back up.
  bow: {
    ms: 1300,
    at(t) {
      const down = Math.sin(Math.PI * part(t, 0, 0.5)) * 22;
      const back = t > 0.5 ? spring(part(t, 0.5, 1), 1.5, 4) * -8 : 0;
      return `rotate(${down + back}deg)`;
    },
  },
  // Jump, twirl and land with a wobble, all in one.
  showoff: {
    ms: 1600,
    origin: "50% 50%",
    at(t) {
      const air = part(t, 0, 0.55);
      const up = Math.sin(Math.PI * air) * 24;
      const after = part(t, 0.55, 1);
      const wob = t > 0.55 ? spring(after, 3, 3.5) * 14 : 0;
      const land = t > 0.55 ? spring(after, 2.5, 4) * 0.12 : 0;
      return `translateY(${-up}%) rotate(${ease(air) * 360 + wob}deg) scale(${1 + land}, ${1 - land})`;
    },
  },
};

// Play a MaWiLo's stop-motion trick by swapping its image through the
// frames in img/frames/, then back to the first one.
// The trick plays twice at the speed of the original GIF, with a little
// bounce on each frame.
function playTrick(f) {
  const count = byFile.get(f.name).frames;
  return new Promise((resolve) => {
    let shown = 0;
    const step = () => {
      shown += 1;
      if (shown > count * 2 || f.state !== "resident") {
        f.img.src = `img/${f.name}.png`;
        resolve();
        return;
      }
      f.img.src = `img/frames/${f.name}-${((shown) % count) + 1}.png`;
      f.img.animate(
        [{ transform: "scale(1, 1)" }, { transform: "scale(1.04, 0.95)" }, { transform: "scale(1, 1)" }],
        { duration: 260, easing: "ease-out" },
      );
      setTimeout(step, 500);
    };
    step();
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
    const move = SIGNATURE_MOVES[m.move] || SIGNATURE_MOVES.jelly;
    const steps = Math.round(move.ms / 25);
    const frames = Array.from({ length: steps + 1 }, (_, i) => ({ transform: move.at(i / steps) }));
    f.img.style.transformOrigin = move.origin || "";
    await f.img.animate(frames, { duration: move.ms, easing: "linear" }).finished.catch(() => {});
    f.img.style.transformOrigin = "";
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
// When the board is too crowded for everyone to fit, less of each box
// counts, so the crowd overlaps more and settles instead of shoving.
const SOLID = 0.8;
let solid = SOLID;

function crowdSolid(bodies) {
  const t = titleRect();
  const k = footerRect();
  const free =
    innerWidth * innerHeight - (t.right - t.left) * (t.bottom - t.top) - (k.right - k.left) * (k.bottom - k.top);
  const used = bodies.reduce((sum, b) => sum + b.full.width * b.full.height, 0);
  if (!used) return SOLID;
  return clamp(Math.sqrt((Math.max(0, free) * 0.5) / used), 0.45, SOLID);
}
// The share of an overlap that is undone in one frame. Lower is softer.
const STIFFNESS = 0.22;

function solidBox(f) {
  const r = f.el.getBoundingClientRect();
  const w = r.width * solid;
  const h = r.height * solid;
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

// After the screen changes size, bring back any MaWiLo left outside it.
addEventListener("resize", () => {
  for (const f of figures.values()) {
    if (f.state !== "resident" || f.dragging) continue;
    const r = f.el.getBoundingClientRect();
    const dx = clamp(0, 8 - r.left, innerWidth - 8 - r.right);
    const dy = clamp(0, TOP_GAP - r.top, innerHeight - 8 - r.bottom);
    if (!dx && !dy) continue;
    f.x += dx / innerWidth;
    f.y += dy / innerHeight;
    place(f);
  }
});

// Once the footer is in, the tickets and the MaWiLos can be used, and the
// bumping starts, even if the intro is still finishing.
let footerOpen = false;

function openFooter() {
  if (footerOpen) return;
  footerOpen = true;
  document.body.classList.add("footer-in");
  startBumping();
}

function startBumping() {
  const step = () => {
    const bodies = [...figures.values()]
      .filter((f) => f.state === "resident" && !f.parked)
      .map((f) => ({
        f,
        box: solidBox(f),
        fixed: f.dragging || f.el.classList.contains("walking") || f.el.classList.contains("marching"),
        dx: 0,
        dy: 0,
      }));
    solid = crowdSolid(bodies.map((b) => b.box));
    for (const b of bodies) {
      b.box.w = b.box.full.width * solid;
      b.box.h = b.box.full.height * solid;
    }
    // The title and the footer are solid too, but never move.
    const t = titleRect();
    const k = footerRect();
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
        // Ignore overlaps of a pixel or two, so a crowd comes to rest
        // instead of jiggling.
        if (ox <= 2 || oy <= 2) continue;
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
      const gap = (bobble.box.w + ziggy.box.w) / 2 / solid * 0.88;
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
let cardFile = null;
let showingPhoto = false;
let returnFocus = null;

// The card shows two instant photos in a stack: the cut-out and the
// original photo. Tapping the photo shuffles them: the top one slides out
// to the side and tucks in behind, and the other one comes forward.
const TOP_POSE = "rotate(-2.5deg)";
const BACK_POSE = "translate(14px, -8px) rotate(5deg)";

function showCardPicture(animate = false) {
  const front = document.querySelector(".card-photo.front");
  const back = document.querySelector(".card-photo.back");
  const [top, under] = showingPhoto ? [back, front] : [front, back];
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

// Shrink a long name until it fits on one line of the photo.
function fitName(el) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && size > 11) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
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
  for (const id of ["card-title", "card-title-back"]) fitName(document.getElementById(id));
  document.getElementById("card-description").textContent = m.name ? m.description : "";
  document.getElementById("card-fabrics").textContent = m.fabrics;
  document.getElementById("card-story").textContent = m.story;
  loopCardTrick(m);
}

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

// While the album or a card is open, everything behind it is inert, so
// the keyboard stays inside the dialog.
function syncInert() {
  const cardOpen = !card.hidden;
  const albumOpen = !album.hidden;
  for (const el of [board, document.getElementById("title"), footer]) {
    el.inert = cardOpen || albumOpen;
  }
  album.inert = cardOpen;
}

function openCard(file) {
  fillCard(file);
  nudgeCard();
  if (!card.classList.contains("open")) returnFocus = document.activeElement;
  card.hidden = false;
  syncInert();
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
  syncInert();
}

function shufflePhotos() {
  showingPhoto = !showingPhoto;
  showCardPicture(true);
}


// Step to the previous or next MaWiLo's card, in the order of data.js,
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
  const slide = (from, to, options) =>
    Promise.all(
      parts.map((el) =>
        el
          .animate(
            [
              { transform: `translateX(${from}px)`, opacity: from ? 0 : 1 },
              { transform: `translateX(${to}px)`, opacity: to ? 0 : 1 },
            ],
            options,
          )
          .finished.catch(() => {}),
      ),
    );
  // Whatever happens part way, the card always ends up filled and fully
  // shown, and stepping is free again.
  try {
    if (!reducedMotion) await slide(0, -direction * 48, { duration: 180, easing: "ease-in", fill: "forwards" });
    fillCard(next);
    for (const el of parts) el.getAnimations().forEach((a) => a.cancel());
    if (!reducedMotion) await slide(direction * 48, 0, { duration: 260, easing: "ease-out" });
  } finally {
    for (const el of parts) el.getAnimations().forEach((a) => a.cancel());
    stepping = false;
  }
}

document.getElementById("card-prev").addEventListener("click", () => stepCard(-1));
document.getElementById("card-next-ticket").addEventListener("click", () => stepCard(1));
document.getElementById("card-next").addEventListener("click", () => stepCard(1));

// Swipe left or right on the card to step, and tap the photo to shuffle.
// A swipe does not count as a tap.
// On touch screens this uses touch events, which keep coming while the
// browser scrolls the story, where pointer events are cancelled.
let swipeStart = null;
let swiped = false;

function swipeFrom(x, y) {
  swipeStart = { x, y };
  swiped = false;
}

function swipeTo(x, y) {
  if (!swipeStart) return;
  const dx = x - swipeStart.x;
  const dy = y - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swiped = true;
    stepCard(dx < 0 ? 1 : -1);
  }
}

card.addEventListener("touchstart", (event) => swipeFrom(event.touches[0].clientX, event.touches[0].clientY), { passive: true });
card.addEventListener("touchend", (event) => swipeTo(event.changedTouches[0].clientX, event.changedTouches[0].clientY));
card.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") swipeFrom(event.clientX, event.clientY);
});
card.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse") swipeTo(event.clientX, event.clientY);
});
const cardPhotos = document.getElementById("card-photos");
cardPhotos.addEventListener("click", () => {
  if (!swiped) shufflePhotos();
});
cardPhotos.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  shufflePhotos();
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
const SIGN_CARRIERS = ["blue-tassels-striped-body", "blue-striped-dress"];
// Ziggy, on the right, leans this far towards Bobble.
const PAIR_LEAN = -40;

function moveTitle(title, x, y, scale = 1) {
  title.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

// The sign is carried at this size and grows to full size as it floats up.
const CARRIED_SCALE = 0.9;

// Bobble and Ziggy carry the title up from the bottom edge, stop in the
// middle, and push it up so it floats to the top. Then the other starting
// MaWiLos walk in from the sides.
async function intro(onStage, layout) {
  const title = document.getElementById("title");
  const others = onStage.filter((n) => !SIGN_CARRIERS.includes(n));
  const entering = others.map((name) => ({
    f: Object.assign(makeFigure(name, { ...layout[name], y: 2 }, "resident"), { parked: true }),
    target: layout[name],
  }));
  offstage = offstage.filter((n) => !SIGN_CARRIERS.includes(n));
  // Each carrier goes to its place on the board afterwards, or offstage if
  // it has no place.
  const carriers = SIGN_CARRIERS.map((name, i) => {
    const target = layout[name];
    const f = makeFigure(name, { ...(target || { r: 0 }), y: 2 }, target ? "resident" : "leaving");
    // The right carrier leans left so the two face each other.
    f.r = i === 1 ? PAIR_LEAN : 0;
    // Carry the sign a little bigger than normal. While carrying, the pair
    // cannot be grabbed.
    setSize(f, 1.15);
    f.carrying = true;
    return { f, target };
  });

  addEventListener("resize", () => {
    if (!title.classList.contains("floating")) return;
    const top = titleRect();
    moveTitle(title, top.left, top.top);
  });

  const leave = (f) => {
    f.el.remove();
    figures.delete(f.name);
    offstage.push(f.name);
  };

  if (reducedMotion) {
    const top = titleRect();
    moveTitle(title, top.left, top.top);
    title.classList.add("shown", "floating");
    openFooter();
    for (const { f, target } of [...entering, ...carriers]) {
      f.parked = false;
      f.carrying = false;
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

  await Promise.all([...carriers, ...entering].map(({ f }) => f.img.decode().catch(() => {})));

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
  await wait(900);
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
  for (const { f } of carriers) f.carrying = false;
  title.classList.add("floating");
  const top = titleRect();
  moveTitle(title, top.left, top.top);
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
  const carriersDone = carriers.map(({ f, target }) => {
    if (!target) return sendOff(f);
    const done = moveTo(f, target.x, target.y, "walk", 2000);
    f.r = target.r;
    setSize(f, target.size || 1);
    place(f);
    return done;
  });

  // They come in a random order with uneven gaps, mostly from the nearer
  // side but sometimes from the far one, each at its own pace.
  // The footer comes in once Bobble and Ziggy have walked away from the
  // bottom of the screen.
  Promise.all(carriersDone).then(openFooter);

  const order = shuffle(entering);
  let start = 0;
  const starts = order.map(() => (start += rand(80, 520)));
  await Promise.all([
    ...carriersDone,
    ...order.map(async ({ f, target }, i) => {
      await wait(starts[i]);
      const { w } = extent(f);
      const near = target.x < 0.5 ? "left" : "right";
      const side = Math.random() < 0.75 ? near : near === "left" ? "right" : "left";
      f.x = side === "left" ? -w / 2 : 1 + w / 2;
      f.y = entryY();
      f.parked = false;
      place(f);
      void f.el.offsetWidth;
      await moveTo(f, target.x, target.y, "walk", rand(1500, 2900));
    }),
  ]);

  // Once everyone is in, the MaWiLos with stop-motion tricks show them
  // off, then one other does its move, one after another.
  const tricky = entering.filter(({ f }) => byFile.get(f.name).move === "trick").map(({ f }) => f);
  const rest = shuffle(entering.map(({ f }) => f).filter((f) => !tricky.includes(f)));
  const performers = [...shuffle(tricky), ...rest.slice(0, 1)];
  for (const f of performers) {
    await wait(350);
    await playSignature(f);
  }
}

async function start() {
  buildAlbum();
  await Promise.all([loadAspects(), document.fonts.ready]);
  const everyone = MAWILO_DATA.map((m) => m.file);
  // Bobble and Ziggy always start on the board, and so do the MaWiLos with
  // stop-motion tricks, so they can show them off in the intro.
  const tricksters = MAWILO_DATA.filter((m) => m.move === "trick").map((m) => m.file);
  const always = [...SIGN_CARRIERS, ...tricksters];
  const others = shuffle(everyone.filter((n) => !always.includes(n)));
  const wanted = [...always, ...others.slice(0, Math.max(0, capacity() - always.length))];
  const layout = scatterLayout(wanted);
  const onStage = wanted.filter((n) => layout[n]);
  offstage = shuffle(everyone.filter((n) => !onStage.includes(n)));
  await intro(onStage, layout);
  syncStack();
  if (!reducedMotion) startIdleMoves();
}

start();
