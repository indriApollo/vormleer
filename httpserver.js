var http = require('http');
var fs = require('fs');
var zlib = require('zlib');

const PORT = 8080;

var pages = [];

function cache(filename, callback) {
    
    var chunks = [];
    var rstream = fs.createReadStream(filename).on('open', function() {
        rstream.pipe(zlib.createGzip()).on('data', function(chunk) {
            chunks.push(chunk);
        }).on('end', function() {
            console.log('done caching '+filename);
            callback(Buffer.concat(chunks), filename);
        });
    });
}
var filenames = ['index.html', 'editor.html'];
var jobs = filenames.length;
for(var i = 0; i < jobs ; i++) {
    cache(filenames[i], function(r,f) {
        var l = f.split('.')[0];
        pages[l] = r;
        --jobs;
        if(jobs === 0) server();
    });
}

function server() {
    http.createServer(function(request, response) {

        var headers = request.headers;
        var method = request.method;
        var url = request.url;
        var body = [];

        response.on('error', function(err) {
            console.error(err);
        });

        request.on('error', function(err) {
            console.error(err);
            response.statusCode = 400;
            response.end();

        }).on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            body = Buffer.concat(body).toString();

            var data = "";

            if(method === 'GET') {
                console.log("url: "+url);
                response.setHeader('Content-Type', 'text/html; charset=utf8');
                response.setHeader('Content-Encoding', 'gzip');

                if(url == '/' || url == '/index.html') {
                    data = pages['index'];
                }
                else if(url == '/editor') {
                    data = pages['editor'];
                }
                else {    
                    response.statusCode = 404;
                }
            } else {
                response.statusCode = 400;
            }

            response.setHeader('Content-Length',Buffer.byteLength(data, 'utf8'));
            response.write(data);
            response.end();
        });
    }).listen(PORT);
    console.log("server listening on "+PORT);
}
