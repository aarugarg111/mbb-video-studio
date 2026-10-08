# Invoice themes

A theme is a soft picture that washes behind the bill on the
"Sales Invoice Created" screen. The app has sixteen illustrated festive
themes; those are FloBiz's own design assets and are supplied separately.

## Adding real theme art

1. Save the image in this folder as `<name>.png`, sized for a 390x844 screen.
2. In the recipe, use the filename without its extension:

   ```yaml
   invoice:
     theme: lakshmi      # kit/themes/lakshmi.png
   ```

The studio draws the image faded behind the bill, so it can be full strength.
Text stays readable over it.

## Built in

- `none` (or no `theme` line) - clean white bill. This is the default.
- `warm` - a plain warm paper wash drawn in CSS. A demonstration so the
  slot is visibly working; it is not festive art and has no PNG.

An unknown name prints a warning and the video renders as `none`.
