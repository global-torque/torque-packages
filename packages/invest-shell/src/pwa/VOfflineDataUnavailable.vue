<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  detail?: string;
}>();
</script>

<template>
  <section
    class="VOfflineDataUnavailable v-offline-data-unavailable"
    role="status"
    aria-live="polite"
    data-testid="offline-data-unavailable"
  >
    <div class="v-offline-data-unavailable__eyebrow">
      Offline
    </div>
    <h3 class="v-offline-data-unavailable__title is--h3__title">
      {{ title }}
    </h3>
    <p class="v-offline-data-unavailable__message is--body-1">
      {{ message }}
    </p>
    <p
      v-if="detail"
      class="v-offline-data-unavailable__detail is--body-2"
    >
      {{ detail }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.v-offline-data-unavailable {
  padding: 32px 24px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 70%, transparent);
  border-radius: 20px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--background) 98%, transparent) 0%, color-mix(in srgb, var(--muted) 92%, transparent) 100%);
  box-shadow: 0 18px 40px color-mix(in srgb, var(--foreground) 6%, transparent);

  &__eyebrow {
    margin-bottom: 12px;
    color: var(--color-text-meta);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0 0 12px;
  }

  &__message {
    margin: 0;
    color: var(--color-surface-inverse-muted);
  }

  &__detail {
    margin: 12px 0 0;
    color: var(--color-text-meta);
  }

  @media screen and (width <= 768px) {
    padding: 24px 20px;
    border-radius: 16px;
  }
}
</style>
