(function(global, dom, loader, Pusher, mobile, $){
    
    var events = 'swipeleft swiperight keyup';
    var urlcache = {}, folder, body;
    var state = { };
    
    function spinner(msgText) {
        if (msgText) {
            mobile.showPageLoadingMsg('a', msgText, true);
        } else {
            mobile.hidePageLoadingMsg();
        }
    }
    
    function renderslide(html) {
        var slide  = $(html);        
        var job    = $.Deferred();
        var assets = slide.find('link[href],script[src]').remove();
        var done = function(){ job.resolve(slide); };
        var urls = $.makeArray(assets.map(function(){
            // don't process URLs we've already downloaded
            var asset = $(this);
            var url = asset.attr('src') || asset.attr('href');
            if (url in urlcache) { return; } 
            else { return folder + '/' + url; }
        }));
        slide.data('steps', slide.find('[data-step]'))
            .appendTo(body).page()
            .find('.footer h1')
            .text([state.slide+1, state.count].join(' of '));
        if (urls.length) {
            loader({ load: urls, complete: done });
        } else {
            done();
        }
        return job.promise();
    }
    
    function loadslide(path) {
        var url = folder + '/' + path;
        var job = $.Deferred();
        $.get(url).then(function(html) {
             renderslide(html).then(job.resolve);
        });
        return job.promise();
    }
    
    function getslide(index) {
        var job = $.Deferred();
        var slide = state.slides[index];        
        if ($.type(slide) === 'string') {
            state.slides[index] = 
                loadslide(slide).then(job.resolve);
        } else {
            slide.then(job.resolve);
        }
        return job.promise();
    }
    
    function gotostep(step, slide) {
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
        getslide(index).then(function(slide){
            var opts = options(slide, data);
            gotostep(step, slide);
            mobile.changePage(slide, opts);           
            spinner(false); 
        });
    }

    function urlstate(href) {
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
        return $.type(i) === 'number' && i > 0;
    }

    function change(step, slide, options) {        
        step = unsigned(step) ? step : 0;
        slide = unsigned(slide) ? slide : 0;
        mobile.changePage('#slide='+slide+'&step='+step, options);
    }

    function next() {
        var index = state.slide;
        var step = state.step;
        getslide(index).then(function(slide){
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
        getslide(index).then(function(slide){
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

    function onchange(event, data) { 
        var location = data.toPage;
        if ($.type(location) === 'string') {   
            var current = urlstate(location);                              
            update(current.slide, current.step, data);
            event.preventDefault();
        }
    }
    
    function controller(event) {
        if (event.type === 'swipeleft') {
            return next();
        } else if (event.type === 'swiperight') {
            return prev();
        } else {
            switch(event.which) {
                case 37: // left
                case 38: // up
                    return prev();
                case 39: // right
                case 40: // down
                case 32: // space
                case 13: // enter
                    return next();
            }
        }
    }
    
    function toggleController(on) {
        var method = on ? 'on' : 'off';
        dom[method](events, controller);
    }
    
    function init(manifest) {
        var current = urlstate();
        state.slides = manifest.slides;
        state.count = manifest.slides.length;
        dom = $(dom).on('pagebeforechange', onchange);
        body = $(dom.get(0).body);
        toggleController(true);
        change(current.step, current.slide, {
            transition: 'fade'
        });
        /*var pusher = new Pusher(manifest.pusherApiKey);
        var channel = pusher.subscribe(manifest.syncChannel);
        channel.bind('test', function(){
            console.log(arguments);
        });
        setTimeout(function(){
            
            $.ajax({
                url: 'http://127.0.0.1:1337',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    channel: manifest.channel,
                    event: 'test',
                    data: 'hello world!'
                })
            });
            
        }, 2000)*/
    }
    
    function start(presentation) {
        folder = presentation;
        var spin = function(){ spinner('loading presentation'); };
        var manifest = $.getJSON(folder+'/manifest.json');
        var ready = $.Deferred().then(spin);
        $.when(manifest, ready).then(function(args){
            init(args[0]);
        });
        $(ready.resolve);
    }
    
    // Expose the public API
    global.tacion = {
        start: start,
        change: change,
        next: next,
        prev: prev
    };
    
    
    
})(window, document, yepnope, Pusher, jQuery.mobile, jQuery);