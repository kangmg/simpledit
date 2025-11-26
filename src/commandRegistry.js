import * as THREE from 'three';
import { ELEMENTS } from './constants.js';

export class CommandRegistry {
    constructor(editor) {
        this.editor = editor;
        this.commands = new Map();
        this.registerDefaultCommands();
    }

    register(name, aliases, help, execute) {
        const command = { name, aliases, help, execute };
        this.commands.set(name, command);

        // Register aliases
        aliases.forEach(alias => {
            this.commands.set(alias, command);
        });
    }

    get(name) {
        return this.commands.get(name.toLowerCase());
    }

    getAllCommands() {
        const seen = new Set();
        const commands = [];

        this.commands.forEach((cmd) => {
            if (!seen.has(cmd.name)) {
                seen.add(cmd.name);
                commands.push(cmd);
            }
        });

        return commands;
    }

    registerDefaultCommands() {
        // Help command
        this.register('help', ['h'], 'help [command] - Show commands', (args) => {
            if (args.length === 0) {
                const commands = this.getAllCommands();
                let output = 'Available commands:\n';
                commands.forEach(cmd => {
                    const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
                    output += `  ${cmd.name}${aliases}: ${cmd.help}\n`;
                });
                return { info: output };
            }

            const cmd = this.get(args[0]);
            if (!cmd) {
                return { error: `Command '${args[0]}' not found` };
            }
            return { info: cmd.help };
        });

        // List command
        this.register('list', ['ls'], 'list [selected] - List atoms', (args) => {
            const atoms = args[0] === 'selected'
                ? this.editor.molecule.atoms.filter(a => a.selected)
                : this.editor.molecule.atoms;

            if (atoms.length === 0) {
                return { info: 'No atoms' };
            }

            let output = '';
            atoms.forEach((atom, i) => {
                const idx = this.editor.molecule.atoms.indexOf(atom);
                const pos = atom.position;
                output += `${idx}: ${atom.element} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n`;
            });
            return { info: output };
        });

        // Add atom command
        this.register('add', ['a'], 'add <element> [x] [y] [z] OR add <format> (xyz, smi, mol2)', (args) => {
            if (args.length === 0) {
                return { error: 'Usage: add <element> [x] [y] [z] OR add <format>' };
            }

            // Check for heredoc data (passed via special args)
            const heredocIndex = args.indexOf('__heredoc__');
            if (heredocIndex !== -1 && heredocIndex < args.length - 1) {
                const heredocData = args[heredocIndex + 1];
                // Remove heredoc args
                args.splice(heredocIndex, 2);

                // Process based on first arg (format)
                const format = args[0].toLowerCase();
                try {
                    this.editor.saveState();

                    if (format === 'xyz') {
                        this.editor.molecule.fromXYZ(heredocData, false);
                        this.editor.rebuildScene();
                        return { success: 'Atoms added from XYZ data' };
                    } else if (format === 'smi' || format === 'smiles') {
                        return { warning: 'SMILES format parsing not yet implemented' };
                    } else if (format === 'mol2') {
                        return { warning: 'Mol2 format parsing not yet implemented' };
                    }
                } catch (error) {
                    return { error: `Error parsing data: ${error.message}` };
                }
            }

            // Check for format mode (interactive)
            const firstArg = args[0].toLowerCase();
            if (['xyz', 'smi', 'mol2', 'smiles'].includes(firstArg)) {
                const format = firstArg === 'smiles' ? 'smi' : firstArg;

                this.editor.console.startInputMode(`${format.toUpperCase()}> `, (data) => {
                    try {
                        this.editor.saveState();

                        if (format === 'xyz') {
                            this.editor.molecule.fromXYZ(data, false);
                            this.editor.rebuildScene();
                            this.editor.console.print('Atoms added from XYZ data.', 'success');
                        } else {
                            this.editor.console.print(`${format.toUpperCase()} format parsing not yet implemented.`, 'warning');
                        }
                    } catch (error) {
                        this.editor.console.print(`Error parsing ${format.toUpperCase()} data: ${error.message}`, 'error');
                    }
                });

                return null; // Output handled by startInputMode
            }

            // Standard add atom logic
            const element = args[0].toUpperCase();

            // Validate element using ELEMENTS constant
            if (!(element in ELEMENTS)) {
                return { error: `Invalid element: ${element}` };
            }

            let x = 0, y = 0, z = 0;
            if (args.length >= 4) {
                x = parseFloat(args[1]);
                y = parseFloat(args[2]);
                z = parseFloat(args[3]);
                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    return { error: 'Coordinates must be numbers' };
                }
            } else if (args.length > 1) {
                return { error: 'Usage: add <element> [x] [y] [z]' };
            }

            this.editor.saveState();
            const pos = new THREE.Vector3(x, y, z);
            this.editor.addAtomToScene(element, pos);
            return { success: `Added ${element} at (${x}, ${y}, ${z})` };
        });

