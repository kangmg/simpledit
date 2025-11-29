import OCL from 'openchemlib';

console.log('Testing Final Tweaks...');

// 1. Test Label Override for Mass=1 H
console.log('--- Label Override ---');
const mol = OCL.Molecule.fromSmiles('C');
const hIdx = mol.addAtom(1);
mol.addBond(0, hIdx, 1);
mol.setAtomMass(hIdx, 1); // Explicit Mass 1 -> "1H"

// Generate SVG without custom label
mol.inventCoordinates();
const svg1 = mol.toSVG(400, 300);
console.log('Default Mass=1 Label:', svg1.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] || 'Not found');

// Set Custom Label
mol.setAtomCustomLabel(hIdx, "H");
const svg2 = mol.toSVG(400, 300);
console.log('Custom Label "H":', svg2.match(/<text[^>]*>([^<]+)<\/text>/)?.[1] || 'Not found');

// 2. Test Canvas Scaling for Spacing
console.log('--- Canvas Scaling ---');
const mol2 = OCL.Molecule.fromSmiles('CC');
mol2.inventCoordinates();

// Measure bond length in SVG for different canvas sizes
const getBondLength = (w, h) => {
    const svg = mol2.toSVG(w, h);
    const match = svg.match(/<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/);
    if (match) {
        const x1 = parseFloat(match[1]);
        const y1 = parseFloat(match[2]);
        const x2 = parseFloat(match[3]);
        const y2 = parseFloat(match[4]);
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    return 0;
};

const lenSmall = getBondLength(400, 300);
const lenMedium = getBondLength(1200, 900);
const lenLarge = getBondLength(3000, 2000);

console.log(`Bond Length @ 400x300: ${lenSmall.toFixed(2)}`);
console.log(`Bond Length @ 1200x900: ${lenMedium.toFixed(2)}`);
console.log(`Bond Length @ 3000x2000: ${lenLarge.toFixed(2)}`);

// 3. Test Manual Scaling
console.log('--- Manual Scaling ---');
const mol3 = OCL.Molecule.fromSmiles('CC');
mol3.inventCoordinates();

// Initial Bond Length
const lenInit = getBondLength(1200, 900);
console.log(`Initial Bond Length: ${lenInit.toFixed(2)}`);

// Scale by 60x
const scaleFactor = 60;
for (let i = 0; i < mol3.getAllAtoms(); i++) {
    mol3.setAtomX(i, mol3.getAtomX(i) * scaleFactor);
    mol3.setAtomY(i, mol3.getAtomY(i) * scaleFactor);
}

// Bond Length after Scaling
const lenScaled = getBondLength(1200, 900);
console.log(`Scaled Bond Length (60x): ${lenScaled.toFixed(2)}`);

// Check if it fits in 1200x900
// If it's too big, it might be clipped?
// But we crop anyway.
