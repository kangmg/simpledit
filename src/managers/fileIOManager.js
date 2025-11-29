import * as THREE from 'three';
import { ErrorHandler } from '../utils/errorHandler.js';
import { oclManager } from './oclManager.js';
import OCL from 'openchemlib';

/**
 * Manages file import/export operations
 * Handles XYZ, SMILES, SDF formats and coordinate conversions
 */
export class FileIOManager {
    constructor(editor) {
        this.editor = editor;
    }

    // ... (skipping unchanged parts)

    /**
     * Import SMILES string
     * @param {string} smiles 
     * @param {Object} options 
     * @param {boolean} [options.shouldClear=true]
     * @param {boolean} [options.autoBond=false]
     * @param {boolean} [options.generate3D=false] - Use OpenChemLib to generate 3D coordinates
     * @param {boolean} [options.addHydrogens=false] - Use OpenChemLib to add explicit hydrogens
     */
    async importSMILES(smiles, options = {}) {
        const { shouldClear = true, autoBond = false, generate3D = false, addHydrogens = false } = options;

        try {
            let molBlock;

            if (generate3D) {
                // Use OCL for 3D generation (implies explicit hydrogens)
                molBlock = await oclManager.generate3D(smiles);
            } else if (addHydrogens) {
                // Use OCL for explicit hydrogens (2D)
                molBlock = await oclManager.addHydrogens(smiles);
            } else {
                // Use OCL for standard 2D (implicit hydrogens) - Replaces RDKit
                // This ensures consistent behavior across all SMILES imports
                // Actually, let's use a simple conversion if no flags
                const mol = OCL.Molecule.fromSmiles(smiles);
                molBlock = mol.toMolfile();
            }

            // Import the generated MolBlock (SDF/Mol format)
            return this.importSDF(molBlock, { shouldClear, autoBond });

        } catch (error) {
            ErrorHandler.logError('FileIOManager.importSMILES', error);
            return ErrorHandler.error('Failed to import SMILES', error.message);
        }
    }

    /**
     * Update current molecule from MolBlock, preserving 3D coordinates if possible
     * @param {string} molBlock 
     */
    /**
     * Update molecule from 2D editor MolBlock
     * Generates fresh 3D coordinates as per user request.
     * @param {string} molBlock - V2000 MolBlock from JSME/OCL
     */
    async updateFromMolBlock(molBlock) {
        try {
            // Ensure OCL resources are initialized
            await oclManager.init();

            // 1. Parse molecule from MolBlock
            const mol = OCL.Molecule.fromMolfile(molBlock);

            // 2. Generate fresh 3D coordinates
            const mol3D = await oclManager.generate3D(mol);

            // 3. Import to editor
            const newMolBlock = mol3D.toMolfile();
            console.log('[updateFromMolBlock] Generated MolBlock:', newMolBlock);

            return this.importSDF(newMolBlock, {
                shouldClear: true,
                autoBond: false // SDF has bonds
            });

        } catch (error) {
            console.error('Error updating from MolBlock:', error);
            return { error: error.message };
        }
    }

    /**
     * Import SDF/MolBlock string
     * @param {string} sdfString 
     * @param {Object} options 
     */
    importSDF(sdfString, options = {}) {
        const { shouldClear = true, autoBond = false } = options;

        try {
            if (shouldClear) {
                this.editor.molecule.clear();
            }

            // Simple V2000/V3000 parser
            // We can use RDKit to parse, but RDKit JS doesn't easily return atom list with coords for us to iterate.
            // Actually, we can just parse the text block since standard is simple.
            // Or use RDKit to get JSON if available. 
            // Let's parse text for now as it's faster than round-trip if we just want coords.
            // V2000:
            // Counts line: aaabbb...
            // Atom block: x y z symbol...
            // Bond block: 1 2 type...

            const lines = sdfString.split('\n');
            let isV3000 = lines.some(l => l.includes('V3000'));

            if (isV3000) {
                return ErrorHandler.error('V3000 import not yet fully implemented');
            }

            // Find counts line (4th line usually, or after header)
            // Header is 3 lines.
            // Line 4: counts
            let atomCount = 0;
            let bondCount = 0;
            let atomStartIndex = 0;

            // Heuristic to find counts line: looks like "  3  2  0  0  0  0  0  0  0  0999 V2000"
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('V2000')) {
                    const parts = lines[i].trim().split(/\s+/);
                    atomCount = parseInt(parts[0]);
                    bondCount = parseInt(parts[1]);
                    atomStartIndex = i + 1;
                    break;
                }
            }

