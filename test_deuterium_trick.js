import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

import fs from 'fs';
import path from 'path';

async function initOCL() {
    // Load force field resources
    const resourcePath = path.resolve('public/lib/openchemlib/forcefield.txt'); // Adjust path if needed
    // Actually, in node environment, we might need to mock or load differently.
    // But oclManager uses fetch. Here we use fs.
    // Wait, OCL in node usually has resources built-in or needs specific setup.
    // The error comes from ConformerGenerator.

    // Let's try to mock the resource loader if possible, or just skip if we can't load.
    // But ConformerGenerator needs it.
    // The error message "static resources must be registered first" suggests we need to call OCL.ConformerGenerator.setResource(...).

    // However, looking at oclManager.js, it fetches 'forcefield.txt' and calls OCL.ConformerGenerator.setResource.

    try {
        // Try to find the file.
        // The project structure has public/lib/openchemlib/forcefield.txt?
        // Let's check where it is.
        const possiblePaths = [
            'public/lib/openchemlib/forcefield.txt',
            'dist/lib/openchemlib/forcefield.txt',
            'node_modules/openchemlib/dist/forcefield.txt'
        ];

        let content = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                content = fs.readFileSync(p, 'utf8');
                break;
            }
        }

        if (content) {
            OCL.ConformerGenerator.setResource(content);
            console.log('OCL Resources initialized.');
        } else {
            console.warn('Could not find forcefield.txt. ConformerGenerator might fail.');
        }
    } catch (e) {
        console.error('Error initializing OCL:', e);
    }
}

async function testDeuteriumTrick() {
    await initOCL();
    console.log('--- Testing Deuterium Trick ---');

    // Case 1: Terminal Dummy (C-*)
    console.log('\nCase 1: Terminal Dummy (C-*)');
    await runTest('C*');

    // Case 2: Linker Dummy (C-*-C)
    console.log('\nCase 2: Linker Dummy (C-*-C)');
    await runTest('C*C');
}

async function runTest(smiles) {
    const mol = OCL.Molecule.fromSmiles(smiles);
    console.log(`Initial SMILES: ${smiles}`);

    const dummyIndices = [];
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        // OCL fromSmiles('*') creates AtomicNo 0? Or 6 with label?
        // Let's check.
        // Usually * is AtomicNo 0.
        if (mol.getAtomicNo(i) === 0 || (mol.getAtomicNo(i) === 6 && mol.getAtomLabel(i) === '*')) {
            dummyIndices.push(i);
            console.log(`Found Dummy at index ${i}`);
        }
    }

    // Apply Deuterium Trick
    console.log('Applying Deuterium Trick (AtomicNo 1, Mass 2)...');
    dummyIndices.forEach(i => {
        mol.setAtomicNo(i, 1);
        mol.setAtomMass(i, 2);
    });

    // Generate 3D
    console.log('Generating 3D...');
    const generator = new OCL.ConformerGenerator(42);
    const mol3D = generator.getOneConformerAsMolecule(mol);

    if (!mol3D) {
        console.error('Conformer generation failed!');
        return;
    }

    // Check Indices and Neighbors
    console.log(`Total Atoms (3D): ${mol3D.getAllAtoms()}`);

    dummyIndices.forEach(originalIdx => {
        // Verify if the atom at originalIdx is still Deuterium
        const atomicNo = mol3D.getAtomicNo(originalIdx);
        const mass = mol3D.getAtomMass(originalIdx);
        console.log(`Atom at index ${originalIdx}: AtomicNo=${atomicNo}, Mass=${mass}`);

        if (atomicNo === 1 && mass === 2) {
            console.log('  Index preserved: Yes');
        } else {
            console.log('  Index preserved: NO (or properties lost)');
        }

        // Check neighbors
        const conn = mol3D.getConnAtoms(originalIdx);
        console.log(`  Connections: ${conn}`);
        for (let j = 0; j < conn; j++) {
            const neighbor = mol3D.getConnAtom(originalIdx, j);
            const nAtomicNo = mol3D.getAtomicNo(neighbor);
            const nH = countHydrogens(mol3D, neighbor);
            console.log(`    Neighbor ${neighbor} (AtomicNo ${nAtomicNo}) has ${nH} hydrogens.`);
        }
    });
}

function countHydrogens(mol, atomIdx) {
    let count = 0;
    for (let i = 0; i < mol.getConnAtoms(atomIdx); i++) {
        const neighbor = mol.getConnAtom(atomIdx, i);
        if (mol.getAtomicNo(neighbor) === 1 && mol.getAtomMass(neighbor) !== 2) count++;
    }
    return count;
}

testDeuteriumTrick();
