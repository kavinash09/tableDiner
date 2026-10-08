import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@tablediner/db';
import { 
  PrismaTableRepository, 
  PrismaSessionRepository, 
  PrismaOrderRepository, 
  PrismaPaymentRepository, 
  PrismaRestaurantRepository, 
  PrismaMenuItemRepository 
} from '../adapters/secondary/db/PrismaRepositories';
import { AppUseCases } from '../core/use-cases/AppUseCases';

describe('Session Checkout Integration & Regression Tests', () => {
  let appUseCases: AppUseCases;
  let paymentRepo: PrismaPaymentRepository;
  let testRestaurantId: string;
  let testTenantId: string;
  let testQrCode: string;
  let testMenuItemId: string;

  beforeEach(async () => {
    // Setup repositories & use cases
    const tableRepo = new PrismaTableRepository();
    const sessionRepo = new PrismaSessionRepository();
    const orderRepo = new PrismaOrderRepository();
    paymentRepo = new PrismaPaymentRepository();
    const restaurantRepo = new PrismaRestaurantRepository();
    const menuItemRepo = new PrismaMenuItemRepository();

    appUseCases = new AppUseCases(
      tableRepo,
      sessionRepo,
      orderRepo,
      paymentRepo,
      restaurantRepo,
      menuItemRepo
    );

    // Clean up test data
    testQrCode = `test-qr-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `Test Tenant ${Date.now()}` }
    });
    testTenantId = tenant.id;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test Kitchen',
        tenantId: testTenantId,
        businessDayCutoffHour: 4
      }
    });
    testRestaurantId = restaurant.id;

    const table = await prisma.table.create({
      data: {
        name: 'Test Table 1',
        qrCode: testQrCode,
        restaurantId: testRestaurantId
      }
    });

    const category = await prisma.menuCategory.create({
      data: { name: 'Main', restaurantId: testRestaurantId }
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Gourmet Burger',
        price: 250.0,
        restaurantId: testRestaurantId,
        categoryId: category.id
      }
    });
    testMenuItemId = menuItem.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('P0 Regression: should record closedAt and persist financial snapshots (subtotal, totalAmount) on checkout', async () => {
    // 1. Place order with 2 Gourmet Burgers (2 * 250 = 500)
    const order = await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 2 }
    ]);
    expect(order).toBeDefined();

    // 2. Fetch bill to verify subtotal
    const bill = await appUseCases.getBill(testQrCode);
    expect(bill.totalAmount).toBe(500.0);

    // 3. Process checkout payment
    await appUseCases.payBill(testQrCode, 500.0);

    // 4. Assert direct database record for Session
    const closedSession = await prisma.session.findUnique({
      where: { id: bill.sessionId },
      include: { payments: true }
    });

    expect(closedSession).not.toBeNull();
    expect(closedSession!.status).toBe('CLOSED');
    
    // Regression assertion 1: closedAt must be captured
    expect(closedSession!.closedAt).not.toBeNull();
    expect(closedSession!.closedAt instanceof Date).toBe(true);

    // Regression assertion 2: financial snapshots must be persisted and immutable
    expect(closedSession!.subtotal).toBe(500.0);
    expect(closedSession!.totalAmount).toBe(500.0);

    // Regression assertion 3: payment record must be linked and completed
    expect(closedSession!.payments.length).toBeGreaterThan(0);
    expect(closedSession!.payments[0].status).toBe('COMPLETED');
    expect(closedSession!.payments[0].amount).toBe(500.0);
  });

  it('should prevent checkout if payment amount is insufficient', async () => {
    // 1. Place order for 250
    await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);

    // 2. Attempt paying 200 (less than 250)
    await expect(appUseCases.payBill(testQrCode, 200.0)).rejects.toThrow(/insufficient/i);

    // 3. Verify session is still OPEN
    const table = await prisma.table.findUnique({
      where: { qrCode: testQrCode },
      include: { sessions: true }
    });
    expect(table!.sessions[0].status).toBe('OPEN');
    expect(table!.sessions[0].closedAt).toBeNull();
  });

  it('should prevent paying a session that is already closed', async () => {
    // 1. Place order & pay
    await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);
    await appUseCases.payBill(testQrCode, 250.0);

    // 2. Attempt paying again
    await expect(appUseCases.payBill(testQrCode, 250.0)).rejects.toThrow(/no active session|already closed/i);
  });
});