        // Delete command
        this.register('delete', ['del'], 'delete <index...> OR delete : OR delete 0:3 - Delete atoms', (args) => {
            if (args.length === 0) {
                return { error: 'Usage: delete <index...> OR delete : OR delete 0:3' };
            }

            // Check for ':' (all atoms)
            if (args.length === 1 && args[0] === ':') {
                const count = this.editor.molecule.atoms.length;
                if (count === 0) {
                    return { info: 'No atoms to delete' };
                }
                this.editor.saveState();
                this.editor.molecule.clear();
                this.editor.rebuildScene();
                return { success: `Deleted all ${count} atoms` };
            }

            // Parse indices with range support
            const indices = [];
            for (const arg of args) {
                // Check for range syntax
                if (arg.includes(':')) {
                    const [start, end] = arg.split(':').map(Number);
                    if (isNaN(start) || isNaN(end)) {
                        return { error: `Invalid range: ${arg}` };
                    }
                    for (let i = start; i <= end; i++) {
                        indices.push(i);
                    }
                } else {
                    const idx = parseInt(arg);
                    if (isNaN(idx)) {
                        return { error: `Invalid index: ${arg}` };
                    }
                    indices.push(idx);
                }
            }

            if (indices.length === 0) {
                return { error: 'Invalid indices' };
            }
            const toDelete = [];

            for (const idx of indices) {
                const atom = this.editor.molecule.atoms[idx];
                if (!atom) {
                    return { error: `Atom ${idx} does not exist` };
                }
                toDelete.push(atom);
            }

            this.editor.saveState();

            // Select atoms to delete
            toDelete.forEach(atom => {
                atom.selected = true;
            });

            this.editor.deleteSelected();

            return { success: `Deleted ${toDelete.length} atom(s)` };
        });

        // Select command
        this.register('select', ['sel'], 'select <index...> OR select : OR select 0:3 - Select atoms', (args) => {
            if (args.length === 0) {
                return { error: 'Usage: select <index...> OR select : OR select 0:3' };
            }

            // Check for ':' (all atoms)
            if (args.length === 1 && args[0] === ':') {
                this.editor.clearSelection();
                this.editor.molecule.atoms.forEach(atom => {
                    atom.selected = true;
                    if (!this.editor.selectionOrder.includes(atom)) {
                        this.editor.selectionOrder.push(atom);
                    }
                    this.editor.updateAtomVisuals(atom);
                });
                this.editor.updateSelectionInfo();
                return { success: `Selected all ${this.editor.molecule.atoms.length} atoms` };
            }

            // Parse indices with range support
            const indices = [];
            for (const arg of args) {
                // Check for range syntax (e.g., "0:3" or "1:5")
                if (arg.includes(':')) {
                    const [start, end] = arg.split(':').map(Number);
                    if (isNaN(start) || isNaN(end)) {
                        return { error: `Invalid range: ${arg}` };
                    }
                    for (let i = start; i <= end; i++) {
                        indices.push(i);
                    }
                } else {
                    const idx = parseInt(arg);
                    if (isNaN(idx)) {
                        return { error: `Invalid index: ${arg}` };
                    }
                    indices.push(idx);
                }
            }

            const toSelect = [];

            // Validate all indices
            for (const idx of indices) {
                const atom = this.editor.molecule.atoms[idx];
                if (!atom) {
                    return { error: `Atom ${idx} does not exist` };
                }
                toSelect.push(atom);
            }

            // Clear existing selection
            this.editor.clearSelection();

            // Select new atoms
            toSelect.forEach(atom => {
                atom.selected = true;
                this.editor.updateAtomVisuals(atom);
                this.editor.selectionOrder.push(atom);
            });

            this.editor.updateSelectionInfo();

            return { success: `Selected atoms: ${indices.join(', ')}` };
        });

