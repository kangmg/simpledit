import OCL from 'openchemlib';

console.log('=== Comprehensive H Visibility Debug ===\n');

// Test Case: Benzene with explicit H
const mol = OCL.Molecule.fromSmiles('c1ccccc1');

console.log('Initial atom count:', mol.getAllAtoms());
console.log('Implicit H on C0:', mol.getImplicitHydrogens(0));

// Simulate fileIOManager logic
const showHydrogens = true;
const showLabels = false; // User said "-l off"

// Step 1: Add Hydrogens with Mass=1
if (showHydrogens) {
    const currentAtomCount = mol.getAllAtoms();
    console.log('\nAdding Hydrogens...');

    // Convert existing H to Mass=1
    for (let i = 0; i < currentAtomCount; i++) {
        if (mol.getAtomicNo(i) === 1) {
            mol.setAtomMass(i, 1);
        }
    }

    // Add implicit H
    const originalCount = currentAtomCount;
    for (let i = 0; i < originalCount; i++) {
        const atomicNo = mol.getAtomicNo(i);
        if (atomicNo !== 1) {
            const implicitH = mol.getImplicitHydrogens(i);
            for (let h = 0; h < implicitH; h++) {
                const hIdx = mol.addAtom(1);
                mol.addBond(i, hIdx, 1);
                mol.setAtomMass(hIdx, 1);
                console.log(`  Added H at index ${hIdx}, mass=${mol.getAtomMass(hIdx)}`);
            }
        }
    }
}

console.log('\nTotal atoms after adding H:', mol.getAllAtoms());

// Step 2: Apply Labels
const atomCount = mol.getAllAtoms();
console.log('\nApplying labels...');
for (let i = 0; i < atomCount; i++) {
    const atomicNo = mol.getAtomicNo(i);

    if (showLabels) {
        // Labels ON logic
        let elem = mol.getAtomLabel(i);
        if (!elem) {
            if (atomicNo === 1) elem = 'H';
            else if (atomicNo === 6) elem = 'C';
            else elem = '?';
        }
        const labelIdx = i;

        if (atomicNo === 1 && mol.getAtomMass(i) === 1) {
            mol.setAtomCustomLabel(i, `H:${labelIdx}`);
            console.log(`  Atom ${i} (H): Set label "H:${labelIdx}"`);
        } else {
            mol.setAtomCustomLabel(i, `${elem}:${labelIdx}`);
            console.log(`  Atom ${i}: Set label "${elem}:${labelIdx}"`);
        }
    } else {
        // Labels OFF logic
        if (atomicNo === 1 && mol.getAtomMass(i) === 1) {
            mol.setAtomCustomLabel(i, "H");
            console.log(`  Atom ${i} (H): Set label "H" (mass=${mol.getAtomMass(i)})`);
        }
    }
}

// Step 3: Generate coordinates
console.log('\nGenerating coordinates...');
mol.inventCoordinates();
console.log('Atoms after inventCoordinates:', mol.getAllAtoms());

// Step 4: Scale
mol.scaleCoords(10.0);

// Step 5: Generate SVG
const svg = mol.toSVG(1200, 900);

// Analyze SVG
console.log('\n=== SVG Analysis ===');
const textMatches = svg.match(/<text[^>]*>([^<]+)<\/text>/g);
console.log('Text elements found:', textMatches ? textMatches.length : 0);
if (textMatches) {
    textMatches.forEach((match, idx) => {
        console.log(`  ${idx}: ${match}`);
    });
}

const lineMatches = svg.match(/<line[^>]*stroke="rgb\(0,0,0\)"[^>]*\/>/g);
console.log('\nBond lines found:', lineMatches ? lineMatches.length : 0);

console.log('\n=== Conclusion ===');
console.log('Are H atoms visible in SVG?', svg.includes('>H<'));
