## Local Development Workflow

To ensure code quality and consistency, please run the following commands locally before committing any changes:

```bash
npm install         # Install dependencies
npm run lint:check  # Run the linter
npm run tsc         # Compile TypeScript
npm run dev         # Run webpack development build
npm test            # Run tests
```

## Licensing

- The source code in the `src/` directory is licensed under the **GPL-2.0** license.
- The `DecafMUD/` submodule is licensed under the **MIT** license.
