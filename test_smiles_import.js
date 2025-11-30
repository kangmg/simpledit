import OCL from 'openchemlib';

console.log('=== Test SMILES Import ===\n');

const smiles = 'c1ccccc1'; // Benzene
console.log(`Input SMILES: ${smiles}`);

try {
    const mol = OCL.Molecule.fromSmiles(smiles);
    const molBlock = mol.toMolfile();

    console.log('\nGenerated MolBlock:');
    console.log('---------------------------------------------------');
    console.log(molBlock);
    console.log('---------------------------------------------------');

    // Simulate importSDF logic
    const lines = molBlock.split('\n');
    let atomStartIndex = 0;

    console.log(`\nTotal lines: ${lines.length}`);

    // Heuristic check from fileIOManager.js
    for (let i = 0; i < lines.length; i++) {
        console.log(`Line ${i}: "${lines[i]}"`);
        if (lines[i].includes('V2000')) {
            console.log(`FOUND V2000 at line ${i}`);
            const parts = lines[i].trim().split(/\s+/);
            console.log(`Counts line parts:`, parts);
            atomStartIndex = i + 1;
            break;
        }
    }

    if (atomStartIndex === 0) {
        console.error('ERROR: V2000 header not found!');
    } else {
        console.log(`SUCCESS: Atom start index is ${atomStartIndex}`);
    }

} catch (e) {
    console.error('An error occurred:', e);
}
