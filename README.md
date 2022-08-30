# instant.page

**Make your site’s pages instant in 1 minute and improve your conversion rate by 1%.**

ℹ️ Info is on [the website](https://instant.page).

Changes of this fork:

 🚀  &nbsp; Added `prerender` for Blink based browsers, which improves performance even more than `prefetch`
 
 ✨  &nbsp; Support for Safari, where only `preload` is supported [at the moment](https://caniuse.com/link-rel-prefetch)

 🧪  &nbsp; For Chrome only (mobile/desktop): this fork implements the [PrerenderV2](https://chromestatus.com/feature/5197044678393856) `speculationrules` script tag.
 
 The new flow is as follows:
 
 - On desktop, hover: `prefetch` (`preload` in Safari) after `HOVER_DELAY` ms (**65 ms** by default, can be set by adding `data-instant-intensity` to the body)
 - On desktop, click: `prerender` + `speculationrules`
 - On mobile, hover & click: `prerender` + `speculationrules` (since hover is most likely a click on mobile)
 - On mobile, if network is slower than 4G (LTE) or `Save-Data` is enabled, we cancel previous fetches when a new link is hovered

## Tests

With [Node](https://nodejs.org/), run:

`node test/app.js`

And access http://127.0.0.1:8000/. Or specify another port with an argument after the filename.

## Minifying

To minify instantpage.js into dist/instantpage.min.js install terser globally (`npm i terser -g`) then run `npm run minify`.
