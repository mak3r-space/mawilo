# MaWiLos

A quiet board for the MaWiLos, a family of handmade fabric creatures. Bobble
and Ziggy carry the title in, and as many others as fit walk onto the
board. Drag them around to arrange them the way you like: drag from the
middle, turn by the edges, and pinch or scroll to resize. Nothing is saved,
so a reload starts fresh.

The footer along the bottom holds the photo stack and two tickets. The
photo on top of the stack is the next MaWiLo to come in, and the "come in"
ticket, with the count on its stub, brings it onto the board. "bye" walks
a surprise MaWiLo off and puts its photo back on top of the stack.
Pushing a MaWiLo to the edge of the screen sends it off too.

Tap the stack to see every MaWiLo on a grid, and tap a photo, or a MaWiLo
on the board, to open its card. Swipe, use the arrow keys, or tap the
arrows (the "next" ticket on phones) to go through the cards, and tap the
card photo to see the original photo.

MaWiLos on the board only overlap a little. When one walks in or is
dragged into a crowd, it bumps the others aside, with a small squish. When
the board is very full they overlap more. MaWiLos higher up are drawn
smaller and further back.

Every MaWiLo has a signature move, like a boing, a twirl or a stretch, set
by `move` in `data.js`. It makes the move when it is tapped and when it is
brought in on its own. Julia and Moustachio do their stop-motion tricks
instead, and always show them in the intro. Now and then one MaWiLo
breathes or wiggles a little to invite play.

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
and resized to at most 480 pixels on the longest side. The original photos
in `img/photo/` are resized to at most 900 pixels on the longest side.
Moustachio's photo is a frame of his clip.

The stop-motion frames in `img/frames/` were cut out of the two clips frame
by frame, cropped to a shared box so they line up, and resized the same
way. Frame 1 is the same image as the board image.
