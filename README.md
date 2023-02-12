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

## Content-Security-Policy (CSP)

When using this fork, you need to be careful since PrerenderV2 uses a `<script>` tag to add the rules to the document; [here's](https://developer.chrome.com/blog/prerender-pages/#speculation-rules-and-content-security-policy) an article on how to deal with it.

## What is unsafe to be prefetched/preloaded/prerendered?

See [this](https://docs.google.com/document/d/1_9XkDUKMGf2f3tDt1gvQQjfliNLpGyFf36BB1-NUZ98/edit) and [this](https://addyosmani.com/blog/what-not-to-prefetch-prerender/) document for helpful tips on what not to prefetch and prerender. You should exclude:
- Logout URLs
- "Switch language" URLs
- "Add to cart" URLs
- Login flow pages where the server (not JavaScript) causes an SMS to be sent
- Pages where fetching them causes server-side consumption of a user's allowance (e.g., X free articles per month)
- A URL to a page that causes server-side ad conversion tracking
- Large resources (e.g. zip files, mp4, ...)

⚠️ Chromium currently ignores HTTP `cache-control: no-store` headers for prefetch/prerender and generally caches prefetched pages for ~5 minutes. This might change in the [future](https://chromestatus.com/feature/5087526916718592).

### Fixing on the client

Add `data-no-instant` to the `<a>` tag.

### Fixing on the server

It is recommended to use `POST` requests to make state changes (e.g. using `<form>` submits) instead of a regular `GET` navigation.

As alternative, you can check the request for the `Sec-Purpose` HTTP header, which will contain `prefetch`.

## How to detect / meausre impact of prerenders?

See [this](https://developer.chrome.com/blog/prerender-pages/#detecting-and-disabling-prerendering) article from the Chrome DevRels Team.

A quick note for testing: Switching tabs currently cancels any prerenders, keep this in mind while debugging.

## Tests

With [Node](https://nodejs.org/), run:

`node test/app.js`

And access http://127.0.0.1:8000/. Or specify another port with an argument after the filename.

## Minifying

To minify instantpage.js into dist/instantpage.min.js install terser globally (`npm i terser -g`) then run `npm run minify`.
