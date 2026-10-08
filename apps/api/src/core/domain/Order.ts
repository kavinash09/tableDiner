import { BaseEntity } from './BaseEntity';

export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | 'REJECTED';

export interface OrderItemProps {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  menuItemId: string;
  notes: string | null;
}

export class Order extends BaseEntity {
  constructor(
    id: string,
    createdAt: Date,
    updatedAt: Date,
    private _status: OrderStatus,
    private _sessionId: string,
    private _items: OrderItemProps[],
    private _acceptedAt: Date | null,
    private _readyAt: Date | null,
    private _servedAt: Date | null,
    private _cancelledAt: Date | null = null,
    private _cancellationReason: string | null = null
  ) {
    super(id, createdAt, updatedAt);
  }

  get status() { return this._status; }
  get sessionId() { return this._sessionId; }
  get items() { return this._items; }
  get cancelledAt() { return this._cancelledAt; }
  get cancellationReason() { return this._cancellationReason; }

  // State Machine for Order Status
  public markPreparing(): void {
    if (this._status !== 'RECEIVED') throw new Error("Order must be in RECEIVED state to start PREPARING");
    this._status = 'PREPARING';
    this._acceptedAt = new Date();
    this._updatedAt = new Date();
  }

  public markReady(): void {
    if (this._status !== 'PREPARING') throw new Error("Order must be in PREPARING state to mark READY");
    this._status = 'READY';
    this._readyAt = new Date();
    this._updatedAt = new Date();
  }

  public markServed(): void {
    if (this._status !== 'READY') throw new Error("Order must be in READY state to mark SERVED");
    this._status = 'SERVED';
    this._servedAt = new Date();
    this._updatedAt = new Date();
  }

  public cancel(reason: string): void {
    if (this._status === 'SERVED') throw new Error("Cannot cancel an order that has already been served.");
    if (this._status === 'CANCELLED' || this._status === 'REJECTED') throw new Error("Order is already cancelled or rejected.");
    
    this._status = 'CANCELLED';
    this._cancelledAt = new Date();
    this._cancellationReason = reason;
    this._updatedAt = new Date();
  }

  public calculateTotal(): number {
    return this._items.reduce((sum, item) => sum + item.lineTotal, 0);
  }

  public toJSON() {
    return {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      status: this._status,
      sessionId: this._sessionId,
      items: this._items,
      acceptedAt: this._acceptedAt,
      readyAt: this._readyAt,
      servedAt: this._servedAt,
      cancelledAt: this._cancelledAt,
      cancellationReason: this._cancellationReason
    };
  }
}
