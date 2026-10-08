export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED';

export interface OrderItemProps {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  menuItemId: string;
  notes: string | null;
}

export class Order {
  constructor(
    private _id: string,
    private _status: OrderStatus,
    private _sessionId: string,
    private _items: OrderItemProps[],
    private _acceptedAt: Date | null,
    private _readyAt: Date | null,
    private _servedAt: Date | null
  ) {}

  get id() { return this._id; }
  get status() { return this._status; }
  get sessionId() { return this._sessionId; }
  get items() { return this._items; }

  // State Machine for Order Status
  public markPreparing(): void {
    if (this._status !== 'RECEIVED') throw new Error("Order must be in RECEIVED state to start PREPARING");
    this._status = 'PREPARING';
    this._acceptedAt = new Date();
  }

  public markReady(): void {
    if (this._status !== 'PREPARING') throw new Error("Order must be in PREPARING state to mark READY");
    this._status = 'READY';
    this._readyAt = new Date();
  }

  public markServed(): void {
    if (this._status !== 'READY') throw new Error("Order must be in READY state to mark SERVED");
    this._status = 'SERVED';
    this._servedAt = new Date();
  }

  public calculateTotal(): number {
    return this._items.reduce((sum, item) => sum + item.lineTotal, 0);
  }

  public toJSON() {
    return {
      id: this._id,
      status: this._status,
      sessionId: this._sessionId,
      items: this._items,
      acceptedAt: this._acceptedAt,
      readyAt: this._readyAt,
      servedAt: this._servedAt
    };
  }
}
