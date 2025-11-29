import OCL from 'openchemlib';

console.log('Inspecting OCL Keys...');
console.log(Object.keys(OCL));

if (OCL.StructureView) console.log('StructureView found');
if (OCL.CanvasDrawer) console.log('CanvasDrawer found');

console.log('Done.');
