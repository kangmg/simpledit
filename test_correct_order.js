import OCL from 'openchemlib';
import fs from 'fs';

const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
};

// Load resources  
const possiblePaths = [
    'public/lib/openchemlib/forcefield.txt',
    'dist/lib/openchemlib/forcefield.txt',
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        OCL.ConformerGenerator.setResource(fs.readFileSync(p, 'utf8'));
        console.log(`Loaded: ${p}`);
        break;
    }
}

async function testCorrectOrder() {
    console.log('\n=== Testing CORRECT Order: F → H → 3D → Revert ===\n');

    const inputMolBlock = `Test Mol
Actelion

  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 ?   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
`.trim();

    console.log('Step 1: Parse');
    const mol = OCL.Molecule.fromMolfile(inputMolBlock);
    console.log(`  Atoms: ${mol.getAllAtoms()}`);

    console.log('\nStep 2: Replace Dummy with Fluorine');
    const dummyIndices = [];
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        if (mol.getAtomicNo(i) === 0) {
            dummyIndices.push(i);
            mol.setAtomicNo(i, 9);
            console.log(`  Converted index ${i} to F`);
        }
    }

    console.log('\nStep 3: Add Implicit Hydrogens BEFORE 3D');
    mol.addImplicitHydrogens();
    console.log(`  Atoms after H: ${mol.getAllAtoms()}`);
    for (let i = 0; i < mol.getAllAtoms(); i++) {
        console.log(`    Atom ${i}: AtomicNo=${mol.getAtomicNo(i)}`);
    }

    console.log('\nStep 4: Generate 3D with explicit H already present');
    const generator = new OCL.ConformerGenerator(42);
    const mol3D = generator.getOneConformerAsMolecule(mol);

    if (!mol3D) {
        console.error('  3D generation failed!');
        return;
    }

    console.log(`  Atoms after 3D: ${mol3D.getAllAtoms()}`);
    for (let i = 0; i < mol3D.getAllAtoms(); i++) {
        console.log(`    Atom ${i}: AtomicNo=${mol3D.getAtomicNo(i)}`);
    }

    console.log('\nStep 5: Revert Fluorine to Dummy');
    dummyIndices.forEach(idx => {
        if (mol3D.getAtomicNo(idx) === 9) {
            mol3D.setAtomicNo(idx, 0);
            console.log(`  Reverted index ${idx} to Dummy`);
        } else {
            console.warn(`  Index ${idx} is NOT F: ${mol3D.getAtomicNo(idx)}`);
        }
    });

    console.log('\nFinal MolBlock:');
    const final = mol3D.toMolfile();
    console.log(final);

    let hCount = 0, dummyCount = 0;
    for (let i = 0; i < mol3D.getAllAtoms(); i++) {
        if (mol3D.getAtomicNo(i) === 1) hCount++;
        if (mol3D.getAtomicNo(i) === 0) dummyCount++;
    }

    console.log(`\n=== Result ===`);
    console.log(`Hydrogens: ${hCount}, Dummies: ${dummyCount}`);

    if (hCount === 3 && dummyCount === 1) {
        console.log('✅ SUCCESS!');
    } else {
        console.log('❌ FAILED!');
    }
}

testCorrectOrder().catch(e => console.error('Error:', e));
