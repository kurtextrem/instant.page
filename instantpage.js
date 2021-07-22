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
	const preload = supports && relList.supports('prefetch') ? _prefetch : _preload // Safari only supports preload

	const DELAY_TO_NOT_BE_CONSIDERED_A_TOUCH_INITIATED_ACTION = 1111

	let dataset = document.body.dataset
	const mousedownShortcut = 'instantMousedownShortcut' in dataset
	const allowQueryString = 'instantAllowQueryString' in dataset
	const allowExternalLinks = 'instantAllowExternalLinks' in dataset
	const has3G = navigator.connection !== undefined && navigator.connection.effectiveType.includes('3g')
	const saveData = navigator.connection !== undefined && (navigator.connection.saveData || navigator.connection.effectiveType.includes('2g'))

	document.head.appendChild(prefetcher)

	const HOVER_DELAY = ('instantIntensity' in dataset) ? +dataset.instantIntensity : 65
	const useViewport = !saveData && ('instantViewport' in dataset) && 
		/* Biggest iPhone resolution (which we want): 414 × 896 = 370944
     * Small 7" tablet resolution (which we don’t want): 600 × 1024 = 614400
     * Note that the viewport (which we check here) is smaller than the resolution due to the UI’s chrome */
		(('instantViewportMobile' in dataset) || document.documentElement.clientWidth * document.documentElement.clientHeight > 450000)
	const prefetchLimit = has3G ? 1 : Infinity

	document.addEventListener('touchstart', touchstartListener, { capture: true, passive: true })
	document.addEventListener('mouseover', mouseoverListener, { capture: true })

	if (mousedownShortcut)
		document.addEventListener('mousedown', mousedownShortcutListener, { capture: true })
	if (isPrerenderSupported)
		document.addEventListener('mousedown', mousedownListener, { capture: true })

	// @todo Add prefetchLimit & test if multiple prefetches work on on rel element
	if (useViewport) {
		// https://www.andreaverlicchi.eu/quicklink-optimal-options/
		const SCROLL_DELAY = ('instantScrollDelay' in dataset) ? +dataset.instantScrollDelay : 500
		const THRESHOLD = 0.75

    const triggeringFunction = (callback) => {
        requestIdleCallback(callback, {
          timeout: 1500,
        })
      }

		const hrefsInViewport = []
    
    triggeringFunction(() => {
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
					const linkElement = entry.target
          if (entry.isIntersecting) {
						// Adding href to array of hrefsInViewport
						hrefsInViewport.push(linkElement.href)

						setTimeout(() => {
							// Do not prefetch if not found in viewport
							if (hrefsInViewport.indexOf(linkElement.href) === -1) return

							intersectionObserver.unobserve(linkElement)
							preload(linkElement.href)
						}, SCROLL_DELAY)
          } else {
						const index = hrefsInViewport.indexOf(linkElement.href)
						if (index > -1) {
							hrefsInViewport.splice(index)
						}
					}
        })
      }, { threshold: THRESHOLD })

      document.querySelectorAll('a').forEach((linkElement) => {
        if (isPreloadable(linkElement)) {
          intersectionObserver.observe(linkElement)
        }
      })
    },)
  }

	dataset = relList = null // GC

	let isMobile = false

	/**
	 * @param {{ target: { closest: (arg0: string) => any; }; }} event
	 */
	function touchstartListener(event) {
		if (!('closest' in event.target)) return // Safari 13.0.5 on iOS 13.3.1 on iPhone

		isMobile = true
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
				preload(linkElement.href)
				mouseoverTimer = 0
			},
			HOVER_DELAY
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
		if (!isPreloadable(linkElement)) return

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
		if (!isPreloadable(linkElement)) return

		prerender(linkElement.href) 
	}

	/**
	 * @param {HTMLElement} linkElement
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
		if (linkElement.getAttribute('download') !== null) return false

		return true
	}

	/**
	 * @param {string} url
	 */
	function _prefetch(url, important) {
		//console.log('prefetch', url)
		prefetcher.rel = 'prefetch'
		prefetcher.href = url
		if (importannt) prefetcher.importance = 'high'
	}

	/**
	 * @param {string} url
	 */
	function prerender(url) {
		//console.log('prerender', url)
		prefetcher.rel = 'prerender'
		prefetcher.href = url

		// https://docs.google.com/document/d/1P2VKCLpmnNm_cRAjUeE-bqLL0bslL_zKqiNeCzNom_w/edit
		if (isMobile) {
			const tag = document.createElement('script')
			tag.src = 'speculationrules'
			const obj = { prerender: [{ source: 'list', urls: [url] }] }
			tag.textContent = JSON.stringify(obj)
		}
	}

	/**
	 * @param {string} url
	 */
	function _preload(url) {
		//console.log('preload', url)
		prefetcher.rel = 'preload'
		prefetcher.as = 'document'
		prefetcher.href = url
	}

	function stopPreloading() {
		prefetcher.removeAttribute('rel') // so we don't trigger an empty prerender
		prefetcher.removeAttribute('href') // might not cancel, if this isn't removed
	}
})(document, location)
