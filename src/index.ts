import * as net from 'net';
import * as http from 'http';
import { EventEmitter } from 'events';
import { IConfig, } from './typings'
import { Connection } from './connection';

export class WSServer extends EventEmitter {
    private server: net.Server;
    private config: IConfig;

    private _connections: Connection[] = [];

    constructor(config?: IConfig) {
        super();
        this.config = config ? config : {};
        !this.config.port && (this.config.port = 8124);
        this.start(this.config.httpServer);
    }

    private start(server: http.Server) {
        if (server) {
            server.on('upgrade', (req, socket) => {
                this.onConnection(socket, req);
            });
        } else {
            this.server = net.createServer(this.onConnection.bind(this));
            this.server.listen(this.config.port, () => {
                console.log(`WebSocket Server start, listening port: ${this.config.port}`);
            });
            this.server.on('error', this.onError.bind(this));
        }
    }

    onConnection(socket: net.Socket, req?: http.ServerRequest) {
        if (!this.getConnectionBySocket(socket)) {
            let conn = new Connection(socket, this._connections, req);
            conn.on('text', data => {
                this.emit('text', data, conn);
            })
        }
    }

    onError(err: Error) {
        console.log(err)
    }

    private getConnectionBySocket(socket: net.Socket) {
        return this._connections.find(s => s.getSocket() == socket);
    }

    public get connections() {
        return this._connections;
    }

    broadcast(text: string) {
        this.connections.forEach(con => {
            con.sendText(text);
        })
    }
}

