import * as net from 'net';
import * as crypto from 'crypto';
import { DataFrame } from './data-frames';
import { IDataFrame, OPCODE, IConfig } from './typings'

const port = 8124;

const SocketCache: net.Socket[] = [];

export class WSServer {
    private server: net.Server;
    private config: IConfig;
    private queue: Function[] = [];

    constructor(config?: IConfig) {
        this.config = config ? config : {};
        !this.config.port && (this.config.port = 8124);
        this.start();
    }

    private start() {
        this.server = net.createServer(socket => {
            socket.once('data', (data) => {
                if (!this.handshake(socket, data)) {
                    return;
                }
                socket.on('data', data => {
                    this.listen(socket, data);
                });
                socket.on('error', function (err) {
                    console.log(err);
                    SocketCache.splice(SocketCache.indexOf(socket), 1);
                });
            });
        });
        this.server.listen(this.config.port, () => {
            console.log(`WebSocket Server start, listening port: ${this.config.port}`);
        });
        this.server.on('error', function (err) {
            console.log(err)
        })
    }

    private listen(socket: net.Socket, data: Buffer) {
        let dataFrame = DataFrame.decode(data);

        switch (dataFrame.opcode) {
            case OPCODE.CLOSE:
                SocketCache.splice(SocketCache.indexOf(socket), 1);
                socket.write(DataFrame.close({ code: 1000, reason: "client closed" }));
                break;
            case OPCODE.TEXT:
                let text = dataFrame.payload ? dataFrame.payload.toString() : "";
                this.queue.forEach(cb => {
                    cb && cb(text);
                });
                break;
            case OPCODE.PING:
                socket.write(DataFrame.pong());
                break;
            default:
        }
    }

    handshake(socket: net.Socket, data: Buffer): boolean {
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

            let response = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                'Sec-WebSocket-Accept: ' + key,
                '\r\n'
            ]
            socket.write(response.join('\r\n'));
            SocketCache.push(socket);
            return true;
        } else {
            console.log('http request header not support.');
            socket.write(DataFrame.close({ code: 1001, reason: "request header not support." }));
            return false;
        }
    }

    on(cb: Function) {
        cb && this.queue.push(cb);
    }

    emit(text: string) {
        let frame = DataFrame.encodeText(text);
        SocketCache.forEach(s => s.write(frame));
    }
}

function sha1(content: string) {
    return crypto.createHash('sha1').update(content).digest('base64')
}

let ws = new WSServer();

ws.on(function (data) {
    console.log(data);
})

setInterval(function () {
    ws.emit("test");
}, 2000)
