import { NodeStringDecoder } from "string_decoder";

export interface IDataFrame {
    fin: number;
    rsv1?: number;
    rsv2?: number;
    rsv3?: number;
    opcode: number;
    mask: number;
    payloadLen?: number;
    extendPayloadLen?: number;
    maskKey?: Buffer;
    payloadData?: Buffer;
}

export class DataFrame {

    static decode(data: Buffer): IDataFrame {
        // 解析第一个字节
        let fin = data[0] >> 7, opcode = data[0] & 0xF,
            mask = data[1] >> 7, payloadLen = data[1] & 0x7F;

        let dataFrame: IDataFrame = {
            fin: fin,
            opcode: opcode,
            mask: mask,
            payloadLen: payloadLen
        };

        let payloadData = null,
            maskKey = null,
            finalPayloadLen = null;

        // mask是1时，maskkey占用4个字节，否则没有
        let masklength;
        mask == 1 ? (masklength = 4) : (masklength = 0)

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
        if (mask == 1) {
            for (let i = 0, j = 0; i < payloadData.length; i++ , j++) {
                j == 4 && (j = 0);
                realData.push(payloadData[i] ^ maskKey[j]);
            }
            dataFrame.payloadData = Buffer.from(realData);
        } else {
            dataFrame.payloadData = payloadData;
        }
        return dataFrame;
    }

    static encodeText(content: string) {

        return this.encode({ fin: 1, opcode: 1, mask: 0, payloadData: Buffer.from(content, "utf-8") });
    }

    static close(reason: string) {
        return this.encode({ fin: 1, opcode: 8, mask: 0, payloadData: Buffer.from(reason, "utf-8") });
    }

    static encode(dataFrame: IDataFrame): Buffer {
        let byte = (dataFrame.fin << 7) | dataFrame.opcode;
        let fByte = byte.toString(16);
        let buffer;

        if (dataFrame.payloadData) {
            if (dataFrame.payloadData.length <= 125) {
                buffer = Buffer.from([fByte, dataFrame.payloadData.length.toString(16)]);
            } else if (dataFrame.payloadData.length <= 65535) {
                let payloadLen = parseInt("126").toString(16);
                let extendPayloadLen = dataFrame.payloadData.length.toString(16);
                buffer = Buffer.from([fByte, payloadLen, extendPayloadLen]);
            } else {
                let payloadLen = parseInt("127").toString(16);
                let extendPayloadLen = dataFrame.payloadData.length.toString(16); // 3位byte情况如何处理
                buffer = Buffer.from([fByte, payloadLen, extendPayloadLen]);
            }

            buffer = Buffer.concat([buffer, dataFrame.payloadData], buffer.length + dataFrame.payloadData.length);
        } else {
            buffer = Buffer.from(fByte);
        }

        return buffer;
    }
}