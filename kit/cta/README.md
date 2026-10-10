# Download CTA

Every video closes on myBillBook's acquisition card: the purple one with the
logo, the "Starts at Rs 2 For 7 Days" offer, the "Trusted by 1 crore
businesses" seal, the laptop-and-phone mockup and the DOWNLOAD NOW button.

That card is a marketing asset supplied by FloBiz. It is not drawn by the
studio, so it is not in the repository until someone adds it.

## Adding it

1. Save the artwork here as `download-now.png`.
2. Size it for a 1080x1920 frame. It fills the whole screen, covering the
   frame edge to edge, so a different shape would be cropped.

That is all. The command-line renderer and the browser studio both pick it up.

## Until then

Without the file, clips close on the plain logo-and-tagline card for the same
length of time, and a warning names the expected path
(`kit/cta/download-now.png`). Nothing fails.

## In a recipe

```yaml
brand:
  cta: { duration: 1.8 }   # the default, even when the block is absent
  # cta: false             # no closing card at all
```
