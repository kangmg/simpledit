import OCL from 'openchemlib';

console.log('Testing Lithium Trick and Scaling...');

// 1. Test Lithium Trick for H Retention
console.log('--- Lithium Trick ---');
const mol = OCL.Molecule.fromSmiles('C'); // Methane
// Add Lithium (Atomic No 3) instead of He
const hIdx = mol.addAtom(3);
mol.addBond(0, hIdx, 1);
mol.setAtomCustomLabel(hIdx, "H"); // Label as H

console.log('Atoms before invent:', mol.getAllAtoms());
mol.inventCoordinates();
console.log('Atoms after invent:', mol.getAllAtoms());
console.log('Atomic No of atom 1:', mol.getAtomicNo(1));

const svgLi = mol.toSVG(400, 300);
console.log('Lithium SVG contains "H"?', svgLi.includes('>H<') || svgLi.includes('H</text>'));
console.log('Lithium SVG contains bond?', svgLi.includes('<line'));

// 2. Test Scaling (60x)
console.log('--- Scaling 60x ---');
const mol2 = OCL.Molecule.fromSmiles('CC');
mol2.inventCoordinates();

// Initial distance
const x1 = mol2.getAtomX(0);
const x2 = mol2.getAtomX(1);
console.log('Dist before:', Math.abs(x2 - x1));

// Scale
const scaleFactor = 60;
for (let i = 0; i < mol2.getAllAtoms(); i++) {
    mol2.setAtomX(i, mol2.getAtomX(i) * scaleFactor);
    mol2.setAtomY(i, mol2.getAtomY(i) * scaleFactor);
}

const x1_new = mol2.getAtomX(0);
const x2_new = mol2.getAtomX(1);
console.log('Dist after:', Math.abs(x2_new - x1_new));

// Generate SVG and check if it respects coordinates or auto-fits
// OCL toSVG usually auto-fits if we don't provide a transformation matrix?
// Let's check the output path coordinates.
const svgScale = mol2.toSVG(1200, 900);
const pathMatch = svgScale.match(/M\s*([\d.]+),([\d.]+)/);
if (pathMatch) {
    console.log('SVG Coord:', pathMatch[1], pathMatch[2]);
}
