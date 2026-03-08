declare module 'upng-js' {
    export interface DecodedPng {
        width: number;
        height: number;
        depth: number;
        ctype: number;
        frames: Array<Record<string, unknown>>;
        tabs: Record<string, unknown>;
    }

    const UPNG: {
        decode(buffer: ArrayBufferLike): DecodedPng;
        toRGBA8(image: DecodedPng): ArrayBufferLike[];
    };

    export default UPNG;
}
