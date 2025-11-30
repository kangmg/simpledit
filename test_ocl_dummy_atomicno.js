import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

function testOCLDummyAtomicNo() {
    console.log('--- Testing OCL Dummy Atom AtomicNo ---');

    const molBlockTemplate = (symbol) => `
  Simpledit
  Test
  
  1  0  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 ${symbol.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0
M  END
`;

    ['A', '*', '?', 'R'].forEach(symbol => {
        console.log(`\nTesting symbol: "${symbol}"`);
        try {
            const molBlock = molBlockTemplate(symbol);
            const mol = OCL.Molecule.fromMolfile(molBlock);
            const atomicNo = mol.getAtomicNo(0);
            const label = mol.getAtomLabel(0);
            console.log(`AtomicNo: ${atomicNo}`);
            console.log(`Label: "${label}"`);
            console.log(`Is AtomicNo 0? ${atomicNo === 0}`);
        } catch (e) {
            console.error('Error:', e.message);
        }
    });
}

testOCLDummyAtomicNo();
