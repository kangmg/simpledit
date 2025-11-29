import OCL from 'openchemlib';

console.log('Testing OCL Bonds with Custom Labels...');

console.log('Testing OCL Bonds with Benzene and Numeric Labels...');

const mol = OCL.Molecule.fromSmiles('c1ccccc1'); // Benzene
mol.inventCoordinates();

// Set numeric labels "0" ... "5"
for (let i = 0; i < 6; i++) {
    mol.setAtomCustomLabel(i, i.toString());
}

const svgBenzeneNumeric = mol.toSVG(400, 400);
console.log('Benzene Numeric Label SVG has line/path?', svgBenzeneNumeric.includes('<line') || svgBenzeneNumeric.includes('<path'));

// Check line count
const linesNumeric = (svgBenzeneNumeric.match(/<line/g) || []).length + (svgBenzeneNumeric.match(/<path/g) || []).length;
console.log(`Lines with numeric labels: ${linesNumeric}`);

// Check if we can safely find the numbers
// Regex: />\d+</
const matches = svgBenzeneNumeric.match(/>\d+</g);
console.log('Numeric label matches:', matches);



console.log('Done.');
