/*!instant.page5.1-(c)2019 Alexandre Dieulot;https://instant.page/license;modified by Jacob Gross*/

;(function (document, location, Date) {
	'use strict'

	if (!('Set' in window)) return
	// min browsers: Edge 15, Firefox 54, Chrome 51, Safari 10, Opera 38, Safari Mobile 10
	
	const prefetcher = document.createElement('link')
	const head = document.head
	head.appendChild(prefetcher)

	const preloadedUrls = new Set()
	let mouseoverTimer = 0
	let lastTouchTimestamp = 0

	let relList = prefetcher.relList
	const supports = relList !== undefined && relList.supports !== undefined // need this check, as Edge < 17, Safari < 10.1, Safari Mobile < 10.3 don't support this
	const isPrerenderSupported = supports && relList.supports('prerender')
	const preload = !supports || relList.supports('prefetch') ? _prefetch : relList.supports('preload') ? _preload : () => {} // Safari (11.1, mobile 11.3) only supports preload; for other browser we prefer prefetch over preload

	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {}
	const effectiveType = typeof connection.effectiveType === 'string' ? connection.effectiveType : ''
	const has3G = effectiveType.indexOf('3g') !== -1
	const saveData = connection.saveData || effectiveType.indexOf('2g') !== -1

	let dataset = document.body.dataset
	const mousedownShortcut = 'instantMousedown' in dataset
	const allowQueryString = 'instantAllowQueryString' in dataset
	const allowExternalLinks = 'instantAllowExternalLinks' in dataset
	const useViewport =
		!saveData &&
		'instantViewport' in dataset &&
		/* Biggest iPhone resolution (which we want): 414 * 896 = 370944
		 * Small 7" tablet resolution (which we don't want): 600 * 1024 = 614400
		 * Note that the viewport (which we check here) is smaller than the resolution due to the UI's chrome */
		('instantViewportMobile' in dataset || document.documentElement.clientWidth * document.documentElement.clientHeight > 450000)

	const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111
	const HOVER_DELAY = 'instantIntensity' in dataset ? +dataset.instantIntensity : 65

	document.addEventListener('touchstart', touchstartListener, { capture: true, passive: true })
	document.addEventListener('mouseover', mouseoverListener, { capture: true })

	if (mousedownShortcut) document.addEventListener('mousedown', mousedownShortcutListener, { capture: true })
	if (isPrerenderSupported) document.addEventListener('mousedown', mousedownListener, { capture: true }) // after 'mousedown' it leaves us ~80ms prerender time to mouseup.

	if (useViewport && window.IntersectionObserver && 'isIntersecting' in IntersectionObserverEntry.prototype) {
		// https://www.andreaverlicchi.eu/quicklink-optimal-options/
		const PREFETCH_LIMIT = !has3G ? ('instantAllowExternalLinks' in dataset ? +dataset.instantLimit : 1 / 0) : 1 // Infinity
		const SCROLL_DELAY = 'instantScrollDelay' in dataset ? +dataset.instantScrollDelay : 500
		const THRESHOLD = 0.75

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
						const entry = entries[i]
						const linkElement = entry.target

						if (len > PREFETCH_LIMIT) return

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
							hrefsInViewport.delete(index)
						}
					}
				},
				{ threshold: THRESHOLD }
			)

			const nodes = document.querySelectorAll('a')
			for (let i = 0; i < nodes.length; ++i) {
				const node = nodes[i]
				if (isPreloadable(node)) {
					intersectionObserver.observe(node)
				}
			}
		})
	}

	dataset = relList = null // GC

	let isMobile = false

	function checkForClosestAnchor(event, relatedTarget) {
		const target = !relatedTarget? event.target : event.relatedTarget
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

		if (!allowExternalLinks && preloadLocation.origin !== location.origin && !('instant' in linkElement.dataset)) return false

		if (preloadLocation.protocol !== 'http:' && preloadLocation.protocol !== 'https:') return false
		if (preloadLocation.protocol === 'http:' && location.protocol === 'https:') return false
		if (!allowQueryString && preloadLocation.search && !('instant' in linkElement.dataset)) return false
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

		const fetcher = newTag ? document.createElement('link') : prefetcher
		if (important) fetcher.setAttribute('importance', 'high')
		fetcher.href = url
		fetcher.rel = 'prefetch'

		if (newTag) head.appendChild(fetcher)
	}

	/**
	 * @param {string} url
	 * @param important
	 */
	function prerender(url, important) {
		console.log('prerender', url)

		preloadedUrls.add(url)

		// trigger PrerenderV2 https://chromestatus.com/feature/5197044678393856
		const speculationTag = document.createElement('script')
		speculationTag.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: [url] }] })
		speculationTag.type = 'speculationrules'
		head.appendChild(speculationTag)

		if (important) prefetcher.setAttribute('importance', 'high')
		prefetcher.href = url
		prefetcher.rel = 'prerender prefetch' // trigger both at the same time
	}

	/**
	 * @param {string} url
	 * @param important
	 * @param newTag
	 */
	function _preload(url, important, newTag) {
		console.log('preload', url)

		preloadedUrls.add(url)

		const fetcher = newTag ? document.createElement('link') : prefetcher
		fetcher.as = 'fetch' // Safari doesn't support `document`
		fetcher.href = url
		fetcher.rel = 'preload' // Safari wants preload set last

		if (newTag) head.appendChild(fetcher)
	}

	function stopPreloading() {
		prefetcher.removeAttribute('rel') // so we don't trigger an empty prerender
		prefetcher.removeAttribute('href') // might not cancel, if this isn't removed
		prefetcher.removeAttribute('importance')
	}
})(document, location, Date)
