<script setup lang="ts">
import { computed } from 'vue';
import type { Order, OrderItem, KdsStatus } from '../types/kds';
import { 
  Clock, 
  Users, 
  UtensilsCrossed, 
  CheckCircle2, 
  Flame, 
  ShoppingBag,
  Bike,
  RotateCcw,
  Send
} from 'lucide-vue-next';

const props = defineProps<{
  order: Order;
  nowTime: number;
}>();

const emit = defineEmits<{
  (e: 'update-status', payload: { itemId: string; status: KdsStatus }): void;
  (e: 'bulk-status', payload: { orderId: string; status: KdsStatus }): void;
  (e: 'serve-order', orderId: string): void;
}>();

const elapsedMinutes = computed(() => {
  const createdAt = new Date(props.order.created_at).getTime();
  const diffMs = Math.max(0, props.nowTime - createdAt);
  return Math.floor(diffMs / 60000);
});

const urgencyClass = computed(() => {
  const mins = elapsedMinutes.value;
  if (mins >= 25) {
    return {
      border: 'border-rose-500 shadow-rose-950/40 shadow-xl ring-2 ring-rose-500/50',
      badge: 'bg-rose-500 text-white animate-pulse',
      header: 'bg-rose-950/40 border-rose-800/60',
    };
  }
  if (mins >= 15) {
    return {
      border: 'border-amber-500/80 shadow-amber-950/30 shadow-lg',
      badge: 'bg-amber-500/90 text-slate-950',
      header: 'bg-amber-950/30 border-amber-800/50',
    };
  }
  return {
    border: 'border-slate-800 hover:border-slate-700 shadow-slate-950/50 shadow-md',
    badge: 'bg-slate-800 text-slate-300',
    header: 'bg-slate-900/80 border-slate-800',
  };
});

const orderTypeInfo = computed(() => {
  const type = props.order.order_type || 'dine_in';
  if (type === 'takeaway') {
    return {
      label: 'BAWA PULANG',
      badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      isTakeaway: true,
      isDelivery: false,
    };
  }
  if (type === 'delivery') {
    return {
      label: 'DIANTAR',
      badgeClass: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
      isTakeaway: false,
      isDelivery: true,
    };
  }
  if (props.order.table_number) {
    return {
      label: `MEJA ${props.order.table_number}`,
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      isTakeaway: false,
      isDelivery: false,
    };
  }
  return {
    label: 'MAKAN DI SINI',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    isTakeaway: false,
    isDelivery: false,
  };
});

const allDone = computed(() => {
  return (
    props.order.order_items.length > 0 &&
    props.order.order_items.every((item) => item.kds_status === 'done')
  );
});

const hasPending = computed(() => {
  return props.order.order_items.some((item) => item.kds_status === 'pending');
});

const hasCooking = computed(() => {
  return props.order.order_items.some((item) => item.kds_status === 'cooking');
});

const currentAction = computed<'masak_semua' | 'selesai_semua' | 'sajikan'>(() => {
  if (allDone.value) {
    return 'sajikan';
  }
  if (hasPending.value) {
    return 'masak_semua';
  }
  return 'selesai_semua';
});

const progress = computed(() => {
  const items = props.order.order_items;
  if (!items.length) return { done: 0, total: 0, percent: 0 };
  const doneCount = items.filter((i) => i.kds_status === 'done').length;
  return {
    done: doneCount,
    total: items.length,
    percent: Math.round((doneCount / items.length) * 100),
  };
});

const orderTime = computed(() => {
  const d = new Date(props.order.created_at);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
});

function formatQty(qty: number, unit?: string | null): string {
  const displayQty = qty % 1 === 0 ? qty.toString() : qty.toFixed(1).replace(/\.0$/, '');
  const displayUnit = unit && unit !== 'porsi' ? ` ${unit}` : 'x';
  return `${displayQty}${displayUnit}`;
}

function handleItemStatusClick(item: OrderItem) {
  let nextStatus: KdsStatus = 'pending';
  if (item.kds_status === 'pending') {
    nextStatus = 'cooking';
  } else if (item.kds_status === 'cooking') {
    nextStatus = 'done';
  } else if (item.kds_status === 'done') {
    nextStatus = 'pending';
  }
  emit('update-status', { itemId: item.id, status: nextStatus });
}

function handleBulkStatus(status: KdsStatus) {
  emit('bulk-status', { orderId: props.order.id, status });
}

function handleServeOrder() {
  emit('serve-order', props.order.id);
}
</script>

