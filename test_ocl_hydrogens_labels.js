import OCL from 'openchemlib';

console.log('Testing OCL Hydrogens and Labels...');

const mol = OCL.Molecule.fromSmiles('C'); // Methane
mol.inventCoordinates();

// 1. Test Hydrogens
console.log('--- Hydrogens ---');
console.log('Atoms before:', mol.getAllAtoms());
mol.addImplicitHydrogens();
console.log('Atoms after addImplicitHydrogens:', mol.getAllAtoms());
console.log('Bonds after addImplicitHydrogens:', mol.getAllBonds()); // Check bonds here
mol.inventCoordinates(); // Re-layout to place H

const svgH = mol.toSVG(400, 400);
console.log('SVG with H contains "H"?', svgH.includes('>H<') || svgH.includes('H</text>'));
console.log('SVG H content snippet:', svgH.substring(0, 200));

// 2. Test Label Style "Symbol:Index" on Hydrogens
console.log('--- Labels on Hydrogens ---');
const mol2 = OCL.Molecule.fromSmiles('C');
mol2.addImplicitHydrogens(); // C + 4H
console.log('After AddH Atom count:', mol2.getAllAtoms());

// Strategy 1: Label H atoms BEFORE inventCoordinates
for (let i = 1; i < mol2.getAllAtoms(); i++) {
    mol2.setAtomCustomLabel(i, "H:" + i);
}

mol2.inventCoordinates();
console.log('After Invent (Protected?) Atom count:', mol2.getAllAtoms());

// Strategy 2: Manual H import
const mol3 = new OCL.Molecule(100, 100);
const c = mol3.addAtom(6);
const h = mol3.addAtom(1);
mol3.addBond(c, h, 1);
console.log('Manual CH Atom count:', mol3.getAllAtoms());
mol3.inventCoordinates();
console.log('Manual CH After Invent Atom count:', mol3.getAllAtoms());
mol2.setAtomCustomLabel(2, "H");   // Simple
mol2.setAtomCustomLabel(3, "X");   // Different symbol

const svgLabel = mol2.toSVG(1200, 900);
console.log('Label SVG has line/path?', svgLabel.includes('<line') || svgLabel.includes('<path'));
console.log('H:1 present?', svgLabel.includes('H:1'));
console.log('H present?', svgLabel.includes('>H<') || svgLabel.includes('H</text>')); // Might match the simple label
console.log('X present?', svgLabel.includes('X'));

// Check bond count again
console.log('Bond count:', mol2.getAllBonds());
