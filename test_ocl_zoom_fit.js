import OCL from 'openchemlib';

console.log('Debugging OCL Zoom/Fit and H Visibility...');

// 1. Test Hydrogen Visibility - Manual Addition Strategy
console.log('--- Hydrogen Visibility (Manual) ---');
const mol = OCL.Molecule.fromSmiles('C');
mol.inventCoordinates(); // Layout C first

// Manually add H atoms and bonds
const cIdx = 0;
for (let i = 0; i < 4; i++) {
    const hIdx = mol.addAtom(1); // H
    mol.addBond(cIdx, hIdx, 1); // Single bond
    mol.setAtomCustomLabel(hIdx, "H:" + i);
}

console.log('Atoms before invent (Manual):', mol.getAllAtoms());
mol.inventCoordinates();
console.log('Atoms after invent (Manual):', mol.getAllAtoms());

// 2. Test Zoom/Fit - Check Bounding Box
console.log('--- Zoom/Fit (Bounding Box) ---');
const mol2 = OCL.Molecule.fromSmiles('c1ccccc1');
mol2.inventCoordinates();

// Get bounding box?
// OCL doesn't expose getBoundingBox directly in Node?
// Let's check atom coordinates range
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let i = 0; i < mol2.getAllAtoms(); i++) {
    const x = mol2.getAtomX(i);
    const y = mol2.getAtomY(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
}
console.log(`Bounds: [${minX}, ${minY}] to [${maxX}, ${maxY}]`);
console.log(`Width: ${maxX - minX}, Height: ${maxY - minY}`);

// Generate SVG and check path coordinates again (better regex)
const svg = mol2.toSVG(600, 600);
// Look for 'M x,y' or 'L x,y'
const pathMatch = svg.match(/[ML]\s*([\d.]+)\s*[\s,]\s*([\d.]+)/g);
console.log('SVG Path Coords Sample:', pathMatch ? pathMatch.slice(0, 5) : 'None');


console.log('Done.');