        // Info command
        this.register('info', ['i'], 'info [idx...] - Show atom info/distance/angle/dihedral', (args) => {
            if (args.length === 0) {
                const selected = this.editor.molecule.atoms.filter(a => a.selected);
                if (selected.length === 0) return { info: 'No atoms selected' };

                let output = '';
                selected.forEach(atom => {
                    const idx = this.editor.molecule.atoms.indexOf(atom);
                    const pos = atom.position;
                    output += `${idx}: ${atom.element} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n`;
                });
                return { info: output };
            }

            const indices = args.map(a => parseInt(a));
            const atoms = indices.map(i => this.editor.molecule.atoms[i]);

            for (let i = 0; i < atoms.length; i++) {
                if (!atoms[i]) return { error: `Atom ${indices[i]} does not exist` };
            }

            if (atoms.length === 1) {
                const atom = atoms[0];
                const pos = atom.position;
                return { info: `${indices[0]}: ${atom.element} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})` };
            } else if (atoms.length === 2) {
                const dist = atoms[0].position.distanceTo(atoms[1].position);
                return { info: `Distance: ${dist.toFixed(3)} Å` };
            } else if (atoms.length === 3) {
                const v1 = atoms[0].position.clone().sub(atoms[1].position);
                const v2 = atoms[2].position.clone().sub(atoms[1].position);
                const angle = v1.angleTo(v2) * (180 / Math.PI);
                return { info: `Angle: ${angle.toFixed(2)}°` };
            } else if (atoms.length === 4) {
                const [a1, a2, a3, a4] = atoms.map(a => a.position);
                const b1 = a2.clone().sub(a1);
                const b2 = a3.clone().sub(a2);
                const b3 = a4.clone().sub(a3);
                const n1 = b1.clone().cross(b2).normalize();
                const n2 = b2.clone().cross(b3).normalize();
                let angle = Math.acos(Math.max(-1, Math.min(1, n1.dot(n2))));
                const sign = b1.dot(n2);
                if (sign < 0) angle = -angle;
                angle = angle * (180 / Math.PI);
                return { info: `Dihedral: ${angle.toFixed(2)}°` };
            } else {
                return { error: 'Usage: info [idx1] [idx2] [idx3] [idx4]' };
            }
        });

        // Bond command
        this.register('bond', ['b'], 'bond <idx1> <idx2> - Create bond', (args) => {
            if (args.length !== 2) return { error: 'Usage: bond <idx1> <idx2>' };

            const [idx1, idx2] = args.map(a => parseInt(a));
            const atom1 = this.editor.molecule.atoms[idx1];
            const atom2 = this.editor.molecule.atoms[idx2];

            if (!atom1 || !atom2) return { error: 'Invalid atom index' };
            if (this.editor.molecule.getBond(atom1, atom2)) {
                return { warning: 'Bond already exists' };
            }

            this.editor.saveState();
            this.editor.addBondToScene(atom1, atom2, 1);
            return { success: `Created bond between ${idx1} and ${idx2}` };
        });

