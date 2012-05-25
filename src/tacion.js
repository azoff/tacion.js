(function(global, Socket, $){
    
    var session = {};
    var presentation = { slide: 0, step: 0, slides: [] };
    
    function init(manifest) {
        presentation.slides = manifest.slides;
        session.socket = new Socket(manifest.socket);
        session.channel = session.socket.subscribe(manifest.channel);
        //session.channel.bind('', function(){});
    }
    
    global.tacion = {
        start: function(root) {
            presentation.root = root;
            $.getJSON(root+'/manifest.json').then(init);
        }
    };
    
})(window, Pusher, jQuery);

// Enable pusher logging - don't include this in production
Pusher.log = function(message) {
  if (window.console && window.console.log) window.console.log(message);
};

// Flash fallback logging - don't include this in production
WEB_SOCKET_DEBUG = true;