import OCL from 'openchemlib';

console.log('=== Debug Highlight Logic ===\n');

// Simulate benzene with selection
const mol = OCL.Molecule.fromSmiles('c1ccccc1');

// Add hydrogens
for (let i = 0; i < 6; i++) {
    const hIdx = mol.addAtom(1);
    mol.addBond(i, hIdx, 1);
    mol.setAtomMass(hIdx, 1);
}

console.log('Atoms:', mol.getAllAtoms());

// Track selected atoms (simulate C:0 selected)
const selectedAtomIndices = [0]; // First carbon
const frag = [{}, {}, {}, {}, {}, {}]; // 6 carbons
const showLabels = false;

// Apply labels
for (let i = 0; i < mol.getAllAtoms(); i++) {
    const atomicNo = mol.getAtomicNo(i);

    if (showLabels) {
        let elem = atomicNo === 1 ? 'H' : 'C';
        mol.setAtomCustomLabel(i, `${elem}:${i}`);
    } else {
        if (atomicNo === 1) {
            mol.setAtomCustomLabel(i, "H.");
        }
        // No label for C when labels OFF
    }
}

mol.inventCoordinates();
let svg = mol.toSVG(400, 300);

console.log('\nText elements in SVG:');
const textMatches = [...svg.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]+)<\/text>/g)];
textMatches.forEach((match, idx) => {
    console.log(`  ${idx}: x=${match[1]}, y=${match[2]}, content="${match[3]}"`);
});

console.log('\nTrying to match selected atom (index 0):');
selectedAtomIndices.forEach(atomIdx => {
    console.log(`  Looking for atom ${atomIdx}`);

    textMatches.forEach((match, idx) => {
        const content = match[3];
        console.log(`    Text ${idx}: "${content}" - includes ":0"? ${content.includes(':0')}`);
    });
});

console.log('\nProblem: When labels are OFF, there is NO ":index" in the text!');
console.log('Solution: We need to match by position or use a different approach.');
