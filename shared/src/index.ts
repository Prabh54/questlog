/**
 * @questlog/shared — the API contract.
 *
 * Request schemas are used by the API's validate() middleware and by the web
 * app's forms; response schemas describe the JSON wire format (dates are ISO
 * strings), are checked against real responses in the API's contract tests,
 * and generate the OpenAPI spec served at /docs.
 */
export * from './schemas/common';
export * from './schemas/auth';
export * from './schemas/category';
export * from './schemas/quest';
export * from './schemas/entry';
export * from './schemas/analytics';
