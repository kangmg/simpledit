
import OCL from 'openchemlib';

// Benzene coordinates (approximate flat hexagon, C-C ~1.40A)
const atoms = [
    { x: 1.395, y: 0.000, z: 0.000, elem: 'C' },
    { x: 0.697, y: 1.208, z: 0.000, elem: 'C' },
    { x: -0.697, y: 1.208, z: 0.000, elem: 'C' },
    { x: -1.395, y: 0.000, z: 0.000, elem: 'C' },
    { x: -0.697, y: -1.208, z: 0.000, elem: 'C' },
    { x: 0.697, y: -1.208, z: 0.000, elem: 'C' }
];

// Connectivity (Single bonds ring)
const bonds = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]
];

const mol = new OCL.Molecule(atoms.length, bonds.length);

atoms.forEach((a, i) => {
    const idx = mol.addAtom(6); // Carbon
    mol.setAtomX(idx, a.x);
    mol.setAtomY(idx, a.y);
    mol.setAtomZ(idx, a.z);
});

bonds.forEach(b => {
    mol.addBond(b[0], b[1], 1); // Single bond
});

console.log('Before inventBondOrders:');
for (let i = 0; i < mol.getAllBonds(); i++) {
    console.log(`Bond ${i}: Order ${mol.getBondOrder(i)}`);
}

console.log('Running inventBondOrders...');
mol.inventBondOrders();

console.log('After inventBondOrders:');
for (let i = 0; i < mol.getAllBonds(); i++) {
    console.log(`Bond ${i}: Order ${mol.getBondOrder(i)}`);
}

const molfile = mol.toMolfile();
console.log('Molfile content:');
console.log(molfile);
