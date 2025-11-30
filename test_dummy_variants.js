import OCL from 'openchemlib';

const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    warn: (...args) => process.stderr.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
};

async function testDummyVariants() {
    console.log('\n=== Testing Dummy Variants ===\n');

    // Case 1: Standard * (What we tested before)
    const molBlockStar = `
  TestStar
  
  
  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 *   0  0  0  0  0  0  0  0  0  0  0  0
    3.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
M  END
`;

    // Case 2: OCL ? (AtomicNo 0)
    const molBlockQuestion = `
  TestQuestion
  
  
  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 ?   0  0  0  0  0  0  0  0  0  0  0  0
    3.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
M  END
`;

    // Case 3: OCL A (Any Atom)
    const molBlockA = `
  TestA
  
  
  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 A   0  0  0  0  0  0  0  0  0  0  0  0
    3.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
M  END
`;

    const testCases = [
        { name: 'Star (*)', block: molBlockStar },
        { name: 'Question (?)', block: molBlockQuestion },
        { name: 'Any (A)', block: molBlockA }
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing ${test.name} ---`);
        await processMolBlock(test.block);
    }
}

async function processMolBlock(molBlock) {
    const dummyIndices = [];
    const molLines = molBlock.split('\n');

    let atomCountLineIdx = -1;
    for (let i = 0; i < molLines.length; i++) {
        if (molLines[i].includes('V2000')) {
            atomCountLineIdx = i;
            break;
        }
    }

    if (atomCountLineIdx === -1) atomCountLineIdx = 3;

    let atomCount = 0;
    if (molLines[atomCountLineIdx]) {
        const parts = molLines[atomCountLineIdx].trim().split(/\s+/);
        atomCount = parseInt(parts[0]);
    }

    const startIdx = atomCountLineIdx + 1;

    for (let i = 0; i < atomCount; i++) {
        const line = molLines[startIdx + i];
        if (!line) continue;

        // Improved detection logic: Check for *, ?, A, X
        // Also handle loose formatting
        let symbol = '';
        if (line.length >= 34) {
            symbol = line.substring(31, 34).trim();
        } else {
            const parts = line.trim().split(/\s+/);
            symbol = parts[3];
        }

        if (['*', '?', 'A', 'X', 'Q'].includes(symbol)) {
            dummyIndices.push(i);
            console.log(`Found Dummy '${symbol}' at index ${i}. Replacing with 'C'.`);

            // Replace logic
            if (line.length >= 34) {
                molLines[startIdx + i] = line.substring(0, 31) + 'C  ' + line.substring(34);
            } else {
                molLines[startIdx + i] = line.replace(symbol, 'C');
            }
        }
    }

    const processingMolBlock = molLines.join('\n');
    const mol = OCL.Molecule.fromMolfile(processingMolBlock);

    console.log(`Total atoms: ${mol.getAllAtoms()}`);
    dummyIndices.forEach(idx => {
        console.log(`Index ${idx}: AtomicNo=${mol.getAtomicNo(idx)} (Expected 6)`);
    });

    // Check implicit hydrogens on neighbors
    // In our test cases, Atom 0 and 2 are neighbors to Dummy (Index 1)
    // Atom 0 is C, bonded to Dummy(C). Single bond.
    // If Dummy is C, Atom 0 is C-C. Needs 3 H.

    mol.addImplicitHydrogens();
    console.log(`After H addition: ${mol.getAllAtoms()} atoms`);

    // Check neighbors of Dummy (Index 1)
    const connCount = mol.getConnAtoms(1);
    for (let k = 0; k < connCount; k++) {
        const neighborIdx = mol.getConnAtom(1, k);
        const neighborAtomicNo = mol.getAtomicNo(neighborIdx);
        if (neighborAtomicNo === 6) {
            // Check hydrogens attached to this neighbor
            const hCount = mol.getConnAtoms(neighborIdx);
            let hFound = 0;
            for (let j = 0; j < hCount; j++) {
                const n = mol.getConnAtom(neighborIdx, j);
                if (mol.getAtomicNo(n) === 1) hFound++;
            }
            console.log(`Neighbor ${neighborIdx} (C) has ${hFound} hydrogens.`);
        }
    }
}

testDummyVariants().catch(e => console.error(e));
