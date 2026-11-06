export type KdsStatus = 'pending' | 'cooking' | 'done';
export type OrderStatus = 'open' | 'completed';
export type PaymentMethod = 'cash' | 'qris';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id?: string | null;
  menu_name: string;
  qty: number;
  unit?: string | null;
  cost_price: number;
  selling_price: number;
  notes?: string | null;
  is_addon: boolean;
  kds_status: KdsStatus;
  created_at: string;
  updated_at: string;
  subtotal?: number;
}

export interface Order {
  id: string;
  customer_name: string;
  pax: number;
  table_number?: string | null;
  order_type?: string | null;
  is_served?: boolean;
  served_at?: string | null;
  order_status: OrderStatus;
  payment_method?: PaymentMethod | null;
  total_cost: number;
  total_price: number;
  amount_paid?: number | null;
  change_amount?: number | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
  wait_duration_minutes?: number;
  has_addons?: boolean;
  all_items_cooked?: boolean;
}

