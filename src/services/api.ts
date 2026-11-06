import axios from 'axios';
import type { Order, OrderItem, KdsStatus } from '../types/kds';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const kdsApi = {
  // Ambil semua order aktif untuk KDS
  async getKdsOrders(): Promise<{ total_active_orders: number; data: Order[] }> {
    const response = await apiClient.get('/orders/kds');
    return response.data;
  },

  // Update status memasak item tertentu di dapur
  async updateItemStatus(itemId: string, kds_status: KdsStatus): Promise<{ message: string; data: OrderItem }> {
    const response = await apiClient.patch(`/orders/items/${itemId}/kds-status`, {
      kds_status,
    });
    return response.data;
  },

  // Update massal status memasak seluruh item di dalam order
  async bulkUpdateItemStatus(orderId: string, kds_status: KdsStatus): Promise<{ message: string }> {
    const response = await apiClient.patch(`/orders/${orderId}/bulk-kds-status`, {
      kds_status,
    });
    return response.data;
  },

  // Sajikan pesanan (pindahkan ke riwayat)
  async serveOrder(orderId: string): Promise<{ message: string; data: Order }> {
    const response = await apiClient.patch(`/orders/${orderId}/serve`);
    return response.data;
  },

  // Batal sajikan (kembalikan ke antrean aktif)
  async unserveOrder(orderId: string): Promise<{ message: string; data: Order }> {
    const response = await apiClient.patch(`/orders/${orderId}/unserve`);
    return response.data;
  },

  // Ambil detail order
  async getOrderDetail(orderId: string): Promise<{ data: Order }> {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  },

  // Ambil riwayat order KDS (yang sudah disajikan)
  async getCompletedOrders(): Promise<{ total: number; data: Order[] }> {
    const response = await apiClient.get('/orders/kds/history');
    return response.data;
  },
};

