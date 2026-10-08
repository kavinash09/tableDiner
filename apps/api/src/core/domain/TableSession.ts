import { BaseEntity } from './BaseEntity';
import { Order } from './Order';

export type SessionStatus = 'OPEN' | 'CLOSED' | 'REOPENED' | 'FINALIZED';

export class TableSession extends BaseEntity {
  constructor(
    id: string,
    createdAt: Date,
    updatedAt: Date,
    private _status: SessionStatus,
    private _restaurantId: string,
    private _tableId: string,
    private _orders: Order[],
    private _guestCount: number,
    private _subtotal: number | null,
    private _taxAmount: number | null,
    private _discountAmount: number | null,
    private _tipAmount: number | null,
    private _totalAmount: number | null,
    private _closedAt: Date | null
  ) {
    super(id, createdAt, updatedAt);
  }

  get status() { return this._status; }
  get restaurantId() { return this._restaurantId; }
  get tableId() { return this._tableId; }
  get orders() { return this._orders; }
  get guestCount() { return this._guestCount; }

  public addOrder(order: Order): void {
    if (this._status !== 'OPEN') throw new Error("Cannot add order to a closed session.");
    this._orders.push(order);
    this._updatedAt = new Date();
  }

  public calculateRunningSubtotal(): number {
    return this._orders
      // Only sum items from orders that haven't been cancelled/rejected
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
      .reduce((sum, order) => sum + order.calculateTotal(), 0);
  }

  public closeSession(
    taxAmount: number = 0,
    tipAmount: number = 0,
    discountAmount: number = 0,
    paymentAmount: number
  ): void {
    if (this._status === 'CLOSED') throw new Error("Session is already closed.");
    
    const subtotal = this.calculateRunningSubtotal();
    const expectedTotal = subtotal + taxAmount + tipAmount - discountAmount;
    
    if (paymentAmount < expectedTotal) {
      throw new Error(`Insufficient payment amount. Expected ${expectedTotal}, got ${paymentAmount}.`);
    }

    this._status = 'CLOSED';
    this._subtotal = subtotal;
    this._taxAmount = taxAmount;
    this._tipAmount = tipAmount;
    this._discountAmount = discountAmount;
    this._totalAmount = expectedTotal;
    this._closedAt = new Date();
    this._updatedAt = new Date();
  }

  public toJSON() {
    return {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      status: this._status,
      restaurantId: this._restaurantId,
      tableId: this._tableId,
      guestCount: this._guestCount,
      orders: this._orders.map(o => o.toJSON()),
      subtotal: this._subtotal,
      taxAmount: this._taxAmount,
      discountAmount: this._discountAmount,
      tipAmount: this._tipAmount,
      totalAmount: this._totalAmount,
      closedAt: this._closedAt
    };
  }
}
