/*global yepnope, Pusher */
(function(global, dom, loader, Pusher, mobile, $){

	"use strict";

	var folder, body, template;
	var syncs = $();
	var urlCache = {};
	var state = {};
	var socket = {
		channels: [],
		send: $.noop,
		listen: $.noop
	};

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

	function setSyncs(manual) {
		syncs.val(manual?'manual':'automatic').slider('refresh');
	}

	function addSync(sync) {
		sync.each(function(){
			syncs.push(this);
		}).change(function(){
			var sync = $(this);
			var manual = sync.val() === 'manual';
			toggleController(manual);
		});
		setSyncs(state.manual);
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
		var steps   = slide.find('[data-step]');
		var pstep   = content.data('page-step');
		var urls    = $.makeArray(assets.map(assetUrl));
		var done    = function(){ job.resolve(slide); };
		slide.attr('id', content.attr('id')+'-page').data('steps', steps);
		if (pstep) { steps.push(slide.attr('data-step', pstep).get(0)); }
		slide.data('steps', steps).appendTo(body).page();
		if (sync.size()) { addSync(sync); }
		if (urls.length) { loader({ load: urls, complete: done }); }
		else { done(); }
		return job.promise();
	}

	function loadSlide(path) {
		var url = folder + '/' + path;
		var job = $.Deferred();
		$.get(url).then(function(html) {
			renderSlide(html).then(job.resolve);
		});
		return job.promise();
	}

	function getSlide(index) {
		var job = $.Deferred();
		var slide = state.slides[index];
		if ($.type(slide) === 'string') {
			state.slides[index] =
				loadSlide(slide).then(job.resolve);
		} else {
			slide.then(job.resolve);
		}
		return job.promise();
	}

	function gotoStep(step, slide) {
		slide.data('steps').each(function(){
			var element = $(this);
			var active = element.data('step') <= step;
			element.toggleClass('active', active);
		});
	}

	function options(slide, data) {
		return $.extend({
			dataUrl: data.toPage,
			changeHash: true,
			transition: slide.data('transition') || 'slide'
		}, data.options || {});
	}

	function update(index, step, data) {
		spinner('loading slide');
		state.slide = index;
		state.step = step;
		syncState();
		getSlide(index).then(function(slide){
			var opts = options(slide, data);
			gotoStep(step, slide);
			mobile.changePage(slide, opts);
			spinner(false);
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
		getSlide(index).then(function(slide){
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

	function toggleController(manual) {
		setSyncs(state.manual = !!manual);
		var method = manual ? 'on' : 'off';
		dom[method]('swipeleft swiperight keyup', controller);
	}

	function syncState(newState) {
		if (newState) {
			if (!state.manual) {
				change(newState.slide, newState.step, {
					allowSamePageTransition: true,
					reverse: newState.slide < state.slide,
					transition: newState.slide !== state.slide
				});
			}
		} else {
			socket.send('sync', 'state', {
				slide: state.slide,
				step: state.step
			});
		}
	}

	function socketSender(manifest) {
		return function(channel, event, data) {
			return $.ajax({
				url: manifest.driverUrl,
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

	function socketListener() {
		return function(channel, event, callback) {
			if (!socket.channels.hasOwnProperty(channel)) {
				socket.channels[channel] = socket.pusher.subscribe(channel);
			}
			if (event && callback) {
				socket.channels[channel].bind(event, callback);
			} else {
				return socket.channels[channel];
			}
		};
	}

	function passengerMode() {
		toggleController(false);
		body.addClass(global.tacion.mode = 'passenger');
		socket.listen('sync', 'state', syncState);
	}

	function driverMode() {
		toggleController(true);
		body.addClass(global.tacion.mode = 'driver');
	}

	function openSocket(manifest) {
		if (manifest.pusherApiKey) {
			//var options = { encrypted: true };
			socket.pusher = new Pusher(manifest.pusherApiKey);
			socket.listen = socketListener();
			if (manifest.driverUrl) {
				$.getJSON(manifest.driverUrl).then(function(data){
					if (data.api_key === manifest.pusherApiKey) {
						socket.send = socketSender(manifest);
						Pusher.channel_auth_endpoint = manifest.driverUrl;
						driverMode();
					} else {
						passengerMode();
					}
				}).error(passengerMode);
			} else {
				passengerMode();
			}
		} else {
			driverMode();
		}
	}

	function init(manifest) {
		var done = function(html) {
			var current = urlState();
			template = html || '<div data-role="page">{{content}}</div>';
			change(current.step, current.slide, { transition: 'fade' });
		};
		body = $(dom.body);
		state.slides = manifest.slides;
		state.count = manifest.slides.length;
		dom = $(dom).on('pagebeforechange', onChange);
		openSocket(manifest);
		if (manifest.template) {
			$.get(folder+'/'+manifest.template).then(done);
		} else {
			done();
		}
	}

	function start(presentation) {
		folder = presentation;
		var spin = function(){ spinner('loading presentation'); };
		var manifest = $.getJSON(folder+'/manifest.json');
		var ready = $.Deferred().then(spin);
		$(ready.resolve);
		$.when(manifest, ready).then(function(args){
			init(args[0]);
		});
	}

	// Expose the public API
	global.tacion = {
		start: start,
		change: change,
		next: next,
		prev: prev,
		listen: socket.listen,
		send: socket.send
	};



})(window, document, yepnope, Pusher, jQuery.mobile, jQuery);