# Proof the T7 extra checks are not blind

`design/screens/tools/render-all.js` runs the measurements of `render.js` and adds two: "hidden by its box" (an element that ends past a clipping parent) and "squeezed" (a card, field, option, row or ticket whose content is taller than the box).

Planted fault, 26 Nov 2026: a copy of `Kitchen-Low-Stock-Phone` with `flex: none` taken off its banner and a 200 px card added below, rendered as `_plant` and then deleted.

```
_plant {"issues":["hidden by its box: squeezed card \"Kitchen store low on 3 itemsBu\""],"font":"Inter","filled":1,"pageOverflow":false}
```

The same check on the 118 drawings of groups 1 to 7 at that moment printed no issue. The fault was real before the fix: the first render of `Kitchen-Low-Stock-Phone` cut the banner's top line, which the reviewer and the contact sheet caught, not the gate; this check was added because of it.
