import OCL from 'openchemlib';

console.log('Testing OCL 2D refinement...');

const mol = OCL.Molecule.fromSmiles('c1ccccc1');

// 1. Test 2D Coordinate Generation
// Currently atomsToOCL sets X/Y/Z. We want to see if inventCoordinates flattens it.
// Let's manually set some 3D-ish coords first (simulating the issue)
mol.setAtomX(0, 0); mol.setAtomY(0, 0); mol.setAtomZ(0, 0);
mol.setAtomX(1, 1); mol.setAtomY(1, 0.5); mol.setAtomZ(1, 1);
// ...

console.log('Original coords (mock 3D):', mol.getAtomX(1), mol.getAtomY(1), mol.getAtomZ(1));

// Call inventCoordinates
mol.inventCoordinates();
console.log('After inventCoordinates:', mol.getAtomX(1), mol.getAtomY(1), mol.getAtomZ(1));


// 2. Test Labeling
// User wants index next to atom in red.
// Try setAtomMapNo
mol.setAtomMapNo(0, 1); // Index 0, Map 1
const svgMap = mol.toSVG(200, 200);
if (svgMap.includes('1')) console.log('MapNo appears in SVG');

// Try setAtomCustomLabel
mol.setAtomCustomLabel(1, 'TEST');
const svgLabel = mol.toSVG(200, 200);
if (svgLabel.includes('TEST')) console.log('CustomLabel appears in SVG');

// Check if we can color the label?
// OCL usually colors the whole atom.
mol.setAtomColor(1, OCL.Molecule.cAtomColorRed);
const svgColor = mol.toSVG(200, 200);
// We can't easily check color in SVG string without parsing, but we can assume setAtomColor works.

console.log('Done.');
