import OCL from 'openchemlib';

// Mock console for the test
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

async function testSmilesImport() {
    console.log('--- Testing SMILES Import with Dummy Atoms and Aromaticity ---');

    const testCases = [
        { name: 'Dummy Atom (*)', smiles: 'C*' },
        { name: 'Dummy Atom in Ring', smiles: 'c1cc(*)ccc1' },
        { name: 'Aromatic Ring (Benzene)', smiles: 'c1ccccc1' },
        { name: 'Problematic Aromatic (Pyridine-like)', smiles: 'n1ccccc1' },
        { name: 'Explicit Dummy', smiles: '[*]C' }
    ];

    for (const test of testCases) {
        console.log(`\nTesting: ${test.name} (${test.smiles})`);
        try {
            const mol = OCL.Molecule.fromSmiles(test.smiles);
            console.log('OCL.Molecule.fromSmiles success');

            const molfile = mol.toMolfile();
            console.log('Generated Molfile (First 5 lines):');
            console.log(molfile.split('\n').slice(0, 5).join('\n'));

            // Check for 'A' or 'X' or '*' in atom block
            const lines = molfile.split('\n');
            let foundDummy = false;
            let foundA = false;
            let foundX = false;
            let foundStar = false;

            // Simple V2000 parsing to check atom symbols
            // Skip header (3 lines) + counts line (1 line) = 4 lines
            // Counts line is usually line 3 (0-indexed)
            let atomCount = 0;
            if (lines.length > 3) {
                const counts = lines[3].trim().split(/\s+/);
                atomCount = parseInt(counts[0]);

                for (let i = 0; i < atomCount; i++) {
                    const line = lines[4 + i];
                    const parts = line.trim().split(/\s+/);
                    const symbol = parts[3];
                    if (symbol === 'A') foundA = true;
                    if (symbol === 'X') foundX = true;
                    if (symbol === '*') foundStar = true;
                    if (['A', 'X', '*'].includes(symbol)) {
                        console.log(`Found atom symbol: ${symbol} at index ${i}`);
                    }
                }
            }

            if (foundA) console.log('RESULT: Found "A" (Any atom?)');
            if (foundX) console.log('RESULT: Found "X"');
            if (foundStar) console.log('RESULT: Found "*"');

        } catch (error) {
            console.error(`ERROR: ${error.message}`);
        }
    }
}

testSmilesImport();
