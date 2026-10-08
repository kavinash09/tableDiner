import { 
  ITableRepository, 
  ISessionRepository, 
  IOrderRepository, 
  IPaymentRepository,
  IRestaurantRepository,
  IMenuItemRepository
} from '../ports/Repositories';

export class AppUseCases {
  constructor(
    private tableRepo: ITableRepository,
    private sessionRepo: ISessionRepository,
    private orderRepo: IOrderRepository,
    private paymentRepo: IPaymentRepository,
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository
  ) {}

  async getTableDetails(qrCode: string) {
    const table = await this.tableRepo.findByQrCode(qrCode);
    if (!table) return null;

    return {
      table: { id: table.id, name: table.name },
      restaurant: { 
        id: table.restaurant.id, 
        name: table.restaurant.name,
        theme: table.restaurant.theme,
        bannerUrl: table.restaurant.bannerUrl 
      },
      session: table.sessions[0] || null,
      menu: {
        categories: table.restaurant.menuCategories,
        uncategorized: table.restaurant.menuItems,
      },
    };
  }

  async placeOrder(qrCode: string, items: { menuItemId: string; quantity: number; notes?: string }[]) {
    const table = await this.tableRepo.findByQrCode(qrCode);
    if (!table) throw new Error('Table not found.');

    let session = table.sessions[0];
    if (!session) {
      session = await this.sessionRepo.createActiveSession(table.restaurantId, table.id);
    }

    // Domain Logic: Map pricing at the time of order
    const enrichedItems = await Promise.all(items.map(async (item) => {
      const menuItem = await this.menuItemRepo.findById(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      return {
        ...item,
        unitPrice: menuItem.price,
        lineTotal: menuItem.price * item.quantity
      };
    }));
    const order = await this.orderRepo.createOrder(session.id, enrichedItems);
    return order;
  }

  async getBill(qrCode: string) {
    const table = await this.tableRepo.findByQrCode(qrCode);
    if (!table || table.sessions.length === 0) {
      throw new Error('No active session found.');
    }

    const session = table.sessions[0];
    let totalAmount = 0;
    const itemized: { name: string; quantity: number; price: number; lineTotal: number }[] = [];

    for (const order of session.orders) {
      for (const item of order.items) {
        const lineTotal = item.menuItem.price * item.quantity;
        totalAmount += lineTotal;
        itemized.push({ name: item.menuItem.name, quantity: item.quantity, price: item.menuItem.price, lineTotal });
      }
    }

    return { sessionId: session.id, itemized, totalAmount };
  }

  async payBill(qrCode: string, amount: number) {
    const table = await this.tableRepo.findByQrCode(qrCode);
    if (!table || table.sessions.length === 0) {
      throw new Error('No active session found.');
    }

    const session = table.sessions[0];
    await this.paymentRepo.processCheckout(session.id, amount);
  }

  async getKitchenOrders() {
    return this.orderRepo.getActiveOrders();
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.orderRepo.updateOrderStatus(orderId, status);
  }

  async getPlatformTenants() {
    return this.restaurantRepo.getAllTenantsWithRestaurants();
  }

  async createPlatformTenant(tenantName: string, restaurantName: string, tablesCount: number) {
    return this.restaurantRepo.createTenantAndRestaurant(tenantName, restaurantName, tablesCount);
  }

  async getCurrentRestaurant() {
    return this.restaurantRepo.getFirstRestaurant();
  }

  async updateRestaurantSettings(id: string, theme: string, qrTemplate: string) {
    return this.restaurantRepo.updateSettings(id, theme, qrTemplate);
  }

  async updateRestaurantBanner(id: string, bannerUrl: string) {
    return this.restaurantRepo.updateBanner(id, bannerUrl);
  }

  async updateMenuItemImage(id: string, imageUrl: string) {
    return this.menuItemRepo.updateImage(id, imageUrl);
  }

  async createMenuCategory(restaurantId: string, name: string) {
    return this.restaurantRepo.createCategory(restaurantId, name);
  }

  async deleteMenuCategory(categoryId: string) {
    return this.restaurantRepo.deleteCategory(categoryId);
  }

  async createMenuItem(restaurantId: string, data: any) {
    return this.menuItemRepo.createItem(restaurantId, data);
  }

  async updateMenuItem(id: string, data: any) {
    return this.menuItemRepo.updateItem(id, data);
  }

  async deleteMenuItem(id: string) {
    return this.menuItemRepo.deleteItem(id);
  }
}

