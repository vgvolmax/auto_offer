import {catalogsRepository} from './catalogs-repository';import {sessionsRepository} from './sessions-repository';import {matchRunsRepository} from './match-runs-repository';
export const appRepositories={catalogs:catalogsRepository,sessions:sessionsRepository,matchRuns:matchRunsRepository};
export type AppRepositories=typeof appRepositories;
