import OCL from 'openchemlib';

console.log('Debugging OCL Hydrogen Addition Failure...');

// Simulate atomsToOCL logic manually
const mol = new OCL.Molecule(100, 100);

// Add a Carbon atom
const cIdx = mol.addAtom(6); // C
mol.setAtomX(cIdx, 0);
mol.setAtomY(cIdx, 0);
mol.setAtomZ(cIdx, 0);

console.log('Atoms before:', mol.getAllAtoms());
console.log('Implicit Hydrogens on C:', mol.getImplicitHydrogens(cIdx));

// Try adding hydrogens
mol.addImplicitHydrogens();
console.log('Atoms after addImplicitHydrogens:', mol.getAllAtoms());

// Test with Benzene-like construction (manual bonds)
const molB = new OCL.Molecule(100, 100);
const atoms = [];
for (let i = 0; i < 6; i++) {
    const idx = molB.addAtom(6);
    atoms.push(idx);
}
// Add bonds
for (let i = 0; i < 6; i++) {
    molB.addBond(atoms[i], atoms[(i + 1) % 6], 1); // Single bonds initially
}

console.log('Benzene (Single Bonds) Atoms before:', molB.getAllAtoms());
molB.addImplicitHydrogens();
console.log('Benzene (Single Bonds) Atoms after:', molB.getAllAtoms());

// What if we set bond orders?
const molB2 = new OCL.Molecule(100, 100);
const atoms2 = [];
for (let i = 0; i < 6; i++) atoms2.push(molB2.addAtom(6));
for (let i = 0; i < 6; i++) {
    const order = (i % 2 === 0) ? 2 : 1; // Kekule
    molB2.addBond(atoms2[i], atoms2[(i + 1) % 6], order);
}
console.log('Benzene (Kekule) Atoms before:', molB2.getAllAtoms());
molB2.addImplicitHydrogens();
console.log('Benzene (Kekule) Atoms after:', molB2.getAllAtoms());

console.log('Done.');
