import type {ValidationResult} from '../domain/validation';
import {validateRequestBundle as validateSharedRequestBundle} from '../../../scripts/bundles/lib/bundle-validator.mjs';
import {createBrowserValidationContext} from './create-browser-validation-context';

export function validateRequestBundle(bundle:unknown):ValidationResult {
  return validateSharedRequestBundle(bundle,createBrowserValidationContext());
}
