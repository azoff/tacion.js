(function(global, dom, SocketApi, mobile, $){
    
    var root, content, folder;
    var state = {};
    
    function render(html, data) {
        return ;
    }
    
    function setSlide(data) {
        if (state.slide <= state.slides.length) {
            var path = state.slides[state.slide];
            var url = folder + '/' + path;
            $.get(url).then(function(html) {
                render(html, data);
            });
        }
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
        return i !== undefined && i > 0;
    }

    function change(step, slide) {        
        step = unsigned(step) ? step : state.step;
        slide = unsigned(slide) ? slide : state.slide;
        mobile.changePage('#slide='+slide+'step='+step);
    }

    function onchange(event, data) {
        var location = data.toPage;
        if ($.type(location) === 'string') {
            var current = urlstate(location);                  
            event.preventDefault();
            if (current.slide !== state.slide) {
                setSlide(current.slide, data);
            } else if (current.step !== state.step) {
                setStep(current.step, data);
            }
        }
    }
    
    function init(manifest) {
        var root = $(dom);        
        var current = urlstate();
        page = root.find('#page');
        content = page.find('#content');
        state.slides = manifest.slides;
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
    
    global.tacion = {
        start: function(presentation) {
            folder = presentation;
            $.getJSON(folder+'/manifest.json').then(init);
        }
    };
    
    
    
})(window, document, Pusher, jQuery.mobile, jQuery);

// Enable pusher logging - don't include this in production
Pusher.log = function(message) {
  if (window.console && window.console.log) window.console.log(message);
};

// Flash fallback logging - don't include this in production
WEB_SOCKET_DEBUG = true;