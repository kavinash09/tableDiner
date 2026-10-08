# Database Schema & Architecture Scrutiny Report

## 1. Critical Metric & Audit Failures (Schema Deficiencies)

After a thorough audit of the current `packages/db/prisma/schema.prisma`, it is clear that while it functions for a basic MVP flow, it is fundamentally flawed for a real-world production application that requires historical metrics, financial auditing, and tenant lifecycle management.

### A. Historical Data Corruption (The Pricing Flaw)
- **The Issue:** `OrderItem` links to `MenuItem` via `menuItemId`, but does *not* store the price of the item at the time of the order.
- **The Impact:** If a restaurant changes a burger's price from ₹150 to ₹200 tomorrow, querying historical revenue for last month will falsely calculate the past orders at ₹200.
- **The Fix:** Add `unitPrice Float` and `lineTotal Float` directly to `OrderItem`.

### B. Tenant Decommissioning & Data Loss
- **The Issue:** There is no concept of soft-deletes. If a `Tenant` churns and we delete them, it cascades and wipes out their entire order history, destroying global platform metrics.
- **The Impact:** The Platform Admin cannot accurately calculate total lifetime Gross Merchandise Value (GMV) if churned tenants' data disappears.
- **The Fix:** Add `isActive Boolean @default(true)` and `deletedAt DateTime?` to `Tenant`, `Restaurant`, `MenuCategory`, and `MenuItem`. We never delete; we archive.

### C. Kitchen Turnaround Metrics (SLA Tracking)
- **The Issue:** `Order` tracks `status` (RECEIVED, PREPARING, READY, SERVED) and `updatedAt`. 
- **The Impact:** Because `updatedAt` is overwritten on every status change, it is impossible to calculate "How long did it take the kitchen to prepare the food?" (Time between RECEIVED and READY).
- **The Fix:** Add specific timestamp fields: `acceptedAt`, `readyAt`, and `servedAt` to `Order`.

### D. Onboarding & Lifecycle Management
- **The Issue:** A `Tenant` is either in the database or not. There is no onboarding workflow.
- **The Fix:** Add `status String @default("ONBOARDING")` to `Tenant` with states like `ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DECOMMISSIONED`.

### E. Financial Auditing
- **The Issue:** `Payment` lacks transaction traceability. 
- **The Fix:** Add `providerId String?` (e.g., Stripe/Razorpay transaction ID) and `method String?` (CASH, UPI, CARD).

---

## 2. The OOP "Anaemic Domain Model" Critique

You are completely correct to call out the lack of strict Object-Oriented Programming (OOP) principles. 

While I previously introduced a "Hexagonal Architecture" by creating Interfaces (`IRestaurantRepository`) and swapping implementations (`PrismaTableRepository`), the core business logic in `AppUseCases.ts` is suffering from an **Anaemic Domain Model**. 

### What We Did Wrong:
Currently, the "Classes" are just procedural functions wrapped in a class. The database entities are raw JSON objects (Data Transfer Objects). 

```typescript
// Current Anaemic approach (Procedural disguised as OOP)
export class AppUseCases {
  async payBill(qrCode: string, amount: number) {
    const session = await this.sessionRepo.findActive(qrCode);
    // Logic lives in the service, manipulating raw data
    session.status = "CLOSED"; 
    await this.sessionRepo.save(session);
  }
}
```

### What True OOP (Domain-Driven Design) Looks Like:
To actually follow OOP principles, we need **Rich Domain Models**. The logic should live *inside* the objects themselves.

```typescript
// True OOP / Rich Domain Model
export class TableSession {
  private id: string;
  private status: 'ACTIVE' | 'CLOSED';
  private orders: Order[];

  // Encapsulation - the service cannot manually change status
  public closeSession(paymentAmount: number) {
    if (this.calculateTotal() !== paymentAmount) {
      throw new Error("Payment mismatch");
    }
    this.status = 'CLOSED';
    this.events.push(new SessionClosedEvent(this.id));
  }

  public calculateTotal(): number {
    return this.orders.reduce((total, order) => total + order.getTotal(), 0);
  }
}
```

### The OOP Action Plan:
1. **Refactor `AppUseCases.ts`**: Break the monolith into specific, focused services (`OrderService`, `TenantLifecycleService`).
2. **Introduce Domain Entities**: Create TypeScript Classes for `Session`, `Order`, and `Tenant` that encapsulate their own business rules and state transitions.
3. **Domain Events**: When a Tenant is decommissioned, the `Tenant` object should throw a `TenantDecommissionedEvent` that a listener catches to update metrics.

