<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { Button } from '@global-torque/ui-primitives/button';
import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import { InfoIcon } from '@lucide/vue';

const brandName = useInvestApplicationContext().appConfig.brand.pwaName!;

defineProps<{
  canInstall: boolean;
  installState: 'hidden' | 'native' | 'manual-ios';
}>();

const emit = defineEmits<{
  install: [];
  dismiss: [];
}>();
</script>

<template>
  <div
    v-if="installState !== 'hidden'"
    class="VPwaInstallPrompt v-pwa-install-prompt"
    data-testid="pwa-install-prompt"
  >
    <Alert
      class="v-pwa-install-prompt__alert">
      <InfoIcon />
      <div class="v-pwa-install-prompt__content">
              <AlertTitle>
              {{ canInstall ? 'Install app' : 'Add to Home Screen' }}
              </AlertTitle>
              <AlertDescription>
                {{
                  canInstall
                    ? `Install ${brandName} for faster launch, standalone navigation, and a more native app experience.`
                    : `On iPhone or iPad, open the Share menu in Safari and choose "Add to Home Screen" to install ${brandName}.`
                }}
              </AlertDescription>
            </div>
            <div class="v-pwa-install-prompt__actions">
              <Button
                v-if="canInstall"
                @click="emit('install')"
                size="sm"
              >
                Install
              </Button>
              <Button
                :variant="canInstall ? 'outline' : 'secondary'"
                @click="emit('dismiss')"
                size="sm"
              >
                {{ canInstall ? 'Not now' : 'Got it' }}
              </Button>
            </div>
    </Alert>
  </div>
</template>

<style scoped lang="scss">
.v-pwa-install-prompt {
  width: 100%;

  &__alert {
    width: 100%;
    margin: 0;
  }

  &__content {
    min-width: 0;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }
}
</style>
