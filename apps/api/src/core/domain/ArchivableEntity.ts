import { BaseEntity } from './BaseEntity';

export abstract class ArchivableEntity extends BaseEntity {
  protected _isActive: boolean;
  protected _deletedAt: Date | null;

  constructor(
    id: string,
    createdAt: Date,
    updatedAt: Date,
    isActive: boolean = true,
    deletedAt: Date | null = null
  ) {
    super(id, createdAt, updatedAt);
    this._isActive = isActive;
    this._deletedAt = deletedAt;
  }

  get isActive(): boolean { return this._isActive; }
  get deletedAt(): Date | null { return this._deletedAt; }

  /**
   * Domain logic to safely soft-delete an entity.
   */
  public softDelete(): void {
    if (!this._isActive) throw new Error("Entity is already deleted.");
    this._isActive = false;
    this._deletedAt = new Date();
    this._updatedAt = new Date(); // Update the audit timestamp
  }

  /**
   * Domain logic to restore a soft-deleted entity.
   */
  public restore(): void {
    if (this._isActive) throw new Error("Entity is already active.");
    this._isActive = true;
    this._deletedAt = null;
    this._updatedAt = new Date();
  }
}

