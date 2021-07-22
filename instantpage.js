/*!instant.page5.1-(c)2019 Alexandre Dieulot;https://instant.page/license;modified by Jacob Gross*/

;(function (document, location) {
	'use strict'

	const preloadedUrls = []
	let mouseoverTimer = 0
	let lastTouchTimestamp = 0

	const prefetcher = document.createElement('link')
	if (!('closest' in prefetcher)) return // Safari 13.0.5 on iOS 13.3.1 on iPhone

	let relList = prefetcher.relList
	const supports = relList !== undefined && relList.supports !== undefined
	const isPrerenderSupported = supports && relList.supports('prerender')
	const preload = supports && relList.supports('prefetch') ? _prefetch : _preload // Safari only supports preload

	const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111

	let dataset = document.body.dataset
	const mousedownShortcut = 'instantMousedown' in dataset
	const allowQueryString = 'instantAllowQueryString' in dataset
	const allowExternalLinks = 'instantAllowExternalLinks' in dataset
	const has3G = navigator.connection !== undefined && navigator.connection.effectiveType.includes('3g')
	const saveData =
		navigator.connection !== undefined && (navigator.connection.saveData || navigator.connection.effectiveType.includes('2g'))

	document.head.appendChild(prefetcher)

	const HOVER_DELAY = 'instantIntensity' in dataset ? +dataset.instantIntensity : 65
	const useViewport =
		!saveData &&
		'instantViewport' in dataset &&
		/* Biggest iPhone resolution (which we want): 414 × 896 = 370944
		 * Small 7" tablet resolution (which we don’t want): 600 × 1024 = 614400
		 * Note that the viewport (which we check here) is smaller than the resolution due to the UI’s chrome */
		('instantViewportMobile' in dataset || document.documentElement.clientWidth * document.documentElement.clientHeight > 450000)
	const PREFETCH_LIMIT = !has3G ? ('instantAllowExternalLinks' in dataset ? +dataset.instantLimit : 1 / 0) : 1 // Infinity

	document.addEventListener('touchstart', touchstartListener, { capture: true, passive: true })
	document.addEventListener('mouseover', mouseoverListener, { capture: true })

	if (mousedownShortcut) document.addEventListener('mousedown', mousedownShortcutListener, { capture: true })
	if (isPrerenderSupported) document.addEventListener('mousedown', mousedownListener, { capture: true }) // after 'mousedown' it leaves us ~80ms prerender time to mouseup.

	// @todo Add prefetchLimit & test if multiple prefetches work on on rel element
	if (useViewport && window.IntersectionObserver && 'isIntersecting' in IntersectionObserverEntry.prototype) {
		// https://www.andreaverlicchi.eu/quicklink-optimal-options/
		const SCROLL_DELAY = 'instantScrollDelay' in dataset ? +dataset.instantScrollDelay : 500
		const THRESHOLD = 0.75

		const triggeringFunction = callback => {
			requestIdleCallback(callback, {
				timeout: 1500,
			})
		}

		const hrefsInViewport = []

		triggeringFunction(() => {
			const intersectionObserver = new IntersectionObserver(
				entries => {
					for (let i = 0; i < entries.length; ++i) {
						const entry = entries[i]
						const linkElement = entry.target

						if (hrefsInViewport.length > PREFETCH_LIMIT) return

						if (entry.isIntersecting) {
							// Adding href to array of hrefsInViewport
							hrefsInViewport.push(linkElement.href)

							setTimeout(() => {
								// Do not prefetch if not found in viewport
								if (hrefsInViewport.indexOf(linkElement.href) === -1) return

								intersectionObserver.unobserve(linkElement)
								preload(linkElement.href, false, true)
							}, SCROLL_DELAY)
						} else {
							const index = hrefsInViewport.indexOf(linkElement.href)
							if (index !== -1) {
								hrefsInViewport.splice(index)
							}
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

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function touchstartListener(event) {
		isMobile = true

		/* Chrome on Android calls mouseover before touchcancel so `lastTouchTimestamp`
		 * must be assigned on touchstart to be measured on mouseover. */
		lastTouchTimestamp = Date.now()

		const linkElement = event.target.closest('a')
		if (!isPreloadable(linkElement)) return

		window.addEventListener('scroll', mouseoutListener, { once: true }) // if a scroll occurs before HOVER_DELAY, user is scrolling around

		mouseoverTimer = setTimeout(mouseoverTimeout.bind(undefined, linkElement, true), HOVER_DELAY)
	}

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function mouseoverListener(event) {
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return

		const linkElement = event.target.closest('a')
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
		const target = event.target
		if (event.relatedTarget && (!('closest' in target) || target.closest('a') === event.relatedTarget.closest('a'))) return

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

		const linkElement = event.target.closest('a')
		if (linkElement === null || 'noInstant' in linkElement.dataset || linkElement.getAttribute('download') !== null) return // we don't use isPreloadable because this might lead to external links

		linkElement.addEventListener(
			'click',
			function (/** @type {{ detail: number; preventDefault: () => void; }} */ ev) {
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

		const linkElement = event.target.closest('a')
		if (!isPreloadable(linkElement, true)) return

		prerender(linkElement.href, true)
	}

	/**
	 * @param {HTMLElement} linkElement
	 * @param ignoreUrlCheck
	 */
	function isPreloadable(linkElement, ignoreUrlCheck) {
		let href
		if (linkElement === null || !(href = linkElement.href)) return false

		if ((!ignoreUrlCheck && preloadedUrls.indexOf(href) !== -1) || href.charCodeAt(0) === 35 /* # */) return false

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
		preloadedUrls.push(url)

		let fetcher = prefetcher
		if (newTag) {
			fetcher = document.createElement('link')
			document.head.appendChild(fetcher)
		}

		fetcher.rel = 'prefetch'
		fetcher.href = url
		if (important) fetcher.setAttribute('importance', 'high')
	}

	let speculationTag

	/**
	 * @param {string} url
	 * @param important
	 */
	function prerender(url, important) {
		console.log('prerender', url)
		prefetcher.rel = 'prerender prefetch' // trigger both at the same time
		prefetcher.href = url
		if (important) prefetcher.setAttribute('importance', 'high')

		// https://docs.google.com/document/d/1P2VKCLpmnNm_cRAjUeE-bqLL0bslL_zKqiNeCzNom_w/edit
		if (isMobile) {
			if (!speculationTag) {
				speculationTag = document.createElement('script')
				speculationTag.type = 'speculationrules'
				document.head.appendChild(speculationTag)
			}

			const obj = { prerender: [{ source: 'list', urls: [url] }] }
			speculationTag.textContent = JSON.stringify(obj)
		}
	}

	/**
	 * @param {string} url
	 * @param important
	 * @param newTag
	 */
	function _preload(url, important, newTag) {
		console.log('preload', url)
		preloadedUrls.push(url)

		let fetcher = prefetcher
		if (newTag) {
			fetcher = document.createElement('link')
			document.head.appendChild(fetcher)
		}

		prefetcher.rel = 'preload'
		prefetcher.as = 'document'
		prefetcher.href = url
	}

	function stopPreloading() {
		prefetcher.removeAttribute('rel') // so we don't trigger an empty prerender
		prefetcher.removeAttribute('href') // might not cancel, if this isn't removed
		prefetcher.removeAttribute('importance')
		// speculationTag.textContent = '' // not sure if this works
	}
})(document, location)
