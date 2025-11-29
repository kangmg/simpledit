import OCL from 'openchemlib';

console.log('Testing SVGDrawer and Scaling...');

const mol = OCL.Molecule.fromSmiles('CC');
mol.inventCoordinates();

// 1. Test toSVG with huge dimensions again (Double Check)
const svgHuge = mol.toSVG(3000, 2000);
const match = svgHuge.match(/<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/);
if (match) {
    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);
    const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    console.log(`Bond Length @ 3000x2000: ${len.toFixed(2)}`);
}

// 2. Test SVGDrawer
// OCL.SVGDrawer might not be exposed directly in the npm package as 'SVGDrawer'.
// It might be OCL.SVGRenderer?
// Let's check keys on OCL
console.log('OCL Keys:', Object.keys(OCL));

// If SVGDrawer is not available, we might be stuck with toSVG.
// But wait, if toSVG produces fixed size, how does OCL editor zoom?
// The editor uses a canvas renderer.
// toSVG is for export.

// 3. Try scaleCoords()
console.log('--- Testing scaleCoords() ---');
const mol3 = OCL.Molecule.fromSmiles('CC');
mol3.inventCoordinates();
// Check coords
console.log('X before:', mol3.getAtomX(0));

// Scale by 2.0 (Double size)
mol3.scaleCoords(2.0);
console.log('X after scaleCoords(2.0):', mol3.getAtomX(0));

const svgScaled = mol3.toSVG(1200, 900);
const match2 = svgScaled.match(/<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/);
if (match2) {
    const x1 = parseFloat(match2[1]);
    const y1 = parseFloat(match2[2]);
    const x2 = parseFloat(match2[3]);
    const y2 = parseFloat(match2[4]);
    const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    console.log(`Bond Length after scaleCoords(2.0): ${len.toFixed(2)}`);
}

// 4. H Visibility Check (Mass=1)
console.log('--- H Visibility Check ---');
const molH = OCL.Molecule.fromSmiles('C');
const hIdx = molH.addAtom(1);
molH.addBond(0, hIdx, 1);
molH.setAtomMass(hIdx, 1);
molH.setAtomCustomLabel(hIdx, "H"); // Force label

const svgH = molH.toSVG(400, 300);
console.log('SVG H Content:', svgH.substring(0, 200)); // Print start
console.log('Contains >H< ?', svgH.includes('>H<'));
// 5. Test toSVG(0,0)
console.log('--- Testing toSVG(0,0) ---');
try {
    const svgZero = mol3.toSVG(0, 0);
    const matchZero = svgZero.match(/<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/);
    if (matchZero) {
        const x1 = parseFloat(matchZero[1]);
        const y1 = parseFloat(matchZero[2]);
        const x2 = parseFloat(matchZero[3]);
        const y2 = parseFloat(matchZero[4]);
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        console.log(`Bond Length @ 0x0: ${len.toFixed(2)}`);
    }
} catch (e) {
    console.log('toSVG(0,0) failed:', e);
}
