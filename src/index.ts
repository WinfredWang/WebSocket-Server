import * as net from 'net';
import * as crypto from 'crypto';
import { DataFrame } from './data-frames';

const port = 8124;

const SocketCache: net.Socket[] = [];

const server = net.createServer(socket => {
    socket.once('data', (data) => {
        try {
            socket.write(handshake(data));
            SocketCache.push(socket);
        } catch (e) {
            console.log(e);
            return;
        }
        socket.on('data', (data) => {
            let dataFrame = DataFrame.decode(data);
            console.log(`Accept data:${JSON.stringify(dataFrame)}`);
            if (dataFrame.opcode == 8) {
                SocketCache.splice(SocketCache.indexOf(socket), 1);
                socket.end();
                return;
            } else {
                socket.write(DataFrame.encodeText("xxxxx = "));
            }
        });
    });
});

function broadcast(content: string) {
    SocketCache.forEach(socket => {
        socket.write(DataFrame.encodeText(content));
    });
}

server.listen(port, () => {
    console.log(`WebSocket Server start, listening port: ${port}`);
});

function handshake(data: Buffer) {
    let lines = data.toString().split('\r\n');
    lines = lines.slice(1, lines.length - 2);

    let headers = {};
    lines.forEach(line => {
        let [key, val] = line.split(': ');
        headers[key.toLowerCase()] = val;
    });

    if (headers['upgrade'] == 'websocket' && headers['connection'] == 'Upgrade'
        && headers['sec-websocket-version'] == '13') {
        let key = sha1(headers['sec-websocket-key'] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
        return `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`;
    }
    throw new Error('Protocol not support.');
}

function sha1(content: string) {
    return crypto.createHash('sha1').update(content).digest('base64')
}