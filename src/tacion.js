(function(global, dom, SocketApi, mobile, $){

    var state = { 
        pages: {} 
    };

    function urlstate(href) {
        var url = href ? mobile.path.parseUrl(href) : global.location;
        var hash = url.hash.split('#').pop();
        var pairs = hash.split('&');
        var args = { page: 0, step: 0 };
        $.each(pairs, function(i, pair){
            pair = pair.split('=');
            args[pair[0]] = parseInt(pair[1], 10);
        });
        return args;
    }

    function unsigned(i) {
        return i !== undefined && i > 0;
    };

    function change(step, page) {
        page = unsigned(page) ? page : state.page;
        step = unsigned(step) ? step : state.step;
        mobile.changePage('#page='+page+'step='+step);
    }

    function onchange(event, data) {
        var location = data.toPage;
        if ($.type(location) === 'string') {
            var current = urlstate(location);
            state.page = current.page;
            state.step = current.step;
            console.log(state);
            /*data.options.dataUrl = (url.hrefNoHash || '/') + selector;                
            mobile.changePage(page.page(), data.options);*/
            event.preventDefault();
        }
    }
    
    function init(manifest) {
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
        var current = urlstate();
        state.slides = manifest.slides;
        $(dom).on('pagebeforechange', onchange);
        change(current.page, current.step);
    }
    
    global.tacion = {
        start: function(root) {
            $.getJSON(root+'/manifest.json').then(init);
        }
    };
    
    
    
})(window, document, Pusher, jQuery.mobile, jQuery);

// Enable pusher logging - don't include this in production
Pusher.log = function(message) {
  if (window.console && window.console.log) window.console.log(message);
};

// Flash fallback logging - don't include this in production
WEB_SOCKET_DEBUG = true;