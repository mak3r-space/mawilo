# MaWiLos

A quiet board for the MaWiLos, a family of handmade fabric creatures. Two
MaWiLos carry the title in, and the others walk onto the board. Drag them
around to arrange them the way you like: drag from the middle, turn by the
edges, and pinch or scroll to resize. Nothing is saved, so a reload starts
fresh.

The photo stack in the bottom right corner holds a photo of every MaWiLo
still to meet. Tap it to see all of them on a grid, where a turquoise dot
marks the ones on the board. Tap a photo to open its card, and swipe or use
the arrows to go through the cards. "come in" puts the card away and brings
the MaWiLo onto the board, and "bye" walks it off again. The two buttons
above the photo stack do the same for a surprise MaWiLo.

MaWiLos on the board only overlap a little. When one walks in or is
dragged into a crowd, it bumps the others aside, and they bump the ones
behind them, with a small squish.

Every MaWiLo has a signature move, like a hop, a spin or a bow, set by
`move` in `data.js`. It makes the move when it arrives and when it is
tapped, and then its card opens. Blep and Moustachio do their stop-motion
tricks instead. Now and then one MaWiLo breathes or wiggles a little to
invite play.

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
