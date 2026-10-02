# Mawilos

A quiet board for the mawilos, a family of handmade fabric creatures. Drag
them around to arrange them the way you like. The browser remembers the
layout, and "reset" puts them back on the starting grid.

The board starts with as many mawilos as fit the screen, from about 4 on a
phone to about 10 on a large screen. The rest wait offstage. Now and then
one waddles in from a side or pops up from the bottom and waits at the
edge. Drag it in to keep it. If nobody does, it leaves again after a while.
Push a mawilo to the edge of the screen and it waddles off.

Tap a mawilo to open its card, with its fabrics and the original photo.
The card text lives in `data.js`. Until a mawilo has a `name`, the card
shows its description, and the card shows the `story` only when it is set.

Until the first drag, one mawilo now and then gives a small wiggle to show
that they can be moved. Two mawilos whose photos are cut off at the bottom
peek up from the bottom edge now and then. The blue elephant wiggles as it
comes up.

If the browser asks for reduced motion, nothing moves on its own.

## Run it

The site is plain HTML, CSS and JavaScript with no build step. Serve the
folder with any static file server:

```
python3 -m http.server 18080
```

Then open http://localhost:18080/.

## Images

The images in `img/` are cut out from photos with the macOS Vision framework
and resized to 480 pixels on the longest side.
The original photos in `img/photo/` are resized to 900 pixels on the
longest side.
