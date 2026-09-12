const WALLET_CREATION_REQUIRED_ERROR_FRAGMENTS = [
  'not found',
  'create wallet',
  'wallet registration is incomplete',
];

const getErrorStatusCode = (error: unknown) => {
  const data = (error as {
    data?: {
      statusCode?: unknown;
      status?: unknown;
    };
  } | null | undefined)?.data;

  if (typeof data?.statusCode === 'number') {
    return data.statusCode;
  }

  if (typeof data?.status === 'number') {
    return data.status;
  }

  return undefined;
};

export const isWalletSetupRequiredError = (
  error: unknown,
  options: {
    isKycApproved?: boolean;
    walletData?: unknown;
  } = {},
) => {
  const { isKycApproved = false, walletData } = options;

  const errorTexts = [
    error instanceof Error && typeof error.message === 'string' ? error.message : '',
    error ? String(error) : '',
  ].map((value) => value.toLowerCase());
  const errorStatusCode = getErrorStatusCode(error);

  const isMissingApprovedWallet =
    Boolean(error)
    && walletData === undefined
    && isKycApproved
    && errorStatusCode === 404;

  return isMissingApprovedWallet || WALLET_CREATION_REQUIRED_ERROR_FRAGMENTS.some((fragment) => (
    errorTexts.some((value) => value.includes(fragment))
  ));
};
