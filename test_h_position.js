import OCL from 'openchemlib';

console.log('=== Testing SVG Structure for H Positioning ===\n');

const mol = OCL.Molecule.fromSmiles('C');
const h = mol.addAtom(1);
mol.addBond(0, h, 1);
mol.setAtomMass(h, 1);
mol.setAtomCustomLabel(h, "H.");

mol.inventCoordinates();
const svg = mol.toSVG(400, 300);

console.log('Original SVG:\n');
console.log(svg);

// Check text elements
const textMatches = [...svg.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)];
console.log('\nText elements:');
textMatches.forEach((match, idx) => {
    console.log(`  ${idx}: x=${match[1]}, y=${match[2]}, fontSize=${match[3]}, content="${match[4]}"`);
});

// Remove mass "1"
let modifiedSvg = svg.replace(/<text[^>]*font-size="9"[^>]*>1<\/text>/g, '');
console.log('\nAfter removing mass "1":');
const modifiedMatches = [...modifiedSvg.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)];
modifiedMatches.forEach((match, idx) => {
    console.log(`  ${idx}: x=${match[1]}, y=${match[2]}, fontSize=${match[3]}, content="${match[4]}"`);
});
