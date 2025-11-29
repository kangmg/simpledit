import OCL from 'openchemlib';

console.log('Debugging H Failure and Scaling...');

// 1. Reproduce Current Logic
console.log('--- Reproducing Current Logic ---');
const mol = OCL.Molecule.fromSmiles('C');
const hIdx = mol.addAtom(1);
mol.addBond(0, hIdx, 1);
mol.setAtomMass(hIdx, 1); // Explicit Mass 1

// Label Logic (Simulated)
const showLabels = true;
const i = hIdx;
const atomicNo = mol.getAtomicNo(i);
let elem = mol.getAtomLabel(i);
if (!elem) {
    if (atomicNo === 1) elem = 'H';
}
// Custom Label Set
mol.setAtomCustomLabel(i, `${elem}:${i}`);

// Invent Coordinates
mol.inventCoordinates();

// Generate SVG
const svg = mol.toSVG(1200, 900);

console.log('SVG contains "H"?', svg.includes('>H<') || svg.includes('H</text>'));
console.log('SVG contains bond?', svg.includes('<line'));

// 2. Check scaleCoords
console.log('--- Checking scaleCoords ---');
if (typeof mol.scaleCoords === 'function') {
    console.log('mol.scaleCoords EXISTS');
} else {
    console.log('mol.scaleCoords DOES NOT EXIST');
}

// 3. Test Manual Scaling + SVGDrawer (Alternative)
console.log('--- Testing SVGDrawer with Manual Scale ---');
// If toSVG auto-fits, maybe we can trick it?
// Or use a huge canvas?
// Let's try scaling coordinates HUGE and see if toSVG respects it if we pass huge dimensions?
const mol2 = OCL.Molecule.fromSmiles('CC');
mol2.inventCoordinates();

// Scale by 100
const scale = 100;
for (let j = 0; j < mol2.getAllAtoms(); j++) {
    mol2.setAtomX(j, mol2.getAtomX(j) * scale);
    mol2.setAtomY(j, mol2.getAtomY(j) * scale);
}

// If we pass 0,0 maybe it doesn't scale?
// const svg2 = mol2.toSVG(0, 0); // Invalid?
// Try passing null?
try {
    const svg2 = mol2.toSVG(1200, 900);
    const match = svg2.match(/<line[^>]*x1="([-\d.]+)"/);
    if (match) console.log('Scaled Bond X1:', match[1]);
} catch (e) {
    console.log('toSVG failed:', e);
}
