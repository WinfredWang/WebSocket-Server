const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
var ws = require('../../dist');

let httpServer = http.createServer(function (req, res) {
    let pathname = url.parse(req.url).pathname;
    pathname == "/" && (pathname = "/index.html")
    let suffix = path.extname(pathname);

    if (req.method == "GET" && suffix) {
        let filePath = path.join(__dirname, 'static', pathname);
        fs.stat(filePath, function (err) {
            if (err) {
                res.statusCode = 404;
                res.end();
            } else {
                fs.createReadStream(filePath).pipe(res);
            }
        })
    } else {
        res.end('Hello World!')
    }
});
httpServer.listen(3000);

let server = new ws.WSServer({ httpServer: httpServer });
server.on('text', (data, connection) => {
    if (!connection.nickname) {
        connection.nickname = data;
        server.broadcast(data + " entered");
    } else {
        server.broadcast("[" + connection.nickname + "] " + data);
    }
})