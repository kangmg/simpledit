import OCL from 'openchemlib';

const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
};

async function testRepro() {
    console.log('\n=== Testing User Repro Case ===\n');

    // Constructing the MolBlock from the user's log
    // Note: The coordinates don't matter for connectivity/valence, but I'll use placeholders.
    // Connectivity is key.
    // Atom 0: *
    // Atom 1: C
    // Atom 2: C
    // ...
    // Bonds:
    // 1-2 (1), 2-3 (1), 2-9 (1) ...

    const molBlock = `UserRepro
  Actelion
  
 16 17  0  0  0  0  0  0  0  0999 V2000
    1.0161   -3.1727   -0.3924 *   0  0  0  0  0  0  0  0  0  0  0  0
   -0.3836   -2.7974    0.0284 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.3774   -1.3985    0.5869 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5886   -0.3013   -0.2595 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.8228   -0.5166   -1.7319 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.0215    0.8289   -2.4117 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.3148    1.4658   -1.9037 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5805    0.9843    0.2674 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.3655    1.1785    1.6177 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.1575    0.0958    2.4505 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.1622   -1.1895    1.9440 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.1616    1.7915   -0.4175 C   0  0  0  0  0  0  0  0  0  0  0  0
   -3.4145    2.4767    0.0984 C   0  0  0  0  0  0  0  0  0  0  0  0
   -3.6581    3.7557   -0.6935 C   0  0  0  0  0  0  0  0  0  0  0  0
   -3.8594    3.4038   -2.1605 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.6004    2.7406   -2.6958 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
  5  6  1  0  0  0  0
  6  7  1  0  0  0  0
  8  9  1  0  0  0  0
  9 10  2  0  0  0  0
 10 11  1  0  0  0  0
  3 11  2  0  0  0  0
  4  8  2  0  0  0  0
 12 13  1  0  0  0  0
 13 14  1  0  0  0  0
 14 15  1  0  0  0  0
 15 16  1  0  0  0  0
  7 16  1  0  0  0  0
  7 12  1  0  0  0  0
M  END
`;

    console.log('Step 1: String Substitution (Pre-parsing)');

    // Replace * with F in the MolBlock string
    // V2000 atom line: x(10) y(10) z(10) space(1) symbol(3)
    // Regex to match lines with * in the symbol column
    // Note: In the test string, spacing might vary, but let's try a robust regex
    // Looking for lines that look like atom lines and have * as symbol

    let modifiedMolBlock = molBlock.replace(/^(\s+[0-9.-]+\s+[0-9.-]+\s+[0-9.-]+\s+)\*(\s+)/gm, '$1F$2');

    // Also handle the case where * might be just * without extra spaces if manually typed, 
    // but V2000 is strict. The user log showed:
    // 1.0161   -3.1727   -0.3924 *   0  0

    console.log('Modified MolBlock (Snippet):');
    console.log(modifiedMolBlock.split('\n').slice(3, 6).join('\n'));

    console.log('\nStep 2: Parse Modified MolBlock');
    let mol = OCL.Molecule.fromMolfile(modifiedMolBlock);
    console.log(`  Atoms: ${mol.getAllAtoms()}`);
    console.log(`  Atom 0: AtomicNo=${mol.getAtomicNo(0)}, Label=${mol.getAtomLabel(0)}`);

    console.log('\nStep 3: Add Implicit Hydrogens');
    console.log(`  Before: ${mol.getAllAtoms()} atoms`);

    mol.addImplicitHydrogens();

    console.log(`  After: ${mol.getAllAtoms()} atoms`);

    // Check if H was added to Atom 1
    const newConnCount = mol.getConnAtoms(1);
    console.log(`  Atom 1 connections after H addition: ${newConnCount}`);
    for (let i = 0; i < newConnCount; i++) {
        const neighbor = mol.getConnAtom(1, i);
        console.log(`    - Neighbor ${neighbor}: AtomicNo=${mol.getAtomicNo(neighbor)}`);
    }

    if (mol.getAllAtoms() > 16) {
        console.log('✅ SUCCESS: Hydrogens added!');
    } else {
        console.log('❌ FAILURE: No hydrogens added.');
    }
}

testRepro().catch(e => console.error(e));