        // Unbond command
        this.register('unbond', ['ub'], 'unbond <idx1> <idx2> - Remove bond', (args) => {
            if (args.length !== 2) return { error: 'Usage: unbond <idx1> <idx2>' };

            const [idx1, idx2] = args.map(a => parseInt(a));
            const atom1 = this.editor.molecule.atoms[idx1];
            const atom2 = this.editor.molecule.atoms[idx2];

            if (!atom1 || !atom2) return { error: 'Invalid atom index' };

            const bond = this.editor.molecule.getBond(atom1, atom2);
            if (!bond) return { error: 'No bond exists between atoms' };

            this.editor.saveState();
            this.editor.removeBond(bond);
            return { success: `Removed bond between ${idx1} and ${idx2}` };
        });

        // Label command
        this.register('label', ['lbl'], 'label -s|-n|-a|off - Control labels', (args) => {
            if (args.length !== 1) return { error: 'Usage: label -s|-n|-a|off' };

            const modeMap = {
                '-s': 'symbol',
                '-n': 'number',
                '-a': 'both',
                'off': 'none'
            };

            const mode = modeMap[args[0]];
            if (!mode) return { error: 'Invalid option. Use -s, -n, -a, or off' };

            this.editor.labelMode = mode;
            this.editor.updateAllLabels();

            const modeNames = {
                'symbol': 'Symbol only',
                'number': 'Number only',
                'both': 'Symbol + Number',
                'none': 'Hidden'
            };

            return { success: `Labels: ${modeNames[mode]}` };
        });

        // Set distance command
        this.register('setdist', ['sd'], 'setdist <idx1> <idx2> <value> - Set bond length', (args) => {
            if (args.length !== 3) return { error: 'Usage: setdist <idx1> <idx2> <value>' };

            const idx1 = parseInt(args[0]);
            const idx2 = parseInt(args[1]);
            const value = parseFloat(args[2]);

            if (isNaN(value) || value <= 0) return { error: 'Distance must be a positive number' };

            const atom1 = this.editor.molecule.atoms[idx1];
            const atom2 = this.editor.molecule.atoms[idx2];

            if (!atom1 || !atom2) return { error: 'Invalid atom index' };

            // Clear selection and select these two atoms
            this.editor.molecule.atoms.forEach(a => a.selected = false);
            atom1.selected = true;
            atom2.selected = true;
            this.editor.selectionOrder = [atom1, atom2];

            this.editor.saveState();

            // Update slider and call setBondLength
            document.getElementById('input-length').value = value;
            this.editor.setBondLength();

            return { success: `Set distance to ${value.toFixed(3)} Å` };
        });

        // Set angle command
        this.register('setangle', ['sa'], 'setangle <idx1> <idx2> <idx3> <value> - Set angle', (args) => {
            if (args.length !== 4) return { error: 'Usage: setangle <idx1> <idx2> <idx3> <value>' };

            const idx1 = parseInt(args[0]);
            const idx2 = parseInt(args[1]);
            const idx3 = parseInt(args[2]);
            const value = parseFloat(args[3]);

            if (isNaN(value) || value < 0 || value > 180) {
                return { error: 'Angle must be between 0 and 180 degrees' };
            }

            const atom1 = this.editor.molecule.atoms[idx1];
            const atom2 = this.editor.molecule.atoms[idx2];
            const atom3 = this.editor.molecule.atoms[idx3];

            if (!atom1 || !atom2 || !atom3) return { error: 'Invalid atom index' };

            this.editor.molecule.atoms.forEach(a => a.selected = false);
            atom1.selected = true;
            atom2.selected = true;
            atom3.selected = true;
            this.editor.selectionOrder = [atom1, atom2, atom3];

            this.editor.saveState();

            document.getElementById('input-angle').value = value;
            this.editor.setBondAngle();

            return { success: `Set angle to ${value.toFixed(2)}°` };
        });

