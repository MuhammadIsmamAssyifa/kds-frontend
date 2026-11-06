<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Order, KdsStatus } from './types/kds';
import { kdsApi } from './services/api';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { soundEffects } from './utils/audio';
import OrderCard from './components/OrderCard.vue';
import {
  ChefHat,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Flame,
  Search,
  CheckCircle,
  Clock,
  BellRing,
  History,
  AlertCircle,
  Maximize,
  Minimize,
  UtensilsCrossed
} from 'lucide-vue-next';

const orders = ref<Order[]>([]);
const completedOrders = ref<Order[]>([]);
const isLoading = ref<boolean>(true);
const isRefreshing = ref<boolean>(false);
const activeTab = ref<'active' | 'cooking' | 'ready' | 'history'>('active');
const searchQuery = ref<string>('');
const isSoundMuted = ref<boolean>(false);
const realtimeConnected = ref<boolean>(false);
const newOrderNotification = ref<string | null>(null);
const isFullscreen = ref<boolean>(false);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true;
    }).catch((err) => {
      console.warn('Gagal masuk mode fullscreen:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        isFullscreen.value = false;
      }).catch((err) => {
        console.warn('Gagal keluar mode fullscreen:', err);
      });
    }
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

const nowTime = ref<number>(Date.now());
const digitalClock = ref<string>('');
let timerInterval: any = null;
let pollingInterval: any = null;
let realtimeChannel: any = null;

function updateClock() {
  nowTime.value = Date.now();
  const d = new Date();
  digitalClock.value = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function fetchOrders(showSpinner = true) {
  if (showSpinner) isRefreshing.value = true;
  try {
    const res = await kdsApi.getKdsOrders();
    orders.value = res.data;
  } catch (err) {
    console.error('Gagal mengambil pesanan KDS:', err);
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
}

async function fetchCompletedOrders() {
  try {
    const res = await kdsApi.getCompletedOrders();
    completedOrders.value = res.data;
  } catch (err) {
    console.error('Gagal mengambil riwayat order:', err);
  }
}

async function handleUpdateStatus(payload: { itemId: string; status: KdsStatus }) {
  for (const o of orders.value) {
    const item = o.order_items.find((i) => i.id === payload.itemId);
    if (item) {
      item.kds_status = payload.status;
      if (payload.status === 'done') {
        soundEffects.playDoneSound();
      }
      break;
    }
  }

  try {
    await kdsApi.updateItemStatus(payload.itemId, payload.status);
  } catch (err) {
    console.error('Gagal update status item:', err);
    await fetchOrders(false);
  }
}

async function handleBulkStatus(payload: { orderId: string; status: KdsStatus }) {
  const targetOrder = orders.value.find((o) => o.id === payload.orderId);
  if (!targetOrder) return;

  for (const item of targetOrder.order_items) {
    if (payload.status === 'cooking') {
      if (item.kds_status === 'pending') {
        item.kds_status = 'cooking';
      }
    } else {
      item.kds_status = payload.status;
    }
  }
  if (payload.status === 'done') {
    soundEffects.playDoneSound();
  }

  try {
    await kdsApi.bulkUpdateItemStatus(payload.orderId, payload.status);
  } catch (err) {
    console.error('Gagal update status massal:', err);
    await fetchOrders(false);
  }
}

async function handleServeOrder(orderId: string) {
  const idx = orders.value.findIndex((o) => o.id === orderId);
  if (idx === -1) return;

  const servedOrder = orders.value[idx];
  orders.value.splice(idx, 1);
  servedOrder.is_served = true;
  servedOrder.served_at = new Date().toISOString();
  completedOrders.value.unshift(servedOrder);

  soundEffects.playDoneSound();
  showFlashNotification(`🍽️ PESANAN "${servedOrder.customer_name}" TELAH DISAJIKAN`);

  try {
    await kdsApi.serveOrder(orderId);
  } catch (err) {
    console.error('Gagal menyajikan pesanan:', err);
    await fetchOrders(false);
  }
}

async function handleUnserveOrder(orderId: string) {
  try {
    await kdsApi.unserveOrder(orderId);
    showFlashNotification('Pesanan dikembalikan ke antrean aktif dapur');
    await fetchOrders(false);
    await fetchCompletedOrders();
  } catch (err) {
    console.error('Gagal mengembalikan pesanan:', err);
  }
}

async function handleCompleteAll(orderId: string) {
  await handleBulkStatus({ orderId, status: 'done' });
}

function toggleSound() {
  isSoundMuted.value = !isSoundMuted.value;
  soundEffects.setMuted(isSoundMuted.value);
}

function testSound() {
  soundEffects.playNewOrderSound();
}

function showFlashNotification(text: string) {
  newOrderNotification.value = text;
  setTimeout(() => {
    newOrderNotification.value = null;
  }, 4500);
}

function setupSupabaseRealtime() {
  if (!isSupabaseConfigured || !supabase) {
    realtimeConnected.value = false;
    pollingInterval = setInterval(() => {
      fetchOrders(false);
    }, 10000);
    return;
  }

  try {
    realtimeChannel = supabase
      .channel('kds-live-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            soundEffects.playNewOrderSound();
            showFlashNotification(
              `🔔 PESANAN BARU MASUK: ${payload.new.customer_name || 'Customer'}`
            );
          }
          fetchOrders(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new.is_addon) {
              soundEffects.playAddonAlertSound();
              showFlashNotification(
                `🔥 TAMBAHAN BARU: ${payload.new.menu_name} (${payload.new.qty}x)`
              );
            } else {
              soundEffects.playNewOrderSound();
            }
          }
          fetchOrders(false);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeConnected.value = true;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          realtimeConnected.value = false;
        }
      });
  } catch (e) {
    console.error('Error saat menghubungkan ke Supabase Realtime:', e);
    realtimeConnected.value = false;
  }
}

