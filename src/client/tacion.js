/*global yepnope, Pusher */
(function(global, dom, loader, Pusher, mobile, $){

	"use strict";

	/**
	* A map of jQuery elements that are used globally
	* @type {Object}
	*/
	var elements = {
		window: $(global)
	};

	/**
	* A map of properties used to globally keep track of presentation state
	* @type {Object}
	*/
	var presentation = { };

	/**
	* A map of objects required for syncing over pusher's web-socket service
	* @type {Object}
	*/
	var sync = {
		enabled: false,
		channels: {}
	};

	/**
	* Starts a presentation by loading its manifest and then
	* calling the init function when the manifest is done loading.
	* @param {String} folder The folder that manifest.json lives in
	*/
	function start(folder) {

		// start a job to wait for document ready
		var documentReady = $.Deferred();
		elements.document = $(documentReady.resolve).on('pagebeforechange', onChange);

		// cache DOM elements then the document is ready
		documentReady.then(function(){
			spinner('loading presentation');
			elements.body = $(dom.body);
			elements.html = elements.body.closest('html').andSelf();
		});

		// initialize tacion once we have a manifest file
		var manifestLoaded = loadFile('manifest.json', folder);
		$.when(manifestLoaded, documentReady).then(function(args){
			init(args.shift());
		});

	}

	/**
	* Initializes the internal framework state.
	* @param {Object} manifest The manifest file describing the presentation
	*/
	function init(manifest) {

		// set slide parameters
		presentation.slides     = manifest.slides;
		presentation.slideCount = manifest.slides.length;

		// try to connect the pusher web-socket service.
		// no need to block, we can let this load in parallel
		openSocket(manifest);

		// set a slide template (if defined), then refresh the page
		if (manifest.template) {
			loadFile(manifest.template).then(setTemplate).then(refresh);
		} else {
			setTemplate('<div data-role="page">{{content}}</div>');
			refresh();
		}
	}

	/**
	* Attempts to connect to the pusher web-socket service. By default,
	* the method will put you in passenger mode. However, if a server is
	* defined in the manifest, and you are able to connect to it, then
	* it will put you in driver mode
	* @param {Object} manifest The configuration object. Relevant properties
	*                          are the 'pusher' and 'server' values.
	*/
	function openSocket(manifest) {

		// pessimistically assume that the user is following along
		passengerMode();

		// disable all syncing - enables manual control
		toggleSyncing(false, false);

		// if the user has provided an API key, then attempt to
		// connect to the pusher web-socket service
		if (manifest.pusher) {

			// create a reference to the pusher API
			sync.api = new Pusher(manifest.pusher, { encrypted: true });

			// monitor the API connection for the duration of the presentation
			addSocketListener('connection', 'state_change', onConnectionChange);

			// now, let's check if this user qualifies to drive the presentation
			if (manifest.server) {

				// attempt to communicate with the defined server
				$.getJSON(manifest.server).then(function(data){

					// if the server responds with the correct API key,
					// then we are safe to assume that the current user is
					// driving the presentation
					if (data && data.api_key === manifest.pusher) {
						// cache a reference to the valid server
						sync.server = manifest.server;
						// and mark this user as the slide driver
						driverMode();
					}

				});

			}
		}
	}

	/**
	* Depending on the sync role, this method determines whether or not
	* events are sent or received across the sync channel
	* @param enabled Whether or not events will be sent or received
	* @param switchable Whether or not the user can switch between manual and sync mode
	*/
	function toggleSyncing(enabled, switchable) {

		// set the sync theme based on the sync state
		if (sync.enabled !== enabled) {
			sync.enabled = enabled;
			if (enabled) { alternateSyncThemes(); }
			else         { resetSyncTheme();     }
			if (sync.role === 'passenger') {
				toggleController(!enabled);
			}
		}

		// set whether or not the user can switch between sync and manual mode
		if (sync.switchable !== switchable && switchable !== undefined) {
			sync.switchable = switchable;
		}

		// enable or disable the sync switches
		if (sync.switchable) {
			sync.switches.slider('enable');
		} else {
			sync.switches.slider('disable');
		}

		// finally, set the sync switch values for all the slides
		var value = enabled ? 'syncing' : 'off';
		sync.switches.val(value).slider('refresh');

	}

	/**
	* Alternates the theme of sync elements (like the header, if defined).
	* Used to show that sync mode is on.
	*/
	function alternateSyncThemes() {
		if (sync.enabled) {
			getSlide(presentation.slide).then(function(slide){
				var alternators = slide.data('alternators');
				var theme = 'ui-bar-' + alternators.data('sync-theme');
				alternators.toggleClass(theme);
				setTimeout(alternateSyncThemes, 2000);
			});
		}
	}

	/**
	* Resets the theme of the sync elements. Used to show that the
	* manual mode is on.
	*/
	function resetSyncTheme() {
		$.each(presentation.slides, function(index, gotSlide){
			if (gotSlide.then) {
				gotSlide.then(function(slide){
					var alternators = slide.data('alternators');
					var theme = 'ui-bar-' + alternators.data('sync-theme');
					alternators.removeClass(theme);
				});
			}
		});
	}

	/**
	* Puts the user in passenger mode. This means that changes to the
	* presentation's state are driven by the sync channel. If the user
	* is in manual mode, then sync events will be ignored and the user
	* can control his/her own presentation
	*/
	function passengerMode() {
		elements.body.addClass(sync.role = 'passenger');
		elements.body.removeClass('driver');
		addSocketListener('sync', 'state', syncState);
		toggleController(!!sync.manual);
	}

	/**
	* Puts the user in driver mode. This means that changes to the
	* presentation state are done manually, and all changes are
	* sent to the sync channel for sharing with all passengers
	*/
	function driverMode() {
		elements.body.addClass(sync.role = 'driver');
		elements.body.removeClass('passenger');
		removeSocketListener('sync', 'state', syncState);
		toggleController(true);
	}

	/**
	* Binds an event listener to a Pusher web-socket channel
	* @param {String} channelName The channel to bind a listener to
	* @param {String} event The event to listen for
	* @param {Function} callback The handler for when the event is fired
	*/
	function addSocketListener(channelName, event, callback) {
		if (channelName && sync.api) {
			var channel = getOrCreateChannel(channelName);
			if (event && callback) {
				channel.bind(event, callback);
			}
		}
	}

	/**
	* Removes an event listener from a Pusher web-socket channel
	* @param {String} channelName The channel to remove a listener from
	* @param {String} event The event to stop listening to
	* @param {Function} callback The handler to remove
	*/
	function removeSocketListener(channelName, event, callback) {
		if ((channelName in sync.channels) && sync.api) {
			var channel = getOrCreateChannel(channelName);
			if (event && callback) {
				channel.unbind(event, callback);
			}
		}
	}

	/**
	* Fires an event (with optional data) against a web-socket channel. Only
	* drivers can use this method, as it sends messages to the server defined
	* in the manifest. If the server is not there, this method will fail
	* @param {String} channel The channel to fire the event on
	* @param {String} event The event to fire on the channel
	* @param {Object} data A map of data to send to the channel
	* @return {jQuery.Deferred} The AJAX request to the server
	*/
	function sendSocketData(channel, event, data) {
		return $.ajax({
			url: sync.server,
			type: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({
				channel: channel,
				event: event,
				data: data
			})
		});
	}

	/**
	* Attempts to get or create a channel by name
	* @param {String} name The name of the channel to fetch
	* @return {Pusher.Channel} The fetched channel
	*/
	function getOrCreateChannel(name) {
		if (name === 'connection') {
			return sync.api.connection;
		} else if (name in sync.channels) {
			return sync.channels[name];
		} else {
			return sync.channels[name] = sync.api.subscribe(name);
		}
	}

	/**
	* Loads a generic file from the presentation's folder
	* @param {String} path The relative file path to load
	* @param {String} folder The folder to set for relative paths
	* @return {jQuery.Deferred} The deferred object for the request
	*/
	function loadFile(path, folder) {
		if (folder) { presentation.rootFolder = folder; }
		return $.get(presentation.rootFolder+'/'+path);
	}

	/**
	* Setter for the presentation's slide template
	* @param {String} html The slide template markup
	*/
	function setTemplate(html) {
		presentation.template = html;
	}

	/**
	* Reloads the current slide and step based
	* off of the state of the URL hash
	*/
	function refresh() {
		var current = urlState(location);
		change(current.step, current.slide, {
			transition: 'fade'
		});
	}

	/**
	* Parses the a URL fragment for state information
	* @param {String} href An optional pass-in to parse, defaults to the current URL
	* @return {Object} A state map from the URL
	*/
	function urlState(href) {
		var url = href ? mobile.path.parseUrl(href) : global.location;
		var hash = url.hash.split('#').pop();
		var pairs = hash.split('&');
		var args = { slide: 0, step: 0 };
		$.each(pairs, function(i, pair){
			pair = pair.split('=');
			args[pair[0]] = parseInt(pair[1], 10);
		});
		return args;
	}

	/**
	* Shows or hides a loading message in the UI
	* @param {String|Boolean} msgText The text to show in the loading message, or false to hide it
	*/
	function spinner(msgText) {
		if (msgText) {
			mobile.showPageLoadingMsg('a', msgText, true);
		} else {
			mobile.hidePageLoadingMsg();
		}
	}

	/**
	* Changes the slide (or step) by updating the URL hash
	* @param {Number} step The step to change to
	* @param {Number} slide The slide to change to
	* @param {Object} options Any options to override for the pending transition
	*/
	function change(step, slide, options) {
		step = unsigned(step) ? step : 0;
		slide = unsigned(slide) ? slide : 0;
		mobile.changePage('#slide='+slide+'&step='+step, options);
	}

	/**
	* Checks if a value is numeric, and greater or equal to 0
	* @param {*} i The value to check
	* @return {Boolean} true if the value is unsigned, false otherwise
	*/
	function unsigned(i) {
		return $.type(i) === 'number' && i >= 0;
	}

	/**
	* Called whenever the 'pagebeforeload' event is fired. This method
	* subverts jQuery mobile's built in controller so that we may load
	* in our own content
	* @param {Event} event The 'pagebeforeload' event object
	* @param {Object} data A configuration object for the event
	*/
	function onChange(event, data) {
		// if the location is a string, then a new slide was requested.
		// if the location is not a string, then it is the content we
		// generated for the slide.
		var location = data.toPage;
		if ($.type(location) === 'string') {
			// load content for whatever slide is selected in the request
			var current = urlState(location);
			update(current.slide, current.step, data);
			// this will subvert the default jQuery mobile logic, and
			// allow us to generate our own content in the update call
			event.preventDefault();
		}
	}

	/**
	* Updates the presentation to display the requested slide and step
	* @param {Number} slide The slide to show
	* @param {Number} step The step in the slide to transition to
	* @param {Object} data A map of transition data
	*/
	function update(slide, step, data) {

		spinner('loading slide');

		// drivers sync state with passengers on update
		if (sync.role === 'driver') {
			syncState(slide, step);
		}

		// get the requested slide
		getSlide(slide).then(function(page){

			var defaults = {
				dataUrl: data.toPage,
				transition: 'none'
			};

			// scroll to the top and respect transitions on new slides
			if (presentation.slide !== slide) {
				defaults.transition = page.data('transition') || 'slide';
				scrollTo(0, 0);
			}

			// set the slide state for this user
			presentation.slide = slide;
			presentation.step = step;

			// instruct jQuery mobile to show the current slide
			mobile.changePage(page, $.extend(defaults, data.options || {}));

			// display the correct step to the user
			gotoStep(step, slide);

			// and inform the API that the slide has been updated
			trigger('update', {
				page: page,
				slide: presentation.slide,
				step: presentation.step
			});

		}).fail(function(index){
			alert('Unable to find slide #' + index);
		});

	}

	/**
	* Gets a slide from memory or from the server. Returns a job that can be
	* used to extract the slide page element
	* @param {Number} slide The slide index to retrieve
	* @return {jQuery.Deferred} An async job that can be used to fetch the slide page
	*/
	function getSlide(slide) {

		var loader = presentation.slides[slide];

		// if the slide index does not exist, error out
		if (loader === undefined) {
			return $.Deferred().reject(slide);
		} else {
			// if the slide index is a path, we should convert it
			// to an async loader for the slide
			if (!loader.then) {
				loader = presentation.slides[slide] = loadSlide(loader);
			}
			// finally, return the loader interface
			return loader.promise();
		}

	}

	/**
	* Loads a slide from the server and returns a job that can be used to
	* access the slide page
	* @param {String} path The path to the slide content file
	* @return {jQuery.Deferred} An async job that can be used to fetch the slide page
	*/
	function loadSlide(path) {
		var afterRender = $.Deferred();
		loadFile(path).then(function(html) {
			renderSlide(html).then(afterRender.resolve);
		});
		return afterRender.promise();
	}

	/**
	* Takes raw html content for a slide, and returns a job that can be used to access
	* the final rendered slide page
	* @param {String} html The raw html of the slide content
	* @return {jQuery.Deferred} An async job that can be used to fetch the slide page
	*/
	function renderSlide(html) {

		// used to track the render job
		var job = $.Deferred();

		// wraps the slide content with a template file
		var slide   = wrapSlideContent(html);
		var content = slide.find('[data-role=content]');

		// the whole page might actually be a step
		// (if the content defines a page step)
		var pageStep = content.data('page-step');
		if (pageStep) {
			steps.push(slide.attr('data-step', pageStep).get(0));
		}

		// parse the slide content for shared elements
		var alert       = slide.find('.alert');
		var assets      = slide.find('link[href]').remove();
		var steps       = slide.find('[data-step]');
		var alternators = slide.find('[data-sync-theme]');
		var contentId   = content.attr('id') || presentation.slide;

		// bind slide data to the slide, and add the slide to the page
		slide.attr('id', contentId + '-page').data({
			steps: steps,
			alternators: alternators,
			alert: alert
		}).appendTo(elements.body).page();

		// add any sync switches to the global list
		var syncSwitches = slide.find('.sync');
		if (syncSwitches.size()) {
			syncSwitches.each(addSyncSwitch);
		}

		// bind click listener to alers
		if (alert.size()) {
			alert.on('click', function(){
				alert.removeClass('active');
			});
		}

		// download any declared assets in the slide content
		var urls = $.makeArray(assets.map(assetUrl));
		var done = function(){ job.resolve(slide); };
		if (urls.length) {
			loader({
				load: urls,
				complete: done
			});
		} else {
			done();
		}

		return job.promise();

	}

	/**
	* Transitions to a step in a given slide
	* @param {Number} step The step to transition to
	* @param {jQuery} page The parent slide page
	*/
	function gotoStep(step, page) {
		var target, padding = 100;
		// iterate over every step
		page.data('steps').each(function(){
			var element = $(this);
			var active = element.data('step') <= step;
			// determine if the step is active or not
			if (active) {
				// capture the *first* converted step to scroll to
				if (!element.hasClass('active') && !target) {
					target = element;
				}
				element.addClass('active');
			} else {
				element.removeClass('active');
			}
		});
		// if the first converted step is off screen, then we
		// scroll it into screen
		if (target && !elementVisible(target.get(0), padding)) {
			scrollTo(target.offset().top-padding);
		}
	}

	/**
	* Scrolls the screen to a Y position on the screen
	* @param {Number} top The Y position to scroll to
	* @param {Number} time The time to take when scrolling (default 500ms)
	*/
	function scrollTo(top, time) {
		var scrollTop = Math.max(top, 0);
		var duration = time !== undefined ? time : 500;
		var step = function(){
			elements.window.trigger('resize');
		};
		elements.window.animate({
			scrollTop: scrollTop
		}, {
			duration: duration,
			step: step
		});
	}

	/**
	* Syncs the state between a driver and passengers.
	* Calling this method as a driver sends the state to passengers.
	* Calling as a passenger will set the current state to the provided values.
	* @param {Number} slide The slide to change to
	* @param {Number} step The step to go to
	*/
	function syncState(slide, step) {
		if (sync.enabled) {
			if (sync.role === 'passenger') {
				var transition = slide !== presentation.slide ? 'slide' : 'none';
				var reverse = slide < presentation.slide;
				change(step, slide, {
					allowSamePageTransition: true,
					transition: transition,
					reverse: reverse
				});
			} else {
				sendSocketData('sync', 'state', {
					slide: slide,
					step: step
				});
			}
		}
	}

	/**
	* Triggers a global event for the API
	* @param {String} event The event name
	* @param {Object} data Data to pass to the event listeners
	*/
	function trigger(event, data) {
		elements.window.trigger(namespaceEvent(event), data);
	}

	/**
	* Binds an event handler to an API event
	* @param {String} event The event to bind to
	* @param {Function} callback The event listener add
	*/
	function on(event, callback) {
		elements.window.on(namespaceEvent(event), callback);
	}

	/**
	* Removes an event handler from the API
	* @param {String} event The event to unbind
	* @param {Function} callback The event listener to remove
	*/
	function off(event, callback) {
		elements.window.off(namespaceEvent(event), callback);
	}

	/**
	* Namespaces events so that they do not collide with real DOM events
	* @param {String} event The event to namespace
	* @return {String} The namespaced event
	*/
	function namespaceEvent(event) {
		return 'tacion:' + event;
	}

	function slideNode(html) {
		var regex = /\{\{([a-z]+)\}\}/g;
		var onMatch = function(match, key){
			if (key === 'content') { return html; }
			else if (key === 'index') { return state.slide+1; }
			else if (key === 'count') { return state.count; }
		};
		return $(template.replace(regex, onMatch));
	}

	function changeSync(event) {
		var sync = $(event.target);
		toggleSyncing(sync.val() === 'syncing');
	}

	function addSync(sync) {
		sync.each(function(){
			syncs.push(this);
		}).change(changeSync);
		toggleSyncing(state.syncing);
	}

	function assetUrl(i, asset) {
		var url = $(asset).attr('href');
		if (!urlCache.hasOwnProperty(url)) {
			urlCache[url] = true;
			return folder + '/' + url;
		} else {
			return undefined;
		}
	}

	function elementVisible(el, padding) {
		var top = el.offsetTop;
		var left = el.offsetLeft;
		var width = el.offsetWidth;
		var height = el.offsetHeight;

		while(el.offsetParent) {
			el = el.offsetParent;
			top += el.offsetTop;
			left += el.offsetLeft;
		}

		return (
			top >= global.pageYOffset &&
			left >= global.pageXOffset &&
			(top + height) <= (global.pageYOffset + global.innerHeight - (padding||0)) &&
			(left + width) <= (global.pageXOffset + global.innerWidth)
		);
	}

	function next() {
		var index = state.slide;
		var step = state.step;
		getSlide(index).then(function(slide){
			var nextSlide = index + 1;
			var maxSlide = state.count;
			var nextStep = step + 1;
			var steps = slide.data('steps').not('.active');
			if (steps.size() > 0) {
				change(nextStep, index, {
					allowSamePageTransition: true,
					transition: 'none'
				});
			} else {
				if (nextSlide < maxSlide) {
					change(0, nextSlide);
				}
			}
		});
	}

	function prev() {
		var index = state.slide;
		var step = state.step;
		getSlide(index).then(function(){
			var prevSlide = index - 1;
			var prevStep = step - 1;
			if (prevStep < 0) {
				if (prevSlide >= 0) {
					change(0, prevSlide, {
						reverse: true
					});
				}
			} else {
				change(prevStep, index, {
					allowSamePageTransition: true,
					transition: 'none'
				});
			}
		});
	}

	function controller(event) {
		var target = $(event.target);
		if (!target.is('.ui-focus, .ui-focus *')) {
			if (event.type === 'swipeleft') { next(); }
			else if (event.type === 'swiperight') { prev(); }
			else {
				switch(event.which) {
					case 37: // left
					case 38: // up
						prev(); break;
					case 39: // right
					case 40: // down
					case 32: // space
					case 13: // enter
						next(); break;
				}
			}
		}
	}

	function toggleController(on) {
		var manual = !!on;
		if (state.manual !== manual) {
			var method = (state.manual = manual) ? 'on' : 'off';
			var events = 'swipeleft swiperight keyup';
			dom[method](events, controller);
		}
	}

	function alert(message) {
		spinner(false);
		getSlide(state.slide).then(function(slide){
			var alert = slide.data('alert');
			if (alert) {
				if ($.type(message) === 'string') {
					alert.children('.message').text(message);
					alert.addClass('active');
					scrollTo(0);
				} else {
					alert.removeClass('active');
				}
			} else if ($.type(message) === 'string') {
				global.alert(message);
			}
		});
	}

	function onConnectionChange(event) {
		var errorMessages = {
			'failed': 'Syncing support unavailable for this device.',
			'disconnected': 'Connection lost! Will try again momentarily...'
		};
		if (event.current in errorMessages) {
			toggleSyncing(false, false);
			alert(errorMessages[event.current]);
		} else if (event.current === 'connected') {
			toggleSyncing(true, true);
			alert(false);
		}
	}

	// Expose the public API
	global.tacion = {
		alert: alert,
		next: next,
		change: change,
		off: off,
		on: on,
		prev: prev,
		refresh: refresh,
		spinner: spinner,
		start: start
	};

})(window, document, yepnope, Pusher, jQuery.mobile, jQuery);

/**
 * *** NOTE: THIS IS A HACK ***
 * I was forced to hot-patch jQuery mobile to fix it's
 * scroll preservation support. jQuery mobile is
 * supposed to keep track of your last scroll offset
 * before a transition, and the restore it after the
 * transition. Unfortunately, when transitioning
 * between steps on a slide, the scroll offset is lost.
 * This patch simply forces the active history object
 * to always have a "lastScroll" property, essentially
 * remedying the situation. Alas, I have no idea if this
 * change will break other components.
 */
(function(history, global){

	"use strict";

	var oldGetActive = history.getActive;
	var frame = $(global);

	history.getActive = function(){
		var active = oldGetActive() || {};
		if (active.lastScroll === undefined) {
			active.lastScroll = frame.scrollTop();
		}
		return active;
	};

})(jQuery.mobile.urlHistory, window);

