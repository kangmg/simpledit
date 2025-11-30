import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
};

async function testFluorineSimple() {
    console.log('\n=== Testing Fluorine Trick WITHOUT 3D Generation ===\n');

    // Simple molecule with dummy: C-*
    const inputMolBlock = `Test Mol
Actelion

  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 ?   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
`.trim();

    console.log('Input MolBlock:');
    console.log(inputMolBlock);
    console.log('');

    // Step 1: Parse
    console.log('--- Step 1: Parse MolBlock ---');
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
            mol.setAtomMapNo(i, 0);
            mol.setAtomRadical(i, 0);
            mol.setAtomMass(i, 0);
            console.log(`Converted to Fluorine`);
        }
    }

    // Step 3: Add implicit hydrogens
    console.log('\n--- Step 3: Add Implicit Hydrogens ---');
    console.log(`Before: ${mol.getAllAtoms()} atoms`);

    mol.addImplicitHydrogens();

    console.log(`After: ${mol.getAllAtoms()} atoms`);

    for (let i = 0; i < mol.getAllAtoms(); i++) {
        const atomicNo = mol.getAtomicNo(i);
        const label = mol.getAtomLabel(i);
        console.log(`Atom ${i}: AtomicNo=${atomicNo}, Label=${label}`);
    }

    // Step 4: Revert Fluorine to Dummy
    console.log('\n--- Step 4: Revert Fluorine to Dummy ---');
    dummyIndices.forEach(idx => {
        if (mol.getAtomicNo(idx) === 9) {
            mol.setAtomicNo(idx, 0);
            // Note: setAtomLabel doesn't exist in this OCL version
            // Just setting AtomicNo to 0 should be sufficient for MolBlock export
            console.log(`Reverted index ${idx} to Dummy (AtomicNo 0)`);
        } else {
            console.warn(`Index ${idx} is not Fluorine: ${mol.getAtomicNo(idx)}`);
        }
    });

    // Step 5: Generate final MolBlock
    console.log('\n--- Step 5: Final MolBlock ---');
    const finalMolBlock = mol.toMolfile();
    console.log(finalMolBlock);

    // Count atoms
    let hCount = 0;
    let dummyCount = 0;
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        if (mol.getAtomicNo(i) === 1) hCount++;
        if (mol.getAtomicNo(i) === 0) dummyCount++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total atoms: ${mol.getAllAtoms()}`);
    console.log(`Hydrogens: ${hCount}`);
    console.log(`Dummies: ${dummyCount}`);
    console.log(`Expected: 3 H (on Carbon) + 1 Dummy`);

    if (hCount === 3 && dummyCount === 1) {
        console.log('\n✅ SUCCESS: Hydrogens added correctly!');
    } else if (hCount > 0 && dummyCount === 1) {
        console.log('\n⚠️  PARTIAL: Has hydrogens but not exactly 3');
    } else {
        console.log('\n❌ FAILURE: Missing hydrogens or dummy');
    }
}

testFluorineSimple().catch(e => console.error('Test failed:', e));