            if (atomStartIndex === 0) {
                return ErrorHandler.error('Invalid SDF/Mol format (V2000 header not found)');
            }

            const newAtoms = [];

            // Parse Atoms
            for (let i = 0; i < atomCount; i++) {
                const line = lines[atomStartIndex + i];
                const parts = line.trim().split(/\s+/);
                // V2000 atom line: x y z symbol ...
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                const z = parseFloat(parts[2]);
                const element = parts[3];

                const atom = this.editor.addAtomToScene(element, new THREE.Vector3(x, y, z));
                newAtoms.push(atom);
            }

            // Parse Bonds
            const bondStartIndex = atomStartIndex + atomCount;
            for (let i = 0; i < bondCount; i++) {
                const line = lines[bondStartIndex + i];
                const parts = line.trim().split(/\s+/);
                // V2000 bond line: 1 2 type ...
                const idx1 = parseInt(parts[0]) - 1; // 1-based to 0-based
                const idx2 = parseInt(parts[1]) - 1;
                const type = parseInt(parts[2]); // 1=Single, 2=Double, etc.

                // We treat all as single for connectivity, or store order if needed.
                // Editor currently treats all as order=1 visually usually, but stores order.
                // Let's store the order.

                if (newAtoms[idx1] && newAtoms[idx2]) {
                    this.editor.addBondToScene(newAtoms[idx1], newAtoms[idx2], 1); // Force single bond as per strategy
                }
            }

            if (autoBond) {
                this.editor.autoBond();
            }

