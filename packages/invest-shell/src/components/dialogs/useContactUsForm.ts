import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

export interface ContactUsModel {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactUsSubmit = (payload: Readonly<ContactUsModel>) => Promise<void>;

export type ContactSubjectPosition = 'item-aligned' | 'popper';

export interface ContactUsSessionPrefill {
  identityId?: string;
  name?: string;
  email?: string;
}

export const contactUsSubjects = [
  { value: 'investment', label: 'Investment' },
  { value: 'report an issue', label: 'Report an issue' },
  { value: 'i have a question', label: 'I have a question' },
  { value: 'Account deactivation', label: 'Account deactivation' },
  { value: 'other', label: 'Other' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'dashboard verification', label: 'Dashboard verification' },
  { value: 'offers', label: 'Offers' },
  { value: 'dashboard profile details', label: 'Dashboard profile details' },
  { value: 'profile details', label: 'Profile details' },
];

function canonicalSubject(value?: string | null): string {
  return contactUsSubjects.find(item => item.value.toLowerCase() === value?.trim().toLowerCase())?.value ?? '';
}

export function useContactUsForm(options: {
  active: () => boolean;
  subject: () => string | undefined;
  session: () => ContactUsSessionPrefill | undefined;
  submit: ContactUsSubmit;
  accepted: () => void;
  surface: 'dialog' | 'page';
}) {
  const model = reactive<ContactUsModel>({ name: '', email: '', subject: '', message: '' });
  const touched = reactive({ name: false, email: false });
  const pending = ref(false);
  const error = ref('');
  const submitted = ref(false);
  const attempted = ref(false);
  let mounted = false;
  let generation = 0;
  let previousIdentity = options.session()?.identityId;
  let lastPrefilledName = '';

  const hideIdentityFields = computed(() => options.surface === 'dialog' && Boolean(options.session()?.identityId));
  const normalized = computed(() => {
    const identity = hideIdentityFields.value ? options.session() : model;
    return {
      name: identity?.name?.trim() ?? '', email: identity?.email?.trim() ?? '',
      subject: canonicalSubject(model.subject), message: model.message.trim(),
    };
  });
  const errors = computed(() => {
    const value = normalized.value;
    const [firstName, ...lastName] = value.name.split(/\s+/u);
    return {
      name: !hideIdentityFields.value && value.name.length < 2
        ? 'Enter a name with at least two characters.'
        : firstName.length > 100 || lastName.join(' ').length > 100
          ? 'First and last names must each be 100 characters or fewer.'
          : '',
      email: value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.email)
        ? 'Enter a valid email address (up to 254 characters).'
        : '',
      subject: value.subject ? '' : 'Select a subject.',
      message: value.message.length < 10 ? 'Enter a message with at least ten characters.' : '',
    };
  });
  const valid = computed(() => Object.values(errors.value).every(value => !value));
  const identityError = computed(() => hideIdentityFields.value && (errors.value.name || errors.value.email)
    ? 'Your account contact details are missing or invalid. Please email our support team.'
    : '');

  function reset() {
    generation += 1;
    Object.assign(model, { name: '', email: '', subject: '', message: '' });
    Object.assign(touched, { name: false, email: false });
    pending.value = false;
    error.value = '';
    submitted.value = false;
    attempted.value = false;
    lastPrefilledName = '';
  }

  function fillSession() {
    const session = options.session();
    if (!touched.name && (!model.name.trim() || model.name === lastPrefilledName)) {
      model.name = session?.name?.trim() ?? '';
      lastPrefilledName = model.name;
    }
    if (!touched.email && !model.email.trim()) model.email = session?.email?.trim() ?? '';
  }

  function activate() {
    if (!mounted || !options.active()) return;
    const url = new URL(window.location.href);
    if (options.surface === 'page' && url.searchParams.get('popup') === 'contact-us') return;
    reset();
    model.name = url.searchParams.get('name')?.trim() ?? '';
    model.email = url.searchParams.get('email')?.trim() ?? '';
    model.subject = canonicalSubject(options.subject()) || canonicalSubject(url.searchParams.get('subject'));
    model.message = url.searchParams.get('message') ?? '';
    fillSession();
    const keys = ['name', 'email', 'subject', 'message'];
    if (keys.some(key => url.searchParams.has(key))) {
      keys.forEach(key => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  watch(options.active, (active) => {
    if (active) activate();
    else reset();
  }, { flush: 'sync' });
  watch(options.session, (session) => {
    const identity = session?.identityId;
    if (previousIdentity && previousIdentity !== identity) {
      reset();
      model.subject = canonicalSubject(options.subject());
    }
    else if (hideIdentityFields.value && !previousIdentity) {
      generation += 1;
      pending.value = false;
      error.value = '';
      submitted.value = false;
    }
    previousIdentity = identity;
    if (mounted && options.active()) fillSession();
  }, { deep: true, flush: 'sync' });

  onMounted(() => {
    mounted = true;
    activate();
  });
  onUnmounted(() => {
    mounted = false;
    reset();
  });

  async function submit() {
    if (!mounted || !options.active() || pending.value) return;
    attempted.value = true;
    if (!valid.value) return;
    const current = ++generation;
    const payload = Object.freeze({ ...normalized.value });
    pending.value = true;
    error.value = '';
    submitted.value = false;
    try {
      await options.submit(payload);
      if (!mounted || !options.active() || current !== generation) return;
      reset();
      submitted.value = true;
      options.accepted();
    }
    catch {
      if (mounted && options.active() && current === generation) {
        error.value = 'Your message could not be submitted. Please try again or email our support team.';
      }
    }
    finally {
      if (current === generation) pending.value = false;
    }
  }

  return {
    model, normalized, hideIdentityFields, identityError, touched,
    pending, error, submitted, attempted, errors, valid, submit,
  };
}
