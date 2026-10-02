// Residents stay where they are put. The visitor comes and goes until
// someone drags it, and then it stays too.
const RESIDENTS = [
  { name: "pink-heart-on-forehead", s: 1 },
  { name: "teal-black-lace-pants-jewel-eyes", s: 1 },
  { name: "green-tartan-pants", s: 0.95 },
  { name: "cream-purple-top-ruffle", s: 1 },
  { name: "red-grey-striped-knit", s: 1.1 },
  { name: "pink-floral-dress-fringe", s: 1.05 },
  { name: "navy-head-red-knit-body-fringe-hair", s: 1.05 },
  { name: "green-lilac-striped-skirt", s: 0.95 },
  { name: "lilac-purple-two-tone", s: 0.9 },
  { name: "blue-brown-ears-brown-scarf", s: 1 },
  { name: "pink-red-floral-striped-patchwork", s: 1 },
  { name: "teal-head-red-shirt-green-legs", s: 1 },
  { name: "red-cable-knit-pink-scarf", s: 0.95 },
  { name: "pink-floral-brown-pink-fringe-hair", s: 1.15 },
  { name: "green-body-red-legs-yellow-horn", s: 1.15 },
  { name: "pink-red-patchwork-red-green-legs", s: 1.05 },
  { name: "light-blue-and-navy-pair-paisley-scarves", s: 0.85 },
];
const VISITOR = { name: "tan-white-button-row", s: 1.1 };
const PEEKERS = [
  { name: "teal-blue-curly-hair", left: "8%" },
  { name: "blue-anteater-shaggy-mane", left: "78%" },
];

const STORAGE_KEY = "mawilo-layout-v1";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const board = document.getElementById("board");
const hint = document.getElementById("hint");
const figures = new Map();
let topZ = 1;
let hasDragged = false;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Place the residents on a loose grid, with the same layout on every load
// until someone moves them.
function defaultLayout() {
  const rand = seededRandom(42);
  const n = RESIDENTS.length;
  const aspect = innerWidth / innerHeight;
  const cols = Math.max(2, Math.round(Math.sqrt(n * aspect * 1.3)));
  const rows = Math.ceil(n / cols);
  const layout = {};
  RESIDENTS.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layout[m.name] = {
      x: 0.07 + ((col + 0.5 + (rand() - 0.5) * 0.4) / cols) * 0.86,
      y: 0.08 + ((row + 0.5 + (rand() - 0.5) * 0.3) / rows) * 0.8,
      r: (rand() - 0.5) * 12,
      z: i + 1,
    };
  });
  return layout;
}

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.figures) {
      hasDragged = Boolean(saved.hasDragged);
      return saved.figures;
    }
  } catch {
    // Storage can be blocked or hold bad data. Fall back to the default.
  }
  return null;
}

function saveLayout() {
  const out = {};
  for (const [name, f] of figures) {
    if (f.resident) out[name] = { x: f.x, y: f.y, r: f.r, z: f.z };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasDragged, figures: out }));
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

function makeFigure(m, pos, resident) {
  const el = document.createElement("div");
  el.className = "mawilo";
  el.style.setProperty("--s", m.s);
  const img = document.createElement("img");
  img.src = `img/${m.name}.png`;
  img.alt = m.name.replaceAll("-", " ");
  img.draggable = false;
  el.append(img);
  board.append(el);

  const f = { name: m.name, el, img, resident, ...pos };
  topZ = Math.max(topZ, f.z);
  place(f);
  enableDrag(f);
  figures.set(m.name, f);
  return f;
}

function enableDrag(f) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let lastX = 0;
  let tilt = 0;

  f.el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    f.el.setPointerCapture(event.pointerId);
    f.dragging = true;
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
    f.x = clamp(originX + (event.clientX - startX) / innerWidth, 0.02, 0.98);
    f.y = clamp(originY + (event.clientY - startY) / innerHeight, 0.04, 0.96);
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
    f.resident = true;
    if (!hasDragged) {
      hasDragged = true;
      hint.classList.add("done");
    }
    saveLayout();
  };
  f.el.addEventListener("pointerup", drop);
  f.el.addEventListener("pointercancel", drop);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Until the first drag, one mawilo now and then gives a small wiggle to
// show that they can be moved.
function startNudges() {
  const nudge = () => {
    if (hasDragged) return;
    const resting = [...figures.values()].filter((f) => f.resident && !f.dragging);
    const f = resting[Math.floor(Math.random() * resting.length)];
    f?.img.animate(
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

function startVisitor(f) {
  const cycle = () => {
    if (f.resident) return;
    f.x = rand(0.15, 0.85);
    f.y = rand(0.2, 0.75);
    f.r = rand(-6, 6);
    f.z = ++topZ;
    place(f);
    f.el.classList.remove("away");
    setTimeout(() => {
      if (f.resident || f.dragging) return;
      f.el.classList.add("away");
      setTimeout(cycle, rand(15000, 30000));
    }, rand(8000, 12000));
  };
  f.el.classList.add("away");
  setTimeout(cycle, rand(6000, 10000));
}

function startPeekers() {
  const els = PEEKERS.map((p) => {
    const img = document.createElement("img");
    img.className = "peeker";
    img.src = `img/${p.name}.png`;
    img.alt = "";
    img.style.left = p.left;
    document.body.append(img);
    return img;
  });
  if (reducedMotion) return;
  const peek = () => {
    const img = els[Math.floor(Math.random() * els.length)];
    img.classList.add("up");
    setTimeout(() => img.classList.remove("up"), rand(3000, 5000));
    setTimeout(peek, rand(14000, 24000));
  };
  setTimeout(peek, rand(8000, 12000));
}

function start() {
  const saved = loadLayout();
  const layout = { ...defaultLayout(), ...(saved || {}) };
  for (const m of RESIDENTS) makeFigure(m, layout[m.name], true);

  const visitorSaved = saved && saved[VISITOR.name];
  const visitor = makeFigure(
    VISITOR,
    visitorSaved || { x: 0.5, y: 0.5, r: 0, z: ++topZ },
    Boolean(visitorSaved),
  );

  if (hasDragged) hint.classList.add("done");
  startPeekers();
  if (reducedMotion) return;
  if (!visitor.resident) startVisitor(visitor);
  startNudges();
}

document.getElementById("reset").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
  const layout = defaultLayout();
  for (const [name, f] of figures) {
    if (!layout[name]) continue;
    Object.assign(f, layout[name]);
    place(f);
  }
});

start();
