export const cityRule = { onlyLetters: true, title: 'city', type: 'string', minLength: 2 };
export const stateRule = { onlyLetters: true, title: 'state', type: 'string', maxLength: 2, minLength: 2 };
export const countryRule = { mustBeUS: true, title: 'country', minLength: 2 };
export const countryRuleObject = { mustBeUS: true, title: 'country', minLength: 2 };
export const zipRule = { title: 'zip_code', type: 'string', zipRegex: true };
export const ssnRule = { maxLength: 9, minLength: 9, title: 'ssn', type: 'string' };
export const phoneRule = { title: 'phone', type: 'string', minLength: 11 };
export const address1Rule = { title: 'address1', type: 'string', minLength: 4 };
export const address2Rule = { title: 'address2', type: 'string', minLength: 3 };
export const dobRule = {
  title: 'dob', type: 'string', format: 'date', underAge: true, dateInFuture: true,
  errorMessage: { format: 'Please provide a valid date DD.MM.YYYY' },
};
export const middleNameRule = { title: 'middle_name', type: 'string', minLength: 2 };
export const lastNameRule = { title: 'last_name', type: 'string', minLength: 2 };
export const firstNameRule = { title: 'first_name', type: 'string', minLength: 2 };
export const passwordRule = { minLength: 8, type: 'string' };
export const codeRule = {};
export const citizenshipRule = { mustBeCitizen: true, title: 'citizenship', type: 'string', minLength: 3 };
export const emailRule = {
  type: 'string', format: 'email', maxLength: 100,
  errorMessage: { format: 'Please provide a valid email' },
};
export const descriptionFileRule = { minLength: 10, type: 'string' };
export const noteFileRule = { minLength: 10, type: 'string' };
export const accountHolderNameRule = { type: 'string', minLength: 4 };
export const accountTypeRule = { type: 'string' };
export const accountNumberRule = { type: 'string', minLength: 9, maxLength: 18 };
export const routingNumbeRuler = { type: 'string', minLength: 9 };
export const relationshipTypeRule = { type: 'string', minLength: 2 };
export const typeProfileRule = { type: 'string', minLength: 3 };
export const identificationTypeRule = { type: 'string', minLength: 3 };
export const identificationNumberRule = { minLength: 3 };
export const documentRule = { errorMessage: { minimum: 'Please provide a document' } };
export const errorMessageRule = { required: 'Please complete' };
