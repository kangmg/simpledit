import OCL from 'openchemlib';

console.log('Testing OCL Fixes...');

// 1. Test Helium Trick for H Retention
console.log('--- Helium Trick ---');
const mol = OCL.Molecule.fromSmiles('C'); // Methane
mol.addAtom(2); // Add Helium (Atomic No 2)
mol.addBond(0, 1, 1);
mol.setAtomCustomLabel(1, "H"); // Label as H

console.log('Atoms before invent:', mol.getAllAtoms());
mol.inventCoordinates();
console.log('Atoms after invent:', mol.getAllAtoms());
console.log('Atomic No of atom 1:', mol.getAtomicNo(1));
console.log('Label of atom 1:', mol.getAtomLabel(1)); // Should be custom label? No, getAtomLabel returns symbol usually.
// Check custom label
// OCL doesn't expose getAtomCustomLabel in Node easily?
// We'll check SVG output.
const svgHe = mol.toSVG(400, 300);
console.log('Helium SVG contains "H"?', svgHe.includes('>H<') || svgHe.includes('H</text>'));

// 2. Test Improved Crop Logic (Line Support)
console.log('--- Crop Logic (Lines) ---');
const mol2 = OCL.Molecule.fromSmiles('CC'); // Ethane
mol2.inventCoordinates();
const svg = mol2.toSVG(600, 600);

// Check if it uses lines
const lines = svg.match(/<line[^>]*>/g);
console.log('Lines found:', lines ? lines.length : 0);

// Parse Line Coordinates
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

const lineRegex = /<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/g;
let match;
while ((match = lineRegex.exec(svg)) !== null) {
    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);

    if (!isNaN(x1)) { if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1; }
    if (!isNaN(y1)) { if (y1 < minY) minY = y1; if (y1 > maxY) maxY = y1; }
    if (!isNaN(x2)) { if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2; }
    if (!isNaN(y2)) { if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2; }
}

console.log(`Bounds from Lines: [${minX}, ${minY}] - [${maxX}, ${maxY}]`);
console.log(`Dimensions: ${maxX - minX} x ${maxY - minY}`);
