# MaWiLos

A quiet board for the MaWiLos, a family of handmade fabric creatures. Bobble
and Ziggy carry the title in, and the others walk onto the board. Drag them
around to arrange them the way you like: drag from the middle, turn by the
edges, and pinch or scroll to resize. Nothing is saved, so a reload starts
fresh.

The footer along the bottom holds the photo stack and two tickets. Tap the
stack to see every MaWiLo on a grid, and tap a photo to open its card.
Swipe, use the arrow keys, or tap the arrows or the peeking neighbours to
go through the cards, and tap the card photo to see the original photo.
"come in" on a card brings that MaWiLo onto the board. The "come in" and
"bye" tickets do the same for a surprise MaWiLo, or say bye to one.

MaWiLos on the board only overlap a little. When one walks in or is
dragged into a crowd, it bumps the others aside, and they bump the ones
behind them, with a small squish. MaWiLos higher up are drawn smaller and
further back.

Every MaWiLo has a signature move, like a hop, a spin or a bow, set by
`move` in `data.js`. It makes the move when it arrives and when it is
tapped, and then its card opens. Julia and Moustachio do their stop-motion
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
