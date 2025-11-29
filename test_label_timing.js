import OCL from 'openchemlib';

console.log('=== Testing Custom Label Effect on H Retention ===\n');

// Test 1: Mass=1 WITHOUT custom label
console.log('Test 1: Mass=1 WITHOUT custom label');
const mol1 = OCL.Molecule.fromSmiles('C');
const h1 = mol1.addAtom(1);
mol1.addBond(0, h1, 1);
mol1.setAtomMass(h1, 1);
console.log('  Atoms before inventCoordinates:', mol1.getAllAtoms());
mol1.inventCoordinates();
console.log('  Atoms after inventCoordinates:', mol1.getAllAtoms());
if (mol1.getAllAtoms() > 1) {
    console.log('  ✓ Hydrogen SURVIVED');
} else {
    console.log('  ✗ Hydrogen STRIPPED');
}

// Test 2: Mass=1 WITH custom label "H"
console.log('\nTest 2: Mass=1 WITH custom label "H"');
const mol2 = OCL.Molecule.fromSmiles('C');
const h2 = mol2.addAtom(1);
mol2.addBond(0, h2, 1);
mol2.setAtomMass(h2, 1);
mol2.setAtomCustomLabel(h2, "H");
console.log('  Atoms before inventCoordinates:', mol2.getAllAtoms());
mol2.inventCoordinates();
console.log('  Atoms after inventCoordinates:', mol2.getAllAtoms());
if (mol2.getAllAtoms() > 1) {
    console.log('  ✓ Hydrogen SURVIVED');
} else {
    console.log('  ✗ Hydrogen STRIPPED');
}

// Test 3: Mass=1 WITH custom label "H:1"
console.log('\nTest 3: Mass=1 WITH custom label "H:1"');
const mol3 = OCL.Molecule.fromSmiles('C');
const h3 = mol3.addAtom(1);
mol3.addBond(0, h3, 1);
mol3.setAtomMass(h3, 1);
mol3.setAtomCustomLabel(h3, "H:1");
console.log('  Atoms before inventCoordinates:', mol3.getAllAtoms());
mol3.inventCoordinates();
console.log('  Atoms after inventCoordinates:', mol3.getAllAtoms());
if (mol3.getAllAtoms() > 1) {
    console.log('  ✓ Hydrogen SURVIVED');
} else {
    console.log('  ✗ Hydrogen STRIPPED');
}

// Test 4: Mass=1 + custom label BUT setting label AFTER inventCoordinates
console.log('\nTest 4: Mass=1, inventCoordinates FIRST, then set label');
const mol4 = OCL.Molecule.fromSmiles('C');
const h4 = mol4.addAtom(1);
mol4.addBond(0, h4, 1);
mol4.setAtomMass(h4, 1);
console.log('  Atoms before inventCoordinates:', mol4.getAllAtoms());
mol4.inventCoordinates();
console.log('  Atoms after inventCoordinates:', mol4.getAllAtoms());
if (mol4.getAllAtoms() > 1) {
    console.log('  ✓ Hydrogen SURVIVED');
    // Now set label
    mol4.setAtomCustomLabel(1, "H");
    const svg = mol4.toSVG(400, 300);
    console.log('  Label in SVG:', svg.includes('>H<'));
}

console.log('\n=== CONCLUSION ===');
console.log('Custom labels BEFORE inventCoordinates() seem to interfere with Mass-based retention.');
console.log('We should set Mass=1, call inventCoordinates(), THEN set custom labels in post-processing.');
