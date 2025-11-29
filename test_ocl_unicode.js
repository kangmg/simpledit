import OCL from 'openchemlib';

console.log('Testing Unicode Labels...');

const mol = OCL.Molecule.fromSmiles('C');
const hIdx = mol.addAtom(1);
mol.addBond(0, hIdx, 1);
mol.setAtomMass(hIdx, 1);

// Try Unicode Superscript 1
const label = `¹H:${hIdx}`;
console.log(`Setting label to: ${label}`);
mol.setAtomCustomLabel(hIdx, label);

mol.inventCoordinates();
const svg = mol.toSVG(400, 300);

console.log('SVG Content:', svg);
console.log('Contains Unicode Label?', svg.includes(label));
