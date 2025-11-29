import OCL from 'openchemlib';

console.log('Inspecting SVG Content...');

const mol = OCL.Molecule.fromSmiles('c1ccccc1');
// Add Helium trick to match current implementation
mol.addAtom(2);
mol.addBond(0, 6, 1);
mol.setAtomCustomLabel(6, "H");

mol.inventCoordinates();
const svg = mol.toSVG(1200, 900);

// Print first few paths fully
const paths = svg.match(/d="[^"]+"/g);
if (paths) {
    console.log('Number of paths:', paths.length);
    paths.slice(0, 5).forEach((p, i) => {
        console.log(`Path ${i}:`, p.substring(0, 200)); // Print first 200 chars
    });
}

// Print lines
const lines = svg.match(/<line[^>]*>/g);
if (lines) {
    console.log('Number of lines:', lines.length);
    lines.slice(0, 5).forEach((l, i) => {
        console.log(`Line ${i}:`, l);
    });
}

// Print text
const texts = svg.match(/<text[^>]*>/g);
if (texts) {
    console.log('Number of texts:', texts.length);
    texts.slice(0, 5).forEach((t, i) => {
        console.log(`Text ${i}:`, t);
    });
}

// Manual Bounding Box Check on printed data
console.log('Done.');
