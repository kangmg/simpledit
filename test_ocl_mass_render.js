import OCL from 'openchemlib';

console.log('Inspecting Mass=1 H SVG...');

const mol = OCL.Molecule.fromSmiles('C');
const hIdx = mol.addAtom(1);
mol.addBond(0, hIdx, 1);
mol.setAtomMass(hIdx, 1);

mol.inventCoordinates();
const svg = mol.toSVG(400, 300);

console.log('--- SVG Content ---');
console.log(svg);
console.log('--- End SVG Content ---');
