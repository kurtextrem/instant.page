/*!instant.page5-(c)2019 Alexandre Dieulot;https://instant.page/license;modified by Jacob Gross*/

;(function (document, location) {
	'use strict'

	let urlToPreload = ''
	let mouseoverTimer = 0
	let lastTouchTimestamp = 0

	const prefetcher = document.createElement('link')
	let relList = prefetcher.relList
	const supports = relList !== undefined && relList.supports !== undefined
	const isPrerenderSupported = supports && relList.supports('prerender')
	const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111
	const HOVER_DELAY = 65
	const HOVER_PRERENDER_DELAY = 75 // pre-render 10ms later to save resources.

	let dataset = document.body.dataset
	const mousedownShortcut = !('instantNoMousedownShortcut' in document.body.dataset)
	const allowQueryString = 'instantAllowQueryString' in dataset
	const allowExternalLinks = 'instantAllowExternalLinks' in dataset
	const saveData = navigator.connection !== undefined && navigator.connection.saveData

	document.head.appendChild(prefetcher)

	let eventListenersOptions = {
		capture: true,
		passive: true,
	}
	document.addEventListener('touchstart', touchstartListener, eventListenersOptions)
	document.addEventListener('mouseover', mouseoverListener, eventListenersOptions)
	if (mousedownShortcut) {
		document.addEventListener('mousedown', mousedownShortcutListener, eventListenersOptions)
	}

	dataset = relList = eventListenersOptions = null // GC

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function touchstartListener(event) {
		if (!('closest' in event.target)) return // Safari 13.0.5 on iOS 13.3.1 on iPhone

		const passive = { passive: true }

		/* Chrome on Android calls mouseover before touchcancel so `lastTouchTimestamp`
		 * must be assigned on touchstart to be measured on mouseover. */
		lastTouchTimestamp = Date.now()

		const linkElement = event.target.closest('a')

		if (!isPreloadable(linkElement)) return

		linkElement.addEventListener('touchcancel', touchendAndTouchcancelListener, passive)
		linkElement.addEventListener('touchend', touchendAndTouchcancelListener, passive)

		urlToPreload = linkElement.href
		preload(linkElement.href)
	}

	function touchendAndTouchcancelListener() {
		urlToPreload = ''
		stopPreloading()
	}

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function mouseoverListener(event) {
		if (!('closest' in event.target)) return // Safari 13.0.5 on iOS 13.3.1 on iPhone
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return

		const linkElement = event.target.closest('a')

		if (!isPreloadable(linkElement)) return

		linkElement.addEventListener('mouseout', mouseoutListener, {
			passive: true,
		})

		urlToPreload = linkElement.href

		mouseoverTimer = setTimeout(
			function () {
				if (isPrerenderSupported) prerender(linkElement.getAttribute('href'))
				else preload(linkElement.getAttribute('href'))
				mouseoverTimer = 0
			},
			isPrerenderSupported || saveData ? HOVER_PRERENDER_DELAY : HOVER_DELAY
		)
	}

	/**
	 * @param {{ relatedTarget: { closest: (arg0: string) => any; }; target: { closest: (arg0: string) => any; }; }} event
	 */
	function mouseoutListener(event) {
		if (event.relatedTarget && (!('closest' in event.target) || event.target.closest('a') === event.relatedTarget.closest('a'))) return

		if (mouseoverTimer) {
			clearTimeout(mouseoverTimer)
			mouseoverTimer = 0
			return
		}

		urlToPreload = ''
		stopPreloading()
	}

	/**
	 * @param {{ which: number; metaKey: any; ctrlKey: any; target: { closest: (arg0: string) => any; }; }} event
	 */
	function mousedownShortcutListener(event) {
		if (Date.now() - lastTouchTimestamp < DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION) return

		if (event.which > 1 || event.metaKey || event.ctrlKey) return

		const linkElement = event.target.closest('a')
		if (linkElement === null || 'noInstant' in linkElement.dataset || linkElement.getAttribute('download') !== null) return

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

	/**
	 * @param {{ href: any; dataset: any; } | null} linkElement
	 */
	function isPreloadable(linkElement) {
		let href
		if (linkElement === null || !(href = linkElement.href)) return false

		if (urlToPreload === href || href.charCodeAt(0) === 35 /* # */) return false

		const preloadLocation = new URL(href)

		if (!allowExternalLinks && preloadLocation.origin !== location.origin && !('instant' in linkElement.dataset)) return false

		if (preloadLocation.protocol !== 'http:' && preloadLocation.protocol !== 'https:') return false
		if (preloadLocation.protocol === 'http:' && location.protocol === 'https:') return false
		if (!allowQueryString && preloadLocation.search && !('instant' in linkElement.dataset)) return false
		if (preloadLocation.hash && preloadLocation.pathname + preloadLocation.search === location.pathname + location.search) return false
		if ('noInstant' in linkElement.dataset) return false

		return true
	}

	/**
	 * @param {string} url
	 */
	function preload(url) {
		//console.log('preload', url)
		prefetcher.rel = 'prefetch'
		prefetcher.href = url
	}

	/**
	 * @param {string} url
	 */
	function prerender(url) {
		//console.log('prerender', url)
		prefetcher.rel = 'prerender'
		prefetcher.href = url
	}

	function stopPreloading() {
		prefetcher.rel = '' // so we don't trigger an empty prerender
		prefetcher.removeAttribute('href') // might not cancel, if this isn't removed
	}
})(document, location)
