# MaWiLos

A quiet board for the MaWiLos, a family of handmade fabric creatures. Two
MaWiLos carry the title in, and the others walk onto the board. Drag them
around to arrange them the way you like: drag from the middle, turn by the
edges, and pinch or scroll to resize. Nothing is saved, so a reload starts
fresh.

The photo box in the bottom right corner holds a photo of every MaWiLo
still to meet. Tap it to open the cards, and swipe or use the arrows to go
through them. "invite in" brings a MaWiLo onto the board, where it walks to
the middle and the others make room, and "send home" walks it off again.
Tap a MaWiLo on the board to open its card, and tap the card photo to see
the original photo.

Blep and Moustachio do their stop-motion tricks now and then, and on their
cards.

Now and then one MaWiLo on the board does a small move, like a wiggle or
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
