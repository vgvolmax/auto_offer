import type {SemanticMatchingCatalog,SemanticSelectionPolicy} from '../../../app/src/domain/matching/semantic-types';
export function buildSemanticMatchingCatalog(input:{requestBundle:unknown;catalogs:unknown[];selectionPolicy:SemanticSelectionPolicy;cryptoApi?:Crypto}):Promise<SemanticMatchingCatalog>;
