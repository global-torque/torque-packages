import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';
import { AccreditationTypes } from '@webdevelop-pro/domain-types/accreditationTypes';
import { useAccreditationAlert } from '../useAccreditationAlert.ts';

const selectedUserProfileData = ref<any>(null);
const isSelectedProfileLoading = ref(false);
const accreditationStoreLoading = ref(false);
const onClick = vi.fn();
const onAlertDescriptionClick = vi.fn();

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => store,
  };
});

vi.mock('@webdevelop-pro/invest-runtime/profiles', () => ({
  useProfilesStore: () => ({
    selectedUserProfileData,
    isSelectedProfileLoading,
  }),
}));

vi.mock('../../store/useAccreditationStatus.ts', () => ({
  useAccreditationStatus: () => ({
    isLoading: accreditationStoreLoading,
    onClick,
    onAlertDescriptionClick,
  }),
}));

describe('useAccreditationAlert', () => {
  beforeEach(() => {
    selectedUserProfileData.value = null;
    isSelectedProfileLoading.value = false;
    accreditationStoreLoading.value = false;
    onClick.mockReset();
    onAlertDescriptionClick.mockReset();
  });

  it('returns a hidden alert model when the profile is not ready for accreditation messaging', () => {
    selectedUserProfileData.value = {
      id: 42,
      isKycApproved: false,
      isAccreditationApproved: false,
      accreditation_status: AccreditationTypes.new,
    };

    const api = useAccreditationAlert();

    expect(api.isDataLoading.value).toBe(false);
    expect(api.alertModel.value).toEqual({
      show: false,
      variant: 'error',
      title: 'Verify Accreditation',
      description: 'Complete your accreditation verification for this profile.',
      buttonText: 'Verify Accreditation',
      isLoading: false,
      isDisabled: false,
    });
  });

  it('returns an info alert without a CTA for pending accreditation reviews', () => {
    selectedUserProfileData.value = {
      id: 42,
      isKycApproved: true,
      isAccreditationApproved: false,
      accreditation_status: AccreditationTypes.pending,
    };
    accreditationStoreLoading.value = true;

    const api = useAccreditationAlert();

    expect(api.alertModel.value).toEqual({
      show: true,
      variant: 'info',
      title: 'Verification In Progress',
      description: 'Please wait while our legal team will review your documents. The process may take 2-4 days. We will notify you automatically once we have more information.',
      buttonText: undefined,
      isLoading: true,
      isDisabled: false,
    });
  });

  it('marks profile loading only while the selected profile is still unresolved', () => {
    isSelectedProfileLoading.value = true;

    const api = useAccreditationAlert();

    expect(api.isDataLoading.value).toBe(true);

    selectedUserProfileData.value = {
      id: 42,
      isKycApproved: true,
      isAccreditationApproved: false,
      accreditation_status: AccreditationTypes.info_required,
    };

    expect(api.isDataLoading.value).toBe(false);
    expect(api.onPrimaryAction).toBe(onClick);
    expect(api.onDescriptionAction).toBe(onAlertDescriptionClick);
  });
});
