import type {ValidationResult} from '../domain/validation';
import {validateCatalogBundle as validateSharedCatalogBundle} from '../../../scripts/bundles/lib/bundle-validator.mjs';
import {createBrowserValidationContext} from './create-browser-validation-context';

export function validateCatalogBundle(bundle:unknown):ValidationResult {
  return validateSharedCatalogBundle(bundle,createBrowserValidationContext());
}
