import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { AccreditationTypes } from '@global-torque/domain-types/accreditationTypes';
import { AccreditationAlerts } from '@global-torque/invest-core/accreditation/status';
import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import { useAccreditationStatus } from '../store/useAccreditationStatus.ts';

export function useAccreditationAlert() {
  const profilesStore = useProfilesStore();
  const { selectedUserProfileData, isSelectedProfileLoading } = storeToRefs(profilesStore as any) as any;
  const accreditationStore = useAccreditationStatus();
  const { isLoading } = storeToRefs(accreditationStore as any) as any;

  const isDataLoading = computed(() => (
    isSelectedProfileLoading.value && !selectedUserProfileData.value?.id
  ));

  const accreditationStatus = computed<AccreditationTypes | null>(
    () => selectedUserProfileData.value?.accreditation_status as AccreditationTypes | undefined ?? null,
  );

  const shouldShow = computed(() => {
    const profile = selectedUserProfileData.value;
    if (!profile || !accreditationStatus.value) return false;
    return profile.isKycApproved && !profile.isAccreditationApproved;
  });

  const variant = computed<'error' | 'info'>(() => (
    accreditationStatus.value === AccreditationTypes.pending ? 'info' : 'error'
  ));

  const alertData = computed(() => (
    accreditationStatus.value ? AccreditationAlerts[accreditationStatus.value] : null
  ));

  const alertModel = computed(() => ({
    show: shouldShow.value,
    variant: variant.value,
    title: alertData.value?.title,
    description: alertData.value?.description,
    buttonText: alertData.value?.button ? 'Verify Accreditation' : undefined,
    isLoading: isLoading.value,
    isDisabled: false,
  }));

  return {
    alertModel,
    isDataLoading,
    onPrimaryAction: accreditationStore.onClick,
    onDescriptionAction: accreditationStore.onAlertDescriptionClick,
  };
}
