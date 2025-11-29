import OCL from 'openchemlib';

console.log('Debugging SVG Generation...');

// Mock FileIOManager.exportSVG logic
function generateSVG(mol, showHydrogens) {
    // 1. Manual H Addition
    if (showHydrogens) {
        const originalAtomCount = mol.getAllAtoms();
        for (let i = 0; i < originalAtomCount; i++) {
            const implicitH = mol.getImplicitHydrogens(i);
            for (let h = 0; h < implicitH; h++) {
                const hIdx = mol.addAtom(1); // Add Hydrogen
                mol.addBond(i, hIdx, 1); // Single bond
            }
        }
    }

    // 2. Labels (Simplified)
    const atomCount = mol.getAllAtoms();
    for (let i = 0; i < atomCount; i++) {
        const atomicNo = mol.getAtomicNo(i);
        if (showHydrogens && atomicNo === 1) {
            mol.setAtomCustomLabel(i, "H");
        }
    }

    // 3. Invent Coordinates
    console.log('Atoms before invent:', mol.getAllAtoms());
    mol.inventCoordinates();
    console.log('Atoms after invent:', mol.getAllAtoms());

    // 4. Generate SVG
    let svg = mol.toSVG(1200, 900);

    // Debug Paths
    const pathTags = svg.match(/<path[^>]*>/g);
    console.log('Total Path Tags:', pathTags ? pathTags.length : 0);
    if (pathTags) {
        console.log('First 3 Paths:', pathTags.slice(0, 3));
    }

    // Debug Text
    const textTags = svg.match(/<text[^>]*>/g);
    console.log('Total Text Tags:', textTags ? textTags.length : 0);

    // 5. Crop Logic (Improved)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // Extract all d attributes
    const dMatches = svg.match(/d="([^"]+)"/g);
    if (dMatches) {
        dMatches.forEach(dAttr => {
            // Ignore if it looks like an ID (heuristic)
            if (dAttr.includes('mol')) return;

            // Extract numbers from d attribute
            // Look for sequences of numbers separated by space or comma
            // e.g. M 10.5,20.3 L ...
            const coords = dAttr.match(/([-\d.]+)[ ,]([-\d.]+)/g);
            if (coords) {
                coords.forEach(pair => {
                    // Handle cases like "10.5,20.3" or "10.5 20.3"
                    // parts might have empty strings if split by space and comma
                    const nums = pair.match(/([-\d.]+)/g);
                    if (nums && nums.length >= 2) {
                        const x = parseFloat(nums[0]);
                        const y = parseFloat(nums[1]);
                        if (!isNaN(x) && !isNaN(y)) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                });
            }
        });
    }

    // Also check text tags for x, y
    const xMatches = svg.match(/x="([-\d.]+)"/g);
    if (xMatches) {
        xMatches.forEach(m => {
            const val = parseFloat(m.match(/"([-\d.]+)"/)[1]);
            if (!isNaN(val)) {
                if (val < minX) minX = val;
                if (val > maxX) maxX = val;
            }
        });
    }
    const yMatches = svg.match(/y="([-\d.]+)"/g);
    if (yMatches) {
        yMatches.forEach(m => {
            const val = parseFloat(m.match(/"([-\d.]+)"/)[1]);
            if (!isNaN(val)) {
                if (val < minY) minY = val;
                if (val > maxY) maxY = val;
            }
        });
    }

    console.log(`Bounds: [${minX}, ${minY}] - [${maxX}, ${maxY}]`);
    console.log(`Dimensions: ${maxX - minX} x ${maxY - minY}`);

    if (minX < Infinity && maxX > -Infinity) {
        const padding = 20;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        const w = maxX - minX;
        const h = maxY - minY;

        svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${minX} ${minY} ${w} ${h}"`);
        console.log(`New viewBox: ${minX} ${minY} ${w} ${h}`);
    } else {
        console.log('Bounds detection failed!');
    }

    return svg;
}

// Test with Benzene
const mol = OCL.Molecule.fromSmiles('c1ccccc1');
console.log('--- Benzene with Hydrogens ---');
const svg = generateSVG(mol, true); // showHydrogens = true

// Check if H is present
console.log('SVG contains "H"?', svg.includes('>H<') || svg.includes('H</text>'));

// Test with Fluorine substitution to see if non-H renders
console.log('--- Benzene with Fluorine ---');
const molF = OCL.Molecule.fromSmiles('c1ccccc1');
molF.addAtom(9); // Fluorine
molF.addBond(0, 6, 1); // Bond to first carbon
const svgF = generateSVG(molF, false); // showHydrogens = false
console.log('Fluorine SVG contains "F"?', svgF.includes('>F<') || svgF.includes('F</text>'));

// Check SVG content snippet
console.log('SVG Snippet:', svg.substring(0, 300));
