import Ajv, { type Options } from 'ajv';
import ajvErrors from 'ajv-errors';
import addFormats from 'ajv-formats';
import {
  CHECKBOX_TRUE_ERROR_MESSAGE, CHECKBOX_TRUE_VALIDATOR_NAME,
  ENUM_NAMES_VALIDATOR_NAME, FUTURE_DATE_ERROR_MESSAGE, FUTURE_DATE_VALIDATOR_NAME,
  MAX_FILE_SIZE_VALIDATOR_NAME, MUST_BE_CITIZEN_ERROR_MESSAGE, MUST_BE_CITIZEN_VALIDATOR_NAME,
  MUST_BE_US_ERROR_MESSAGE, MUST_BE_US_VALIDATOR_NAME, NOT_EMPTY_VALIDATOR_NAME,
  NOT_ZERO_ERROR_MESSAGE, NOT_ZERO_VALIDATOR_NAME, ONLY_LETTERS_ERROR_MESSAGE,
  ONLY_LETTERS_VALIDATOR_NAME, REQUIRED_ERROR_MESSAGE, UNDER_AGE_ERROR_MESSAGE,
  UNDER_AGE_VALIDATOR_NAME, ZIP_REGEX_ERROR_MESSAGE, ZIP_REGEX_VALIDATOR_NAME,
} from './constants.ts';

export interface InvestmentAjvOptions {
  /** Inject a clock for deterministic age and date validation tests. */
  clock?: () => Date;
}

enum CitizenTypes {
  us_citizen = 'U.S. Citizen',
  us_resident = 'U.S. Resident',
  us_non_resident = 'Non Resident',
}

const ONLY_LETTERS_REGEX = /^[A-Za-z\s]*[A-Za-z][A-Za-z\s]*$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

export function createInvestmentAjv(
  options: InvestmentAjvOptions = {},
  ajvOptions: Options = {},
): Ajv {
  const now = options.clock ?? (() => new Date());
  const ajv = new Ajv({ allErrors: true, allowMatchingProperties: true, $data: true, ...ajvOptions });

  ajvErrors(ajv);
  addFormats(ajv, ['date', 'time', 'float', 'email']);
  // Backend schemas use file as an opaque string. Validation of size/content
  // remains a host presentation concern and never weakens backend validation.
  ajv.addFormat('file', { type: 'string', validate: () => true } as any);

  const addKeywordWithMessage = (
    keyword: string,
    validate: (schema: unknown, data: unknown) => boolean,
    message: string,
  ) => {
    ajv.addKeyword({ keyword, validate, error: { message } });
  };

  addKeywordWithMessage(
    NOT_EMPTY_VALIDATOR_NAME,
    (_schema, data) => data !== null && data !== undefined && typeof data === 'string' && data.trim() !== '',
    REQUIRED_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    MUST_BE_CITIZEN_VALIDATOR_NAME,
    (_schema, data) => data === CitizenTypes.us_citizen || data === CitizenTypes.us_resident,
    MUST_BE_CITIZEN_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    MUST_BE_US_VALIDATOR_NAME,
    (_schema, data) => {
      const value = data as any;
      const candidate = String(value && typeof value === 'object' && 'code' in value ? value.code : value).toLowerCase();
      return candidate === 'us';
    },
    MUST_BE_US_ERROR_MESSAGE,
  );
  addKeywordWithMessage(CHECKBOX_TRUE_VALIDATOR_NAME, (_schema, data) => data === true, CHECKBOX_TRUE_ERROR_MESSAGE);
  addKeywordWithMessage(
    NOT_ZERO_VALIDATOR_NAME,
    (schema, data) => schema ? typeof data === 'number' && data > 0 : true,
    NOT_ZERO_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    ONLY_LETTERS_VALIDATOR_NAME,
    (_schema, data) => typeof data === 'string' && ONLY_LETTERS_REGEX.test(data),
    ONLY_LETTERS_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    ZIP_REGEX_VALIDATOR_NAME,
    (_schema, data) => typeof data !== 'string' || data.length < 5 || ZIP_REGEX.test(data),
    ZIP_REGEX_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    UNDER_AGE_VALIDATOR_NAME,
    (_schema, data) => {
      const birthDate = new Date(data as any);
      const current = now();
      if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > current.getTime()) return true;
      const eighteen = new Date(birthDate.getFullYear() + 18, birthDate.getMonth(), birthDate.getDate());
      return eighteen <= current;
    },
    UNDER_AGE_ERROR_MESSAGE,
  );
  addKeywordWithMessage(
    FUTURE_DATE_VALIDATOR_NAME,
    (_schema, data) => {
      const inputDate = new Date(data as any);
      return Number.isNaN(inputDate.getTime()) || inputDate < now();
    },
    FUTURE_DATE_ERROR_MESSAGE,
  );

  // Legacy presentation annotations stay accepted for compatibility. They
  // carry no file policy and do not alter server or transport validation.
  ajv.addKeyword({ keyword: ENUM_NAMES_VALIDATOR_NAME });
  ajv.addKeyword({ keyword: MAX_FILE_SIZE_VALIDATOR_NAME });
  return ajv;
}
