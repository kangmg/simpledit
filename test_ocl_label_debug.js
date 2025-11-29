import OCL from 'openchemlib';

console.log('Debugging OCL Label Visibility...');

const mol = OCL.Molecule.fromSmiles('C'); // Single Carbon
mol.inventCoordinates();

// Test 1: Map No 0
mol.setAtomMapNo(0, 0, false);
const svg0 = mol.toSVG(200, 200);
console.log('MapNo 0 SVG includes "0"?', svg0.includes('>0<') || svg0.includes('0</text>'));

// Test 2: Map No 1
mol.setAtomMapNo(0, 1, false);
const svg1 = mol.toSVG(200, 200);
console.log('MapNo 1 SVG includes "1"?', svg1.includes('>1<') || svg1.includes('1</text>'));

// Test 3: Custom Label
mol.setAtomCustomLabel(0, "TEST");
const svgLabel = mol.toSVG(200, 200);
console.log('Custom Label SVG includes "TEST"?', svgLabel.includes('TEST'));

// Test 4: Check if Custom Label replaces symbol
// If we have C and label TEST, do we see C?
console.log('Custom Label SVG includes "C"?', svgLabel.includes('>C<') || svgLabel.includes('C</text>'));

console.log('Done.');
