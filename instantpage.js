/*!instant.page5.2-(c)2019-23 Alexandre Dieulot;https://instant.page/license;modified by Jacob Gross*/

;(function (document, location, Date) {
	'use strict'

	if (!('Set' in window)) return
	// min browsers: Edge 15, Firefox 54, Chrome 51, Safari 10, Opera 38, Safari Mobile 10

	const handleVaryAcceptHeader = 'instantVaryAccept' in document.body.dataset || 'Shopify' in window
	// The `Vary: Accept` header when received in Chromium 79–109 makes prefetches
	// unusable, as Chromium used to send a different `Accept` header.
	// It’s applied on all Shopify sites by default, as Shopify is very popular
	// and is the main source of this problem.
	// `window.Shopify` only exists on “classic” Shopify sites. Those using
	// Hydrogen (Remix SPA) aren’t concerned.

	let _chromiumMajorVersionInUserAgent

	const chromiumUserAgentIndex = navigator.userAgent.indexOf('Chrome/')
	if (chromiumUserAgentIndex > -1) {
		_chromiumMajorVersionInUserAgent = parseInt(navigator.userAgent.substring(chromiumUserAgentIndex + 'Chrome/'.length))
	}
	// The user agent client hints API is a theoretically more reliable way to
	// get Chromium’s version… but it’s not available in Samsung Internet 20.
	// It also requires a secure context, which would make debugging harder,
	// and is only available in recent Chromium versions.
	// In practice, Chromium browsers never shy from announcing "Chrome" in
	// their regular user agent string, as that maximizes their compatibility.

	if (handleVaryAcceptHeader && _chromiumMajorVersionInUserAgent && _chromiumMajorVersionInUserAgent < 110) {
		return
	}

	const prefetcher = document.createElement('link')
	const head = document.head
	head.appendChild(prefetcher)

	// this set is needed to take care of the "exceeded 10 prerenders" message, which happens if you try to prerender
	// the same URL multiple times. This issue is fixed in Chromium 110+. https://crbug.com/1397727
	const preloadedUrls = new Set()
	let mouseoverTimer = 0
	let lastTouchTimestamp = 0

	let relList = prefetcher.relList
	const supports = relList !== undefined && relList.supports !== undefined // need this check, as Edge < 17, Safari < 10.1, Safari Mobile < 10.3 don't support this
	const isPrerenderSupported = supports && relList.supports('prerender')
	const preload = !supports || relList.supports('prefetch') ? _prefetch : relList.supports('preload') ? _preload : false // Safari (11.1, mobile 11.3) only supports preload; for other browser we prefer prefetch over preload

	if (!preload && !isPrerenderSupported) return // nothing we can do for the browser.

	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {}
	const effectiveType = typeof connection.effectiveType === 'string' ? connection.effectiveType : ''
	const has3G = effectiveType.indexOf('3g') !== -1
	const saveData = connection.saveData || effectiveType.indexOf('2g') !== -1

	let dataset = document.body.dataset
	const mousedownShortcut = 'instantMousedownShortcut' in dataset
	const allowQueryString = 'instantAllowQueryString' in dataset
	const allowExternalLinks = 'instantAllowExternalLinks' in dataset
	const allowSpeculationRules =
		!('instantNoSpeculation' in dataset) && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')
	const useWhitelist = 'instantWhitelist' in document.body.dataset

	const useViewport =
		!saveData &&
		('instantViewport' in dataset ||
			// Smartphones are the most likely to have a slow connection, and
			// their small screen size limits the number of links (and thus
			// server load).
			//
			// Foldable phones (being expensive as of 2023), tablets and PCs
			// generally have a decent connection, and a big screen displaying
			// more links that would put more load on the server.
			//
			// iPhone 14 Pro Max (want): 430×932 = 400 760
			// Samsung Galaxy S22 Ultra with display size set to 80% (want):
			// 450×965 = 434 250
			// Small tablet (don’t want): 600×960 = 576 000
			// Those number are virtual screen size, the viewport (used for
			// the check above) will be smaller with the browser’s interface.
			('instantViewportMobile' in dataset && document.documentElement.clientWidth * document.documentElement.clientHeight < 450000))

	const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111
	const HOVER_DELAY = 'instantIntensity' in dataset ? +dataset.instantIntensity : 65

	// only trigger `prefetch` requests on mobile, as ~90ms is too slow to get a preload done on mobile;
	// we need to do this, as prefetch + speculationrules do not share the same request (so we might end up with 2-3 reqs)
	if (preload !== _preload) document.addEventListener('touchstart', touchstartListener, { capture: true, passive: true })

	let listenerOptions = { capture: true }
	document.addEventListener('mouseover', mouseoverListener, listenerOptions)

	if (mousedownShortcut) document.addEventListener('mousedown', mousedownShortcutListener, listenerOptions)
	if (isPrerenderSupported) document.addEventListener('mousedown', mousedownListener, listenerOptions) // after 'mousedown' it leaves us ~80ms prerender time to mouseup.

	if (useViewport && window.IntersectionObserver && 'isIntersecting' in IntersectionObserverEntry.prototype) {
		// https://verlok.github.io/quicklink-optimal-options/
		const PREFETCH_LIMIT = !has3G ? (allowExternalLinks ? +dataset.instantLimit : 1 / 0) : 1 // Infinity
		const SCROLL_DELAY = 'instantScrollDelay' in dataset ? +dataset.instantScrollDelay : 1000
		const THRESHOLD = 'instantThreshold' in dataset ? +dataset.instantThreshold : 0.9
		const SELECTOR = 'instantSelector' in dataset ? dataset.instantSelector : 'a'

		const triggeringFunction = callback => {
			requestIdleCallback(callback, {
				timeout: 1500,
			})
		}

		const hrefsInViewport = new Set()
		let len = 0

		triggeringFunction(() => {
			const intersectionObserver = new IntersectionObserver(
				entries => {
					for (let i = 0; i < entries.length; ++i) {
						if (len > PREFETCH_LIMIT) return

						const entry = entries[i]
						const linkElement = entry.target
						if (entry.isIntersecting) {
							// Adding href to array of hrefsInViewport
							hrefsInViewport.add(linkElement.href)
							++len

							setTimeout(() => {
								// Do not prefetch if not found in viewport
								if (!hrefsInViewport.has(linkElement.href)) return

								intersectionObserver.unobserve(linkElement)
								preload(linkElement.href, false, true)
							}, SCROLL_DELAY)
						} else {
							--len
							hrefsInViewport.delete(linkElement.href)
						}
					}
				},
				{ threshold: THRESHOLD }
			)

			const nodes = document.querySelectorAll(SELECTOR)
			for (let i = 0; i < nodes.length; ++i) {
				const node = nodes[i]
				if (isPreloadable(node)) {
					intersectionObserver.observe(node)
				}
			}
		})
	}

	dataset = relList = listenerOptions = null // GC

	let isMobile = false

	function checkForClosestAnchor(event, relatedTarget) {
		const target = !relatedTarget ? event.target : event.relatedTarget
		if (!target || typeof target.closest !== 'function') return

		return target.closest('a')
	}

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function touchstartListener(event) {
		isMobile = true

		/* Chrome on Android calls mouseover before touchcancel so `lastTouchTimestamp`
		 * must be assigned on touchstart to be measured on mouseover. */
		lastTouchTimestamp = Date.now()

		const linkElement = checkForClosestAnchor(event)
		if (!isPreloadable(linkElement)) return

		window.addEventListener('scroll', mouseoutListener, { once: true }) // if a scroll occurs before HOVER_DELAY, user is scrolling around

		mouseoverTimer = setTimeout(mouseoverTimeout.bind(undefined, linkElement, true), HOVER_DELAY)
	}

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function mouseoverListener(event) {
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return

		const linkElement = checkForClosestAnchor(event)
		if (!isPreloadable(linkElement)) return

		linkElement.addEventListener('mouseout', mouseoutListener)

		mouseoverTimer = setTimeout(mouseoverTimeout.bind(undefined, linkElement, false), HOVER_DELAY)
	}

	function mouseoverTimeout(linkElement, important) {
		if (isPrerenderSupported && isMobile) prerender(linkElement.href, important)
		else preload(linkElement.href, important, !(isMobile && (saveData || has3G))) // on mobile we want to cancel requests when data saver is enabled or user has slow connection
		mouseoverTimer = undefined
	}

	/**
	 * @param {{ relatedTarget: { closest: (arg0: string) => any; }; target: { closest: (arg0: string) => any; }; }} event
	 */
	function mouseoutListener(event) {
		if (checkForClosestAnchor(event) === checkForClosestAnchor(event, true)) return

		if (mouseoverTimer) {
			clearTimeout(mouseoverTimer)
			mouseoverTimer = undefined
			return
		}

		stopPreloading()
	}

	/**
	 * @param {{ which: number; metaKey: any; ctrlKey: any; target: { closest: (arg0: string) => any; }; }} event
	 */
	function mousedownShortcutListener(event) {
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return

		if (event.which > 1 || event.metaKey || event.ctrlKey) return

		const linkElement = checkForClosestAnchor(event)
		if (!linkElement || 'noInstant' in linkElement.dataset || linkElement.getAttribute('download') !== null) return // we don't use isPreloadable because this might lead to external links

		linkElement.addEventListener(
			'click',
			ev => {
				if (ev.detail === 1337) return
				ev.preventDefault()
			},
			{ capture: true, once: true }
		)

		const customEvent = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1337, view: window })
		linkElement.dispatchEvent(customEvent)
	}

	function mousedownListener(event) {
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return
		if (event.which > 1 || event.metaKey || event.ctrlKey) return

		const linkElement = checkForClosestAnchor(event)
		if (!isPreloadable(linkElement, true)) return

		prerender(linkElement.href, true)
	}

	/**
	 * @param {HTMLElement} linkElement
	 * @param ignoreUrlCheck
	 */
	function isPreloadable(linkElement, ignoreUrlCheck) {
		let href
		if (!linkElement || !(href = linkElement.href)) return false

		if ((!ignoreUrlCheck && preloadedUrls.has(href)) || href.charCodeAt(0) === 35 /* # */) return false

		const preloadLocation = new URL(href)

		if (linkElement.origin != location.origin) {
			let allowed = allowExternalLinks || 'instant' in linkElement.dataset
			if (!allowed || !_chromiumMajorVersionInUserAgent) {
				return false
			}
		}

		if (preloadLocation.protocol !== 'http:' && preloadLocation.protocol !== 'https:') return false
		if (preloadLocation.protocol === 'http:' && location.protocol === 'https:') return false
		if ((useWhitelist || (!allowQueryString && preloadLocation.search)) && !('instant' in linkElement.dataset)) return false
		if (preloadLocation.hash && preloadLocation.pathname + preloadLocation.search === location.pathname + location.search) return false
		if ('noInstant' in linkElement.dataset) return false
		if (linkElement.getAttribute('download') !== null) return false

		return true
	}

	/**
	 * @param {string} url
	 * @param important
	 * @param newTag
	 */
	function _prefetch(url, important, newTag) {
		console.log('prefetch', url)

		preloadedUrls.add(url)

		// trigger PrerenderV2: https://chromestatus.com/feature/5197044678393856
		// Before Chromium 107, adding another speculation tag instead of modifying the existing one fails
		/*if (allowSpeculationRules) { // && chromiumMajorVersionClientHint >= 107; but this check would exclude other Chromium browsers (Opera) that support this.
			const speculationTag = document.createElement('script')
			speculationTag.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: [url] }] })
			speculationTag.type = 'speculationrules'
			head.appendChild(speculationTag)
			return;
		}*/

		const fetcher = newTag ? document.createElement('link') : prefetcher
		if (important) fetcher.setAttribute('fetchPriority', 'high')
		fetcher.href = url
		fetcher.rel = 'prefetch'
		fetcher.as = 'document'
		// as=document is Chromium-only and allows cross-origin prefetches to be
		// usable for navigation. They call it “restrictive prefetch” and intend
		// to remove it: https://crbug.com/1352371

		if (newTag) head.appendChild(fetcher)
	}

	/**
	 * @param {string} url
	 * @param important
	 */
	function prerender(url, important) {
		console.log('prerender', url)

		preloadedUrls.add(url)

		// trigger PrerenderV2: https://chromestatus.com/feature/5197044678393856
		// Before Chromium 107, adding another speculation tag instead of modifying the existing one fails
		if (allowSpeculationRules) {
			// && chromiumMajorVersionClientHint >= 107; but this check would exclude other Chromium browsers (Opera) that support this.
			const speculationTag = document.createElement('script')
			speculationTag.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: [url] }] })
			speculationTag.type = 'speculationrules'
			head.appendChild(speculationTag)
			return
		}

		if (important) prefetcher.setAttribute('fetchPriority', 'high')
		prefetcher.href = url
		prefetcher.rel = 'prerender'
	}

	/**
	 * @param {string} url
	 * @param important
	 * @param newTag
	 */
	function _preload(url, important, newTag) {
		if (isMobile)
			// ~90ms is too slow to get a preload done on mobile (request can not be re-used)
			return

		console.log('preload', url)

		preloadedUrls.add(url)

		const fetcher = newTag ? document.createElement('link') : prefetcher
		// although Safari doesn't support `fetchPriority`, we can still set it (and hope for the best in the future)
		if (important) fetcher.setAttribute('fetchPriority', 'high')
		fetcher.as = 'fetch' // Safari doesn't support `document`
		fetcher.href = url
		fetcher.rel = 'preload' // Safari wants preload set last

		if (newTag) head.appendChild(fetcher)
	}

	function stopPreloading() {
		prefetcher.removeAttribute('rel') // so we don't trigger an empty prerender
		prefetcher.removeAttribute('href') // might not cancel, if this isn't removed
		prefetcher.removeAttribute('fetchPriority')
		prefetcher.removeAttribute('as')
	}
})(document, location, Date)
