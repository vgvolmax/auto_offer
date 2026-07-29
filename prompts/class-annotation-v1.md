# Class-specific annotation prompt v1

Return one JSON object that conforms to the supplied class-specific schema. Extract only facts present in the source text. Use `unknown_fields` for missing required facts and `ambiguities` for multiple plausible interpretations. Every AI-derived value needs RFC 6901 evidence.

Never return `product_id`, `offer_id`, `match_level`, similarity scores, or matching decisions. For catalog items, never copy, normalize, repair, or assess GTIN or supplier SKU; those identifiers are imported deterministically outside the AI annotation.
