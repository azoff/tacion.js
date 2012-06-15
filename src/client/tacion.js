/*global yepnope, Pusher */
(function(global, dom, loader, Pusher, mobile, $){

	"use strict";

	var folder, html, body, template;
	var syncs = $(), machine = $('<a/>');
	var urlCache = {};
	var state = {};
	var socket = {
		channels: [],
		send: $.noop,
		listen: $.noop,
		unlisten: $.noop
	};

	function namespaceEvent(event) {
		return 'tacion:' + event;
	}

	function trigger(event, data) {
		machine.trigger(namespaceEvent(event), data);
	}

	function on(event, callback) {
		machine.on(namespaceEvent(event), callback);
	}

	function off(event, callback) {
		machine.off(namespaceEvent(event), callback);
	}

	function spinner(msgText) {
		if (msgText) {
			mobile.showPageLoadingMsg('a', msgText, true);
		} else {
			mobile.hidePageLoadingMsg();
		}
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

	function alternateHeaders() {
		if (state.syncing) {
			getSlide(state.slide).then(function(slide){
				var headers = slide.data('headers');
				var theme = 'ui-bar-' + headers.data('sync-theme');
				headers.toggleClass(theme);
				setTimeout(alternateHeaders, 2000);
			});
		}
	}

	function resetHeaders() {
		$.each(state.slides, function(index, deferred){
			if (deferred.then) {
				getSlide(index).then(function(slide){
					var headers = slide.data('headers');
					var theme = 'ui-bar-' + headers.data('sync-theme');
					headers.removeClass(theme);
				});
			}
		});
	}

	function toggleSyncing(on, enabled) {
		var syncing = !!on;
		var value = syncing ? 'syncing' : 'off';
		if (state.syncing !== syncing) {
			state.syncing = syncing;
			if (syncing) { alternateHeaders(); }
			else { resetHeaders(); }
			if (state.mode === 'passenger') {
				toggleController(!syncing);
			}
		}
		if (state.syncEnabled !== enabled && enabled !== undefined) {
			state.syncEnabled = enabled;
		}
		if (state.syncEnabled) {
			syncs.slider('enable');
		} else {
			syncs.slider('disable');
		}
		syncs.val(value).slider('refresh');
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

	function renderSlide(html) {
		var slide   = slideNode(html);
		var content = slide.find('[data-role=content]');
		var sync    = slide.find('.sync');
		var job     = $.Deferred();
		var assets  = slide.find('link[href]').remove();
		var alert   = slide.find('.alert');
		var steps   = slide.find('[data-step]');
		var headers = slide.find('[data-sync-theme]');
		var pstep   = content.data('page-step');
		var urls    = $.makeArray(assets.map(assetUrl));
		var done    = function(){ job.resolve(slide); };

		if (pstep) { steps.push(slide.attr('data-step', pstep).get(0)); }
		slide.attr('id', content.attr('id')+'-page')
			.data('steps', steps)
			.data('headers', headers)
			.data('alert', alert)
			.appendTo(body).page();

		if (sync.size()) { addSync(sync); }
		if (alert.size()) {
			alert.on('click', function(){
				alert.removeClass('active');
			});
		}

		if (urls.length) { loader({ load: urls, complete: done }); }
		else { done(); }

		return job.promise();
	}

	function slideError(xhr, error, ex) {
		var messages = {
			parsererror: 'Slide is mal-formed',
			error: 'Client Error (' + ex + ')',
			timeout: 'Request timed out',
			abort: 'Request aborted'
		};
		alert('Unable to load slide: ' + messages[error]);
	}

	function loadSlide(path) {
		var url = folder + '/' + path;
		var job = $.Deferred();
		$.get(url).then(function(html) {
			renderSlide(html).then(job.resolve);
		}).fail(slideError);
		return job.promise();
	}

	function getSlide(index) {
		var job = $.Deferred();
		var slide = state.slides[index];
		if (slide === undefined) {
			job.reject(index);
		} else if ($.type(slide) === 'string') {
			state.slides[index] =
				loadSlide(slide).then(job.resolve);
		} else if (slide.then) {
			slide.then(job.resolve);
		}
		return job.promise();
	}

	function elementVisible(el) {
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
			(top + height) <= (global.pageYOffset + global.innerHeight - 50) &&
			(left + width) <= (global.pageXOffset + global.innerWidth)
		);
	}

	function gotoStep(step, slide) {
		var last;
		slide.data('steps').each(function(){
			var element = $(this);
			var active = element.data('step') <= step;
			element.toggleClass('active', active);
			if (active) { last = element; }
		});
		if (last && !elementVisible(last.get(0))) {
			scrollTo(last.offset().top - 100);
		}
	}

	function options(slide, data) {
		return $.extend({
			dataUrl: data.toPage,
			transition: slide.data('transition') || 'slide'
		}, data.options || {});
	}

	function update(index, step, data) {
		var top = index !== state.slide;
		spinner('loading slide');
		state.slide = index;
		state.step = step;
		syncState();
		getSlide(index).then(function(slide){
			var opts = options(slide, data);
			if (top) { scrollTo(0, 0); }
			mobile.changePage(slide, opts);
			gotoStep(step, slide);
			trigger('update', {
				slide: slide,
				index: index,
				step: step
			});
		});
	}

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

	function unsigned(i) {
		return $.type(i) === 'number' && i >= 0;
	}

	function change(step, slide, options) {
		step = unsigned(step) ? step : 0;
		slide = unsigned(slide) ? slide : 0;
		mobile.changePage('#slide='+slide+'&step='+step, options);
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

	function onChange(event, data) {
		var location = data.toPage;
		if ($.type(location) === 'string') {
			var current = urlState(location);
			update(current.slide, current.step, data);
			event.preventDefault();
		}
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

	function syncState(newState) {
		if (state.syncing) {
			if (newState && state.mode === 'passenger') {
				var transition = newState.slide !== state.slide ? 'slide' : 'none';
				var reverse = newState.slide < state.slide;
				change(newState.step, newState.slide, {
					allowSamePageTransition: true,
					reverse: reverse,
					transition: transition
				});
			} else if (state.mode === 'driver') {
				socket.send('sync', 'state', {
					slide: state.slide,
					step: state.step
				});
			}
		}
	}

	function getChannel(name) {
		if (name === 'connection') {
			return socket.pusher.connection;
		} else if (name in socket.channels) {
			return socket.channels[name];
		} else {
			return socket.channels[name] = socket.pusher.subscribe(name);
		}
	}

	function socketSender(manifest) {
		return function(channel, event, data) {
			return $.ajax({
				url: manifest.server,
				type: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					channel: channel,
					event: event,
					data: data
				})
			});
		};
	}

	function socketListener(channelName, event, callback) {
		if (channelName) {
			var channel = getChannel(channelName);
			if (event && callback) {
				channel.bind(event, callback);
			}
			return channel;
		}
		return false;
	}

	function socketUnListener(channelName, event, callback) {
		if (channelName in socket.channels) {
			var channel = getChannel(channelName);
			if (event && callback) {
				channel.unbind(event, callback);
			}
			return channel;
		}
	}

	function passengerMode() {
		body.addClass(state.mode = 'passenger');
		body.removeClass('driver');
		socket.listen('sync', 'state', syncState);
		toggleController(!!state.manual);
	}

	function driverMode() {
		body.addClass(state.mode = 'driver');
		body.removeClass('passenger');
		socket.unlisten('sync', 'state', syncState);
		toggleController(true);
	}

	function alert(message) {
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

	function openSocket(manifest) {
		passengerMode();
		toggleSyncing(false, false);
		if (manifest.pusher) {
			var options = { encrypted: true };
			socket.pusher = new Pusher(manifest.pusher, options);
			socket.listen = socketListener;
			socket.unlisten = socketUnListener;
			socket.listen('connection', 'state_change', onConnectionChange);
			if (manifest.server) {
				$.getJSON(manifest.server).then(function(data){
					if (data.api_key === manifest.pusher) {
						socket.send = socketSender(manifest);
						Pusher.channel_auth_endpoint = manifest.server;
						driverMode();
					} else {
						passengerMode();
					}
				}).error(passengerMode);
			}
		}
	}

	function scrollTo(top, time) {
		var scrollTop = Math.max(top, 0);
		var duration = time !== undefined ? time : 500;
		html.animate({ scrollTop: scrollTop }, duration);
	}

	function cacheDomReferences() {
		body = $(dom.body);
		dom = $(dom).on('pagebeforechange', onChange);
		html = body.closest('html').andSelf();
	}

	function loadFirstSlide(html) {
		var current = urlState();
		template = html || '<div data-role="page">{{content}}</div>';
		change(current.step, current.slide, { transition: 'fade' });
	}

	function init(manifest) {
		state.slides = manifest.slides;
		state.count = manifest.slides.length;
		cacheDomReferences();
		openSocket(manifest);
		if (manifest.template) {
			$.get(folder+'/'+manifest.template).then(loadFirstSlide);
		} else {
			loadFirstSlide();
		}
	}

	function start(presentation) {
		folder = presentation;
		var manifest = $.getJSON(folder+'/manifest.json');
		var ready = $.Deferred().then(function(){
			spinner('loading presentation');
		});
		$(ready.resolve);
		$.when(manifest, ready).then(function(args){
			init(args[0]);
		});
	}

	// Expose the public API
	global.tacion = {
		spinner: spinner,
		start: start,
		change: change,
		alert: alert,
		next: next,
		prev: prev,
		off: off,
		on: on
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