        // Set dihedral command
        this.register('setdihedral', ['sdi'], 'setdihedral <idx1> <idx2> <idx3> <idx4> <value> - Set dihedral', (args) => {
            if (args.length !== 5) return { error: 'Usage: setdihedral <idx1> <idx2> <idx3> <idx4> <value>' };

            const idx1 = parseInt(args[0]);
            const idx2 = parseInt(args[1]);
            const idx3 = parseInt(args[2]);
            const idx4 = parseInt(args[3]);
            const value = parseFloat(args[4]);

            if (isNaN(value) || value < -180 || value > 180) {
                return { error: 'Dihedral must be between -180 and 180 degrees' };
            }

            const atom1 = this.editor.molecule.atoms[idx1];
            const atom2 = this.editor.molecule.atoms[idx2];
            const atom3 = this.editor.molecule.atoms[idx3];
            const atom4 = this.editor.molecule.atoms[idx4];

            if (!atom1 || !atom2 || !atom3 || !atom4) return { error: 'Invalid atom index' };

            this.editor.molecule.atoms.forEach(a => a.selected = false);
            atom1.selected = true;
            atom2.selected = true;
            atom3.selected = true;
            atom4.selected = true;
            this.editor.selectionOrder = [atom1, atom2, atom3, atom4];

            this.editor.saveState();

            document.getElementById('input-dihedral').value = value;
            this.editor.setDihedralAngle();

            return { success: `Set dihedral to ${value.toFixed(2)}°` };
        });

        // Camera command
        this.register('camera', ['cam'], 'camera orbit|trackball - Change camera mode', (args) => {
            if (args.length !== 1) return { error: 'Usage: camera orbit|trackball' };

            const mode = args[0].toLowerCase();
            if (mode !== 'orbit' && mode !== 'trackball') {
                return { error: 'Invalid mode. Use orbit or trackball' };
            }

            this.editor.renderer.setCameraMode(mode);
            // Update UI select
            document.getElementById('camera-mode').value = mode;
            return { success: `Camera mode: ${mode}` };
        });

        // Projection command
        this.register('projection', ['proj'], 'projection perspective|orthographic - Change projection', (args) => {
            if (args.length !== 1) return { error: 'Usage: projection perspective|orthographic' };

            const type = args[0].toLowerCase();
            if (type === 'perspective' || type === 'persp') {
                this.editor.renderer.setProjection('perspective');
                // Update UI select
                document.getElementById('projection-mode').value = 'perspective';
                return { success: 'Projection: Perspective' };
            } else if (type === 'orthographic' || type === 'ortho') {
                this.editor.renderer.setProjection('orthographic');
                // Update UI select
                document.getElementById('projection-mode').value = 'orthographic';
                return { success: 'Projection: Orthographic' };
            } else {
                return { error: 'Invalid type. Use perspective or orthographic' };
            }
        });

        // Fragment command
        this.register('fragment', ['frag'], 'fragment <index> - Select fragment containing atom', (args) => {
            if (args.length !== 1) return { error: 'Usage: fragment <index>' };

            const idx = parseInt(args[0]);
            const atom = this.editor.molecule.atoms[idx];

            if (!atom) return { error: `Atom ${idx} does not exist` };

            const fragment = this.editor.getConnectedAtoms(atom, null);

            // Select all atoms in fragment
            this.editor.clearSelection();
            fragment.forEach(a => {
                a.selected = true;
                this.editor.selectionOrder.push(a);
                this.editor.updateAtomVisuals(a);
            });

            return { success: `Selected fragment with ${fragment.size} atoms` };
        });

