import OCL from 'openchemlib';

console.log('=== Debug Hydrogen Display Issue ===\n');

// Test case: Simple benzene with hydrogens
const mol = OCL.Molecule.fromSmiles('c1ccccc1');

console.log('Initial atoms:', mol.getAllAtoms());
console.log('Implicit H on C0:', mol.getImplicitHydrogens(0));

// Simulate the hydrogen addition logic from fileIOManager
const showHydrogens = true;

if (showHydrogens) {
    // Convert existing H to Mass 1
    const currentAtomCount = mol.getAllAtoms();
    for (let i = 0; i < currentAtomCount; i++) {
        if (mol.getAtomicNo(i) === 1) {
            mol.setAtomMass(i, 1);
        }
    }

    // Add implicit H
    const originalCount = currentAtomCount;
    for (let i = 0; i < originalCount; i++) {
        const atomicNo = mol.getAtomicNo(i);
        if (atomicNo !== 1) {
            const implicitH = mol.getImplicitHydrogens(i);
            console.log(`Atom ${i} (AtomicNo=${atomicNo}): ${implicitH} implicit H`);
            for (let h = 0; h < implicitH; h++) {
                const hIdx = mol.addAtom(1);
                mol.addBond(i, hIdx, 1);
                mol.setAtomMass(hIdx, 1);
            }
        }
    }
}

console.log('\nAtoms after adding H:', mol.getAllAtoms());

// Apply labels (showLabels = false)
const showLabels = false;
for (let i = 0; i < mol.getAllAtoms(); i++) {
    const atomicNo = mol.getAtomicNo(i);

    if (!showLabels) {
        // Only set labels for Hydrogens
        if (atomicNo === 1) {
            mol.setAtomCustomLabel(i, "H.");
        }
    }
}

console.log('\nGenerating coordinates...');
mol.inventCoordinates();
console.log('Atoms after inventCoordinates:', mol.getAllAtoms());

if (mol.getAllAtoms() === 0) {
    console.log('\nERROR: All atoms removed!');
} else {
    console.log('\nGenerating SVG...');
    mol.scaleCoords(10.0);
    const svg = mol.toSVG(1200, 900);

    console.log('SVG length:', svg.length);
    console.log('Line count:', (svg.match(/<line/g) || []).length);
    console.log('Text count:', (svg.match(/<text/g) || []).length);
}
