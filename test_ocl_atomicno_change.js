import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

function testOCLAtomicNoChange() {
    console.log('--- Testing OCL AtomicNo Change & Hydrogens ---');

    // Build molecule manually
    let mol = new OCL.Molecule(100, 100);
    const c = mol.addAtom(6); // Carbon
    const dummy = mol.addAtom(0); // Dummy
    mol.setAtomX(c, 0); mol.setAtomY(c, 0);
    mol.setAtomX(dummy, 1.5); mol.setAtomY(dummy, 0);
    mol.addBond(c, dummy, 1); // Single bond

    console.log(`Initial: C(${c}) AtomicNo=${mol.getAtomicNo(c)}, Dummy(${dummy}) AtomicNo=${mol.getAtomicNo(dummy)}`);

    // Change Dummy to Carbon
    console.log('\nChanging Dummy to Carbon...');
    mol.setAtomicNo(dummy, 6);

    // Clear potential flags
    mol.setAtomMapNo(dummy, 0);
    mol.setAtomRadical(dummy, 0);
    mol.setAtomMass(dummy, 0);

    console.log(`After Change: Dummy(1) AtomicNo=${mol.getAtomicNo(dummy)}`);
    console.log(`Implicit H after change: Dummy=${mol.getImplicitHydrogens(dummy)}`);

    // Force clean rebuild using Molfile cycle
    console.log('Cleaning molecule via toMolfile/fromMolfile...');
    mol = OCL.Molecule.fromMolfile(mol.toMolfile());

    // Manual Hydrogen Addition
    console.log('\nAdding Hydrogens Manually...');
    const atomCount = mol.getAllAtoms();
    let addedCount = 0;

    for (let i = 0; i < atomCount; i++) {
        const implicit = mol.getImplicitHydrogens(i);
        if (implicit > 0) {
            console.log(`Atom ${i} needs ${implicit} hydrogens.`);
            for (let h = 0; h < implicit; h++) {
                const hAtom = mol.addAtom(1); // Hydrogen
                mol.addBond(i, hAtom, 1); // Single bond
                addedCount++;
            }
        }
    }
    console.log(`Manually added ${addedCount} hydrogens.`);

    // Force clean rebuild using Molfile cycle AGAIN to fix connectivity
    console.log('Cleaning molecule via toMolfile/fromMolfile (Post-Addition)...');
    const molfile = mol.toMolfile();
    console.log('Generated Molfile:\n', molfile);
    mol = OCL.Molecule.fromMolfile(molfile);

    console.log(`Total Atoms After: ${mol.getAllAtoms()}`);

    // Inspect all atoms
    console.log('\n--- Full Molecule Inspection ---');
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        const atomicNo = mol.getAtomicNo(i);
        const conn = mol.getConnAtoms(i);
        let neighbors = [];
        for (let j = 0; j < conn; j++) {
            neighbors.push(`${mol.getConnAtom(i, j)}(${mol.getAtomicNo(mol.getConnAtom(i, j))})`);
        }
        console.log(`Atom ${i}: AtomicNo=${atomicNo}, Connections=${conn} -> [${neighbors.join(', ')}]`);
    }

    // Check Explicit Hydrogens
    // Note: Indices might shift after cleaning/rebuilding.
    // We need to find the dummy (now Carbon) again.
    // It should be the one connected to the other Carbon.
    // Or we can assume indices 0 and 1 are preserved (usually true).
    const dummyIdx = 1;
    console.log(`\nAtom ${dummyIdx} AtomicNo: ${mol.getAtomicNo(dummyIdx)}`);

    const hCountDummy = countHydrogens(mol, dummyIdx);
    console.log(`Explicit H added to Dummy (now C): ${hCountDummy}`);

    if (hCountDummy === 3) {
        console.log('SUCCESS: Hydrogens added to converted dummy.');
    } else {
        console.log('FAILURE: Hydrogens NOT added to converted dummy.');
    }

    // Check Explicit Hydrogens using Reverse Lookup
    // OCL seems to hide explicit hydrogens from the parent's connection list in some cases?
    // But the child (H) knows its parent.

    console.log(`\n--- Reverse Lookup for Hydrogens on Atom ${dummyIdx} ---`);
    let reverseCount = 0;
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        if (mol.getAtomicNo(i) === 1) { // Hydrogen
            if (mol.getConnAtoms(i) === 1) {
                const parent = mol.getConnAtom(i, 0);
                if (parent === dummyIdx) {
                    console.log(`Hydrogen ${i} is connected to Dummy ${parent}`);
                    reverseCount++;
                }
            }
        }
    }
    console.log(`Reverse Lookup Count: ${reverseCount}`);

    if (reverseCount === 3) {
        console.log('SUCCESS: Hydrogens found via reverse lookup.');
    } else {
        console.log('FAILURE: Hydrogens NOT found via reverse lookup.');
    }
}

function countHydrogens(mol, atomIdx) {
    let count = 0;
    for (let i = 0; i < mol.getConnAtoms(atomIdx); i++) {
        const neighbor = mol.getConnAtom(atomIdx, i);
        if (mol.getAtomicNo(neighbor) === 1) count++;
    }
    return count;
}

testOCLAtomicNoChange();
