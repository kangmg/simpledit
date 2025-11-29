import OCL from 'openchemlib';

console.log('Testing Label Fix for Fake Hydrogens...');

const mol = OCL.Molecule.fromSmiles('C'); // Methane
// Add Lithium (Atomic No 3) as Fake H
const hIdx = mol.addAtom(3);
mol.addBond(0, hIdx, 1);

// Simulate Label Logic from FileIOManager
const showLabels = true;
const i = hIdx;
const atomicNo = mol.getAtomicNo(i);
let elem = mol.getAtomLabel(i); // Should be "Li"

console.log(`Original Symbol: ${elem}`);
console.log(`Atomic No: ${atomicNo}`);

// Apply Fix Logic
if (atomicNo === 2 || atomicNo === 3) {
    elem = 'H';
} else if (!elem) {
    if (atomicNo === 1) elem = 'H';
    else if (atomicNo === 6) elem = 'C';
    else elem = '?';
}

const label = `${elem}:${i}`;
console.log(`Final Label: ${label}`);

if (label === `H:${hIdx}`) {
    console.log('SUCCESS: Label is correct.');
} else {
    console.log('FAILURE: Label is incorrect.');
}
