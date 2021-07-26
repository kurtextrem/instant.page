# instant.page

**Make your site’s pages instant in 1 minute and improve your conversion rate by 1%.**

ℹ️ Info is on [the website](https://instant.page).

Changes of this fork:

 🚀  &nbsp; Added `prerender` for Blink based browsers, which improves performance even more than `prefetch`
 
 ✨  &nbsp; Support for Safari, where only `preload` is supported [at the moment](https://caniuse.com/link-rel-prefetch)

 🧪  &nbsp; For Chrome on Android: this fork implements the [PrerenderV2](https://docs.google.com/document/d/1P2VKCLpmnNm_cRAjUeE-bqLL0bslL_zKqiNeCzNom_w/edit) `speculationrules` script tag.

## Tests

With [Node](https://nodejs.org/), run:

`node test/app.js`

And access http://127.0.0.1:8000/. Or specify another port with an argument after the filename.

## Minifying

To minify instantpage.js into dist/instantpage.min.js install terser globally (`npm i terser -g`) then run `npm run minify`.