        // Fragments command  
        this.register('fragments', ['frags'], 'fragments - List all fragments', (args) => {
            const visited = new Set();
            const fragments = [];

            this.editor.molecule.atoms.forEach(atom => {
                if (!visited.has(atom)) {
                    const fragment = this.editor.getConnectedAtoms(atom, null);
                    fragment.forEach(a => visited.add(a));

                    const indices = Array.from(fragment).map(a =>
                        this.editor.molecule.atoms.indexOf(a)
                    );
                    fragments.push(indices);
                }
            });

            if (fragments.length === 0) return { info: 'No fragments' };

            let output = '';
            fragments.forEach((frag, i) => {
                output += `Fragment ${i}: atoms [${frag.join(',')}] (${frag.length} atoms)\n`;
            });
            return { info: output };
        });

        // Adjust bond command
        this.register('adjustbond', ['ab'], 'adjustbond - Auto-adjust bonds', (args) => {
            this.editor.saveState();

            // Clear all existing bonds
            this.editor.molecule.bonds = [];
            this.editor.molecule.atoms.forEach(atom => {
                atom.bonds = [];
            });

            // Rebuild scene to update visuals and re-add bonds
            this.editor.rebuildScene();

            return { success: 'Bonds adjusted' };
        });

        // Set threshold command
        this.register('setthreshold', ['st'], 'setthreshold <value> - Set bond threshold (default: 1.2)', (args) => {
            if (args.length !== 1) {
                return { error: 'Usage: setthreshold <value>' };
            }

            const value = parseFloat(args[0]);
            if (isNaN(value) || value <= 0) {
                return { error: 'Threshold must be a positive number' };
            }

            // Update UI slider and value display
            document.getElementById('bond-threshold').value = value;
            document.getElementById('val-bond-threshold').textContent = value.toFixed(1);
            return { success: `Bond threshold set to ${value.toFixed(2)}` };
        });

        // Clear command
        this.register('clear', ['cls'], 'clear - Clear console output', (args) => {
            this.editor.console.clear();
            return null; // No output needed
        });

        // Molecule Management Commands

        // List molecules
        this.register('molecules', ['mols'], 'molecules - List all molecules', (args) => {
            const molecules = this.editor.moleculeManager.molecules;
            const activeIndex = this.editor.moleculeManager.activeMoleculeIndex;

            let output = '';
            molecules.forEach((entry, i) => {
                const active = i === activeIndex ? '*' : ' ';
                output += `${active} ${i}: ${entry.name} (${entry.molecule.atoms.length} atoms)\n`;
            });
            return { info: output };
        });

        // New molecule command
        this.register('new', [], 'new [name] - Create new molecule', (args) => {
            const name = args.join(' ');
            const result = this.editor.moleculeManager.createMolecule(name);

            if (result.error) {
                return { error: result.error };
            }

            return { success: `Created new molecule "${result.name}"` };
        });

