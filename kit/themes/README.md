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

## The Theme Store file names

The Theme Store (`theme-store` screen) shows sixteen festive themes. Name each
file after its slug and both the grid thumbnail and the invoice background pick
it up. A theme with no file shows a plain card tinted with its colour.

| Theme | File |
|---|---|
| Navaratri | `navaratri.png` |
| Durga Puja | `durga-puja.png` |
| Dussehra | `dussehra.png` |
| Dhanteras | `dhanteras.png` |
| Diwali | `diwali.png` |
| Chhath Puja | `chhath-puja.png` |
| Gandhi Jayanti | `gandhi-jayanti.png` |
| Ganesh Chaturthi | `ganesh-chaturthi.png` |
| Janmashtami | `janmashtami.png` |
| Rakhi | `rakhi.png` |
| Onam | `onam.png` |
| Eid-e-Milad | `eid-e-milad.png` |
| Independence | `independence.png` |
| Shubh Ekadashi | `shubh-ekadashi.png` |
| Jain theme | `jain-theme.png` |
| Industrial | `industrial.png` |
