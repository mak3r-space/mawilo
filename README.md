# Mawilos

A quiet board for the mawilos, a family of handmade fabric creatures. Drag
them around to arrange them the way you like. The browser remembers the
layout, and "reset" puts them back on the starting grid.

Until the first drag, one mawilo now and then gives a small wiggle to show
that they can be moved. Only a few come and go: one mawilo fades in and out
until you move it, and two peek up from the bottom edge of the screen.

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
