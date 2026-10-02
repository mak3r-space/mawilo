const WALKERS = [
  "blue-brown-ears-brown-scarf",
  "cream-purple-top-ruffle",
  "green-body-red-legs-yellow-horn",
  "green-lilac-striped-skirt",
  "green-tartan-pants",
  "light-blue-and-navy-pair-paisley-scarves",
  "lilac-purple-two-tone",
  "navy-head-red-knit-body-fringe-hair",
  "pink-floral-brown-pink-fringe-hair",
  "pink-floral-dress-fringe",
  "pink-heart-on-forehead",
  "pink-red-floral-striped-patchwork",
  "pink-red-patchwork-red-green-legs",
  "red-cable-knit-pink-scarf",
  "red-grey-striped-knit",
  "tan-white-button-row",
  "teal-black-lace-pants-jewel-eyes",
  "teal-head-red-shirt-green-legs",
];

// These photos are cut off at the frame edge, so they peek up from the
// bottom of the stage instead of walking.
const PEEKERS = [
  { name: "teal-blue-curly-hair", side: "left" },
  { name: "blue-anteater-shaggy-mane", side: "right" },
];

const ROWS = {
  back: { count: 4, speed: [25, 45] },
  mid: { count: 3, speed: [45, 70] },
  front: { count: 2, speed: [70, 100] },
};

const HEARTS = ["💖", "✨", "💛", "🧵", "🌸"];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const stage = document.getElementById("stage");
const walkers = [];
let pool = shuffle([...WALKERS]);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function nextName() {
  if (pool.length === 0) {
    const onStage = new Set(walkers.map((w) => w.name));
    pool = shuffle(WALKERS.filter((n) => !onStage.has(n)));
  }
  return pool.pop();
}

function dress(walker) {
  walker.name = nextName();
  walker.img.src = `img/${walker.name}.png`;
  walker.img.alt = walker.name.replaceAll("-", " ");
  walker.img.style.setProperty("--step", `${rand(0.45, 0.8)}s`);
  walker.img.style.setProperty("--tilt", `${rand(4, 9)}deg`);
}

function makeWalker(rowEl, speedRange, index, count) {
  const el = document.createElement("div");
  el.className = "walker";
  const img = document.createElement("img");
  img.draggable = false;
  el.append(img);
  rowEl.append(el);

  const walker = {
    el,
    img,
    name: "",
    x: 0,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: rand(...speedRange),
    speedRange,
    paused: false,
  };
  dress(walker);

  // Spread the first walkers across the stage so it is not empty at the start.
  const width = innerWidth;
  walker.x = ((index + rand(0.1, 0.9)) / count) * width;

  el.addEventListener("pointerenter", () => {
    walker.paused = true;
    el.classList.add("paused");
  });
  el.addEventListener("pointerleave", () => {
    walker.paused = false;
    el.classList.remove("paused");
  });
  el.addEventListener("click", (event) => boop(img, event));

  walkers.push(walker);
  return walker;
}

function respawn(walker) {
  dress(walker);
  walker.dir = Math.random() < 0.5 ? 1 : -1;
  walker.speed = rand(...walker.speedRange);
  const w = walker.el.offsetWidth || 200;
  walker.x = walker.dir === 1 ? -w : innerWidth;
}

function boop(img, event) {
  if (!reducedMotion) {
    img.animate(
      [
        { transform: "scale(1, 1) translateY(0)" },
        { transform: "scale(1.15, 0.8) translateY(0)", offset: 0.15 },
        { transform: "scale(0.9, 1.15) translateY(-35%)", offset: 0.45 },
        { transform: "scale(1.1, 0.9) translateY(0)", offset: 0.75 },
        { transform: "scale(0.97, 1.03) translateY(0)", offset: 0.88 },
        { transform: "scale(1, 1) translateY(0)" },
      ],
      { duration: 700, easing: "ease-out", composite: "add" },
    );
  }
  for (let i = 0; i < 6; i++) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
    heart.style.left = `${event.clientX - 14}px`;
    heart.style.top = `${event.clientY - 14}px`;
    heart.style.setProperty("--dx", `${rand(-80, 80)}px`);
    heart.style.setProperty("--rot", `${rand(-40, 40)}deg`);
    heart.style.zIndex = 9;
    document.body.append(heart);
    heart.addEventListener("animationend", () => heart.remove());
    if (reducedMotion) setTimeout(() => heart.remove(), 600);
  }
}

function setupPeekers() {
  const box = document.getElementById("peekers");
  for (const p of PEEKERS) {
    const img = document.createElement("img");
    img.src = `img/${p.name}.png`;
    img.alt = p.name.replaceAll("-", " ");
    img.className = `peeker ${p.side}`;
    img.draggable = false;
    img.addEventListener("click", (event) => boop(img, event));
    box.append(img);
    if (reducedMotion) {
      img.classList.add("up");
      continue;
    }
    const peek = () => {
      img.classList.add("up");
      setTimeout(() => img.classList.remove("up"), rand(2500, 4500));
      setTimeout(peek, rand(7000, 14000));
    };
    setTimeout(peek, rand(3000, 8000));
  }
}

function setupParallax() {
  const layers = [...document.querySelectorAll(".layer")];
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  addEventListener("pointermove", (event) => {
    targetX = event.clientX / innerWidth - 0.5;
    targetY = event.clientY / innerHeight - 0.5;
  });

  return () => {
    // Ease towards the pointer so the layers drift instead of snapping.
    x += (targetX - x) * 0.06;
    y += (targetY - y) * 0.06;
    for (const layer of layers) {
      const depth = Number(layer.dataset.depth);
      layer.style.transform = `translate(${-x * depth * 40}px, ${-y * depth * 14}px)`;
    }
  };
}

function start() {
  for (const [rowName, cfg] of Object.entries(ROWS)) {
    const rowEl = stage.querySelector(`[data-row="${rowName}"]`);
    for (let i = 0; i < cfg.count; i++) makeWalker(rowEl, cfg.speed, i, cfg.count);
  }
  setupPeekers();

  if (reducedMotion) {
    for (const w of walkers) w.el.style.transform = `translateX(${w.x}px)`;
    return;
  }

  const parallax = setupParallax();
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const w of walkers) {
      if (!w.paused) w.x += w.dir * w.speed * dt;
      const width = w.el.offsetWidth;
      if (w.x > innerWidth + 40 || w.x < -width - 40) respawn(w);
      w.el.style.transform = `translateX(${w.x}px)`;
    }
    parallax();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const openButton = document.getElementById("open");
openButton.addEventListener("click", () => {
  document.body.classList.add("open");
});

if (location.hash === "#open") document.body.classList.add("open");

start();
