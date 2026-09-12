import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';
import { getInvestDataAppLinks } from '@webdevelop-pro/invest-data/service/dataClientConfig';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { useRepositoryOffer } from '../../data/offer.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { composeInvestmentFormSchema, createInvestmentAjv, prepareInvestmentFormData } from '@webdevelop-pro/invest-core/form-validation';
import { useRoute } from 'vitepress';
import type { JSONSchemaType } from 'ajv/dist/types/json-schema';

export type FormModelOfferComment = {
  comment: string;
  offer_id: number;
  related: string;
}

export function useVFormComments(offerId: number) {
  const route = useRoute();
  const urlSignin = getInvestDataAppLinks().signin;

  const offerRepository = useRepositoryOffer();
  const { setOfferCommentState, setOfferCommentOptionsState } = storeToRefs(offerRepository);
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore);

  const errorData = computed(() => (setOfferCommentState.value.error as any)?.data?.responseJson);
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
      offer_id: offerId,
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

  const sendQuestion = async () => {
    onValidate();
    if (!isValid.value) {
      scrollToError('VFormComments');
      return;
    }

    await offerRepository.setOfferComment(model);
    if (setOfferCommentState.value.data?.id) {
      await offerRepository.getOfferComments(offerId);
      model.comment = '';
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
