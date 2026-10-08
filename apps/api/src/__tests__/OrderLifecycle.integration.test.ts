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

describe('Order Lifecycle & SLA Timestamps Integration Tests', () => {
  let appUseCases: AppUseCases;
  let orderRepo: PrismaOrderRepository;
  let testRestaurantId: string;
  let testTenantId: string;
  let testQrCode: string;
  let testMenuItemId: string;

  beforeEach(async () => {
    const tableRepo = new PrismaTableRepository();
    const sessionRepo = new PrismaSessionRepository();
    orderRepo = new PrismaOrderRepository();
    const paymentRepo = new PrismaPaymentRepository();
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

    testQrCode = `test-order-qr-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `Test Tenant ${Date.now()}` }
    });
    testTenantId = tenant.id;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test Kitchen for Orders',
        tenantId: testTenantId,
        businessDayCutoffHour: 4
      }
    });
    testRestaurantId = restaurant.id;

    await prisma.table.create({
      data: {
        name: 'Order Table',
        qrCode: testQrCode,
        restaurantId: testRestaurantId
      }
    });

    const category = await prisma.menuCategory.create({
      data: { name: 'Sides', restaurantId: testRestaurantId }
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Crispy Fries',
        price: 120.0,
        restaurantId: testRestaurantId,
        categoryId: category.id
      }
    });
    testMenuItemId = menuItem.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('P0 Regression: should record acceptedAt, readyAt, and servedAt across the lifecycle', async () => {
    // 1. Place order
    const createdOrder = await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);
    expect(createdOrder.status).toBe('RECEIVED');

    const initialDbOrder = await prisma.order.findUnique({ where: { id: createdOrder.id } });
    expect(initialDbOrder!.acceptedAt).toBeNull();
    expect(initialDbOrder!.readyAt).toBeNull();
    expect(initialDbOrder!.servedAt).toBeNull();

    // 2. Kitchen accepts order -> PREPARING
    const preparingOrder = await appUseCases.updateOrderStatus(createdOrder.id, 'PREPARING');
    expect(preparingOrder.status).toBe('PREPARING');

    const preparingDbOrder = await prisma.order.findUnique({ where: { id: createdOrder.id } });
    expect(preparingDbOrder!.acceptedAt).not.toBeNull();
    expect(preparingDbOrder!.acceptedAt instanceof Date).toBe(true);
    expect(preparingDbOrder!.readyAt).toBeNull();
    expect(preparingDbOrder!.servedAt).toBeNull();

    // 3. Kitchen marks ready -> READY
    const readyOrder = await appUseCases.updateOrderStatus(createdOrder.id, 'READY');
    expect(readyOrder.status).toBe('READY');

    const readyDbOrder = await prisma.order.findUnique({ where: { id: createdOrder.id } });
    expect(readyDbOrder!.readyAt).not.toBeNull();
    expect(readyDbOrder!.readyAt instanceof Date).toBe(true);
    expect(readyDbOrder!.servedAt).toBeNull();

    // 4. Runner serves order -> SERVED
    const servedOrder = await appUseCases.updateOrderStatus(createdOrder.id, 'SERVED');
    expect(servedOrder.status).toBe('SERVED');

    const servedDbOrder = await prisma.order.findUnique({ where: { id: createdOrder.id } });
    expect(servedDbOrder!.servedAt).not.toBeNull();
    expect(servedDbOrder!.servedAt instanceof Date).toBe(true);

    // Assert chronological invariant: createdAt <= acceptedAt <= readyAt <= servedAt
    expect(servedDbOrder!.createdAt.getTime()).toBeLessThanOrEqual(servedDbOrder!.acceptedAt!.getTime());
    expect(servedDbOrder!.acceptedAt!.getTime()).toBeLessThanOrEqual(servedDbOrder!.readyAt!.getTime());
    expect(servedDbOrder!.readyAt!.getTime()).toBeLessThanOrEqual(servedDbOrder!.servedAt!.getTime());
  });

  it('P0 Regression: should reject invalid state skips (e.g. RECEIVED directly to SERVED)', async () => {
    const order = await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);

    // Attempt skipping straight to SERVED
    await expect(appUseCases.updateOrderStatus(order.id, 'SERVED')).rejects.toThrow(/READY/i);

    // Verify order remains in RECEIVED state without timestamps
    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(dbOrder!.status).toBe('RECEIVED');
    expect(dbOrder!.servedAt).toBeNull();
  });

  it('P0 Regression: should record cancelledAt and reason, and prohibit cancelling a SERVED order', async () => {
    // 1. Place order, accept, ready, serve
    const order = await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);
    await appUseCases.updateOrderStatus(order.id, 'PREPARING');
    await appUseCases.updateOrderStatus(order.id, 'READY');
    await appUseCases.updateOrderStatus(order.id, 'SERVED');

    // 2. Attempt cancelling already served order
    await expect(appUseCases.updateOrderStatus(order.id, 'CANCELLED')).rejects.toThrow(/already been served/i);

    // 3. Place another order to test valid cancellation
    const cancellableOrder = await appUseCases.placeOrder(testQrCode, [
      { menuItemId: testMenuItemId, quantity: 1 }
    ]);
    await appUseCases.updateOrderStatus(cancellableOrder.id, 'CANCELLED');

    const cancelledDbOrder = await prisma.order.findUnique({ where: { id: cancellableOrder.id } });
    expect(cancelledDbOrder!.status).toBe('CANCELLED');
    expect(cancelledDbOrder!.cancelledAt).not.toBeNull();
  });
});

