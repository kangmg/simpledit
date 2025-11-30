import OCL from 'openchemlib';

console.log('=== Test Marker Approach for SVG Coordinates ===\n');

const mol = OCL.Molecule.fromSmiles('C');
const h = mol.addAtom(1);
mol.addBond(0, h, 1);
mol.setAtomMass(h, 1);

mol.inventCoordinates();
mol.scaleCoords(10.0);

// 1. Prepare desired labels and set markers
const atomCount = mol.getAllAtoms();
const desiredLabels = [];

for (let i = 0; i < atomCount; i++) {
    const atomicNo = mol.getAtomicNo(i);
    if (atomicNo === 1) desiredLabels[i] = "H";
    else if (atomicNo === 6) desiredLabels[i] = ""; // Hidden C
    else desiredLabels[i] = mol.getAtomLabel(i) || "?";

    // Set marker
    mol.setAtomCustomLabel(i, `%%${i}`);
}

// 2. Generate SVG
const svg = mol.toSVG(400, 300);
console.log('Generated SVG with markers:\n', svg);

// 3. Parse coordinates
const atomCoords = {};
const markerRegex = /<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>%%(\d+)<\/text>/g;
let match;
while ((match = markerRegex.exec(svg)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const idx = parseInt(match[3]);
    atomCoords[idx] = { x, y };
    console.log(`Atom ${idx}: x=${x}, y=${y}`);
}

// 4. Replace markers and inject stuff
let newSvg = svg;

// Replace markers with desired labels
newSvg = newSvg.replace(/<text([^>]*)>%%(\d+)<\/text>/g, (match, attrs, idxStr) => {
    const idx = parseInt(idxStr);
    const label = desiredLabels[idx];

    if (!label) return ''; // Remove text element for hidden atoms
    return `<text${attrs}>${label}</text>`;
});

console.log('\nFinal SVG:\n', newSvg);
