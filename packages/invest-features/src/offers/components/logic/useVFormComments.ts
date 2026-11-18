import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { getInvestDataAppLinks } from '@global-torque/invest-data/service/dataClientConfig';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useRepositoryOffer } from '../../data/offer.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { composeInvestmentFormSchema, createInvestmentAjv, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import { useRoute } from 'vitepress';
import type { JSONSchemaType } from 'ajv/dist/types/json-schema';
import type { IOfferComment } from '@global-torque/domain-types/offerTypes';

export type FormModelOfferComment = {
  content_type: 'offer.offer';
  object_id: string;
  comment: string;
  related: string;
}

export function useVFormComments(offerId: number) {
  const route = useRoute();
  const urlSignin = getInvestDataAppLinks().signin;

  const offerRepository = useRepositoryOffer();
  const { setOfferCommentState, setOfferCommentOptionsState } = storeToRefs(offerRepository);
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore);

  const isSubmitting = ref(false);
  const submitError = ref<Error | null>(null);
  const errorData = computed(() => (submitError.value as any)?.data?.responseJson);
  const schemaBackend = computed(() => (
    setOfferCommentOptionsState.value.data as JSONSchemaType<FormModelOfferComment> | undefined
  ));
  const schemaFrontend = computed(() => ({
    type: 'object',
    properties: {},
    required: [],
  }) as unknown as JSONSchemaType<FormModelOfferComment>);

  const fieldsPaths = ['comment', 'related'];

  const {
    model,
    validation,
    isValid,
    onValidate,
    schemaObject,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions: getOptionsFromValidation,
  } = useFormValidation<FormModelOfferComment>(
    schemaFrontend,
    schemaBackend,
    {
      content_type: 'offer.offer',
      object_id: String(offerId),
      comment: '',
      related: 'none',
    } as FormModelOfferComment,
    fieldsPaths,
    {
      createAjv: createInvestmentAjv,
      composeSchema: composeInvestmentFormSchema,
      prepareData: prepareInvestmentFormData,
    }
  );

  const isDisabledButton = computed(() => (!isValid.value));

  const disclosureCheckbox = ref(false);

  const relatedOptions = computed(() => getOptionsFromValidation('related'));
  const relatedOptionsFormatted = computed(() => (
    relatedOptions.value?.map((option: any) => ({ value: option.value, text: option.name })) || []
  ));
  const relatedOptionsFiltered = computed(() => (
    relatedOptionsFormatted.value.filter((option: any) => option.value !== 'none')
  ));

  const isAuth = computed(() => userLoggedIn.value);

  const sendQuestion = async (): Promise<IOfferComment | undefined> => {
    if (isSubmitting.value) return undefined;
    onValidate();
    if (!isValid.value) {
      scrollToError('VFormComments');
      return;
    }

    submitError.value = null;
    isSubmitting.value = true;
    try {
      const comment = await offerRepository.setOfferComment(model);
      if (comment?.id) {
        model.comment = '';
      }
      return comment;
    } catch (error) {
      submitError.value = error instanceof Error
        ? error
        : new Error(String(error));
      return undefined;
    } finally {
      isSubmitting.value = false;
    }
  };

  const signInHandler = () => {
    const redirect = `${route.path}${window.location.search}${window.location.hash}`;
    navigateWithQueryParams(urlSignin, { redirect });
  };

  watch(() => disclosureCheckbox.value, (value) => {
    if (!value) model.related = 'none';
  });

  return {
    model,
    validation,
    isValid,
    onValidate,
    schemaObject,
    schemaBackend,
    isDisabledButton,
    isSubmitting,
    submitError,
    disclosureCheckbox,
    relatedOptionsFiltered,
    isAuth,
    sendQuestion,
    signInHandler,
    errorData,
    setOfferCommentState,
    setOfferCommentOptionsState,
    
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions: getOptionsFromValidation,
    scrollToError,
  };
}
