export interface ISignature {
  [key: string | number]: string;
}

export interface IInvestDocumentSign {
  sign_url?: string;
  expires_at?: number;
  signing_redirect_url?: string;
  test_mode?: boolean;
  entity_id?: string;
}
