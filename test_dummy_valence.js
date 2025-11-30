import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

function testDummyHydrogen() {
    console.log('--- Testing Hydrogen Addition with Dummy Atoms ---');

    // Case 1: Simple Methyl with Dummy [*]C
    // C should have 3 Hydrogens (valence 4 - 1 bond to *)
    const smiles1 = '[*]C';
    console.log(`\nCase 1: ${smiles1}`);
    try {
        const mol = OCL.Molecule.fromSmiles(smiles1);
        console.log(`Initial Atom Count: ${mol.getAllAtoms()}`);

        mol.addImplicitHydrogens();
        console.log(`After addImplicitHydrogens: ${mol.getAllAtoms()} atoms`);

        // Check atoms
        for (let i = 0; i < mol.getAllAtoms(); i++) {
            console.log(`Atom ${i}: ${mol.getAtomLabel(i)} (AtomicNo: ${mol.getAtomicNo(i)})`);
        }

        // Check formula
        console.log(`Formula: ${mol.getMolecularFormula().formula}`);

    } catch (e) {
        console.error(e.message);
    }

    // Case 2: User Example [*]CCC1=C(CCCC)C=CC=C1
    const smiles2 = '[*]CCC1=C(CCCC)C=CC=C1';
    console.log(`\nCase 2: ${smiles2}`);
    try {
        const mol = OCL.Molecule.fromSmiles(smiles2);
        const initialCount = mol.getAllAtoms();
        console.log(`Initial Atom Count: ${initialCount}`);

        mol.addImplicitHydrogens();
        const finalCount = mol.getAllAtoms();
        console.log(`After addImplicitHydrogens: ${finalCount} atoms`);
        console.log(`Added ${finalCount - initialCount} hydrogens`);
        console.log(`Formula: ${mol.getMolecularFormula().formula}`);

    } catch (e) {
        console.error(e.message);
    }

    // Case 3: Replacement Strategy Test (Replace * with [2H], add H)
    console.log(`\nCase 3: Replacement Strategy ([2H] instead of *)`);
    try {
        const smiles3 = '[2H]CCC1=C(CCCC)C=CC=C1'; // Replaced [*] with [2H]
        const mol = OCL.Molecule.fromSmiles(smiles3);
        mol.addImplicitHydrogens();
        console.log(`Formula with [2H]: ${mol.getMolecularFormula().formula}`);
        console.log(`Atom Count with [2H]: ${mol.getAllAtoms()}`);

        const molfile = mol.toMolfile();
        console.log('Full Molfile for [2H] case:');
        console.log(molfile);

    } catch (e) {
        console.error(e.message);
    }
}

testDummyHydrogen();
