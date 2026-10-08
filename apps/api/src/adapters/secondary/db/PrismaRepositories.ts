import { prisma } from '@tablediner/db';
import { 
  ITableRepository, 
  ISessionRepository, 
  IOrderRepository, 
  IPaymentRepository,
  IRestaurantRepository,
  IMenuItemRepository
} from '../../../core/ports/Repositories';

export class PrismaTableRepository implements ITableRepository {
  async findByQrCode(qrCode: string) {
    return prisma.table.findUnique({
      where: { qrCode },
      include: {
        restaurant: {
          include: {
            menuCategories: { include: { items: true } },
            menuItems: { where: { categoryId: null } },
          },
        },
        sessions: { 
          where: { status: 'OPEN' }, 
          take: 1,
          include: {
            orders: { include: { items: { include: { menuItem: true } } } },
          }
        },
      },
    });
  }
}

export class PrismaSessionRepository implements ISessionRepository {
  async createActiveSession(tenantId: string, restaurantId: string, tableId: string, businessDate: string) {
    return prisma.session.create({
      data: { status: 'OPEN', tenantId, restaurantId, tableId, businessDate },
    }) as any;
  }
  
  async updateSessionStatus(sessionId: string, status: 'CLOSED') {
    return prisma.session.update({
      where: { id: sessionId },
      data: { status },
    }) as any;
  }
}

export class PrismaOrderRepository implements IOrderRepository {
  async createOrder(tenantId: string, sessionId: string, businessDate: string, items: { menuItemId: string; quantity: number; notes?: string; unitPrice: number; lineTotal: number }[]) {
    return prisma.order.create({
      data: {
        tenantId,
        sessionId,
        businessDate,
        status: 'RECEIVED',
        items: {
          create: items.map(item => ({ tenantId, menuItemId: item.menuItemId, quantity: item.quantity, notes: item.notes || null, unitPrice: item.unitPrice, lineTotal: item.lineTotal })),
        },
      },
      include: { items: true },
    }) as any;
  }

  async getActiveOrders(restaurantId: string) {
    return prisma.order.findMany({
      where: { 
        status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
        session: { restaurantId }
      },
      include: {
        items: { include: { menuItem: true } },
        session: { include: { table: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async updateOrderStatus(orderId: string, status: string, reason?: string) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existing) {
      throw new Error(`Order ${orderId} not found.`);
    }

    // Terminal state protection
    if (existing.status === 'SERVED') {
      throw new Error('Cannot modify or cancel an order that has already been served.');
    }
    if (existing.status === 'CANCELLED' || existing.status === 'REJECTED') {
      throw new Error(`Order is already ${existing.status.toLowerCase()}.`);
    }

    const data: any = { status };

    if (status === 'PREPARING') {
      if (existing.status !== 'RECEIVED') {
        throw new Error('Order must be in RECEIVED state to start PREPARING');
      }
      data.acceptedAt = existing.acceptedAt ?? new Date();
    } else if (status === 'READY') {
      if (existing.status !== 'PREPARING') {
        throw new Error('Order must be in PREPARING state to mark READY');
      }
      data.readyAt = existing.readyAt ?? new Date();
    } else if (status === 'SERVED') {
      if (existing.status !== 'READY') {
        throw new Error('Order must be in READY state to mark SERVED');
      }
      data.servedAt = existing.servedAt ?? new Date();
    } else if (status === 'CANCELLED' || status === 'REJECTED') {
      data.cancelledAt = existing.cancelledAt ?? new Date();
      data.cancellationReason = reason || 'Order cancelled';
    } else {
      throw new Error(`Invalid status transition to ${status}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data,
    }) as any;
  }
}

export class PrismaPaymentRepository implements IPaymentRepository {
  async processCheckout(tenantId: string, sessionId: string, amount: number) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: {
          orders: {
            include: { items: true },
          },
        },
      });

      if (!session) {
        throw new Error('Session not found.');
      }

      if (session.status === 'CLOSED') {
        throw new Error('Session is already closed.');
      }

      // Compute running subtotal of all non-cancelled, non-rejected orders
      const subtotal = session.orders
        .filter((o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .flatMap((o) => o.items)
        .reduce((sum, item) => sum + item.lineTotal, 0);

      const taxAmount = 0.0;
      const discountAmount = 0.0;
      const tipAmount = 0.0;
      const expectedTotal = subtotal + taxAmount + tipAmount - discountAmount;

      if (amount < expectedTotal) {
        throw new Error(`Insufficient payment amount. Expected ${expectedTotal}, got ${amount}.`);
      }

      const closedAt = new Date();

      await tx.payment.create({
        data: {
          tenantId,
          sessionId,
          status: 'COMPLETED',
          amount,
          method: 'MOCK_PAY',
        },
      });

      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt,
          subtotal,
          taxAmount,
          tipAmount,
          discountAmount,
          totalAmount: expectedTotal,
        },
      });
    });
  }
}

export class PrismaRestaurantRepository implements IRestaurantRepository {
  async getAllTenantsWithRestaurants() {
    return prisma.tenant.findMany({
      include: { restaurants: { include: { tables: true } } },
    });
  }

  async createTenantAndRestaurant(tenantName: string, restaurantName: string, tablesCount: number) {
    return prisma.tenant.create({
      data: {
        name: tenantName,
        restaurants: {
          create: {
            name: restaurantName,
            tables: {
              create: Array.from({ length: tablesCount }).map((_, i) => ({ name: `Table ${i + 1}` })),
            },
          },
        },
      },
      include: { restaurants: { include: { tables: true } } },
    });
  }

  async getFirstRestaurant() {
    return prisma.restaurant.findFirst({
      include: { 
        tables: true,
        menuCategories: { include: { items: true } }
      }
    });
  }

  async updateSettings(id: string, theme: string, qrTemplate: string) {
    return prisma.restaurant.update({
      where: { id },
      data: { theme, qrTemplate },
    }) as any;
  }

  async updateBanner(id: string, bannerUrl: string) {
    await prisma.restaurant.update({
      where: { id },
      data: { bannerUrl },
    });
  }

  async createCategory(restaurantId: string, name: string) {
    return prisma.menuCategory.create({
      data: { name, restaurantId },
    }) as any;
  }

  async deleteCategory(categoryId: string) {
    await prisma.menuCategory.update({ 
      where: { id: categoryId },
      data: { isActive: false, deletedAt: new Date() }
    });
  }
}

export class PrismaMenuItemRepository implements IMenuItemRepository {

  async findById(id: string): Promise<any> {
    return prisma.menuItem.findUnique({ where: { id } });
  }

  async updateImage(id: string, imageUrl: string) {
    await prisma.menuItem.update({
      where: { id },
      data: { imageUrl },
    });
  }

  async createItem(restaurantId: string, data: any) {
    return prisma.menuItem.create({
      data: { ...data, restaurantId },
    }) as any;
  }

  async updateItem(id: string, data: any) {
    return prisma.menuItem.update({
      where: { id },
      data,
    }) as any;
  }

  async deleteItem(id: string) {
    await prisma.menuItem.update({ 
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });
  }
}
