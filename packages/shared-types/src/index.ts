// Base Models matching Prisma types
export interface Tenant {
  id: string;
  name: string;
}

export interface Restaurant {
  id: string;
  tenantId: string;
  name: string;
  subscriptionTier: string;
  theme: string;
  qrTemplate: string;
  bannerUrl: string | null;
}

export interface Table {
  id: string;
  name: string;
  qrCode: string;
  restaurantId: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  restaurantId: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  restaurantId: string;
}

export interface Session {
  id: string;
  status: 'ACTIVE' | 'CLOSED';
  restaurantId: string;
  tableId: string;
}

export interface Order {
  id: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED';
  sessionId: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  notes?: string | null;
  orderId: string;
  menuItemId: string;
}

export interface Payment {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  sessionId: string;
}

// API Response Types
export interface HealthResponse {
  status: string;
}

export interface TableDetailsResponse {
  table: { id: string; name: string };
  restaurant: { id: string; name: string; theme: string; bannerUrl: string | null };
  session: Session | null;
  menu: {
    categories: (MenuCategory & { items: MenuItem[] })[];
    uncategorized: MenuItem[];
  };
}

export interface PlaceOrderResponse {
  success: boolean;
  order: Order & { items: OrderItem[] };
}

export interface BillResponse {
  sessionId: string;
  itemized: {
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }[];
  totalAmount: number;
}

export interface PayResponse {
  success: boolean;
  message: string;
}

export type KitchenOrdersResponse = (Order & {
  items: (OrderItem & { menuItem: MenuItem })[];
  session: Session & { table: Table };
})[];

export type UpdateOrderResponse = Order;

export type AdminRestaurantsResponse = (Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
})[];

export type CreateRestaurantResponse = Tenant & {
  restaurants: (Restaurant & { tables: Table[] })[];
};

export interface ErrorResponse {
  error: string;
}
