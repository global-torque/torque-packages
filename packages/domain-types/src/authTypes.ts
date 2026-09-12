interface IAuthenticationMethods {
  method: string;
  completed_at: string;
}

interface IDevice {
  id: string;
  ip_address: string;
  user_agent: string;
  location: string;
}

interface IIdentityTraits {
  email: string;
  first_name?: string;
  last_name?: string;
  name?: {
    first: string;
    last: string;
  };
}

interface IIdentityVerifiableAddresses {
  id: string;
  value: string;
  verified: boolean;
  via: string;
}

interface IIdentityRecoveryAddresses {
  id: string;
  value: string;
  via: string;
}

interface IIdentity {
  id: string;
  schema_id: string;
  schema_url: string;
  state: string;
  state_changed_at: string;
  traits: IIdentityTraits;
  verifiable_addresses: IIdentityVerifiableAddresses[];
  recovery_addresses: IIdentityRecoveryAddresses[];
}

export interface ISession {
  active: boolean;
  authenticated_at: string;
  authenticator_assurance_level: string;
  authentication_methods: IAuthenticationMethods[];
  devices: IDevice[];
  expires_at: string;
  id: string;
  identity: IIdentity;
  issued_at: string;
  tokenized: string;
}

interface IError {
  debug: string;
  error: string;
  error_description: string;
  id: string;
  message: string;
  status_code: number;
}

export interface IErrorGeneric {
  error: IError;
  redirect_browser_to?: string;
}

interface IUIAttribute {
  name: string;
  type: string;
  value: string;
  required: boolean;
  disabled: boolean;
  node_type: string;
}

interface IUIMessage {
  id: number;
  text: string;
  type: string;
}

interface IUIMeta {
  label: {
    id: number;
    text: string;
    type: string;
  };
}

interface IUINode {
  type: string;
  group: string;
  attributes: IUIAttribute;
  messages: IUIMessage[];
  meta: IUIMeta;
}

interface IUI {
  action: string;
  method: string;
  nodes: IUINode[];
}

interface IContinueWith {
  action: string;
  redirect_browser_to: string;
}

export interface IAuthFlow {
  id: string;
  continue_with?: IContinueWith[];
  identity?: IIdentity;
  type: string;
  active: string;
  created_at?: string;
  expires_at: string;
  updated_at?: string;
  issued_at: string;
  request_url: string;
  ui: IUI;
  oauth2_login_challenge?: string;
  oauth2_login_request?: object;
  organization_id?: string;
  refresh?: boolean;
  requestred_aal?: string;
  return_to: string;
  session_token_exchange_code?: string;
  state: unknown;
  transient_payload: object;
}

export interface ILogoutFlow {
  logout_url: string;
  logout_token: string;
}

export interface ISuccessfullNativeAuth {
  session: ISession;
  session_token: string;
  identity?: IIdentity;
  continue_with?: IContinueWith[];
}

export interface ISchema {
  id: string;
  schema: string;
  url: string;
}
