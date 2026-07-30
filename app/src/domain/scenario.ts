export const implementedScenarios = ['A1','A2','A3','A4','A5','A7','A8','B1','B2','B3','H1','H2','H3'] as const;
export type ScenarioId = typeof implementedScenarios[number];
