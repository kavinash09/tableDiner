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
          where: { status: 'ACTIVE' }, 
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
  async createActiveSession(restaurantId: string, tableId: string) {
    return prisma.session.create({
      data: { status: 'ACTIVE', restaurantId, tableId },
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
  async createOrder(sessionId: string, items: { menuItemId: string; quantity: number; notes?: string }[]) {
    return prisma.order.create({
      data: {
        sessionId,
        status: 'RECEIVED',
        items: {
          create: items.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity, notes: item.notes || null, unitPrice: (item as any).unitPrice, lineTotal: (item as any).lineTotal })),
        },
      },
      include: { items: true },
    }) as any;
  }

  async getActiveOrders() {
    return prisma.order.findMany({
      where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
      include: {
        items: { include: { menuItem: true } },
        session: { include: { table: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    }) as any;
  }
}

export class PrismaPaymentRepository implements IPaymentRepository {
  async processCheckout(sessionId: string, amount: number) {
    await prisma.$transaction([
      prisma.payment.create({ data: { sessionId, status: 'COMPLETED', amount } }),
      prisma.session.update({ where: { id: sessionId }, data: { status: 'CLOSED' } }),
    ]);
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
    await prisma.menuCategory.delete({ where: { id: categoryId } });
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
    await prisma.menuItem.delete({ where: { id } });
  }
}
