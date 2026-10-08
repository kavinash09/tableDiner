# Session Business Rules

1. **Table Constraint**: Only ONE `OPEN` session can exist per table at any time.
2. **Auto-Creation**: A session is automatically created when an order is placed and no `OPEN` session exists for the table.
3. **Lifecycle**: Sessions transition from `OPEN` to `CLOSED` upon successful payment. (Other states defined in schema: `REOPENED`, `FINALIZED`).
4. **Denormalization Requirements**: `tenantId` and `businessDate` MUST be set on creation for cross-tenant analytics. (⚠️ BUG: Currently not being set).
5. **Financial Rollup**: When closed, the session must accurately reflect the sum of its associated order items (taxes, tips, subtotals).
6. **State Validation**: `ACTIVE` is not a valid state; the system must use `OPEN`. (⚠️ BUG: Code uses `ACTIVE`).

