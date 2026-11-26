# Tools the drawings were made and measured with

- `render.js`: `node render.js <file.html> <width> <height> <out.png>` opens one drawing in Chromium with the network blocked, saves a PNG and prints what it measured: clipped text, anything outside the frame, text spilling out of a tile, targets under 44 px, text under 12 px, and how many filled buttons are on the screen. A drawing is finished when `issues` is empty and `filled` is 0 or 1. Content under an open sheet is marked `inert` in the HTML and is not counted.
- `g.py`: the helper the first 38 drawings were generated with (icons, the page skeleton, the bars per role, the order screen pieces). It writes Design-canvas files; for drawings in this folder write plain `.html` that links `../kit.css`, as the files in `html/` do. Use it as a reference for markup and class names, not as a fixed pipeline.

Inter must be installed on the machine, or the drawing falls back to a system font and the measurements are wrong: check that `font` in the output says `Inter`.
