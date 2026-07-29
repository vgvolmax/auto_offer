import { generateClassContracts } from './annotation/generate-class-contracts.mjs';
const result = await generateClassContracts();
console.log(`Generated annotation contracts for ${result.classCount} production classes.`);
