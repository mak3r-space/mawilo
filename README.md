# Mawilos

A quiet board for the mawilos, a family of handmade fabric creatures. Two
mawilos carry the title in, and the others walk onto the board. Drag them
around to arrange them the way you like: drag from the middle, turn by the
edges, and pinch or scroll to resize. Nothing is saved, so a reload starts
fresh.

A photo of every mawilo hangs on a laundry line at the top. Photos of
mawilos on the board are in colour, and the others are grey. Tap a grey
photo to invite that mawilo in. It walks to the middle, the others make
room, and its card opens. Push a mawilo to the edge of the screen and it walks off.

Tap a mawilo or its colour photo to pick it out, and tap again to open its
card, with its name, story, fabrics and the original photo. The card text
lives in `data.js`.

Now and then one mawilo on the board does a small move, like a wiggle or
a hop, to invite play.

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
