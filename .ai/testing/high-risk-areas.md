# High Risk Areas

## Risk Analysis

1. **getBill() price bug**
   - **Risk Level**: CRITICAL
   - **Impact**: Customers could be overbilled or underbilled if menu prices change mid-session. The system calculates totals using the live `menuItem.price` instead of the snapshotted `OrderItem.unitPrice`.

2. **Session status 'ACTIVE' vs 'OPEN'**
   - **Risk Level**: CRITICAL
   - **Impact**: All analytics queries using `businessDate` return 0 because no session is ever found as `OPEN` (they are incorrectly created as `ACTIVE`, which isn't even in the schema enum).

3. **tenantId/businessDate not set on Session/Order creation**
   - **Risk Level**: CRITICAL
   - **Impact**: All analytics return 0, and multi-tenant isolation is fundamentally broken for these entities.

4. **Hard deletes on MenuCategory/MenuItem**
   - **Risk Level**: HIGH
   - **Impact**: Permanently destroys `OrderItem` historical data, violating Rule 19 which requires soft deletes to preserve data integrity.

5. **AUTH_SECRET hardcoded fallback**
   - **Risk Level**: HIGH
   - **Impact**: All JWT tokens can be forged in any environment without the environment variable set, posing a significant security vulnerability.

6. **getCurrentRestaurant() returns first restaurant**
   - **Risk Level**: HIGH
   - **Impact**: Multi-tenant environment will serve the wrong restaurant's data. This is an MVP hack that needs to be replaced with proper tenant-aware logic.

7. **No auth guards on admin routes**
   - **Risk Level**: HIGH
   - **Impact**: Any unauthenticated user can call `/admin/restaurants` and potentially view or manipulate tenant data.

8. **UpdateOrderStatusSchema allows free-form status update bypassing Order state machine**
   - **Risk Level**: MEDIUM
   - **Impact**: Order state can transition invalidly (e.g., from RECEIVED straight to SERVED, or CANCELLED to READY), breaking operational workflows and SLA metrics.

9. **AppUseCases.createMenuItem(data: any)**
   - **Risk Level**: MEDIUM
   - **Impact**: No type safety for input data, potentially leading to runtime errors or malformed data being saved to the database.

10. **PrismaRepositories import prisma singleton; Analytics repos import PrismaClient directly**
    - **Risk Level**: LOW
    - **Impact**: Inconsistent pattern that could lead to connection pool issues or difficulty in mocking during tests.

