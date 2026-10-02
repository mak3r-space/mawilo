# Mawilo Theatre

A small stage for the mawilos, a family of handmade fabric creatures. Click
the button to open the curtain. The mawilos waddle across the stage in three
rows, and the rows shift with the pointer to give a parallax effect. Click a
mawilo to make it hop. Hover over a mawilo to make it stop and wait. Two
mawilos whose photos are cut off at the edge peek up from the bottom of the
stage now and then.

If the browser asks for reduced motion, the curtain opens without animation
and the mawilos stand still.

## Run it

The site is plain HTML, CSS and JavaScript with no build step. Serve the
folder with any static file server:

```
python3 -m http.server 18080
```

Then open http://localhost:18080/. Add `#open` to the URL to start with the
curtain open.

## Images

The images in `img/` are cut out from photos with the macOS Vision framework
and resized to 480 pixels on the longest side.
