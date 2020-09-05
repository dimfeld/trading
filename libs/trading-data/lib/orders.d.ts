export interface GetPendingOrdersOptions {
    orderIds: string[] | Set<string>;
    after?: Date;
    progress?: (data: any) => any;
}
export declare function waitForOrders(options: GetPendingOrdersOptions): Promise<Map<any, any>>;
