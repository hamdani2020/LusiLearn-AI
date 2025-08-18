// Polyfill for missing browser globals in Node.js environment
// This is needed because undici expects these globals to be available

if (typeof globalThis.File === 'undefined') {
  // Create a minimal File polyfill
  globalThis.File = class File {
    name: string;
    size: number;
    type: string;
    lastModified: number;

    constructor(bits: any[], name: string, options?: any) {
      this.name = name;
      this.size = bits.reduce((acc, bit) => acc + (bit.size || 0), 0);
      this.type = options?.type || '';
      this.lastModified = options?.lastModified || Date.now();
    }
  } as any;
}

if (typeof globalThis.Blob === 'undefined') {
  // Create a minimal Blob polyfill
  globalThis.Blob = class Blob {
    size: number;
    type: string;

    constructor(parts?: any[], options?: any) {
      this.size = parts?.reduce((acc, part) => acc + (part.size || 0), 0) || 0;
      this.type = options?.type || '';
    }
  } as any;
}

if (typeof globalThis.FormData === 'undefined') {
  // Create a minimal FormData polyfill
  globalThis.FormData = class FormData {
    private data: Map<string, any> = new Map();

    append(name: string, value: any) {
      this.data.set(name, value);
    }

    get(name: string) {
      return this.data.get(name);
    }

    has(name: string) {
      return this.data.has(name);
    }

    delete(name: string) {
      return this.data.delete(name);
    }

    entries() {
      return this.data.entries();
    }

    keys() {
      return this.data.keys();
    }

    values() {
      return this.data.values();
    }

    forEach(callback: (value: any, key: string) => void) {
      this.data.forEach(callback);
    }
  } as any;
} 