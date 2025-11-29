import OCL from 'openchemlib';

console.log('Testing SVG Post-processing...');

const mol = OCL.Molecule.fromSmiles('C');
mol.inventCoordinates();

// Set custom label to a pattern we can recognize
// e.g. "C|1"
mol.setAtomCustomLabel(0, "C|1");

const svg = mol.toSVG(200, 200);
console.log('SVG content snippet:', svg.substring(svg.indexOf('<text'), svg.indexOf('</text>') + 7));

// Try replacement
// We want "C" in default color, "1" in red, small, subscript?
// SVG text: <text x="100" y="100" ...>C|1</text>
// We can replace "C|1" with "C<tspan fill='red' dy='5' font-size='smaller'>1</tspan>"

const processed = svg.replace(/C\|1/g, 'C<tspan fill="red" dy="5" font-size="0.7em">1</tspan>');
console.log('Processed SVG snippet:', processed.substring(processed.indexOf('<text'), processed.indexOf('</text>') + 200)); // +200 to see more

console.log('Done.');
