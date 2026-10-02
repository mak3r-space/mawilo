const MAWILOS = [
  "pink-heart-on-forehead",
  "teal-black-lace-pants-jewel-eyes",
  "green-tartan-pants",
  "cream-purple-top-ruffle",
  "red-grey-striped-knit",
  "teal-blue-curly-hair",
  "pink-floral-dress-fringe",
  "navy-head-red-knit-body-fringe-hair",
  "green-lilac-striped-skirt",
  "tan-white-button-row",
  "lilac-purple-two-tone",
  "blue-brown-ears-brown-scarf",
  "pink-red-floral-striped-patchwork",
  "teal-head-red-shirt-green-legs",
  "red-cable-knit-pink-scarf",
  "pink-floral-brown-pink-fringe-hair",
  "green-body-red-legs-yellow-horn",
  "pink-red-patchwork-red-green-legs",
  "blue-anteater-shaggy-mane",
  "light-blue-and-navy-pair-paisley-scarves",
];

function buildTitle() {
  const title = document.getElementById("title");
  [..."Mawilos"].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = ch;
    span.style.setProperty("--i", i);
    span.setAttribute("aria-hidden", "true");
    title.append(span);
  });
}

function buildScenes() {
  const scenes = document.getElementById("scenes");
  MAWILOS.forEach((name, i) => {
    const label = name.replaceAll("-", " ");
    const scene = document.createElement("section");
    scene.className = `scene ${i % 2 ? "right" : "left"}`;
    scene.innerHTML = `
      <div class="window">
        <img src="img/${name}.png" alt="${label}" draggable="false">
      </div>
      <div class="ground"></div>
      <p class="name">${label}</p>
    `;
    scenes.append(scene);
  });
}

buildTitle();
buildScenes();
