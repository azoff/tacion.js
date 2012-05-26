(function(global, SocketApi, $){
    
    
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
    }
    
    global.tacion = {
        start: function(root) {
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