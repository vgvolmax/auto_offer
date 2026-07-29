# Annotation bundle contracts

Bundle schema version **1.0.0** wraps the existing annotation schema version **1.1.0** and production taxonomy **1.0.0**. A catalog bundle represents exactly one source price list; multiple price lists use multiple bundles. A request bundle represents one request.

Catalog source fields are kept separate from the catalog item annotation so original SKUs, GTINs, prices, units, and raw columns remain faithful source data rather than AI-generated values. Class-specific annotation is checked through the existing production catalog dispatcher and request-document contract, followed by the existing semantic validator.

Validate files with `npm run validate:catalog-bundle -- <file>` or `npm run validate:request-bundle -- <file>`. Exit status 0 means valid, 1 means invalid user data, and 2 means usage, file-read, or JSON parsing failure.

Finished real catalog bundles may be stored in `data/catalogs/`. These contracts neither authorize nor automatically run AI annotation, prompts, kits, spreadsheet parsing, or matching.
