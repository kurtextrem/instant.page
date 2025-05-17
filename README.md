# instant.page

**Make your site’s pages instant in 1 minute and improve your conversion rate by 1%.**

ℹ️ Info is on [the website](https://instant.page).

Changes of this fork:

 🚀  &nbsp; Added `prerender` for Blink based browsers, which improves performance even more than `prefetch`
 
 🧪  &nbsp; For Chrome only (mobile/desktop): this fork implements the [PrerenderV2](https://chromestatus.com/feature/5197044678393856) `speculationrules` script tag.
 
 ✨  &nbsp; Support for Safari, where only `preload` is supported [at the moment](https://caniuse.com/link-rel-prefetch) [*](#preload-limiations)

 ⏱️  &nbsp; Sets the `prefetch` fetch priority to `high` on click/touch ([recently](https://github.com/instantpage/instant.page/commit/e7648798ac3255f5852bb0856b2bbef90cac1f1a) added by the original instant.page too) 
 
 The new flow is as follows:
 
 - On desktop, hover: `prefetch` (`preload` in Safari) after `HOVER_DELAY` ms (**65 ms** by default, can be set by adding `data-instant-intensity` to the body)
 - On desktop, click: `prerender` + `speculationrules prerender`
 - On mobile, hover & click: `prerender` + `speculationrules prerender` (since hover is most likely a click on mobile)
 - On mobile, if network is slower than 4G (LTE) or `Save-Data` is enabled, we cancel previous fetches when a new link is hovered

## Content-Security-Policy (CSP)

When using this fork, you need to be careful since PrerenderV2 uses a `<script>` tag to add the rules to the document; [here's](https://developer.chrome.com/blog/prerender-pages/#speculation-rules-and-content-security-policy) an article on how to deal with it.

## What is unsafe to be prefetched/preloaded/prerendered?

In general, you should avoid prefetching/preloading/prerendering for SEO bots, see [this](https://merj.com/blog/managing-webpages-resources-for-efficient-crawling-and-rendering#:~:text=NextJS%E2%80%99s%20Approach%20To%20Avoiding%20Prefetching%20Links) analysis and the [NextJS PR](https://github.com/vercel/next.js/pull/40435/files).

See [this](https://docs.google.com/document/d/1_9XkDUKMGf2f3tDt1gvQQjfliNLpGyFf36BB1-NUZ98/edit) and [this](https://addyosmani.com/blog/what-not-to-prefetch-prerender/) document for helpful tips on what not to prefetch and prerender. You should exclude:
- Logout URLs
- "Switch language" URLs
- "Add to cart" URLs
- Login flow pages where the server (not JavaScript) causes an SMS to be sent
- Pages where fetching them causes server-side consumption of a user's allowance (e.g., X free articles per month)
- A URL to a page that causes server-side ad conversion tracking
- Large resources (e.g. zip files, mp4, ...)

⚠️ Chromium currently ignores HTTP `cache-control` (including `no-store`) header for prefetch/prerender and generally caches prefetched pages for ~5 minutes. This might change in the [future](https://chromestatus.com/feature/5087526916718592).

Maybe interesting: [Recently-Logged-In](https://calendar.perfplanet.com/2023/rli/) technique.

### Fixing on the client

Add `data-no-instant` to the `<a>` tag.

### Fixing on the server

It is recommended to use `POST` requests to make state changes (e.g. using `<form>` submits) instead of a regular `GET` navigation.

As alternative, you can check the request for the `Sec-Purpose` HTTP header, which will contain `prefetch`.

## How to detect / meausre impact of prerenders?

See [this](https://developer.chrome.com/blog/prerender-pages/#detecting-and-disabling-prerendering) article from the Chrome DevRels Team.

A quick note for testing: Switching tabs currently cancels any prerenders, keep this in mind while debugging.

## Prefetch Limitations

In older Chromes (< 116), prefetch and prerender did not use the same in-flight request, so they created two separate requests.

Navigational requests will re-use the in-flight request or [request the remaining bytes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Link_prefetching_FAQ#what_happens_if_i_click_on_a_link_while_something_is_being_prefetched) of a request.

In old Chromium versions, prefetches may be stored for [5 min unconditionally](https://issues.chromium.org/issues/40232065).

## Prerender Limitations

- Prerender/prefetch is disabled if the user has OS-level data-saver or battery-saver turned on, or if the user has "preload pages" turned off in chrome://settings
- PrerenderV2 consumes 30 - 100 MiB per prerendered page
- For background tabs, PrerenderV2 keeps prerendered pages in memory for up to [180 seconds](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/preloading/prerender/prerender_host_registry.h;l=61;drc=19f3c214cd4f78e0fe47b2ccafaca406aaacd42f)
- Maximum of 10 prerenders are allowed at once ([source](https://docs.google.com/document/d/1Cp4KK6lVftKcsrrlg5F5yOfXxZZW_jilcOAfbRTIA64/edit)), removing the `speculationrule` removes the prerendered process and frees up a slot in the 10-prerender limit
- In older Chromes (< 117), prerendering is disabled when Chrome uses over 10% of the total RAM available of the device ([source](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/preloading/prerender/prerender_host_registry.cc;l=1107;drc=61bc5ca953c07dca60dd1e4de000da97e7bc4e3f))
- PrerenderV2 is possibly [disabled](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/preloading/prerender/prerender_host_registry.cc;l=44;drc=61bc5ca953c07dca60dd1e4de000da97e7bc4e3f;bpv=1;bpt=1) on Android devices with less than 1.7 GB of memory

## Preload Limitations

Preloads in Safari are sent using `as=fetch`, which makes them ineligible for navigational requests (in other words: when a user clicks on the link, it won't re-use the preload request). However, the requests can still be used to e.g. prime CDN cache.

## Tests

With [Node](https://nodejs.org/), run:

`node test/app.js`

And access http://127.0.0.1:8000/. Or specify another port with an argument after the filename.

## Minifying

To minify instantpage.js into dist/instantpage.min.js install terser globally (`npm i terser -g`) then run `npm run minify`.
