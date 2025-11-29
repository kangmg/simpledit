/**
 * Manages JSME (Java Script Molecule Editor) instance
 */
export class JSMEManager {
    constructor() {
        this.jsmeApplet = null;
        this.containerId = null;
        this.isInitialized = false;
    }

    /**
     * Initialize JSME in the specified container
     * @param {string} containerId - ID of the container element
     */
    init(containerId) {
        if (this.isInitialized && this.containerId === containerId) return;

        this.containerId = containerId;

        // JSME requires a global function to be called when it loads, 
        // or we can instantiate it if the script is loaded.
        // Since we installed via npm, we might need to import it or load the script.
        // The 'jsme-editor' package usually provides a global 'JSME' object or similar.
        // Let's assume for now we can use the global JSApplet class provided by JSME.

        // Note: JSME is often distributed as a legacy script that puts 'JSApplet' on window.
        // We might need to handle the script loading if it's not a proper module.
        // For now, let's try to instantiate it assuming it's available or we load it.

        // If we use the 'jsme-editor' npm package, it might export a setup function.
        // Let's check how we import it. 
        // If it's a script, we might need to add it to index.html or dynamic import.

        // For this implementation, we will assume the script is loaded and 'JSApplet' is available.
        // If not, we might need to adjust.

        const checkAndInit = () => {
            if (typeof window.JSApplet === 'undefined') {
                console.warn('JSME script not loaded yet, retrying...');
                setTimeout(checkAndInit, 100);
                return;
            }

            try {
                this.jsmeApplet = new window.JSApplet.JSME(containerId, "100%", "100%", {
                    "options": "newlook,guicolor=#333333,atommovebutton"
                });
                this.isInitialized = true;
                console.log('JSME initialized');
            } catch (e) {
                console.error('Failed to initialize JSME:', e);
            }
        };

        checkAndInit();
    }

    /**
     * Set molecule in JSME
     * @param {string} molBlock - V2000 MolBlock or JME string
     */
    setMol(molBlock) {
        if (this.jsmeApplet) {
            if (!molBlock || molBlock.trim() === '') {
                this.jsmeApplet.reset();
            } else {
                this.jsmeApplet.readMolFile(molBlock);
            }
        }
    }

    /**
     * Get molecule from JSME as MolBlock
     * @returns {string} MolBlock
     */
    getMol() {
        if (this.jsmeApplet) {
            return this.jsmeApplet.molFile();
        }
        return '';
    }

    /**
     * Get molecule from JSME as JME string
     * @returns {string} JME string
     */
    getJME() {
        if (this.jsmeApplet) {
            return this.jsmeApplet.jmeFile();
        }
        return '';
    }

    /**
     * Get molecule from JSME as SMILES
     * @returns {string} SMILES string
     */
    getSMILES() {
        if (this.jsmeApplet) {
            return this.jsmeApplet.smiles();
        }
        return '';
    }
}

export const jsmeManager = new JSMEManager();