        // Switch molecule
        this.register('switch', ['sw'], 'switch <index|name> - Switch active molecule', (args) => {
            if (args.length === 0) return { error: 'Usage: switch <index|name>' };

            const target = args.join(' ');
            let index = parseInt(target);

            // If not a number, try to find by name
            if (isNaN(index)) {
                index = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
                if (index === -1) return { error: `Molecule "${target}" not found` };
            }

            const result = this.editor.moleculeManager.switchMolecule(index);
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Remove molecule
        this.register('remove', ['rm'], 'remove [index|name] - Remove molecule', (args) => {
            let index;

            if (args.length === 0) {
                // Remove current
                index = this.editor.moleculeManager.activeMoleculeIndex;
            } else {
                const target = args.join(' ');
                index = parseInt(target);

                if (isNaN(index)) {
                    index = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
                    if (index === -1) return { error: `Molecule "${target}" not found` };
                }
            }

            const result = this.editor.moleculeManager.removeMolecule(index);
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Rename molecule
        this.register('rename', ['rn'], 'rename <name> - Rename active molecule', (args) => {
            if (args.length === 0) return { error: 'Usage: rename <name>' };

            const newName = args.join(' ');
            const index = this.editor.moleculeManager.activeMoleculeIndex;

            const result = this.editor.moleculeManager.renameMolecule(index, newName);
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Copy selection command
        this.register('copy', ['cp'], 'copy - Copy selected atoms to clipboard', (args) => {
            const result = this.editor.moleculeManager.copySelection();
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Paste clipboard command
        this.register('paste', ['pa'], 'paste [-offset <dist>] - Paste clipboard atoms', (args) => {
            let minDistance = 0;
            const offsetIdx = args.indexOf('-offset');
            if (offsetIdx !== -1 && offsetIdx < args.length - 1) {
                const val = parseFloat(args[offsetIdx + 1]);
                if (!isNaN(val)) minDistance = val;
            }
            const result = this.editor.moleculeManager.pasteClipboard(minDistance);
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Cut command (copy + delete)
        this.register('cut', ['ct'], 'cut - Cut selected atoms', (args) => {
            const copyResult = this.editor.moleculeManager.copySelection();
            if (copyResult.error) return { error: copyResult.error };

            // Delete selected atoms
            this.editor.saveState();
            this.editor.deleteSelected();

            return { success: `Cut ${this.editor.moleculeManager.clipboard.atoms.length} atom(s)` };
        });

        // Merge command
        this.register('merge', ['mg'], 'merge <index|name> - Merge molecule into active', (args) => {
            if (args.length === 0) return { error: 'Usage: merge <index|name>' };

            const target = args.join(' ');
            let index;

            if (!isNaN(target)) {
                index = parseInt(target);
            } else {
                index = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
                if (index === -1) return { error: `Molecule "${target}" not found` };
            }

            const result = this.editor.moleculeManager.mergeMolecule(index);
            if (result.error) return { error: result.error };
            return { success: result.success };
        });

        // Time/Sleep/Wait command for test delays
        this.register('time', ['sleep', 'wait'], 'time <seconds> - Wait for specified seconds', (args) => {
            if (args.length === 0) return { error: 'Usage: time <seconds>' };

            const seconds = parseFloat(args[0]);
            if (isNaN(seconds) || seconds <= 0) {
                return { error: 'Seconds must be a positive number' };
            }

            // Return a promise that resolves after the delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ info: `Waited ${seconds} second(s)` });
                }, seconds * 1000);
            });
        });

        // Capture command
        this.register('capture', ['cap'], 'capture [bg|nobg] - Capture molecule snapshot', (args) => {
            const molecule = this.editor.molecule;
            if (molecule.atoms.length === 0) {
                return { error: 'No atoms to capture' };
            }

            // Parse background option
            let transparentBg = false;
            if (args.length > 0) {
                const bgOption = args[0].toLowerCase();
                if (bgOption === 'nobg') {
                    transparentBg = true;
                } else if (bgOption !== 'bg') {
                    return { error: 'Usage: capture [bg|nobg]' };
                }
            }

            // Collect all objects to capture (atoms, bonds, labels)
            const objects = [];

            // Add atom meshes
            this.editor.renderer.scene.traverse(obj => {
                if (obj.userData && obj.userData.type === 'atom') {
                    objects.push(obj);
                }
            });

            // Add bond meshes
            this.editor.renderer.scene.traverse(obj => {
                if (obj.userData && obj.userData.type === 'bond') {
                    objects.push(obj);
                }
            });

            // Add labels
            this.editor.renderer.scene.traverse(obj => {
                if (obj.userData && obj.userData.type === 'label') {
                    objects.push(obj);
                }
            });

            if (objects.length === 0) {
                return { error: 'No visible objects to capture' };
            }

            // Capture snapshot
            const dataURL = this.editor.renderer.captureSnapshot(objects, transparentBg);

            if (!dataURL) {
                return { error: 'Failed to capture snapshot' };
            }

            // Display in console
            this.editor.console.print(dataURL, 'image');

            const bgText = transparentBg ? 'transparent' : 'white';
            return { success: `Snapshot captured (background: ${bgText})` };
        });
    }
}
