import OCL from 'openchemlib';
import fs from 'fs';

console.log('=== Debug Bond Visibility Issue ===\n');

// Create benzene with labels
const mol = OCL.Molecule.fromSmiles('c1ccccc1');

// Add hydrogens
for (let i = 0; i < 6; i++) {
    const hIdx = mol.addAtom(1);
    mol.addBond(i, hIdx, 1);
    mol.setAtomMass(hIdx, 1);
}

// Set labels (simulate showLabels=true)
const showLabels = true;
for (let i = 0; i < mol.getAllAtoms(); i++) {
    const atomicNo = mol.getAtomicNo(i);
    let elem = atomicNo === 1 ? 'H' : 'C';
    mol.setAtomCustomLabel(i, `${elem}:${i}`);
}

mol.inventCoordinates();
mol.scaleCoords(10.0);

// Generate SVG
let svg = mol.toSVG(1200, 900);

// Apply post-processing (similar to fileIOManager)
svg = svg.replace(/font-size="14"/g, 'font-size="10"');
svg = svg.replace(/stroke-width="1.44"/g, 'stroke-width="1.2"');
if (showLabels) {
    svg = svg.replace(/font-size="10"/g, 'font-size="5"');
}

console.log('SVG Stats BEFORE cropping:');
console.log('  Original viewBox:', svg.match(/viewBox="[^"]+"/)?.[0]);
const lines = svg.match(/<line[^>]*stroke="rgb\(0,0,0\)"[^>]*\/>/g) || [];
console.log('  Bond lines:', lines.length);
console.log('  Text elements:', (svg.match(/<text/g) || []).length);

// Parse bond coordinates
console.log('\nBond coordinates:');
lines.forEach((line, idx) => {
    const match = line.match(/x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/);
    if (match && idx < 5) {
        console.log(`  Bond ${idx}: (${match[1]}, ${match[2]}) -> (${match[3]}, ${match[4]})`);
    }
});

// Simulate viewBox cropping logic
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

const updateBounds = (x, y) => {
    if (!isNaN(x) && !isNaN(y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
};

// Parse lines
const lineRegex = /<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/g;
let match;
while ((match = lineRegex.exec(svg)) !== null) {
    updateBounds(parseFloat(match[1]), parseFloat(match[2]));
    updateBounds(parseFloat(match[3]), parseFloat(match[4]));
}

// Parse text
const textRegex = /<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]*)<\/text>/g;
while ((match = textRegex.exec(svg)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const fontSize = 5;
    const textLen = match[3].length * (fontSize * 0.6);

    updateBounds(x - textLen / 2, y - fontSize);
    updateBounds(x + textLen / 2, y + fontSize / 2);
}

console.log('\nCalculated bounds:');
console.log(`  minX: ${minX}, maxX: ${maxX}`);
console.log(`  minY: ${minY}, maxY: ${maxY}`);

const padding = 30;
minX -= padding;
minY -= padding;
maxX += padding;
maxY += padding;
const w = maxX - minX;
const h = maxY - minY;

console.log(`\nNew viewBox: "${minX} ${minY} ${w} ${h}"`);
svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${minX} ${minY} ${w} ${h}"`);

// Save SVG
fs.writeFileSync('debug_bonds.svg', svg);
console.log('\nSaved to debug_bonds.svg');
console.log('Open this file in a browser to check if bonds are visible.');
