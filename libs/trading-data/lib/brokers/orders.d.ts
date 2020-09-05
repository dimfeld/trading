import { GetTrades } from './broker_interface';
export interface WaitForOrdersOptions {
    orderIds: string[] | Set<string>;
    after?: Date;
    progress?: (data: any) => any;
}
export declare function waitForOrders(api: GetTrades, options: WaitForOrdersOptions): Promise<Map<any, any>>;
