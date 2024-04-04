const fs = require("fs");
const path = require("path");

/*
Note (16.12.2023) on how to build both CommonJS and ESModule versions:

- Compile to ESModule in one directory:
  tsc --module esnext --outDir "./dist/es"

- Compile to CommonJS in another directory:
  tsc --module commonjs --outDir "./dist/commonjs"

- Package.json should have main-field, module-field and exports-field pointing
  to the two entry points as follows:

  "main": "dist/commonjs/index.js",
  "module": "dist/es/index.js",
  "exports": {
    ".": {
      "import": "./dist/es/index.js",
      "require": "./dist/commonjs/index.js"
    }
  },

Post-build steps (handled by this script after `npm run build`):

- Add additional package.json files to dist:
  - ./dist/commonjs/package.json with content { "type": "commonjs" }
  - ./dist/es/package.json with content { "type": "module" }

- Fix import and re-export paths to use standard format:
  - Add .js file extension, e.g.
    import { foo } from "./bar"  -->  import { foo } from "./bar.js"
  - Add path to index.js for directory imports (not supported by ESM), e.g.
    import { foo } from ".."  -->  import { foo } from "../index.js"
    export * from "./dir"     -->  export * from "./dir/index.js"
*/

console.log("Running post-build script");

const commonjsDir = path.join(__dirname, "dist", "commonjs");
const esDir = path.join(__dirname, "dist", "es");

// Add package.json files:
fs.writeFileSync(
  path.join(commonjsDir, "package.json"),
  `{
  "type": "commonjs"
}
`,
  "utf-8"
);
console.log(`Added package.json to ${commonjsDir}`);

fs.writeFileSync(
  path.join(esDir, "package.json"),
  `{
  "type": "module"
}
`,
  "utf-8"
);
console.log(`Added package.json to ${esDir}`);

/*
Fix imports and re-exports for ES modules, by adding .js extension and by
changing directory imports to refer to index.js. This code is mostly generated
with GPT 4.0.
*/

readDirectory(esDir);

// Function to recursively read through the directory
function readDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      readDirectory(filePath);
    } else if (stats.isFile() && filePath.endsWith(".js")) {
      updateModuleReferences(filePath);
    }
  });
}

// Function to update import and export statements in a file
function updateModuleReferences(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Regular expression to find and update import/export statements
  const moduleRegex =
    /(import\s+[\s\S]*?\s+from\s+|export\s+.*?\s+from\s+)['"]([^'"]+)['"]/gm;
  let updatedContent = content.replace(
    moduleRegex,
    (match, prefix, modulePath) => {
      if (!modulePath.startsWith(".")) {
        // Skip if it's not a relative path
        return match;
      }

      // Check if the module path is a directory and add /index if necessary
      let fullPath = path.join(path.dirname(filePath), modulePath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        if (!modulePath.endsWith("/")) {
          modulePath += "/";
        }
        modulePath += "index";
      }

      // Append .js extension to the module path
      modulePath += ".js";

      return `${prefix || ""}'${modulePath}'`;
    }
  );

  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent, "utf8");
    console.log(`Updated module references in ${filePath}`);
  }
}
