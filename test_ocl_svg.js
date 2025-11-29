import OCL from 'openchemlib';

console.log('Checking OCL SVG capabilities...');

const mol = OCL.Molecule.fromSmiles('c1ccccc1');

// Check for toSVG on molecule instance
if (typeof mol.toSVG === 'function') {
    console.log('mol.toSVG exists');
    // Try to call it with options?

    // Test custom label
    if (typeof mol.setAtomCustomLabel === 'function') {
        console.log('Testing setAtomCustomLabel...');
        mol.setAtomCustomLabel(0, 'TEST_LABEL');
    }

    const svg3 = mol.toSVG(300, 300);
    console.log('SVG length with label:', svg3.length);
    if (svg3.includes('TEST_LABEL')) {
        console.log('SUCCESS: Label found in SVG');
    } else {
        console.log('FAILURE: Label NOT found in SVG');
    }


