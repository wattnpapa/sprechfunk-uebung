### Sprechfunk Übungsgenerator - Developer Guidelines

#### 1. Build & Configuration

The project is built using **TypeScript** and **Rollup**.

- **Dependencies**: Install via `npm install`.
- **Build**: Run `npm run build` to compile the project. The output is generated in the `dist/` directory, including copied assets and static files (`index.html`, `style.css`, etc.).
- **Development**:
    - `npm run dev`: Starts a watch mode that recompiles on changes and serves the project locally.
    - `npm run start`: Performs a full build and starts the local server.
- **Environment**: The project is designed to run in a web environment. Configuration for external services like Firebase is located in `src/firebase-config.js` (copied to `dist/` during build).

#### 2. Testing

Currently, the project does not have a formal automated testing suite integrated into `package.json`. However, core logic resides in `src/FunkUebung.ts` and can be tested by instantiating the class and invoking its methods.

##### How to add and run tests
For new logic, it is recommended to create standalone test scripts that can be run with `node` or `ts-node`.

**Example Test Process**:
1. Create a test script (e.g., `test_distribution.js`).
2. Mock or instantiate the `FunkUebung` class.
3. Assert the expected state after calling `erstelle()`.

**Simple Test Example**:
```javascript
// simple_test.js
function testExerciseGeneration() {
    console.log("Starting test...");
    
    // Minimal mock of the FunkUebung logic
    const uebung = {
        teilnehmerListe: ["Unit 1", "Unit 2"],
        funksprueche: ["Msg A", "Msg B"],
        nachrichten: {},
        erstelle() {
            this.nachrichten = {};
            this.teilnehmerListe.forEach((t, i) => {
                this.nachrichten[t] = [{ id: i, empfaenger: [t], nachricht: this.funksprueche[i] }];
            });
        }
    };
    
    uebung.erstelle();
    
    if (Object.keys(uebung.nachrichten).length === 2) {
        console.log("✓ Test PASSED: Messages distributed to all participants.");
    } else {
        console.log("✗ Test FAILED: Distribution mismatch.");
        process.exit(1);
    }
}

testExerciseGeneration();
```
Run with: `node simple_test.js`

#### 3. Development Information

- **Architecture**:
    - `src/app.ts`: Main entry point and UI logic.
    - `src/FunkUebung.ts`: Core business logic for exercise generation and message distribution.
    - `src/pdf/`: Contains PDF generation logic using `jspdf`.
- **Code Style**:
    - The project uses TypeScript for type safety.
    - Variable and method names are mostly in German (e.g., `teilnehmerListe`, `erstelle`), following the domain language of the THW/civil protection.
    - Asynchronous operations are handled via Promises (e.g., file reading).
- **Asset Management**:
    - Radio message templates are stored in `assets/funksprueche/` as `.txt` files.
- **PDF Generation**:
    - Custom templates for various forms (Meldevordruck, Nachrichtenvordruck) are implemented in `src/pdf/`. Check `BasePDF.ts` for the base class.
