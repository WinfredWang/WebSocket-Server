import * as http from 'http';

export enum OPCODE {
    CONTINUE = 0,
    TEXT = 1,
    BINARY = 2,
    CLOSE = 8,
    PING = 9,
    PONG = 10,
}

export interface IDataFrame {
    fin: number;
    opcode: OPCODE;
    mask: number;
    maskKey?: Buffer;
    payloadLen?: number;
    extendPayloadLen?: number;
    payload?: Buffer
}
export interface ICloseFrame {
    code: number;
    reason: string;
}
export interface IConfig {

    port?: number;
    httpServer?: http.Server;
}