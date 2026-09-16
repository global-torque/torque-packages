<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { Button } from '@global-torque/ui-primitives/button';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
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
                {{ ' ' }}
              <Button
                v-if="canInstall"
                type="button"
                variant="link"
                class="v-pwa-install-prompt__action"
                @click="emit('install')"
              >
                Install
              </Button>
              {{ ' ' }}
              <Button
                type="button"
                variant="link"
                class="v-pwa-install-prompt__action"
                @click="emit('dismiss')"
              >
                {{ canInstall ? 'Not now' : 'Got it' }}
              </Button>
              </AlertDescription>
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

  &__action[data-slot='button'][data-variant='link'] {
    display: inline;
    min-height: 0;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    gap: 0;
    font: inherit;
    line-height: inherit;
    white-space: normal;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    vertical-align: baseline;

    &:hover {
      background: transparent;
    }
  }
}
</style>
