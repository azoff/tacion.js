var url    = require('url');
var http   = require('http');
var Pusher = require('node-pusher');

var IP = '127.0.0.1';
var PORT = 1337;

var pusher;
var client_id  = process.argv[2];
var api_key    = process.argv[3];
var api_secret = process.argv[4];

if (!api_key || !api_secret) {
    console.error('Usage: driver.js [client_id] [api_key] [api_secret]');
    process.exit(1);
} else {
    pusher = new Pusher({
        appId: client_id,
        key: api_key,
        secret: api_secret
    });
}

function respond(response, status, data, headers) {        
    headers = headers || {};
    headers['Content-Type'] = 'application/json';
    response.writeHead(200, headers);
    if (data !== undefined) {
        data = JSON.stringify(data);
        headers['Content-Length'] = data.length;
        response.end(data);
    }
}

function cors(request, response) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Access-Control-Allow-Headers', 'origin, content-type, accept');
    response.setHeader('Access-Control-Max-Age', 7200);    
}


function getargs(request, callback) {
    var postdata = '', json;
    request.on('data', function(chunk) {
		postdata += chunk;
	});
	request.on('end', function(){
		try {
		    json = JSON.parse(postdata);
		} catch(e) {
		    json = {};
		}
		callback(json);
	});
}

function post(request, response) {
    getargs(request, function(args){
        if (args.channel && args.event && args.data) {
            pusher.trigger(
                args.channel, args.event, args.data, args.socket_id,
                function(error, sent, received) {                
                    if (error) {
                        respond(response, 500, { error: error });
                    } else {
                        respond(response, received.statusCode, args);
                    }
                }
            );
        } else {
            respond(response, 400, {
                error: 'Missing required arguments',
                required: ['channel', 'event', 'data']
            });
        }
    });
}

function handler(request, response) {
    cors(request, response);    
    if (request.method === 'POST') {
        post(request, response);
    } else {
        respond(response, 200, '');
    }
}

http.createServer(handler).listen(PORT, IP);

console.log('Running on ' + IP + ':' + PORT + '...')