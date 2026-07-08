declare module 'qrcode' {
    interface QRCodeToBufferOptions {
        scale?: number
        [key: string]: unknown
    }

    const QRCode: {
        toBuffer(text: string, options?: QRCodeToBufferOptions): Promise<Buffer>
        toFile(path: string, text: string, options?: QRCodeToBufferOptions): Promise<void>
    }

    export default QRCode
}

