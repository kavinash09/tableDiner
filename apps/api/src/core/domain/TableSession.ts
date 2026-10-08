import { Order } from './Order';

export type SessionStatus = 'ACTIVE' | 'CLOSED';

export class TableSession {
  constructor(
    private _id: string,
    private _status: SessionStatus,
    private _restaurantId: string,
    private _tableId: string,
    private _orders: Order[],
    private _totalAmount: number | null,
    private _closedAt: Date | null
  ) {}

  get id() { return this._id; }
  get status() { return this._status; }
  get restaurantId() { return this._restaurantId; }
  get tableId() { return this._tableId; }
  get orders() { return this._orders; }

  public addOrder(order: Order): void {
    if (this._status !== 'ACTIVE') throw new Error("Cannot add order to a closed session.");
    this._orders.push(order);
  }

  public calculateRunningTotal(): number {
    return this._orders.reduce((sum, order) => sum + order.calculateTotal(), 0);
  }

  public closeSession(paymentAmount: number): void {
    if (this._status === 'CLOSED') throw new Error("Session is already closed.");
    
    const expectedTotal = this.calculateRunningTotal();
    
    // In a real app we might allow partial payments, but for MVP strict check:
    if (paymentAmount < expectedTotal) {
      throw new Error(`Insufficient payment amount. Expected ${expectedTotal}, got ${paymentAmount}.`);
    }

    this._status = 'CLOSED';
    this._totalAmount = expectedTotal;
    this._closedAt = new Date();
  }

  public toJSON() {
    return {
      id: this._id,
      status: this._status,
      restaurantId: this._restaurantId,
      tableId: this._tableId,
      orders: this._orders.map(o => o.toJSON()),
      totalAmount: this._totalAmount,
      closedAt: this._closedAt
    };
  }
}
