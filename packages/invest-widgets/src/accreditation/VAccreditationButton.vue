<script setup lang="ts">
import { Badge } from '@global-torque/ui-primitives/badge';
import { Button } from '@global-torque/ui-primitives/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@global-torque/ui-primitives/tooltip';
import arrowRight from '../icons/images/arrow-right.svg?component';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { useAccreditationButton } from './useAccreditationAlert.ts';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

const { data, tagBackground, onClick } = useAccreditationButton();

defineProps<{
  isLoading?: boolean;
}>();
</script>

<template>
  <Skeleton
    v-if="isLoading"
    class="dashboard-top-info__skeleton"
    :style="{ width: '100px', height: '22px' }"
  />
  <div
    v-else-if="data"
    class="VAccreditationButton v-accreditation-button"
    :class="data.class"
  >
    <Button
      v-if="data.button"
      class="v-accreditation-button__button text-destructive"
      @click="onClick"
      variant="link"
      size="sm"
    >
      <span class="is--gt-tablet-show">
        {{ data.text }}
      </span>
      <span class="is--lt-tablet-show">
        {{ data.mobileText || data.text }}
      </span>
      <arrowRight
        alt="Arrow icon"
        class="v-accreditation-button__button-icon"
      />
    </Button>

    <div
      v-else
      class="v-accreditation-button__tag-wrap"
    >
      <TooltipProvider :delay-duration="100">
        <Tooltip :disabled="!Boolean(data.tooltip)">
          <TooltipTrigger>
            <Badge
              class="v-accreditation-button__tag"
              variant="outline"
              :class="badgeToneClass(tagBackground)"
            >
              <span class="is--gt-tablet-show">
                {{ data.text }}
              </span>
              <span class="is--lt-tablet-show">
                {{ data.mobileText || data.text }}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div class="is--small">
              {{ data.tooltip }}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>

<style lang="scss">
.v-accreditation-button {
  $root: &;

  &__tag-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
  }

  &__button-icon {
    width: 15px;
  }

  &__tag {
    display: block;
  }
}
</style>
