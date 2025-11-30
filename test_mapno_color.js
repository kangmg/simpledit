import OCL from 'openchemlib';

console.log('=== Test setAtomMapNo and setAtomColor ===\n');

const mol = OCL.Molecule.fromSmiles('c1ccccc1');
// Add a hydrogen
const h = mol.addAtom(1);
mol.addBond(0, h, 1);
mol.setAtomMass(h, 1);

// Select Atom 0 (Carbon) and Atom 6 (Hydrogen)
// We'll use a specific color to mark them.
// OCL colors are integers. Let's try to find what they map to.
// Usually: 0=Black, 1=Blue, 2=Red, 3=Green, 4=Magenta, 5=Orange, etc.
mol.setAtomColor(0, 4); // Magenta?
mol.setAtomColor(6, 4);

// Set Map No for indices
for (let i = 0; i < mol.getAllAtoms(); i++) {
    mol.setAtomMapNo(i, i, false); // i, auto-correct?
}

mol.inventCoordinates();

const svg = mol.toSVG(400, 300);
console.log('Generated SVG:\n', svg);

// Check for colors
const magentaMatches = svg.match(/fill="rgb\(255,0,255\)"/g) || []; // Magenta is usually 255,0,255
console.log('Magenta fills found:', magentaMatches.length);

// Check for map numbers
// Map numbers usually appear as small text
const textMatches = svg.match(/<text[^>]*>(\d+)<\/text>/g) || [];
console.log('Numeric text found:', textMatches.length);
console.log('Sample texts:', textMatches.slice(0, 5));
