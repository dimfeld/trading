export default function (symbol: string): Promise<{
    ema10: number;
    ema21: number;
    ma50: number;
    ma200: number;
}>;
