
import OCL from 'openchemlib';

function testBenzene(bondOrderValue, name) {
    console.log(`\nTesting Benzene with Bond Order: ${name} (${bondOrderValue})`);
    const mol = new OCL.Molecule(6, 6);

    // Add 6 carbons in a hexagon
    for (let i = 0; i < 6; i++) {
        mol.addAtom(6); // Carbon
        const angle = i * 60 * Math.PI / 180;
        mol.setAtomX(i, Math.cos(angle) * 1.40);
        mol.setAtomY(i, Math.sin(angle) * 1.40);
    }

    // Add bonds
    for (let i = 0; i < 6; i++) {
        mol.addBond(i, (i + 1) % 6, bondOrderValue);
    }

    // Check implicit hydrogens
    let totalH = 0;
    for (let i = 0; i < 6; i++) {
        totalH += mol.getImplicitHydrogens(i);
    }
    console.log(`Total Implicit Hydrogens: ${totalH}`);
    console.log(`Expected for Benzene: 6`);
    console.log(`Expected for Cyclohexane: 12`);

    console.log(`Bond Type (0): ${mol.getBondType(0)}`);
    console.log(`Bond Order (0): ${mol.getBondOrder(0)}`);

    // Try calculate properties
    try {
        mol.ensureHelperArrays(OCL.Molecule.cHelperCIP);
        console.log("ensureHelperArrays success");
    } catch (e) {
        console.log("ensureHelperArrays failed: " + e);
    }
}

console.log("cBondTypeSingle:", OCL.Molecule.cBondTypeSingle);
console.log("cBondTypeDouble:", OCL.Molecule.cBondTypeDouble);
console.log("cBondTypeTriple:", OCL.Molecule.cBondTypeTriple);
console.log("cBondTypeDelocalized:", OCL.Molecule.cBondTypeDelocalized);

testBenzene(3, "Order 3 (Triple?)");
testBenzene(2, "Order 2 (Double)");

function testSetBondType() {
    console.log(`\nTesting Benzene with setBondType(cBondTypeDelocalized) + ensureHelperArrays`);
    const mol = new OCL.Molecule(6, 6);
    for (let i = 0; i < 6; i++) {
        mol.addAtom(6);
        const angle = i * 60 * Math.PI / 180;
        mol.setAtomX(i, Math.cos(angle) * 1.40);
        mol.setAtomY(i, Math.sin(angle) * 1.40);
    }
    for (let i = 0; i < 6; i++) {
        const bondIdx = mol.addBond(i, (i + 1) % 6, 1);
        mol.setBondType(bondIdx, OCL.Molecule.cBondTypeDelocalized);
    }

    console.log(`Before ensureHelperArrays:`);
    let totalH = 0;
    for (let i = 0; i < 6; i++) {
        totalH += mol.getImplicitHydrogens(i);
    }
    console.log(`Total Implicit Hydrogens: ${totalH}`);
    console.log(`Bond Type (0): ${mol.getBondType(0)}`);

    try {
        mol.ensureHelperArrays(OCL.Molecule.cHelperCIP);
        console.log(`After ensureHelperArrays:`);
        totalH = 0;
        for (let i = 0; i < 6; i++) {
            totalH += mol.getImplicitHydrogens(i);
        }
        console.log(`Total Implicit Hydrogens: ${totalH}`);
        console.log(`Bond Type (0): ${mol.getBondType(0)}`);
    } catch (e) {
        console.log("ensureHelperArrays failed: " + e);
    }
}

function testKekule() {
    console.log(`\nTesting Benzene with Kekule (1, 2, 1, 2...)`);
    const mol = new OCL.Molecule(6, 6);
    for (let i = 0; i < 6; i++) {
        mol.addAtom(6);
        const angle = i * 60 * Math.PI / 180;
        mol.setAtomX(i, Math.cos(angle) * 1.40);
        mol.setAtomY(i, Math.sin(angle) * 1.40);
    }
    for (let i = 0; i < 6; i++) {
        const order = (i % 2 === 0) ? 2 : 1;
        mol.addBond(i, (i + 1) % 6, order);
    }

    let totalH = 0;
    for (let i = 0; i < 6; i++) {
        totalH += mol.getImplicitHydrogens(i);
    }
    console.log(`Total Implicit Hydrogens: ${totalH}`);

    mol.ensureHelperArrays(OCL.Molecule.cHelperCIP);
    console.log(`After ensureHelperArrays, Bond Type (0): ${mol.getBondType(0)}`);
    console.log(`Is Delocalized? ${mol.isDelocalizedBond(0)}`);
}

function testSetBondOrder() {
    console.log(`\nTesting Benzene with setBondOrder(2) (Double)`);
    const mol = new OCL.Molecule(6, 6);
    for (let i = 0; i < 6; i++) {
        mol.addAtom(6);
        const angle = i * 60 * Math.PI / 180;
        mol.setAtomX(i, Math.cos(angle) * 1.40);
        mol.setAtomY(i, Math.sin(angle) * 1.40);
    }
    for (let i = 0; i < 6; i++) {
        const bondIdx = mol.addBond(i, (i + 1) % 6);
        // Set double bond for all? No, that's impossible (valency 5).
        // Set Kekule with setBondOrder
        const order = (i % 2 === 0) ? 2 : 1;
        mol.setBondOrder(bondIdx, order);
    }

    let totalH = 0;
    for (let i = 0; i < 6; i++) {
        totalH += mol.getImplicitHydrogens(i);
    }
    console.log(`Total Implicit Hydrogens: ${totalH}`);
    console.log(`Bond Type (0): ${mol.getBondType(0)}`);
    console.log(`Bond Order (0): ${mol.getBondOrder(0)}`);
}

function testSetBondQueryFeature() {
    console.log(`\nTesting Benzene with setBondQueryFeature(cBondQFAromatic)`);
    const mol = new OCL.Molecule(6, 6);
    for (let i = 0; i < 6; i++) {
        mol.addAtom(6);
        const angle = i * 60 * Math.PI / 180;
        mol.setAtomX(i, Math.cos(angle) * 1.40);
        mol.setAtomY(i, Math.sin(angle) * 1.40);
    }
    for (let i = 0; i < 6; i++) {
        const bondIdx = mol.addBond(i, (i + 1) % 6); // Single by default
        mol.setBondQueryFeature(bondIdx, OCL.Molecule.cBondQFAromatic, true);
    }

    let totalH = 0;
    for (let i = 0; i < 6; i++) {
        totalH += mol.getImplicitHydrogens(i);
    }
    console.log(`Total Implicit Hydrogens: ${totalH}`);
    console.log(`Bond Type (0): ${mol.getBondType(0)}`);
}

testSetBondQueryFeature();
