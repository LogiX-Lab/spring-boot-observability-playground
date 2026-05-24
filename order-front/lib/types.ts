export interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface OrderRequest {
  id: number;
  customerId: number;
  paymentToken: string;
  orderStatus: string;
  items: OrderItem[];
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderHistoryItem {
  id: number;
  customerId: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: { productId: number; quantity: number; price: number }[];
}
