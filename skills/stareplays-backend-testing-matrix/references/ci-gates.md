# CI Gates

- go test ./... must pass.
- race test for critical packages should pass.
- lints and formatting should pass.
- changed API behavior must update docs.
- performance-sensitive diffs require at least smoke benchmark evidence.
