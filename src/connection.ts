import * as net from 'net';
import * as crypto from 'crypto';
import { Frame } from './frame';
import { OPCODE, ICloseFrame } from './typings';
import { EventEmitter } from 'events';



export class Connection extends EventEmitter {

    static CONNECTING = 0;
    static CONECTED = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    private socket: net.Socket;
    private bufferList: Buffer[] = [];
    private connCache: Connection[];
    private state: number;

    constructor(socket: net.Socket, connections: Connection[]) {
        super();
        this.socket = socket;
        this.connCache = connections;
        this.state = Connection.CONNECTING;
        this.socket.once('data', data => {
            if (this.handshake(data)) {
                this.state = Connection.CONECTED;
                this.connCache.push(this);
                this.socket.on('data', this.onData.bind(this));
                this.socket.on('error', this.onError.bind(this));
                this.socket.on('end', this.onEnd.bind(this));
                this.socket.on('close', this.onCLose.bind(this));
            }
        });
    }

    private handshake(data: Buffer) {
        let lines = data.toString().split('\r\n');
        lines = lines.slice(1, lines.length - 2);

        let headers = {};
        lines.forEach(line => {
            let [key, val] = line.split(': ');
            headers[key.toLowerCase()] = val;
        });

        if (headers['upgrade'] == 'websocket' && headers['connection'] == 'Upgrade'
            && headers['sec-websocket-version'] == '13') {
            let key = this.sha1(headers['sec-websocket-key'] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");

            let response = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                'Sec-WebSocket-Accept: ' + key,
                '\r\n'
            ]
            this.socket.write(response.join('\r\n'));
            return true;
        } else {
            console.log('http request header not support.');
            this.socket.end(Frame.close({ code: 1001, reason: "request header not support." }));
            return false;
        }
    }

    private onData(data: Buffer) {
        let dataFrame = Frame.parse(data);
        if (dataFrame.opcode == OPCODE.TEXT) {
            this.bufferList.push(dataFrame.payload);
            if (dataFrame.fin == 1) {
                this.emit('text', this.bufferList.toString());
                this.bufferList = [];
            }
        } else if (dataFrame.opcode == OPCODE.BINARY) {
            this.bufferList.push(dataFrame.payload);
            if (dataFrame.fin == 1) {
                this.emit('binary', this.bufferList);
                this.bufferList = [];
            }
        } else if (dataFrame.opcode == OPCODE.PING) {
            this.socket.write(Frame.pong());
        } else if (dataFrame.opcode == OPCODE.PONG) {
            this.socket.write(Frame.ping())
        } else if (dataFrame.opcode == OPCODE.CLOSE) {
            this.state = Connection.CLOSING;
            this.socket.end(Frame.close({ code: 1002, reason: "client terminated connection" }));
        }
    }

    private onError(err: Error) {
        console.log('error');
        !this.destroyed() && this.socket.end(Frame.close({ code: 1001, reason: "client gone." }));
        this.removeConnFramCahce();
    }

    private onEnd() {
        console.log('end');
        this.removeConnFramCahce();
    }

    private onCLose() {
        console.log('close');
        this.removeConnFramCahce();
    }

    getSocket() {
        return this.socket;
    }

    sendText(text: string) {
        this.socket.write(Frame.text(text));
    }

    close(frame: ICloseFrame) {
        this.socket.end(Frame.close(frame));
    }

    sendBinary() {
        // TODO
    }

    private sha1(content: string) {
        return crypto.createHash('sha1').update(content).digest('base64')
    }

    private removeConnFramCahce() {
        let index = this.connCache.indexOf(this);
        if (index > -1) {
            this.connCache.splice(index, 1);
            this.socket.destroy();
        }
    }

    private destroyed() {
        return this.socket.destroyed;
    }
}
