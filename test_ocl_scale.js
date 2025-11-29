import OCL from 'openchemlib';

console.log('Testing OCL Scaling and H Fix...');

// 1. Test Coordinate Scaling
console.log('--- Coordinate Scaling ---');
const mol = OCL.Molecule.fromSmiles('c1ccccc1');
mol.inventCoordinates();

// Get original bounds
let minX = Infinity, maxX = -Infinity;
for (let i = 0; i < mol.getAllAtoms(); i++) {
    const x = mol.getAtomX(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
}
console.log(`Original Width: ${maxX - minX}`);

// Scale Coordinates by 20x
const scaleFactor = 20;
for (let i = 0; i < mol.getAllAtoms(); i++) {
    mol.setAtomX(i, mol.getAtomX(i) * scaleFactor);
    mol.setAtomY(i, mol.getAtomY(i) * scaleFactor);
}

// Check new bounds
minX = Infinity; maxX = -Infinity;
for (let i = 0; i < mol.getAllAtoms(); i++) {
    const x = mol.getAtomX(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
}
console.log(`Scaled Width: ${maxX - minX}`);

// Generate SVG
const svg = mol.toSVG(1200, 900);
// Check if font-size is present
const fontSizeMatch = svg.match(/font-size="(\d+)"/);
console.log('Font size in SVG:', fontSizeMatch ? fontSizeMatch[1] : 'Not found (using default)');

// Check coordinate magnitude in path
const pathMatch = svg.match(/M\s*([\d.]+),([\d.]+)/);
if (pathMatch) {
    console.log('Sample Path Coord:', pathMatch[1], pathMatch[2]);
}

// 2. Test H Persistence (Existing + Implicit)
console.log('--- H Persistence ---');
const molH = OCL.Molecule.fromSmiles('C'); // Methane
molH.addAtom(1); // Explicit H
molH.addBond(0, 1, 1);

// Convert Existing H to He
const atomCount = molH.getAllAtoms();
for (let i = 0; i < atomCount; i++) {
    if (molH.getAtomicNo(i) === 1) {
        molH.setAtomicNo(i, 2); // Change to He
        molH.setAtomCustomLabel(i, "H");
    }
}

// Add Implicit H as He
const implicitH = molH.getImplicitHydrogens(0); // Should be 3
console.log('Implicit H count:', implicitH);
for (let i = 0; i < implicitH; i++) {
    const hIdx = molH.addAtom(2); // He
    molH.addBond(0, hIdx, 1);
    molH.setAtomCustomLabel(hIdx, "H");
}

console.log('Atoms before invent:', molH.getAllAtoms());
molH.inventCoordinates();
console.log('Atoms after invent:', molH.getAllAtoms());

// Check if all are He (AtomicNo 2) or C (6)
for (let i = 0; i < molH.getAllAtoms(); i++) {
    console.log(`Atom ${i}: No=${molH.getAtomicNo(i)}, Label=${molH.getAtomLabel(i)}`);
}
