import * as THREE from 'three';
import { ELEMENTS } from './constants.js';
import { GeometryEngine } from './geometryEngine.js';

export class CommandRegistry {
    constructor(editor) {
        this.editor = editor;
        this.commands = new Map();
        this.registerDefaultCommands();
    }

    register(name, aliases, help, arg4, arg5) {
        let execute, options;
        if (typeof arg4 === 'function') {
            execute = arg4;
            options = arg5 || {};
        } else {
            options = arg4 || {};
            execute = arg5;
        }

        const command = { name, aliases, help, execute, ...options };
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

        // List command (Consolidated)
        this.register('list', ['ls', 'l'], 'list [mols|frags|atoms] [options] - List objects', (args) => {
            const type = args.length > 0 && !args[0].startsWith('-') ? args[0].toLowerCase() : 'atoms';

            if (type === 'mols' || type === 'molecules') {
                const molecules = this.editor.moleculeManager.molecules;
                const activeIndex = this.editor.moleculeManager.activeMoleculeIndex;
                let output = '';
                molecules.forEach((entry, i) => {
                    const active = i === activeIndex ? '*' : ' ';
                    output += `${active} ${i}: ${entry.name} (${entry.molecule.atoms.length} atoms)\n`;
                });
                return { info: output };
            }
            else if (type === 'frags' || type === 'fragments') {
                const visited = new Set();
                const fragments = [];
                this.editor.molecule.atoms.forEach(atom => {
                    if (!visited.has(atom)) {
                        const fragment = this.editor.getConnectedAtoms(atom, null);
                        fragment.forEach(a => visited.add(a));
                        const indices = Array.from(fragment).map(a => this.editor.molecule.atoms.indexOf(a));
                        fragments.push(indices);
                    }
                });
                if (fragments.length === 0) return { info: 'No fragments' };
                let output = '';
                fragments.forEach((frag, i) => {
                    output += `Fragment ${i}: atoms [${frag.join(',')}] (${frag.length} atoms)\n`;
                });
                return { info: output };
            }
            else { // Default: list atoms
                const selectedOnly = args.includes('-s') || args.includes('--selected') || (args[0] === 'selected'); // Backward compat
                const atoms = selectedOnly
                    ? this.editor.molecule.atoms.filter(a => a.selected)
                    : this.editor.molecule.atoms;

                if (atoms.length === 0) return { info: 'No atoms' };

                let output = '';
                atoms.forEach((atom) => {
                    const idx = this.editor.molecule.atoms.indexOf(atom);
                    const pos = atom.position;
                    output += `${idx}: ${atom.element} (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n`;
                });
                return { info: output };
            }
        });

        // Add command (Consolidated)
        this.register('add', ['a'], 'add [atom|bond|mol] ...', { isDestructive: true }, (args) => {
            if (args.length === 0) return { error: 'Usage: add [atom|bond|mol] ...' };

            // Check for heredoc data
            const heredocIndex = args.indexOf('__heredoc__');
            if (heredocIndex !== -1) {
                const heredocData = args[heredocIndex + 1];
                // Expect: add mol <format> <<EOF
                if (args[0].toLowerCase() !== 'mol' && args[0].toLowerCase() !== 'molecule') {
                    return { error: 'Heredoc only supported for "add mol <format>"' };
                }
                const format = args[1].toLowerCase();
                try {
                    if (format === 'xyz') {
                        this.editor.molecule.fromXYZ(heredocData, false);
                        this.editor.rebuildScene();
                        return { success: 'Atoms added from XYZ data' };
                    }
                    return { warning: `${format} format not implemented` };
                } catch (e) {
                    return { error: e.message };
                }
            }

            const subCmd = args[0].toLowerCase();

            // add bond <idx1> <idx2>
            if (subCmd === 'bond') {
                if (args.length !== 3) return { error: 'Usage: add bond <idx1> <idx2>' };
                const idx1 = parseInt(args[1]);
                const idx2 = parseInt(args[2]);
                const atom1 = this.editor.molecule.atoms[idx1];
                const atom2 = this.editor.molecule.atoms[idx2];
                if (!atom1 || !atom2) return { error: 'Invalid atom index' };
                if (this.editor.molecule.getBond(atom1, atom2)) return { warning: 'Bond already exists' };

                this.editor.addBondToScene(atom1, atom2, 1);
                return { success: `Created bond ${idx1}-${idx2}` };
            }

            // add atom <element> [x] [y] [z]
            if (subCmd === 'atom') {
                if (args.length < 2) return { error: 'Usage: add atom <element> [x] [y] [z]' };
                const element = args[1].toUpperCase();
                if (!(element in ELEMENTS)) return { error: `Invalid element: ${element}` };

                let x = 0, y = 0, z = 0;
                if (args.length >= 5) {
                    x = parseFloat(args[2]);
                    y = parseFloat(args[3]);
                    z = parseFloat(args[4]);
                }

                if (isNaN(x) || isNaN(y) || isNaN(z)) return { error: 'Coordinates must be numbers' };

                this.editor.addAtomToScene(element, new THREE.Vector3(x, y, z));
                return { success: `Added ${element} at (${x}, ${y}, ${z})` };
            }

            // add mol <format>
            if (subCmd === 'mol' || subCmd === 'molecule') {
                if (args.length < 2) return { error: 'Usage: add mol <format>' };
                const format = args[1].toLowerCase();

                if (['xyz', 'smi', 'mol2'].includes(format)) {
                    // Interactive format mode
                    this.editor.console.startInputMode(`${format.toUpperCase()}> `, (data) => {
                        try {
                            if (format === 'xyz') {
                                this.editor.molecule.fromXYZ(data, false);
                                this.editor.rebuildScene();
                                this.editor.console.print('Atoms added from XYZ data.', 'success');
                            } else {
                                this.editor.console.print('Format not implemented', 'warning');
                            }
                        } catch (e) {
                            this.editor.console.print(e.message, 'error');
                        }
                    });
                    return null;
                }
                return { error: `Unknown format: ${format}` };
            }

            return { error: `Unknown subcommand: ${subCmd}. Use 'atom', 'bond', or 'mol'.` };
        });

        // Delete command (Consolidated)
        this.register('del', ['delete', 'rm', 'remove'], 'del [atom|mol|bond] ... - Delete objects', { isDestructive: true }, (args) => {
            if (args.length === 0) return { error: 'Usage: del [atom|mol|bond] ...' };

            const subCmd = args[0].toLowerCase();

            // del mol <index|name>
            if (subCmd === 'mol' || subCmd === 'molecule' || subCmd === 'mols') {
                if (args.length < 2) {
                    // Remove current
                    const result = this.editor.moleculeManager.removeMolecule(this.editor.moleculeManager.activeMoleculeIndex);
                    return result.error ? { error: result.error } : { success: result.success };
                }
                const target = args.slice(1).join(' ');
                let index = parseInt(target);
                if (isNaN(index)) {
                    index = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
                    if (index === -1) return { error: `Molecule "${target}" not found` };
                }
                const result = this.editor.moleculeManager.removeMolecule(index);
                return result.error ? { error: result.error } : { success: result.success };
            }

            // del bond <idx1> <idx2>
            if (subCmd === 'bond') {
                if (args.length !== 3) return { error: 'Usage: del bond <idx1> <idx2>' };
                const idx1 = parseInt(args[1]);
                const idx2 = parseInt(args[2]);
                const atom1 = this.editor.molecule.atoms[idx1];
                const atom2 = this.editor.molecule.atoms[idx2];
                if (!atom1 || !atom2) return { error: 'Invalid atom index' };
                const bond = this.editor.molecule.getBond(atom1, atom2);
                if (!bond) return { error: 'No bond found' };

                this.editor.removeBond(bond);
                return { success: `Removed bond ${idx1}-${idx2}` };
            }

            // del atom <indices>
            if (subCmd === 'atoms' || subCmd === 'atom') {
                const indicesArgs = args.slice(1);

                // Handle ':' (all)
                if (indicesArgs.length === 1 && indicesArgs[0] === ':') {
                    const count = this.editor.molecule.atoms.length;
                    if (count === 0) return { info: 'No atoms' };
                    this.editor.molecule.clear();
                    this.editor.rebuildScene();
                    return { success: `Deleted all ${count} atoms` };
                }

                // Parse indices
                const indices = [];
                for (const arg of indicesArgs) {
                    if (arg.includes(':')) {
                        const [start, end] = arg.split(':').map(Number);
                        if (isNaN(start) || isNaN(end)) return { error: `Invalid range: ${arg}` };
                        for (let i = start; i <= end; i++) indices.push(i);
                    } else {
                        const idx = parseInt(arg);
                        if (!isNaN(idx)) indices.push(idx);
                    }
                }

                if (indices.length === 0) return { error: 'No valid indices provided' };

                const toDelete = indices.map(i => this.editor.molecule.atoms[i]).filter(a => a);
                toDelete.forEach(a => a.selected = true);
                this.editor.deleteSelected();
                return { success: `Deleted ${toDelete.length} atom(s)` };
            }

            return { error: `Unknown subcommand: ${subCmd}. Use 'atom', 'bond', or 'mol'.` };
        });


        // Set command (Consolidated)
        this.register('set', [], 'set [dist|angle|dihedral|threshold] ... - Set properties', { isDestructive: true }, (args) => {
            if (args.length < 2) return { error: 'Usage: set [property] [values...]' };

            const prop = args[0].toLowerCase();
            const vals = args.slice(1);

            if (prop === 'dist' || prop === 'distance') {
                if (vals.length !== 3) return { error: 'Usage: set dist <idx1> <idx2> <val>' };
                const idx1 = parseInt(vals[0]);
                const idx2 = parseInt(vals[1]);
                const val = parseFloat(vals[2]);
                if (isNaN(val) || val <= 0) return { error: 'Invalid distance' };

                const atom1 = this.editor.molecule.atoms[idx1];
                const atom2 = this.editor.molecule.atoms[idx2];
                if (!atom1 || !atom2) return { error: 'Invalid atoms' };

                this.editor.molecule.atoms.forEach(a => a.selected = false);
                atom1.selected = true; atom2.selected = true;
                this.editor.selectionOrder = [atom1, atom2];

                document.getElementById('input-length').value = val;
                this.editor.setBondLength();
                return { success: `Distance set to ${val}` };
            }

            if (prop === 'angle') {
                if (vals.length !== 4) return { error: 'Usage: set angle <idx1> <idx2> <idx3> <val>' };
                const idx1 = parseInt(vals[0]);
                const idx2 = parseInt(vals[1]);
                const idx3 = parseInt(vals[2]);
                const val = parseFloat(vals[3]);
                if (isNaN(val)) return { error: 'Invalid angle' };

                const atoms = [idx1, idx2, idx3].map(i => this.editor.molecule.atoms[i]);
                if (atoms.some(a => !a)) return { error: 'Invalid atoms' };

                this.editor.molecule.atoms.forEach(a => a.selected = false);
                atoms.forEach(a => a.selected = true);
                this.editor.selectionOrder = atoms;

                document.getElementById('input-angle').value = val;
                this.editor.setBondAngle();
                return { success: `Angle set to ${val}` };
            }

            if (prop === 'dihedral') {
                if (vals.length !== 5) return { error: 'Usage: set dihedral <idx1> <idx2> <idx3> <idx4> <val>' };
                const idx1 = parseInt(vals[0]);
                const idx2 = parseInt(vals[1]);
                const idx3 = parseInt(vals[2]);
                const idx4 = parseInt(vals[3]);
                const val = parseFloat(vals[4]);
                if (isNaN(val)) return { error: 'Invalid angle' };

                const atoms = [idx1, idx2, idx3, idx4].map(i => this.editor.molecule.atoms[i]);
                if (atoms.some(a => !a)) return { error: 'Invalid atoms' };

                this.editor.molecule.atoms.forEach(a => a.selected = false);
                atoms.forEach(a => a.selected = true);
                this.editor.selectionOrder = atoms;

                document.getElementById('input-dihedral').value = val;
                this.editor.setDihedralAngle();
                return { success: `Dihedral set to ${val}` };
            }

            if (prop === 'threshold') {
                const val = parseFloat(vals[0]);
                if (isNaN(val) || val <= 0) return { error: 'Invalid threshold' };
                document.getElementById('bond-threshold').value = val;
                document.getElementById('val-bond-threshold').textContent = val.toFixed(1);
                return { success: `Threshold set to ${val}` };
            }

            return { error: `Unknown property: ${prop}` };
        });

        // Measure command (Replaces info)
        this.register('measure', ['meas', 'info'], 'measure <idx...> - Measure geometry', (args) => {
            if (args.length === 0) {
                // Info behavior for selected
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
            if (atoms.some(a => !a)) return { error: 'Invalid atom indices' };

            if (atoms.length === 2) {
                const dist = atoms[0].position.distanceTo(atoms[1].position);
                return { info: `Distance: ${dist.toFixed(3)} Å` };
            } else if (atoms.length === 3) {
                const v1 = atoms[0].position.clone().sub(atoms[1].position);
                const v2 = atoms[2].position.clone().sub(atoms[1].position);
                const angle = v1.angleTo(v2) * (180 / Math.PI);
                return { info: `Angle: ${angle.toFixed(2)}°` };
            } else if (atoms.length === 4) {
                // Dihedral calc
                const [a1, a2, a3, a4] = atoms.map(a => a.position);
                const b1 = a2.clone().sub(a1);
                const b2 = a3.clone().sub(a2);
                const b3 = a4.clone().sub(a3);
                const n1 = b1.clone().cross(b2).normalize();
                const n2 = b2.clone().cross(b3).normalize();
                let angle = Math.acos(Math.max(-1, Math.min(1, n1.dot(n2))));
                const sign = b1.dot(n2);
                if (sign < 0) angle = -angle;
                return { info: `Dihedral: ${(angle * 180 / Math.PI).toFixed(2)}°` };
            }

            return { error: 'Select 2, 3, or 4 atoms to measure' };
        });

        // Rebond command (was adjustbond)
        this.register('rebond', ['rb'], 'rebond - Recalculate bonds based on threshold', { isDestructive: true }, (args) => {
            // Clear all existing bonds
            this.editor.molecule.bonds = [];
            this.editor.molecule.atoms.forEach(atom => {
                atom.bonds = [];
            });

            // Rebuild scene to update visuals and re-add bonds
            this.editor.rebuildScene();

            return { success: 'Bonds recalculated' };
        });

        // Center command
        this.register('center', ['cen'], 'center - Move molecule center to (0,0,0)', { isDestructive: true }, (args) => {
            const atoms = this.editor.molecule.atoms;
            if (atoms.length === 0) return { info: 'No atoms' };

            // Import GeometryEngine dynamically or assume it's available via Editor if attached
            // Since we didn't attach it to Editor yet, we'll import it at top of file or use it if available
            // For now, let's assume we need to import it. But we can't easily add import here.
            // We will rely on Editor having it or adding it to Editor.
            // Let's assume Editor has a helper or we implement logic here using GeometryEngine if imported.
            // Wait, we need to import GeometryEngine in CommandRegistry.js first.

            // Actually, let's implement the logic using the GeometryEngine we just created.
            // We need to add the import to the top of this file first.
            // For this step, I will add the commands assuming GeometryEngine is imported.
            // I will add the import in a separate step or if I can edit the whole file.
            // Since I am replacing a chunk, I will assume I can't add import here easily without replacing top.
            // I will use a temporary workaround or just implement the logic if simple, but better to use GeometryEngine.

            // Let's use the editor's method if we add it there, OR just use the logic here if we can't import.
            // But the plan was to use GeometryEngine.
            // I will add the import in the next step. For now, let's write the command logic assuming GeometryEngine is available.

            // Actually, I should probably add the import first.
            // But I am already in this tool call.
            // I'll write the commands and then add the import.

            const com = GeometryEngine.getCenterOfMass(atoms);
            const offset = com.clone().negate();

            atoms.forEach(atom => {
                atom.position.add(offset);
            });

            this.editor.rebuildScene();
            return { success: 'Molecule centered' };
        });

        // Rotate command
        this.register('rotate', ['rot'], 'rotate <x> <y> <z> - Rotate molecule (degrees)', { isDestructive: true }, (args) => {
            if (args.length !== 3) return { error: 'Usage: rotate <x> <y> <z>' };

            const x = parseFloat(args[0]);
            const y = parseFloat(args[1]);
            const z = parseFloat(args[2]);

            if (isNaN(x) || isNaN(y) || isNaN(z)) return { error: 'Invalid angles' };

            const atoms = this.editor.molecule.atoms;
            const positions = atoms.map(a => a.position);
            const newPositions = GeometryEngine.getRotatedPositions(positions, x, y, z);

            atoms.forEach((atom, i) => {
                atom.position.copy(newPositions[i]);
            });

            this.editor.rebuildScene();
            return { success: `Rotated by (${x}, ${y}, ${z})` };
        });

        // Translate command
        this.register('trans', ['tr', 'translation'], 'trans <x> <y> <z> - Translate molecule', { isDestructive: true }, (args) => {
            if (args.length !== 3) return { error: 'Usage: trans <x> <y> <z>' };

            const x = parseFloat(args[0]);
            const y = parseFloat(args[1]);
            const z = parseFloat(args[2]);

            if (isNaN(x) || isNaN(y) || isNaN(z)) return { error: 'Invalid coordinates' };

            const atoms = this.editor.molecule.atoms;
            const positions = atoms.map(a => a.position);
            const newPositions = GeometryEngine.getTranslatedPositions(positions, x, y, z);

            atoms.forEach((atom, i) => {
                atom.position.copy(newPositions[i]);
            });

            this.editor.rebuildScene();
            return { success: `Translated by (${x}, ${y}, ${z})` };
        });

        // Select command (Preserved)
        this.register('select', ['sel'], 'select <indices> - Select atoms', (args) => {
            if (args.length === 0) return { error: 'Usage: select <indices>' };

            if (args[0] === ':') {
                this.editor.clearSelection();
                this.editor.molecule.atoms.forEach(a => {
                    a.selected = true;
                    this.editor.selectionOrder.push(a);
                    this.editor.updateAtomVisuals(a);
                });
                this.editor.updateSelectionInfo();
                return { success: 'Selected all' };
            }

            const indices = [];
            for (const arg of args) {
                if (arg.includes(':')) {
                    const [s, e] = arg.split(':').map(Number);
                    for (let i = s; i <= e; i++) indices.push(i);
                } else {
                    indices.push(parseInt(arg));
                }
            }

            this.editor.clearSelection();
            indices.forEach(i => {
                const atom = this.editor.molecule.atoms[i];
                if (atom) {
                    atom.selected = true;
                    this.editor.selectionOrder.push(atom);
                    this.editor.updateAtomVisuals(atom);
                }
            });
            this.editor.updateSelectionInfo();
            return { success: `Selected ${indices.length} atoms` };
        });

        // Utility Commands
        this.register('clear', ['cls'], 'clear - Clear console', () => {
            this.editor.console.clear();
            return null;
        });

        this.register('time', ['sleep'], 'time <sec> - Wait', (args) => {
            const sec = parseFloat(args[0]);
            return new Promise(r => setTimeout(() => r({ info: `Waited ${sec}s` }), sec * 1000));
        });

        this.register('camera', ['cam'], 'camera [orbit|trackball]', (args) => {
            const mode = args[0];
            if (mode) {
                this.editor.renderer.setCameraMode(mode);
                document.getElementById('camera-mode').value = mode;
            }
            return { success: `Camera: ${mode}` };
        });

        this.register('projection', ['proj'], 'projection [persp|ortho]', (args) => {
            const arg = args[0].toLowerCase();
            let mode = 'perspective';
            if (['orthographic', 'ortho', 'ot'].includes(arg)) mode = 'orthographic';
            else if (['perspective', 'persp', 'ps'].includes(arg)) mode = 'perspective';
            this.editor.renderer.setProjection(mode);
            document.getElementById('projection-mode').value = mode;
            return { success: `Projection: ${mode}` };
        });

        // Molecule Management (New Standard)
        this.register('new', [], 'new [name]', (args) => {
            const name = args.join(' ');
            const res = this.editor.moleculeManager.createMolecule(name);
            return res.error ? { error: res.error } : { success: `Created ${res.name}` };
        });

        this.register('switch', ['sw'], 'switch <index|name>', (args) => {
            const target = args.join(' ');
            let idx = parseInt(target);
            if (isNaN(idx)) idx = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
            if (idx === -1) return { error: 'Not found' };
            const res = this.editor.moleculeManager.switchMolecule(idx);
            return res.error ? { error: res.error } : { success: res.success };
        });

        this.register('rename', ['rn'], 'rename <name>', (args) => {
            const name = args.join(' ');
            const res = this.editor.moleculeManager.renameMolecule(this.editor.moleculeManager.activeMoleculeIndex, name);
            return res.error ? { error: res.error } : { success: res.success };
        });

        // Clipboard
        this.register('copy', ['cp'], 'copy', () => {
            const res = this.editor.moleculeManager.copySelection();
            return res.error ? { error: res.error } : { success: res.success };
        });

        this.register('paste', ['pa'], 'paste [--offset <val>]', (args) => {
            let dist = 0;
            const idx = args.indexOf('--offset') !== -1 ? args.indexOf('--offset') : args.indexOf('-o');
            if (idx !== -1) dist = parseFloat(args[idx + 1]);
            const res = this.editor.moleculeManager.pasteClipboard(dist);
            return res.error ? { error: res.error } : { success: res.success };
        });

        this.register('cut', ['ct'], 'cut', { isDestructive: true }, () => {
            const cp = this.editor.moleculeManager.copySelection();
            if (cp.error) return { error: cp.error };
            this.editor.deleteSelected();
            return { success: 'Cut selected atoms' };
        });

        this.register('merge', ['mg'], 'merge <index|name>', (args) => {
            const target = args.join(' ');
            let idx = parseInt(target);
            if (isNaN(idx)) idx = this.editor.moleculeManager.molecules.findIndex(m => m.name === target);
            const res = this.editor.moleculeManager.mergeMolecule(idx);
            return res.error ? { error: res.error } : { success: res.success };
        });

        this.register('capture', ['cap'], 'capture [--no-bg]', (args) => {
            const noBg = args.includes('--no-background') || args.includes('-n');
            // Mock capture logic for now as it depends on renderer
            const objects = [];
            this.editor.renderer.scene.traverse(obj => {
                if (obj.userData && obj.userData.type === 'atom') objects.push(obj);
            });
            const dataURL = this.editor.renderer.captureSnapshot(objects, noBg);
            return { info: dataURL, type: 'image' };
        });

        // Label command
        this.register('label', ['lbl'], 'label [-s|-n|-a|-o]', (args) => {
            const arg = args[0];
            let mode = 'none';
            if (arg === '-s' || arg === '--symbol') mode = 'symbol';
            else if (arg === '-n' || arg === '--number') mode = 'number';
            else if (arg === '-a' || arg === '--all') mode = 'both';
            else if (arg === '-o' || arg === '--off') mode = 'none';

            this.editor.labelMode = mode;
            this.editor.updateAllLabels();
            return { success: `Label mode: ${mode}` };
        });

        // Undo/Redo
        this.register('undo', ['u'], 'undo - Undo last action', () => {
            this.editor.undo();
            return { success: 'Undid last action' };
        });

        this.register('redo', ['r', 'y'], 'redo - Redo last action', () => {
            this.editor.redo();
            return { success: 'Redid last action' };
        });
    }
}