<template>
  <div
    :class="[
      'flex flex-col bg-slate-900 rounded-xl sm:rounded-2xl border transition-all duration-300 overflow-hidden relative shadow-lg',
      urgencyClass.border,
      allDone ? 'ring-2 ring-emerald-500/40 bg-slate-900/90' : 'opacity-100',
    ]"
  >
    <div
      :class="[
        'px-3.5 sm:px-4 py-2.5 sm:py-3 border-b flex items-start justify-between gap-2.5',
        urgencyClass.header,
      ]"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
          <div
            :class="[
              'inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-lg border font-black text-[10px] sm:text-xs tracking-wider shrink-0 uppercase',
              orderTypeInfo.badgeClass,
            ]"
          >
            <ShoppingBag v-if="orderTypeInfo.isTakeaway" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <Bike v-else-if="orderTypeInfo.isDelivery" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <UtensilsCrossed v-else class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{{ orderTypeInfo.label }}</span>
          </div>

          <span
            v-if="order.table_number && (order.order_type === 'takeaway' || order.order_type === 'delivery')"
            class="text-[10px] sm:text-xs text-slate-400 font-mono"
          >
            Ref: {{ order.table_number }}
          </span>
        </div>

        <div class="font-black text-slate-100 text-base sm:text-lg leading-tight truncate tracking-tight">
          {{ order.customer_name }}
        </div>

        <div class="flex items-center gap-1 text-[11px] sm:text-xs text-slate-400 mt-0.5">
          <Users class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          <span>{{ order.pax }} Orang</span>
        </div>
      </div>

      <div class="flex flex-col items-end shrink-0">
        <div
          :class="[
            'flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-black tracking-tight',
            urgencyClass.badge,
          ]"
        >
          <Clock class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{{ elapsedMinutes }} mnt</span>
        </div>
        <span class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-mono font-medium">
          {{ orderTime }}
        </span>
      </div>
    </div>

    <div class="w-full bg-slate-800 h-1 sm:h-1.5">
      <div
        class="h-full transition-all duration-500"
        :class="allDone ? 'bg-emerald-500' : hasCooking ? 'bg-sky-500' : 'bg-amber-500'"
        :style="{ width: `${progress.percent}%` }"
      ></div>
    </div>

    <div class="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 flex-1 overflow-y-auto max-h-[340px] sm:max-h-[380px] lg:max-h-[440px]">
      <div
        v-for="item in order.order_items"
        :key="item.id"
        :class="[
          'p-2.5 sm:p-3 rounded-xl border transition-all duration-200 relative flex flex-col gap-1.5 sm:gap-2',
          item.is_addon
            ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
            : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600',
          item.kds_status === 'done' ? 'opacity-50' : 'opacity-100',
        ]"
      >
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-start gap-2 min-w-0">
            <span
              :class="[
                'px-1.5 sm:px-2 min-w-8 sm:min-w-10 h-7 sm:h-8 rounded-lg flex items-center justify-center font-extrabold text-xs sm:text-sm shrink-0 transition-colors',
                item.kds_status === 'done'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : item.kds_status === 'cooking'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-amber-500 text-slate-950 font-black',
              ]"
            >
              {{ formatQty(item.qty, item.unit) }}
            </span>

            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  :class="[
                    'font-bold text-xs sm:text-sm leading-snug break-words',
                    item.kds_status === 'done'
                      ? 'line-through text-slate-400'
                      : 'text-slate-100',
                  ]"
                >
                  {{ item.menu_name }}
                </span>

                <span
                  v-if="item.is_addon"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase bg-rose-500 text-white shadow-sm shadow-rose-900/50 animate-bounce"
                >
                  <Flame class="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-white" />
                  TAMBAHAN BARU
                </span>
              </div>

              <div
                v-if="item.notes"
                class="mt-1 text-[11px] sm:text-xs text-amber-300/90 italic bg-amber-500/10 border-l-2 border-amber-400 px-2 py-0.5 rounded-r"
              >
                "{{ item.notes }}"
              </div>
            </div>
          </div>

          <button
            @click="handleItemStatusClick(item)"
            :class="[
              'px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold tracking-tight shrink-0 flex items-center gap-1 sm:gap-1.5 transition-all active:scale-95 shadow-sm touch-manipulation',
              item.kds_status === 'pending'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : item.kds_status === 'cooking'
                ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-900/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40',
            ]"
            :title="'Ubah status item'"
          >
            <span v-if="item.kds_status === 'pending'" class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-900 animate-ping"></span>
              Antrean
            </span>
            <span v-else-if="item.kds_status === 'cooking'" class="flex items-center gap-1">
              <Flame class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-pulse" />
              Dimasak
            </span>
            <span v-else class="flex items-center gap-1">
              <CheckCircle2 class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              Selesai
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="px-3 sm:px-4 py-2 sm:py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2 mt-auto">
      <div class="text-[11px] sm:text-xs font-semibold text-slate-400">
        Progress:
        <span :class="allDone ? 'text-emerald-400 font-bold' : 'text-slate-200 font-bold'">
          {{ progress.done }} / {{ progress.total }}
        </span>
      </div>

      <div v-if="currentAction === 'sajikan'" class="flex items-center gap-1 sm:gap-1.5">
        <button
          @click="handleBulkStatus('cooking')"
          class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs"
          title="Kembalikan semua ke status Dimasak"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>

        <button
          @click="handleServeOrder"
          class="text-xs font-black px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 animate-pulse"
        >
          <Send class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950" />
          <span>Sajikan</span>
        </button>
      </div>

      <button
        v-else-if="currentAction === 'masak_semua'"
        @click="handleBulkStatus('cooking')"
        class="text-xs font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
      >
        <Flame class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Masak Semua</span>
      </button>

      <button
        v-else-if="currentAction === 'selesai_semua'"
        @click="handleBulkStatus('done')"
        class="text-xs font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
      >
        <CheckCircle2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Selesai Semua</span>
      </button>
    </div>
  </div>
</template>
