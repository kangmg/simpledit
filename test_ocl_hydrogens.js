import OCL from 'openchemlib';

// Mock console
const console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

async function testOCLHydrogens() {
    console.log('--- Testing OCL Hydrogen Addition with Dummy Atoms ---');

    // Case 1: Standard Carbon (Control)
    console.log('\n[Case 1] Control: C-C');
    const molControl = new OCL.Molecule(0, 0);
    const c1 = molControl.addAtom(6);
    const c2 = molControl.addAtom(6);
    molControl.addBond(c1, c2, 1);
    console.log(`Before H: C1 Hydrogens=${molControl.getImplicitHydrogens(c1)}`);
    molControl.addImplicitHydrogens();
    console.log(`After H:  C1 Hydrogens=${molControl.getImplicitHydrogens(c1)} (Expected: 3)`);

    // Case 2: Carbon - Dummy (AtomicNo 0)
    console.log('\n[Case 2] C - Dummy (AtomicNo 0)');
    const molDummy = new OCL.Molecule(0, 0);
    const c = molDummy.addAtom(6);
    const d = molDummy.addAtom(0); // Dummy
    molDummy.addBond(c, d, 1);

    console.log(`Before H: C Hydrogens=${molDummy.getImplicitHydrogens(c)}`);
    try {
        molDummy.addImplicitHydrogens();
        console.log(`After H:  C Hydrogens=${molDummy.getImplicitHydrogens(c)}`);
        console.log(`Dummy Atom Label: ${molDummy.getAtomLabel(d)}`);
        console.log(`Dummy AtomicNo: ${molDummy.getAtomicNo(d)}`);
    } catch (e) {
        console.error('Error adding hydrogens:', e.message);
    }

    // Case 3: 3D Generation with Dummy
    console.log('\n[Case 3] 3D Generation with Dummy');
    try {
        // We need to initialize resources for 3D, but we can't in this node env easily without fetch.
        // However, we can check if ConformerGenerator throws immediately.
        const generator = new OCL.ConformerGenerator(42);
        const conformer = generator.getOneConformerAsMolecule(molDummy);
        if (conformer) {
            console.log('3D Generation Success');
            console.log(conformer.toMolfile());
        } else {
            console.log('3D Generation Failed (returned null)');
        }
    } catch (e) {
        console.error('3D Generation Error:', e.message);
    }
}

testOCLHydrogens();
