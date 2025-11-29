import OCL from 'openchemlib';

console.log('Testing Native Explicit Hydrogen Support...');

// 1. Inspect toSVG
console.log('--- Inspecting toSVG ---');
// In JS, we can't easily see signature, but we can try calling it with options
const mol = OCL.Molecule.fromSmiles('C');
mol.addAtom(1); // Explicit H
mol.addBond(0, 1, 1);

console.log('Atoms before invent:', mol.getAllAtoms());
mol.inventCoordinates();
console.log('Atoms after invent:', mol.getAllAtoms()); // Expect 1 if stripped

// 2. Test toSVG options (if H survived or if it renders implicit H)
// If H was stripped, toSVG can't draw it as an atom unless it draws implicit H.
// But we want EXPLICIT H.
// Let's see if we can prevent stripping.

console.log('--- Preventing H Stripping ---');
const mol2 = OCL.Molecule.fromSmiles('C');
const hIdx = mol2.addAtom(1);
mol2.addBond(0, hIdx, 1);

// Try flags
// mol2.setAtomMapNo(hIdx, 1); // Try map number
// mol2.setAtomCustomLabel(hIdx, "H"); // We tried this, didn't work?
// Let's retry custom label specifically
mol2.setAtomCustomLabel(hIdx, "H");

console.log('Atoms before invent (Label=H):', mol2.getAllAtoms());
mol2.inventCoordinates();
console.log('Atoms after invent (Label=H):', mol2.getAllAtoms());

// Try Stereo?
const mol3 = OCL.Molecule.fromSmiles('C');
const hIdx3 = mol3.addAtom(1);
mol3.addBond(0, hIdx3, 1);
mol3.setAtomParity(hIdx3, OCL.Molecule.cAtomParity1); // Fake stereo

console.log('Atoms before invent (Stereo):', mol3.getAllAtoms());
mol3.inventCoordinates();
console.log('Atoms after invent (Stereo):', mol3.getAllAtoms());

// 3. Test SVGDrawer options (if accessible)
// Maybe toSVG takes an options object?
// mol.toSVG(w, h, id, options)
const mol4 = OCL.Molecule.fromSmiles('C');
// If we don't run inventCoordinates, we have no coords.
// But maybe we can generate coords without stripping?
// OCL doesn't seem to have inventCoordinates(keepH).

// What if we use setAllAtomsExplicit? (If it exists)
if (mol4.setAllAtomsExplicit) {
    console.log('setAllAtomsExplicit exists');
} else {
    console.log('setAllAtomsExplicit DOES NOT exist');
}

// Check for noImplicitHydrogen option in toSVG
// We can't check it if H is already gone.
// Is there a way to draw implicit hydrogens?
const mol5 = OCL.Molecule.fromSmiles('C');
mol5.inventCoordinates();
// Maybe toSVG({ noImplicitHydrogen: false }) draws them?
// Default is usually NOT to draw implicit H.
const svg5 = mol5.toSVG(200, 200, 'test', { noImplicitHydrogen: false, suppressChiralText: true });
console.log('SVG with options:', svg5.includes('H'));

// 4. Check if we can protect H by marking it as a "connected" atom in a special way?
// Or maybe using setAtomMass(1, 1)? (Standard H mass)
const mol6 = OCL.Molecule.fromSmiles('C');
const hIdx6 = mol6.addAtom(1);
mol6.addBond(0, hIdx6, 1);
mol6.setAtomMass(hIdx6, 1); // Explicit mass 1

console.log('Atoms before invent (Mass=1):', mol6.getAllAtoms());
mol6.inventCoordinates();
console.log('Atoms after invent (Mass=1):', mol6.getAllAtoms());

// 5. Verify Mass=1 Rendering
console.log('--- Verify Mass=1 Rendering ---');
const mol7 = OCL.Molecule.fromSmiles('C');
const hIdx7 = mol7.addAtom(1);
mol7.addBond(0, hIdx7, 1);
mol7.setAtomMass(hIdx7, 1); // Explicit mass 1

mol7.inventCoordinates();
const svg7 = mol7.toSVG(400, 300);

console.log('SVG contains "H"?', svg7.includes('>H<') || svg7.includes('H</text>'));
console.log('SVG contains "1H"?', svg7.includes('>1H<') || svg7.includes('1H</text>'));
console.log('SVG contains bond?', svg7.includes('<line'));

// Check if we can override label if it shows "1H"
if (svg7.includes('1H')) {
    console.log('Label is "1H", trying to override...');
    mol7.setAtomCustomLabel(hIdx7, "H");
    const svg8 = mol7.toSVG(400, 300);
    console.log('Overridden SVG contains "H"?', svg8.includes('>H<') || svg8.includes('H</text>'));
    console.log('Overridden SVG contains "1H"?', svg8.includes('1H'));
}
