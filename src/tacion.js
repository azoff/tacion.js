(function(global, dom, loader, SocketApi, mobile, $){
    
    var hidden = 'ui-hidden-accessible';
    var page, content, header, footer;
    var urlcache = {}, folder;
    var state = { };
    
    function spinner(msgText) {
        if (msgText) {
            mobile.showPageLoadingMsg('a', msgText, true);
        } else {
            mobile.hidePageLoadingMsg();
        }
    }
    
    function renderslide(html) {
        var job = $.Deferred();
        var slide = $(html);
        var title = slide.find('title').html();
        var article = slide.find('article');
        var assets = slide.find('link[href],script[src]').remove();
        var done = function(){ job.resolve(article); }
        var urls = $.makeArray(assets.map(function(){
            // don't process URLs we've already downloaded
            var asset = $(this);
            var url = asset.attr('src') || asset.attr('href');
            if (url in urlcache) { return; } 
            else { return folder + '/' + url; }
        }));   
        article.addClass(hidden);     
        article.appendTo(content).data('title', title);
        if (urls.length) {
            loader({ load: urls, complete: done() });
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
        var classNames = slide.prop('className') || '';
        var largestStep = 0, stepLength = step+1, i;
        // only remove steps that we don't need
        slide.prop('className', classNames.replace(/step-(\d+)/g, 
            function(className, stepName){    
                var currentStep = parseInt(stepName, 10);
                largestStep = currentStep > largestStep ? currentStep : largestStep;
                if (currentStep > step) { return ''; } 
                else { return className; }
            })
        );
        for (i=largestStep; i<stepLength; i++) {
            slide.addClass('step-' + i);
        }
    }
    
    function update(index, step, data) {
        spinner('loading slide');
        getslide(index).then(function(slide){                        
            if (state.slide !== index) {                
                slide.siblings().addClass(hidden);
                slide.removeClass(hidden);
                state.slide = index;
                header.html(slide.data('title'));
                footer.html((index+1) + ' of ' + state.count)
            }
            state.step = step;
            gotostep(step, slide);
            mobile.changePage(page.page(), data);           
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

    function change(step, slide) {        
        step = unsigned(step) ? step : (unsigned(state.step) ? state.step : 0);
        slide = unsigned(slide) ? slide : (unsigned(state.slide) ? state.slide : 0);
        mobile.changePage('#slide='+slide+'&step='+step);
    }

    function onchange(event, data) {    
        var location = data.toPage;
        if ($.type(location) === 'string') {            
            var current = urlstate(location);                  
            update(current.slide, current.step, data);
            event.preventDefault();
        }
    }
    
    function init(manifest) {
        var root = $(dom);        
        var current = urlstate();
        page = root.find('#page');
        content = page.find('#content');
        header = page.find('#header h1');
        footer = page.find('#footer h1');
        state.slides = manifest.slides;
        state.count = manifest.slides.length;
        root.on('pagebeforechange', onchange);
        change(current.step, current.slide);
        /*var socketApi = new SocketApi(manifest.apiKey);
        var channel = socketApi.subscribe(manifest.channel);
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
        spinner('loading presentation');
        folder = presentation;
        $.getJSON(folder+'/manifest.json').then(init);
    }
    
    // Expose the public API
    global.tacion = {
        start: start,
        change: change
    };
    
    
    
})(window, document, yepnope, Pusher, jQuery.mobile, jQuery);

// Enable pusher logging - don't include this in production
Pusher.log = function(message) {
  if (window.console && window.console.log) window.console.log(message);
};

// Flash fallback logging - don't include this in production
WEB_SOCKET_DEBUG = true;