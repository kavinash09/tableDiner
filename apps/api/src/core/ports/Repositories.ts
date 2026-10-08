import type { 
  Table, 
  Restaurant, 
  Session, 
  Order, 
  Tenant, 
  MenuItem, 
  MenuCategory,
  OrderItem
} from '@tablediner/shared-types';

export interface ITableRepository {
  findByQrCode(qrCode: string): Promise<any>;
}

export interface ISessionRepository {
  createActiveSession(tenantId: string, restaurantId: string, tableId: string, businessDate: string): Promise<Session>;
  updateSessionStatus(sessionId: string, status: 'CLOSED'): Promise<Session>;
}

export interface IOrderRepository {
  createOrder(tenantId: string, sessionId: string, businessDate: string, items: { menuItemId: string; quantity: number; notes?: string; unitPrice: number; lineTotal: number }[]): Promise<Order>;
  getActiveOrders(restaurantId: string): Promise<any[]>;
  updateOrderStatus(orderId: string, status: string, reason?: string): Promise<Order>;
}

export interface IPaymentRepository {
  processCheckout(tenantId: string, sessionId: string, amount: number): Promise<void>;
}

export interface IRestaurantRepository {
  getAllTenantsWithRestaurants(): Promise<any[]>;
  createTenantAndRestaurant(tenantName: string, restaurantName: string, tablesCount: number): Promise<any>;
  getFirstRestaurant(): Promise<any>;
  updateSettings(id: string, theme: string, qrTemplate: string): Promise<Restaurant>;
  updateBanner(id: string, bannerUrl: string): Promise<void>;
  createCategory(restaurantId: string, name: string): Promise<MenuCategory>;
  deleteCategory(categoryId: string): Promise<void>;
}

export interface IMenuItemRepository {
  updateImage(id: string, imageUrl: string): Promise<void>;
  findById(id: string): Promise<any>;
  createItem(restaurantId: string, data: any): Promise<MenuItem>;
  updateItem(id: string, data: any): Promise<MenuItem>;
  deleteItem(id: string): Promise<void>;
}
