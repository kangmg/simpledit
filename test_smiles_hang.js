import OCL from 'openchemlib';
import { rdkitManager } from './src/managers/rdkitManager.js';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

// Mock window for RDKit loader
global.window = {};

async function testHangAndValence() {
    console.log('--- Testing SMILES Import Hang and Valence ---');
    const smiles = '[*]CCC1=C(CCCC)C=CC=C1';
    console.log(`Target SMILES: ${smiles}`);

    // 1. Test OCL Import
    console.log('\n[Test 1] OCL Import');
    try {
        const mol = OCL.Molecule.fromSmiles(smiles);
        console.log('OCL.Molecule.fromSmiles success');
        const molfile = mol.toMolfile();
        console.log('OCL Molfile generated');

        // Check for dummy atom symbol
        if (molfile.includes(' A ')) console.log('OCL uses "A" for dummy atom');
        if (molfile.includes(' * ')) console.log('OCL uses "*" for dummy atom');

        // Test Hydrogen Addition in OCL
        console.log('Attempting OCL addImplicitHydrogens...');
        mol.addImplicitHydrogens();
        console.log('OCL addImplicitHydrogens success');
        console.log('Formula:', mol.getMolecularFormula().formula);

    } catch (e) {
        console.error('OCL Error:', e.message);
    }

    // 2. Test RDKit Fallback (Simulating the hang)
    console.log('\n[Test 2] RDKit Import (Simulating Fallback)');
    try {
        // We need to mock the RDKit loading part or assume it's available if we run this in node with appropriate setup
        // Since we can't easily run WASM in this simple node script without the actual wasm file and loader,
        // we might skip actual RDKit execution if it's too complex to setup here.
        // However, we can check if the logic *reaches* here.

        console.log('Skipping actual RDKit WASM execution in this test script due to environment limitations.');
        console.log('If OCL failed above, the code would try RDKit.');

    } catch (e) {
        console.error('RDKit Error:', e.message);
    }
}

testHangAndValence();
