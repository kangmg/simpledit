import OCL from 'openchemlib';
import fs from 'fs';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
};

// Load OCL resources
const possiblePaths = [
    'public/lib/openchemlib/forcefield.txt',
    'dist/lib/openchemlib/forcefield.txt',
    'node_modules/openchemlib/dist/forcefield.txt'
];

let loaded = false;
for (const resourcePath of possiblePaths) {
    if (fs.existsSync(resourcePath)) {
        const content = fs.readFileSync(resourcePath, 'utf8');
        OCL.ConformerGenerator.setResource(content);
        console.log(`OCL Resources loaded from: ${resourcePath}`);
        loaded = true;
        break;
    }
}

if (!loaded) {
    console.warn('WARNING: Could not find forcefield.txt. 3D generation will fail.');
}

async function testFluorineTrick() {
    console.log('\n=== Testing Fluorine Trick with Real Workflow ===\n');

    // Simple molecule with dummy: C-*
    // Using proper V2000 format
    const inputMolBlock = `
  Test Mol
Actelion

  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 ?   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
`.trim();

    console.log('Input MolBlock:');
    console.log(inputMolBlock);

    // Step 1: Parse
    console.log('\n--- Step 1: Parse MolBlock ---');
    const mol = OCL.Molecule.fromMolfile(inputMolBlock);
    console.log(`Total atoms: ${mol.getAllAtoms()}`);

    for (let i = 0; i < mol.getAllAtoms(); i++) {
        console.log(`Atom ${i}: AtomicNo=${mol.getAtomicNo(i)}, Label=${mol.getAtomLabel(i)}`);
    }

    // Step 2: Replace Dummy with Fluorine
    console.log('\n--- Step 2: Replace Dummy with Fluorine ---');
    const dummyIndices = [];
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        if (mol.getAtomicNo(i) === 0) {
            console.log(`Found dummy at index ${i}`);
            dummyIndices.push(i);
            mol.setAtomicNo(i, 9); // Fluorine
            console.log(`Converted to Fluorine`);
        }
    }

    // Step 3: Add implicit hydrogens BEFORE 3D generation
    console.log('\n--- Step 3: Add Implicit Hydrogens (Before 3D) ---');
    mol.addImplicitHydrogens();
    console.log(`Total atoms after addImplicitHydrogens: ${mol.getAllAtoms()}`);

    for (let i = 0; i < mol.getAllAtoms(); i++) {
        console.log(`Atom ${i}: AtomicNo=${mol.getAtomicNo(i)}`);
    }

    // Step 4: Generate 3D
    console.log('\n--- Step 4: Generate 3D Coordinates ---');
    const generator = new OCL.ConformerGenerator(42);
    const mol3D = generator.getOneConformerAsMolecule(mol);

    if (!mol3D) {
        console.error('Conformer generation failed!');
        return;
    }

    console.log(`Total atoms after 3D generation: ${mol3D.getAllAtoms()}`);

    for (let i = 0; i < mol3D.getAllAtoms(); i++) {
        console.log(`Atom ${i}: AtomicNo=${mol3D.getAtomicNo(i)}`);
    }

    // Step 5: Check if we need to add hydrogens again
    console.log('\n--- Step 5: Try addImplicitHydrogens on mol3D ---');
    mol3D.addImplicitHydrogens();
    console.log(`Total atoms after addImplicitHydrogens on mol3D: ${mol3D.getAllAtoms()}`);

    for (let i = 0; i < mol3D.getAllAtoms(); i++) {
        console.log(`Atom ${i}: AtomicNo=${mol3D.getAtomicNo(i)}`);
    }

    // Step 6: Revert Fluorine to Dummy
    console.log('\n--- Step 6: Revert Fluorine to Dummy ---');
    dummyIndices.forEach(idx => {
        if (mol3D.getAtomicNo(idx) === 9) {
            mol3D.setAtomicNo(idx, 0);
            mol3D.setAtomLabel(idx, 'X');
            console.log(`Reverted index ${idx} to Dummy`);
        } else {
            console.warn(`Index ${idx} is not Fluorine: ${mol3D.getAtomicNo(idx)}`);
        }
    });

    // Step 7: Generate final MolBlock
    console.log('\n--- Step 7: Final MolBlock ---');
    const finalMolBlock = mol3D.toMolfile();
    console.log(finalMolBlock);

    // Count hydrogens and dummy
    let hCount = 0;
    let dummyCount = 0;
    for (let i = 0; i < mol3D.getAllAtoms(); i++) {
        if (mol3D.getAtomicNo(i) === 1) hCount++;
        if (mol3D.getAtomicNo(i) === 0) dummyCount++;
    }

    console.log(`\nSummary:`);
    console.log(`  Total atoms: ${mol3D.getAllAtoms()}`);
    console.log(`  Hydrogens: ${hCount}`);
    console.log(`  Dummies: ${dummyCount}`);
    console.log(`  Expected: Carbon should have 3 H, Dummy should exist`);

    if (hCount >= 3 && dummyCount === 1) {
        console.log('\n✅ SUCCESS: Fluorine trick works!');
    } else {
        console.log('\n❌ FAILURE: Not enough hydrogens or dummy lost');
    }
}

testFluorineTrick().catch(e => console.error('Test failed:', e));
