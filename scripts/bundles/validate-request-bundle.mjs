import { runBundleValidationCli } from './lib/bundle-cli.mjs';
process.exitCode = await runBundleValidationCli({ kind: 'request_bundle', argv: process.argv.slice(2), stdout: process.stdout, stderr: process.stderr });
