import OCL from 'openchemlib';

console.log('Debugging OCL Zoom and H Visibility...');

// 1. Test Font Size Scaling
const mol = OCL.Molecule.fromSmiles('c1ccccc1'); // Benzene
mol.inventCoordinates();

// Label Benzene to ensure text tags
for (let i = 0; i < 6; i++) mol.setAtomCustomLabel(i, "C:" + i);

const svgSmall = mol.toSVG(400, 300);
const svgLarge = mol.toSVG(1200, 900);

// Find first text tag
const textSmall = svgSmall.match(/<text[^>]*>/);
const textLarge = svgLarge.match(/<text[^>]*>/);

console.log('Small SVG Text Tag:', textSmall ? textSmall[0] : 'Not found');
console.log('Large SVG Text Tag:', textLarge ? textLarge[0] : 'Not found');

// 2. Test Hydrogen Visibility (Existing H)
console.log('--- Existing Hydrogens ---');
const molH = OCL.Molecule.fromSmiles('C');
molH.addImplicitHydrogens(); // Now has 5 atoms
console.log('Atoms:', molH.getAllAtoms());

// Simulate "showHydrogens" logic where we add implicit H again (should be 0 added)
const countBefore = molH.getAllAtoms();
molH.addImplicitHydrogens();
const countAfter = molH.getAllAtoms();
console.log(`Added: ${countBefore} -> ${countAfter}`);

// Now generate SVG. If we don't label them, do they show?
molH.inventCoordinates();
const svgExistingH = molH.toSVG(400, 300);
console.log('Existing H visible without label?', svgExistingH.includes('>H<') || svgExistingH.includes('H</text>'));

// Now apply label to ALL H atoms
for (let i = 0; i < molH.getAllAtoms(); i++) {
    if (molH.getAtomicNo(i) === 1) {
        molH.setAtomCustomLabel(i, "H");
    }
}
const svgLabeledH = molH.toSVG(400, 300);
console.log('Existing H visible WITH label?', svgLabeledH.includes('>H<') || svgLabeledH.includes('H</text>'));

console.log('Done.');