const filteredOrders = computed(() => {
  let list = orders.value;

  if (activeTab.value === 'cooking') {
    list = list.filter((o) =>
      o.order_items.some((i) => i.kds_status === 'cooking' || i.kds_status === 'pending')
    );
  } else if (activeTab.value === 'ready') {
    list = list.filter((o) =>
      o.order_items.length > 0 && o.order_items.every((i) => i.kds_status === 'done')
    );
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (o) =>
        o.customer_name.toLowerCase().includes(q) ||
        (o.table_number && o.table_number.toLowerCase().includes(q)) ||
        o.order_items.some((i) => i.menu_name.toLowerCase().includes(q))
    );
  }

  return list;
});

const stats = computed(() => {
  const activeCount = orders.value.length;
  const cookingCount = orders.value.filter((o) =>
    o.order_items.some((i) => i.kds_status === 'cooking')
  ).length;
  const readyCount = orders.value.filter(
    (o) =>
      o.order_items.length > 0 &&
      o.order_items.every((i) => i.kds_status === 'done')
  ).length;
  const addonCount = orders.value.filter((o) =>
    o.order_items.some((i) => i.is_addon)
  ).length;

  return { activeCount, cookingCount, readyCount, addonCount };
});

onMounted(() => {
  updateClock();
  timerInterval = setInterval(updateClock, 1000);
  fetchOrders();
  setupSupabaseRealtime();
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (pollingInterval) clearInterval(pollingInterval);
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 flex flex-col text-slate-100">
    <transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="-translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-full opacity-0"
    >
      <div
        v-if="newOrderNotification"
        class="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 border-2 border-white/50 animate-bounce max-w-[90vw] truncate"
      >
        <BellRing class="w-4 h-4 shrink-0 fill-slate-950 animate-pulse" />
        <span class="truncate">{{ newOrderNotification }}</span>
      </div>
    </transition>

    <header class="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-5 py-2.5 sm:py-3.5">
      <div class="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <ChefHat class="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
          </div>
          <div>
            <div class="flex items-center gap-1.5 sm:gap-2">
              <h1 class="text-base sm:text-xl font-extrabold tracking-tight text-white leading-none">
                SEAFOOD RESTO
              </h1>
              <span class="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-400">
                KDS DAPUR
              </span>
            </div>
            <p class="hidden sm:block text-xs text-slate-400 mt-0.5 font-medium">
              Kitchen Display System • Mode Layar Sentuh
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <div
            :class="[
              'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold border transition-colors',
              realtimeConnected
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/30 text-amber-400 border-amber-500/30',
            ]"
            :title="realtimeConnected ? 'Koneksi Supabase Realtime Aktif' : 'Mode Polling atau Konfigurasi Supabase Tertunda'"
          >
            <span
              :class="[
                'w-2 h-2 rounded-full shrink-0',
                realtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500',
              ]"
            ></span>
            <Wifi v-if="realtimeConnected" class="w-3.5 h-3.5 shrink-0" />
            <WifiOff v-else class="w-3.5 h-3.5 shrink-0" />
            <span class="hidden sm:inline">{{ realtimeConnected ? 'Realtime' : 'Polling' }}</span>
          </div>

          <div class="bg-slate-950 border border-slate-800 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-inner">
            <Clock class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span class="font-mono font-bold text-xs sm:text-base text-slate-100 tracking-wider">
              {{ digitalClock }}
            </span>
          </div>

          <div class="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
            <button
              @click="toggleSound"
              :class="[
                'p-1.5 sm:p-2 rounded-lg transition-colors touch-manipulation',
                isSoundMuted ? 'text-rose-400 hover:bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800',
              ]"
              :title="isSoundMuted ? 'Suara Dinonaktifkan' : 'Suara Aktif'"
            >
              <VolumeX v-if="isSoundMuted" class="w-4 h-4" />
              <Volume2 v-else class="w-4 h-4" />
            </button>
            <button
              @click="testSound"
              class="hidden sm:inline-block px-2.5 py-1 text-xs font-bold text-amber-400 hover:bg-slate-800 rounded-lg transition-colors touch-manipulation"
              title="Tes Bunyi Notifikasi"
            >
              Tes Suara
            </button>
          </div>

          <button
            @click="fetchOrders(true)"
            :disabled="isRefreshing"
            class="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all active:scale-95 disabled:opacity-50 touch-manipulation"
            title="Refresh Pesanan"
          >
            <RefreshCw
              :class="['w-4 h-4', isRefreshing ? 'animate-spin text-amber-400' : '']"
            />
          </button>

          <button
            @click="toggleFullscreen"
            class="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation"
            :title="isFullscreen ? 'Keluar Fullscreen (Esc)' : 'Mode Layar Penuh (Fullscreen)'"
          >
            <Minimize v-if="isFullscreen" class="w-4 h-4 text-amber-400" />
            <Maximize v-else class="w-4 h-4 text-slate-300" />
            <span class="text-xs font-bold hidden lg:inline">{{ isFullscreen ? 'Keluar' : 'Layar Penuh' }}</span>
          </button>
        </div>
      </div>

      <div class="max-w-[1920px] mx-auto mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div class="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          <button
            @click="activeTab = 'active'"
            :class="[
              'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 touch-manipulation',
              activeTab === 'active'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900',
            ]"
          >
            <span>Semua Aktif</span>
            <span
              :class="[
                'px-1.5 py-0.2 rounded-full text-[10px] sm:text-[11px]',
                activeTab === 'active' ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300',
              ]"
            >
              {{ stats.activeCount }}
            </span>
          </button>

          <button
            @click="activeTab = 'cooking'"
            :class="[
              'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 touch-manipulation',
              activeTab === 'cooking'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900',
            ]"
          >
            <Flame class="w-3.5 h-3.5" />
            <span>Dimasak</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] sm:text-[11px] bg-slate-800 text-slate-300">
              {{ stats.cookingCount }}
            </span>
          </button>

          <button
            @click="activeTab = 'ready'"
            :class="[
              'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 touch-manipulation',
              activeTab === 'ready'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900',
            ]"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Siap Diantar</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] sm:text-[11px] bg-slate-800 text-slate-300">
              {{ stats.readyCount }}
            </span>
          </button>

          <button
            @click="activeTab = 'history'; fetchCompletedOrders()"
            :class="[
              'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 touch-manipulation',
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900',
            ]"
          >
            <History class="w-3.5 h-3.5" />
            <span>Riwayat Selesai</span>
          </button>
        </div>

        <div class="relative w-full sm:w-auto sm:min-w-[220px] md:min-w-[260px]">
          <Search class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari Meja, Tamu, Menu..."
            class="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 rounded-xl text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-500 transition-colors"
          />
        </div>
      </div>
    </header>

    <main class="flex-1 p-3 sm:p-4 lg:p-6 max-w-[1920px] mx-auto w-full">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 sm:py-28 text-slate-400">
        <RefreshCw class="w-9 h-9 sm:w-10 sm:h-10 animate-spin text-amber-500 mb-4" />
        <p class="font-bold text-sm sm:text-base text-slate-300">Memuat Antrean Dapur...</p>
        <p class="text-xs text-slate-500 mt-1">Sinkronisasi pesanan aktif</p>
      </div>

      <div v-else-if="activeTab === 'history'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-2">
            <History class="w-4 h-4 text-indigo-400" />
            Riwayat Pesanan yang Sudah Disajikan
          </h2>
          <span class="text-xs text-slate-400">Total: {{ completedOrders.length }}</span>
        </div>

        <div v-if="completedOrders.length === 0" class="text-center py-16 sm:py-20 text-slate-500 text-xs sm:text-sm">
          Belum ada riwayat pesanan yang disajikan hari ini.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <div
            v-for="order in completedOrders"
            :key="order.id"
            class="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 opacity-85 hover:opacity-100 transition-opacity"
          >
            <div class="flex items-start justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span class="font-black text-slate-100 text-sm sm:text-base block">{{ order.customer_name }}</span>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    :class="[
                      'text-[10px] font-black uppercase px-2 py-0.5 rounded border',
                      order.order_type === 'takeaway'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : order.order_type === 'delivery'
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    ]"
                  >
                    {{
                      order.order_type === 'takeaway'
                        ? 'Bawa Pulang'
                        : order.order_type === 'delivery'
                        ? 'Diantar'
                        : order.table_number
                        ? `Meja ${order.table_number}`
                        : 'Makan di Sini'
                    }}
                  </span>
                  <span class="text-xs text-slate-400">{{ order.pax }} Pax</span>
                </div>
              </div>

              <button
                @click="handleUnserveOrder(order.id)"
                class="text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors touch-manipulation"
                title="Kembalikan pesanan ke antrean aktif dapur"
              >
                Kembalikan
              </button>
            </div>

            <div class="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar">
              <div
                v-for="item in order.order_items"
                :key="item.id"
                class="text-xs flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-800/40"
              >
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-amber-400">
                    {{ item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1) }}{{ item.unit && item.unit !== 'porsi' ? ` ${item.unit}` : 'x' }}
                  </span>
                  <span>{{ item.menu_name }}</span>
                </div>
                <span class="text-slate-400 font-mono text-[11px]">Rp {{ (item.selling_price * item.qty).toLocaleString('id-ID') }}</span>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Status: <strong class="text-emerald-400">Disajikan</strong></span>
              <span class="font-mono">{{ order.served_at ? new Date(order.served_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else>
        <div
          v-if="filteredOrders.length === 0"
          class="flex flex-col items-center justify-center py-20 sm:py-28 text-slate-500"
        >
          <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
            <UtensilsCrossed class="w-7 h-7 sm:w-8 sm:h-8 text-slate-600" />
          </div>
          <p class="font-bold text-base sm:text-lg text-slate-300">Tidak ada antrean pesanan masakan</p>
          <p class="text-xs text-slate-500 mt-1 max-w-sm text-center px-4">
            Semua pesanan telah disajikan atau belum ada pesanan baru dari kasir POS.
          </p>
        </div>

        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5"
        >
          <OrderCard
            v-for="order in filteredOrders"
            :key="order.id"
            :order="order"
            :now-time="nowTime"
            @update-status="handleUpdateStatus"
            @bulk-status="handleBulkStatus"
            @serve-order="handleServeOrder"
          />
        </div>
      </div>
    </main>
  </div>
</template>