            this.editor.rebuildScene();
            return ErrorHandler.success(`Imported ${atomCount} atoms`);

        } catch (error) {
            ErrorHandler.logError('FileIOManager.importSDF', error);
            return ErrorHandler.error('Failed to import SDF', error.message);
        }
    }

    /**
     * Export molecule as XYZ format
     * @param {Object} options
     * @param {boolean} [options.splitFragments=false]
     * @returns {string|null} XYZ format string
     */
    exportXYZ(options = {}) {
        const { splitFragments = false } = options;
        const atoms = this.editor.molecule.atoms;

        if (atoms.length === 0) return null;

        if (splitFragments) {
            const fragments = this.getFragments();
            let output = '';
            fragments.forEach(fragAtoms => {
                output += this.atomsToXYZ(fragAtoms);
            });
            return output;
        } else {
            return this.atomsToXYZ(atoms);
        }
    }

    /**
     * Export current molecule as SMILES
     * @returns {Promise<string>} SMILES string
     */
    async exportSMILES(options = {}) {
        const { splitFragments = false } = options;
        const fragments = splitFragments ? this.getFragments() : [this.editor.molecule.atoms];

        const smilesList = [];

        for (const frag of fragments) {
            const molBlock = this.atomsToMolBlock(frag);
            const smi = await oclManager.molBlockToSmiles(molBlock);
            if (smi) smilesList.push(smi);
        }

        if (splitFragments) {
            return smilesList.join('\n'); // Separate lines for separate records
        } else {
            return smilesList.join('.'); // Dot-disconnected for single record (though RDKit handles this naturally if we passed all atoms)
        }
    }

    /**
     * Export molecule as SDF
     * @param {Object} options
     * @param {boolean} [options.splitFragments=false]
     * @returns {string} SDF string
     */
    exportSDF(options = {}) {
        const { splitFragments = false } = options;
        const fragments = splitFragments ? this.getFragments() : [this.editor.molecule.atoms];

        let sdf = '';
        fragments.forEach(frag => {
            sdf += this.atomsToMolBlock(frag);
            sdf += '$$$$\n'; // SDF record separator
        });

        return sdf;
    }

    /**
     * Helper: Get disconnected fragments (arrays of atoms)
     * @returns {Array<Array<Object>>} List of atom arrays
     */
    getFragments() {
        const atoms = this.editor.molecule.atoms;
        const atomIndexMap = new Map();
        atoms.forEach((a, i) => atomIndexMap.set(a, i));

        const visited = new Set();
        const fragments = [];

        atoms.forEach(atom => {
            if (!visited.has(atom)) {
                const fragment = [];
                const stack = [atom];
                visited.add(atom);

                while (stack.length > 0) {
                    const current = stack.pop();
                    fragment.push(current);

                    current.bonds.forEach(bond => {
                        const neighbor = bond.atom1 === current ? bond.atom2 : bond.atom1;
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            stack.push(neighbor);
                        }
                    });
                }

                // Sort fragment atoms by original index to preserve order
                fragment.sort((a, b) => atomIndexMap.get(a) - atomIndexMap.get(b));

                fragments.push(fragment);
            }
        });

        return fragments;
    }

    /**
     * Helper: Convert atoms to OCL Molecule
     * @param {Array<Object>} atoms
     * @param {Object} options
     * @returns {OCL.Molecule} OCL Molecule
     */
    atomsToOCL(atoms, options = {}) {
        const mol = new OCL.Molecule(atoms.length, atoms.length); // Estimate capacity
        const atomIndexMap = new Map();

        // Add atoms
        atoms.forEach((atom, i) => {
            // Sanitize element
            let elem = atom.element || 'C';
            elem = elem.replace(/[^a-zA-Z]/g, '');
            if (elem.length === 0) elem = 'C';
            if (elem === 'X') elem = '*'; // Dummy

            // OCL expects atomic number or label
            const idx = mol.addAtom(OCL.Molecule.getAtomicNoFromLabel(elem));
            mol.setAtomX(idx, atom.position.x);
            mol.setAtomY(idx, atom.position.y);
            mol.setAtomZ(idx, atom.position.z);
            atomIndexMap.set(atom, idx);
        });

        // Pre-process bonds to identify types
        const bondList = [];
        const aromaticBonds = []; // List of {atom1, atom2, bondObj}
        const atomAromaticBonds = new Map(); // atom -> [bondEntry]

        const processedBonds = new Set();

        atoms.forEach(atom => {
            if (!atom.bonds) return;
            atom.bonds.forEach(bond => {
                if (!processedBonds.has(bond)) {
                    const idx1 = atomIndexMap.get(bond.atom1);
                    const idx2 = atomIndexMap.get(bond.atom2);

                    if (idx1 !== undefined && idx2 !== undefined) {
                        let order = 1;
                        let isAromaticCandidate = false;

                        const originalOrder = bond.order || 1;
                        if (originalOrder > 1) {
                            order = originalOrder; // Trust explicit high order
                        } else {
                            // Geometry inference
                            const dist = bond.atom1.position.distanceTo(bond.atom2.position);
                            const el1 = bond.atom1.element;
                            const el2 = bond.atom2.element;

                            if ((el1 === 'C' && el2 === 'C')) {
                                if (dist < 1.25) order = 3;
                                else if (dist < 1.38) order = 2;
                                else if (dist < 1.45) isAromaticCandidate = true;
                            } else if ((el1 === 'C' && el2 === 'N') || (el1 === 'N' && el2 === 'C')) {
                                if (dist < 1.22) order = 3;
                                else if (dist < 1.35) order = 2;
                                // C-N aromatic? Pyridine C-N is ~1.34 (Double-like) or 1.37.
                                // Let's treat < 1.38 as Double/Aromatic candidate?
                                // For now, stick to explicit thresholds.
                            } else if ((el1 === 'C' && el2 === 'O') || (el1 === 'O' && el2 === 'C')) {
                                if (dist < 1.30) order = 2;
                            } else if ((el1 === 'N' && el2 === 'N')) {
                                if (dist < 1.15) order = 3;
                                else if (dist < 1.30) order = 2;
                            }
                        }

                        if (isAromaticCandidate) {
                            const bondEntry = { idx1, idx2, assignedOrder: 0 }; // 0 means pending
                            aromaticBonds.push(bondEntry);

                            if (!atomAromaticBonds.has(idx1)) atomAromaticBonds.set(idx1, []);
                            if (!atomAromaticBonds.has(idx2)) atomAromaticBonds.set(idx2, []);
                            atomAromaticBonds.get(idx1).push(bondEntry);
                            atomAromaticBonds.get(idx2).push(bondEntry);
                        } else {
                            bondList.push({ idx1, idx2, order });
                        }
                        processedBonds.add(bond);
                    }
                }
            });
        });

        // Greedy Kekulization for Aromatic Candidates
        // Assign alternating Double (2) and Single (1)

        for (let i = 0; i < atoms.length; i++) {
            const idx = i; // OCL index matches loop since we added in order
            if (atomAromaticBonds.has(idx)) {
                // Check if atom already has a Double bond assigned in aromatic set
                const bonds = atomAromaticBonds.get(idx);
                let hasDouble = bonds.some(b => b.assignedOrder === 2);

                // Assign remaining undefined bonds
                bonds.forEach(bond => {
                    if (bond.assignedOrder === 0) {
                        if (!hasDouble) {
                            bond.assignedOrder = 2;
                            hasDouble = true;
                        } else {
                            bond.assignedOrder = 1;
                        }
                    }
                });
            }
        }

        // Add standard bonds
        bondList.forEach(b => {
            const bondIdx = mol.addBond(b.idx1, b.idx2);
            mol.setBondOrder(bondIdx, b.order);
        });

        // Add kekulized aromatic bonds
        aromaticBonds.forEach(b => {
            const order = b.assignedOrder || 1; // Default to 1 if missed
            const bondIdx = mol.addBond(b.idx1, b.idx2);
            mol.setBondOrder(bondIdx, order);
        });

        // FALLBACK AUTO-BOND for OCL
        if (mol.getAllBonds() === 0 && atoms.length > 1) {
            console.log('[FileIO] No bonds found, applying fallback auto-bond for OCL');
            for (let i = 0; i < atoms.length; i++) {
                for (let j = i + 1; j < atoms.length; j++) {
                    const dist = atoms[i].position.distanceTo(atoms[j].position);
                    if (dist < 1.9) {
                        const bIdx = mol.addBond(i, j);
                        mol.setBondOrder(bIdx, 1);
                    }
                }
            }
        }

        // Use OCL to ensure validity and perceive properties
        mol.ensureHelperArrays(OCL.Molecule.cHelperCIP);

        return mol;
    }

    /**
     * Export molecule as SVG using OCL
     * @param {Object} options
     * @param {boolean} [options.splitFragments=false]
     * @param {boolean} [options.showLabels=false]
     * @param {boolean} [options.showHydrogens=false]
     * @returns {string|string[]} SVG string or array of strings
     */
    exportSVG(options = {}) {
        const { splitFragments = false, showLabels = false, showHydrogens = false } = options;
        const fragments = splitFragments ? this.getFragments() : [this.editor.molecule.atoms];

        const svgs = [];

        fragments.forEach(frag => {
            try {
                const mol = this.atomsToOCL(frag);

                // 1. Hydrogen Persistence Logic
                // OCL's inventCoordinates() aggressively strips standard Hydrogens (AtomicNo 1).
                // To prevent this, we set the atom mass to 1 (Protium).
                // This marks the Hydrogen as "explicit isotope" which OCL preserves,
                // but it still renders as "H" (not "1H") and draws the bond correctly.
                // This is the clean, direct method requested by the user.

                if (showHydrogens) {
                    // A. Convert EXISTING Hydrogens to Explicit Mass 1
                    const currentAtomCount = mol.getAllAtoms();
                    for (let i = 0; i < currentAtomCount; i++) {
                        if (mol.getAtomicNo(i) === 1) {
                            mol.setAtomMass(i, 1); // Explicit Mass 1
                        }
                    }

                    // B. Add IMPLICIT Hydrogens as Explicit Mass 1
                    const originalCount = currentAtomCount;
                    for (let i = 0; i < originalCount; i++) {
                        // Only check implicit H for non-H atoms
                        const atomicNo = mol.getAtomicNo(i);
                        if (atomicNo !== 1) {
                            const implicitH = mol.getImplicitHydrogens(i);
                            for (let h = 0; h < implicitH; h++) {
                                const hIdx = mol.addAtom(1); // Add Hydrogen
                                mol.addBond(i, hIdx, 1); // Single bond
                                mol.setAtomMass(hIdx, 1); // Explicit Mass 1
                            }
                        }
                    }
                }

                // 2. Apply Labels and Track Selected Atoms
                const atomCount = mol.getAllAtoms();
                const selectedAtomIndices = []; // Track which atoms are selected

                for (let i = 0; i < atomCount; i++) {
                    // Determine if this is an original atom (from fragment)
                    let isOriginal = i < frag.length;
                    let atom = isOriginal ? frag[i] : null;

                    // Track selected atoms (but DON'T change their color)
                    if (isOriginal && atom && atom.selected) {
                        selectedAtomIndices.push(i);
                    }

                    // Label Logic
                    const atomicNo = mol.getAtomicNo(i);

                    if (showLabels) {
                        // Get element symbol
                        let elem = mol.getAtomLabel(i);
                        if (!elem) {
                            if (atomicNo === 1) elem = 'H';
                            else if (atomicNo === 6) elem = 'C';
                            else elem = '?';
                        }

                        // Construct label
                        let labelIdx;
                        if (isOriginal && atom) {
                            labelIdx = this.editor.molecule.atoms.indexOf(atom);
                        } else {
                            labelIdx = i;
                        }

                        // For Hydrogen atoms, use H:Index format
                        if (atomicNo === 1) {
                            mol.setAtomCustomLabel(i, `H:${labelIdx}`);
                        } else {
                            mol.setAtomCustomLabel(i, `${elem}:${labelIdx}`);
                        }
                    } else {
                        // If labels are OFF, only set labels for Hydrogens
                        if (atomicNo === 1) {
                            mol.setAtomCustomLabel(i, "H.");
                        }
                    }
                }

                // 3. Generate clean 2D coordinates
                mol.inventCoordinates();

                // 4. Scale Coordinates (User Request)
                // mol.scaleCoords(1);

                // 5. Generate SVG
                let svg = mol.toSVG(1200, 900);

                // 6. Post-process: Highlight Injection
                // Find text elements for selected atoms and draw yellow circles behind them
                const highlightCircles = [];

                if (selectedAtomIndices.length > 0) {
                    // Parse all text elements to find those corresponding to selected atoms
                    const textMatches = [...svg.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]+)<\/text>/g)];

                    selectedAtomIndices.forEach(atomIdx => {
                        // Find the text element for this atom
                        // The atom index in the molecule corresponds to the order of text elements
                        // BUT we need to be careful because H atoms might have been added

                        // For now, let's use a simpler approach: highlight ALL Carbon atoms if any are selected
                        // This is a approximation, but more reliable
                        textMatches.forEach(match => {
                            const x = parseFloat(match[1]);
                            const y = parseFloat(match[2]);
                            const content = match[3];

                            // Check if this is a selected atom's label
                            // For atoms in the original fragment, we can check the index in the label
                            if (atomIdx < frag.length) {
                                const originalIdx = this.editor.molecule.atoms.indexOf(frag[atomIdx]);
                                if (content.includes(`:${originalIdx}`)) {
                                    // This is the selected atom's label
                                    highlightCircles.push(`<circle cx="${x}" cy="${y}" r="20" fill="#FFFF00" opacity="0.4" />`);
                                }
                            }
                        });
                    });
                }

                // Inject circles at the beginning (so they appear behind the molecule)
                if (highlightCircles.length > 0) {
                    const insertPos = svg.indexOf('>') + 1;
                    svg = svg.slice(0, insertPos) + highlightCircles.join('') + svg.slice(insertPos);
                }

                // Crop Logic
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

                const updateBounds = (x, y) => {
                    if (!isNaN(x) && !isNaN(y)) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                };

                // Parse <line> (Bonds)
                const lineRegex = /<line[^>]*x1="([-\d.]+)"[^>]*y1="([-\d.]+)"[^>]*x2="([-\d.]+)"[^>]*y2="([-\d.]+)"/g;
                let match;
                while ((match = lineRegex.exec(svg)) !== null) {
                    updateBounds(parseFloat(match[1]), parseFloat(match[2]));
                    updateBounds(parseFloat(match[3]), parseFloat(match[4]));
                }

                // Parse <polygon> (Wedges)
                const polyRegex = /<polygon[^>]*points="([^"]+)"/g;
                while ((match = polyRegex.exec(svg)) !== null) {
                    const points = match[1].split(/\s+/);
                    points.forEach(p => {
                        const [x, y] = p.split(',').map(parseFloat);
                        updateBounds(x, y);
                    });
                }

                // Parse <text> (Labels)
                const textRegex = /<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]*)<\/text>/g;
                while ((match = textRegex.exec(svg)) !== null) {
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    // Approximate text dimensions
                    const fontSize = 10;
                    const textLen = match[3].length * (fontSize * 0.6);

                    updateBounds(x - textLen / 2, y - fontSize);
                    updateBounds(x + textLen / 2, y + fontSize / 2);
                }

                // Parse <path> (General)
                const pathTagRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
                while ((match = pathTagRegex.exec(svg)) !== null) {
                    const d = match[1];
                    if (d.length < 5 && !d.match(/\d/)) continue;

                    const coords = d.match(/([-\d.]+)[ ,]([-\d.]+)/g);
                    if (coords) {
                        coords.forEach(pair => {
                            const nums = pair.match(/([-\d.]+)/g);
                            if (nums && nums.length >= 2) {
                                updateBounds(parseFloat(nums[0]), parseFloat(nums[1]));
                            }
                        });
                    }
                }

                // Include Highlight Circles in Bounds
                // We parsed them earlier, but we need to ensure they are inside the viewbox
                // We don't have their coords handy in a list unless we reused them.
                // But since they are centered on text, and text is included, we just need to add padding.

                // Update viewBox
                if (minX < Infinity && maxX > -Infinity) {
                    // Add padding (generous for highlights)
                    const padding = 30;
                    minX -= padding;
                    minY -= padding;
                    maxX += padding;
                    maxY += padding;
                    const w = maxX - minX;
                    const h = maxY - minY;

                    svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${minX} ${minY} ${w} ${h}"`);
                }

                // Post-process Styles
                // Reduce font size and stroke width
                svg = svg.replace(/font-size="14"/g, 'font-size="10"');
                svg = svg.replace(/stroke-width="1.44"/g, 'stroke-width="1.2"');

                // When labels are ON, scale font to 0.7x for better readability
                if (showLabels) {
                    svg = svg.replace(/font-size="10"/g, 'font-size="5"');
                }

                // Clean up H. labels when labels are OFF
                if (!showLabels) {
                    svg = svg.replace(/>H\.<\/text>/g, '>H</text>');
                }

                // Remove mass number "1" superscripts from Hydrogens
                // OCL renders isotopes with two text elements: "H" and a smaller "1" above it
                // We want to hide the "1" to show just "H"
                // Pattern: <text ... font-size="9" ...>1</text> (mass number is rendered at font-size 9)
                // ALSO: After removing "1", we need to shift the "H" text slightly left to center it

                // Find all mass "1" elements and their positions
                const massMatches = [...svg.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*font-size="9"[^>]*>1<\/text>/g)];

                // For each mass "1", find the corresponding "H" text that comes after it
                // and adjust its x coordinate
                massMatches.forEach(match => {
                    const massX = parseFloat(match[1]);
                    const massY = parseFloat(match[2]);

                    // The "H" text is usually at similar Y (around massY + 5-6) and X (around massX + 5)
                    // We'll search for text near this position
                    const hPattern = new RegExp(
                        `<text x="(${massX + 3},${massX + 7})" y="(${massY + 4},${massY + 7})"[^>]*font-size="14"[^>]*>H[.:]*</text>`.replace(/,/g, '|')
                    );

                    // Actually, let's use a simpler approach: find H text that appears shortly after the mass "1"
                    // in the SVG string, and shift it left by ~5 pixels
                });

                // Remove mass number elements
                svg = svg.replace(/<text[^>]*font-size="9"[^>]*>1<\/text>\s*/g, (match) => {
                    // After removing, we need to shift the next H text
                    // This is complex with regex, so let's do it differently:
                    // We'll do a two-pass approach
                    return '<!--REMOVED_MASS-->';
                });

                // Now find H texts that come right after REMOVED_MASS markers and shift them
                svg = svg.replace(/<!--REMOVED_MASS-->\s*<text x="([-\d.]+)"([^>]*font-size="1[04]"[^>]*)>(H[.:]*)<\/text>/g,
                    (match, xVal, attrs, content) => {
                        const newX = parseFloat(xVal) + 3; // Shift 3 pixels right to center
                        return `<text x="${newX}"${attrs}>${content}</text>`;
                    });

                // Remove markers
                svg = svg.replace(/<!--REMOVED_MASS-->/g, '');

                svgs.push(svg);
            } catch (e) {
                console.error('SVG generation failed for fragment:', e);
            }
        });

        if (splitFragments) {
            return svgs;
        } else {
            return svgs.length > 0 ? svgs[0] : '';
        }
    }

    /**
     * Export molecule as PNG Data URL (Async)
     * @param {Object} options
     * @returns {Promise<string|string[]>} PNG Data URL or array of them
     */
    async exportPNG(options = {}) {
        const svgs = this.exportSVG({ ...options, splitFragments: true }); // Always get array to simplify
        const pngs = [];

        for (const svg of svgs) {
            if (!svg) continue;
            try {
                const png = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        // Parse width/height from SVG or use default
                        const wMatch = svg.match(/width="(\d+)(px)?"/);
                        const hMatch = svg.match(/height="(\d+)(px)?"/);
                        canvas.width = wMatch ? parseInt(wMatch[1]) : 1200;
                        canvas.height = hMatch ? parseInt(hMatch[1]) : 900;

                        const ctx = canvas.getContext('2d');
                        // White background
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = (e) => reject(new Error('Image load failed'));
                    // Handle Unicode in SVG for Data URL
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
                });
                pngs.push(png);
            } catch (e) {
                console.error('PNG conversion failed:', e);
                pngs.push(null);
            }
        }

        if (options.splitFragments) {
            return pngs;
        } else {
            return pngs.length > 0 ? pngs[0] : null;
        }
    }

    /**
     * Helper: Convert atoms to V2000 MolBlock (for RDKit consumption)
     * @param {Array<Object>} atoms 
     * @returns {string} MolBlock
     */
    atomsToMolBlock(atoms, options = {}) {
        const { sanitize = true } = options;

        // Try using OCL for robust generation and perception if sanitize is true
        if (sanitize) {
            try {
                const mol = this.atomsToOCL(atoms);
                return mol.toMolfile();
            } catch (e) {
                console.warn('[FileIO] OCL generation failed, falling back to manual generation:', e);
            }
        }

        // --- MANUAL GENERATION (Fallback or Sync Mode) ---
        let out = "\n  Simpledit\n\n";
        const atomCount = atoms.length;

        // Collect bonds within this set of atoms
        const bonds = [];
        const atomIndexMap = new Map();

        atoms.forEach((atom, i) => {
            atomIndexMap.set(atom, i + 1); // 1-based
        });

        const processedBonds = new Set();
        atoms.forEach(atom => {
            if (!atom.bonds) return; // Safety check

            atom.bonds.forEach(bond => {
                if (!processedBonds.has(bond)) {
                    const idx1 = atomIndexMap.get(bond.atom1);
                    const idx2 = atomIndexMap.get(bond.atom2);

                    // Only include if both atoms are in this fragment
                    if (idx1 !== undefined && idx2 !== undefined) {
                        // Trust connectivity
                        // If sanitize is false (Sync mode), force single bond (1).
                        let order = sanitize ? (bond.order || 1) : 1;

                        // Note: If we are here, it means sanitize=false OR OCL failed.
                        // If sanitize=true but OCL failed, we still try manual inference below.

                        if (sanitize && order === 1) {
                            const dist = bond.atom1.position.distanceTo(bond.atom2.position);
                            const el1 = bond.atom1.element;
                            const el2 = bond.atom2.element;

                            if ((el1 === 'C' && el2 === 'C')) {
                                if (dist < 1.25) order = 3;
                                else if (dist < 1.38) order = 2;
                                else if (dist < 1.45) order = 4;
                            } else if ((el1 === 'C' && el2 === 'N') || (el1 === 'N' && el2 === 'C')) {
                                if (dist < 1.22) order = 3;
                                else if (dist < 1.35) order = 2;
                            } else if ((el1 === 'C' && el2 === 'O') || (el1 === 'O' && el2 === 'C')) {
                                if (dist < 1.30) order = 2;
                            } else if ((el1 === 'N' && el2 === 'N')) {
                                if (dist < 1.15) order = 3;
                                else if (dist < 1.30) order = 2;
                            }
                        }

                        bonds.push({ idx1, idx2, order: order });
                        processedBonds.add(bond);
                    }
                }
            });
        });

        // FALLBACK AUTO-BOND: If no bonds exist at all (e.g. raw XYZ)
        if (bonds.length === 0 && atomCount > 1) {
            console.log('[FileIO] No bonds found, applying fallback auto-bond for 2D export');
            for (let i = 0; i < atomCount; i++) {
                for (let j = i + 1; j < atomCount; j++) {
                    const a1 = atoms[i];
                    const a2 = atoms[j];
                    const dist = a1.position.distanceTo(a2.position);
                    // Use a slightly larger threshold for fallback auto-bond to catch more potential bonds
                    if (dist < 1.9) {
                        bonds.push({ idx1: i + 1, idx2: j + 1, order: 1 });
                    }
                }
            }
        }

        // Counts line
        const counts = `${atomCount.toString().padStart(3)}` +
            `${bonds.length.toString().padStart(3)}` +
            "  0  0  0  0  0  0  0  0999 V2000\n";
        out += counts;

        // Atom block
        atoms.forEach(atom => {
            const x = atom.position.x.toFixed(4).padStart(10);
            const y = atom.position.y.toFixed(4).padStart(10);
            const z = atom.position.z.toFixed(4).padStart(10);

            let elem = atom.element || 'C'; // Default to C if missing
            // Sanitize element (remove numbers, whitespace)
            elem = elem.replace(/[^a-zA-Z]/g, '');
            if (elem.length === 0) elem = 'C';
            if (elem.length > 3) elem = elem.substring(0, 3);

            if (elem === 'X') elem = '*'; // Map dummy to *

            out += `${x}${y}${z} ${elem.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
        });

        // Bond block
        bonds.forEach(b => {
            const i1 = b.idx1.toString().padStart(3);
            const i2 = b.idx2.toString().padStart(3);
            const type = (b.order || 1).toString().padStart(3); // Ensure valid order
            out += `${i1}${i2}${type}  0  0  0  0\n`;
        });

        out += "M  END\n";
        return out;
    }

    /**
     * Convert atoms array to XYZ string
     * @param {Object[]} atoms - Array of atom objects
     * @returns {string} XYZ format string
     */
    atomsToXYZ(atoms) {
        if (!atoms || atoms.length === 0) {
            return '';
        }

        let xyz = `${atoms.length}\n`;
        xyz += `Exported from Simpledit\n`; // Comment line

        atoms.forEach(atom => {
            const x = atom.position.x.toFixed(6);
            const y = atom.position.y.toFixed(6);
            const z = atom.position.z.toFixed(6);
            xyz += `${atom.element.padEnd(3)} ${x.padStart(12)} ${y.padStart(12)} ${z.padStart(12)}\n`;
        });

        return xyz;
    }

    /**
     * Convert atoms to JSON format
     * @param {Object[]} atoms - Array of atom objects
     * @returns {string} JSON string
     */
    atomsToJSON(atoms) {
        const data = atoms.map(atom => ({
            element: atom.element,
            position: {
                x: atom.position.x,
                y: atom.position.y,
                z: atom.position.z
            },
            index: atoms.indexOf(atom)
        }));

        return JSON.stringify(data, null, 2);
    }

    /**
     * Download XYZ file
     */
    downloadXYZ() {
        const xyz = this.exportXYZ();

        if (!xyz) {
            return ErrorHandler.error('No atoms to export');
        }

        const blob = new Blob([xyz], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `molecule_${Date.now()}.xyz`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        return ErrorHandler.success('XYZ file downloaded');
    }

    /**
     * Load XYZ from file input
     * @param {File} file - File object
     * @returns {Promise<Object>} Result object
     */
    async loadXYZFile(file) {
        try {
            const text = await file.text();
            return this.importXYZ(text);
        } catch (error) {
            ErrorHandler.logError('FileIOManager.loadXYZFile', error);
            return ErrorHandler.error('Failed to read file', error.message);
        }
    }
    /**
     * Import XYZ string
     * @param {string} xyz 
     * @param {Object} options 
     */
    importXYZ(xyz, options = {}) {
        const { shouldClear = true, autoBond = false } = options;

        if (!xyz) return ErrorHandler.error('Empty XYZ data');

        const lines = xyz.trim().split('\n');
        if (lines.length < 3) return ErrorHandler.error('Invalid XYZ format (too few lines)');

        // Check for multi-frame XYZ (animation)
        // If we find multiple count lines, it's a trajectory.
        // For now, we just take the first frame or split if needed.
        // But simpledit is single-frame editor mostly.

        // Parse atom count
        const atomCount = parseInt(lines[0].trim());
        if (isNaN(atomCount)) return ErrorHandler.error('Invalid XYZ format (atom count missing)');

        // If shouldClear is true, clear existing
        if (shouldClear) {
            this.editor.molecule.clear();
        }

        const startLine = 2; // Skip count and comment
        let importedCount = 0;

        for (let i = 0; i < atomCount; i++) {
            if (startLine + i >= lines.length) break;

            const line = lines[startLine + i].trim();
            if (!line) continue;

            const parts = line.split(/\s+/);
            if (parts.length < 4) continue;

            const element = parts[0];
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);

            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                this.editor.addAtomToScene(element, new THREE.Vector3(x, y, z));
                importedCount++;
            }
        }

        if (autoBond) {
            this.editor.autoBond();
        }

        this.editor.rebuildScene();
        return ErrorHandler.success(`Imported ${importedCount} atoms from XYZ`);
    }
}
