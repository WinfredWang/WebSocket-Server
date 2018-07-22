var ws = require('../../dist');

let server = new ws.WSServer();
server.on('text', (data, connection) => {
    if (!connection.nickname) {
        connection.nickname = data;
        server.broadcast(data + " entered");
    } else {
        server.broadcast("[" + connection.nickname + "] " + data);
    }
})