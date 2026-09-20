<script setup lang="ts">
defineProps<{
  label: string
  /** px. Unset -> fills the wrapper's cross-size (100%), same as the other axis when also unset. */
  width?: number
  height?: number
  color?: string
  badge?: string
}>()
</script>

<template>
  <div
    class="demo-card"
    :style="{
      width: width ? `${width}px` : '100%',
      height: height ? `${height}px` : '100%',
      background: color,
    }"
  >
    <span class="demo-card-label">{{ label }}</span>
    <span v-if="badge" class="demo-card-badge">{{ badge }}</span>
  </div>
</template>

<style scoped>
.demo-card {
  position: relative;
  border-radius: var(--radius-md);
  display: flex;
  align-items: flex-end;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.demo-card-badge {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.25);
  padding: 2px 6px;
  border-radius: 999px;
}
</style>
