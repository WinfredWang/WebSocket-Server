import { IDataFrame, OPCODE, ICloseFrame } from './typings';

/**
 * 将整数转化成占n个的buffer
 * @param n 
 * @param bufSize 
 */
function int2Buf(n: number, bufSize: number) {
    let hex = parseInt(n + "").toString(16);
    const buf = Buffer.allocUnsafe(bufSize);
    buf.writeUIntBE(parseInt(hex, 16), 0, bufSize);
    return buf;
}

export class Frame {
    static parseHeader(data: Buffer): IDataFrame {
        // 解析第一个字节
        let fin = data[0] >> 7, opcode = data[0] & 0xF,
            mask = data[1] >> 7, payloadLen = data[1] & 0x7F;

        return {
            fin: fin,
            opcode: opcode,
            mask: mask,
            payloadLen: payloadLen
        };
    }

    static parse(data: Buffer): IDataFrame {
        let dataFrame = this.parseHeader(data);
        let payloadData = null,
            maskKey = null,
            finalPayloadLen = null;

        // mask是1时，maskkey占用4个字节，否则没有
        let masklength, payloadLen = dataFrame.payloadLen;
        dataFrame.mask == 1 ? (masklength = 4) : (masklength = 0)

        if (payloadLen <= 125) {
            payloadData = data.slice(masklength + 2);
            maskKey = data.slice(2, 6);
            finalPayloadLen = payloadLen;
        } else if (payloadLen == 126) {
            payloadData = data.slice(masklength + 2 + 2);
            maskKey = data.slice(2 + 2, 8);
            finalPayloadLen = data.slice(2, 4);
        } else { // 127
            payloadData = data.slice(masklength + 2 + 8);
            maskKey = data.slice(2 + 8, 14);
            finalPayloadLen = data.slice(2, 10);
        }

        let realData = [];
        if (dataFrame.mask == 1) {
            for (let i = 0, j = 0; i < payloadData.length; i++ , j++) {
                j == 4 && (j = 0);
                realData.push(payloadData[i] ^ maskKey[j]);
            }
            dataFrame.payload = Buffer.from(realData);
        } else {
            dataFrame.payload = payloadData;
        }
        return dataFrame;
    }

    static binary(content: Buffer) {
        return this.create({ fin: 1, opcode: OPCODE.BINARY, mask: 0, payload: content });
    }

    static text(content: string) {
        return this.create({ fin: 1, opcode: OPCODE.TEXT, mask: 0, payload: Buffer.from(content) });
    }

    static ping(): Buffer {
        return this.create({ fin: 1, opcode: OPCODE.PING, mask: 0 });
    }

    static pong(): Buffer {
        return this.create({ fin: 1, opcode: OPCODE.PONG, mask: 0 });
    }

    static close(frame: ICloseFrame): Buffer {
        let reason = Buffer.from(frame.reason);
        const codeBuf = int2Buf(frame.code, 2);
        return this.create({ fin: 1, opcode: OPCODE.CLOSE, mask: 0, payload: Buffer.concat([codeBuf, reason], reason.length + codeBuf.length) });
    }

    static create(dataFrame: IDataFrame): Buffer {
        let byte = (dataFrame.fin << 7) | dataFrame.opcode;
        let buf: Buffer;

        if (dataFrame.payload) {
            let headerBuf;
            let payloadLen = dataFrame.payload.length;
            if (payloadLen <= 125) {
                headerBuf = Buffer.from([byte, payloadLen]);
            } else if (payloadLen <= 65535) { // 16bit
                headerBuf = Buffer.from([byte, 126]);
                let extendPayloadLen = int2Buf(payloadLen, 2);
                headerBuf = Buffer.concat([headerBuf, extendPayloadLen], extendPayloadLen.length + headerBuf.length);
            } else { // 64bit
                headerBuf = Buffer.from([byte, 127]);
                let extendPayloadLen = int2Buf(payloadLen, 8);
                headerBuf = Buffer.concat([headerBuf, extendPayloadLen], extendPayloadLen.length + headerBuf.length);
            }
            buf = Buffer.concat([headerBuf, dataFrame.payload], payloadLen + headerBuf.length);
        } else {
            buf = Buffer.from([byte]);
        }

        return buf;
    }
}