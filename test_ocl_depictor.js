import OCL from 'openchemlib';

console.log('Testing DepictorOptions and Label Override...');

// 1. Test noImplicitHydrogen Option
console.log('--- Testing noImplicitHydrogen ---');
const mol = OCL.Molecule.fromSmiles('C');
mol.addAtom(1); // Explicit H
mol.addBond(0, 1, 1);

// Standard inventCoordinates (strips H)
mol.inventCoordinates();
console.log('Atoms after invent (default):', mol.getAllAtoms()); // Expect 1

// Try toSVG with options
// Note: If atoms are stripped, toSVG can't draw them as explicit bonds.
// Unless toSVG draws *implicit* hydrogens as explicit lines?
const svg1 = mol.toSVG(400, 300, 'test', { noImplicitHydrogen: false });
console.log('SVG with noImplicitHydrogen:false contains bond?', svg1.includes('<line'));
console.log('SVG with noImplicitHydrogen:false contains H?', svg1.includes('>H<') || svg1.includes('H</text>'));

// 2. Test Label Override for Mass=1
console.log('--- Testing Label Override for Mass=1 ---');
const mol2 = OCL.Molecule.fromSmiles('C');
const hIdx = mol2.addAtom(1);
mol2.addBond(0, hIdx, 1);
mol2.setAtomMass(hIdx, 1); // Preserve H

// Case A: No Custom Label -> Expect "¹H" (or similar)
mol2.inventCoordinates();
const svgA = mol2.toSVG(400, 300);
console.log('Case A (Default Mass=1):', svgA.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] || 'Not found');

// Case B: Custom Label "H" -> Expect "H"
mol2.setAtomCustomLabel(hIdx, "H");
const svgB = mol2.toSVG(400, 300);
console.log('Case B (Custom Label "H"):', svgB.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] || 'Not found');

// Case C: Custom Label "H:1" -> Expect "H:1"
mol2.setAtomCustomLabel(hIdx, "H:1");
const svgC = mol2.toSVG(400, 300);
console.log('Case C (Custom Label "H:1"):', svgC.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] || 'Not found');
