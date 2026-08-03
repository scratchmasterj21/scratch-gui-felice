const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Patching scratch-vm for custom extensions (ml2scratch, posenet2scratch, faceSensing)...');

const rootDir = path.resolve(__dirname, '..');
const vmDir = path.join(rootDir, 'node_modules', 'scratch-vm');

if (!fs.existsSync(vmDir)) {
    console.error('scratch-vm not found in node_modules. Skipping patch.');
    process.exit(0);
}

// 1. Install dependencies inside scratch-vm
console.log('Installing dependencies inside scratch-vm...');
try {
    execSync('npm install ml5@0.12.2', { cwd: vmDir, stdio: 'inherit' });
    execSync('npm install @teachablemachine/image@0.8.4 @teachablemachine/pose@0.8.6 @tensorflow/tfjs@1.3.1 @tensorflow-models/posenet@2.2.2 babel-polyfill@6.26.0 --legacy-peer-deps', { cwd: vmDir, stdio: 'inherit' });
    execSync('npm install @mediapipe/face_detection @tensorflow-models/face-detection @tensorflow/tfjs-core @tensorflow/tfjs-converter --legacy-peer-deps', { cwd: vmDir, stdio: 'inherit' });
} catch (err) {
    console.error('Failed to install dependencies in scratch-vm:', err);
    process.exit(1);
}

// 2. Copy extension files
console.log('Copying extension files...');

// ml2scratch
const ml2scratchSrc = path.join(rootDir, 'ml2scratch', 'scratch-vm', 'src', 'extensions', 'scratch3_ml2scratch', 'index.js');
const ml2scratchDestDir = path.join(vmDir, 'src', 'extensions', 'scratch3_ml2scratch');
fs.mkdirSync(ml2scratchDestDir, { recursive: true });
fs.copyFileSync(ml2scratchSrc, path.join(ml2scratchDestDir, 'index.js'));

// posenet2scratch
const posenetSrc = path.join(rootDir, 'posenet2scratch', 'scratch-vm', 'src', 'extensions', 'scratch3_posenet2scratch', 'index.js');
const posenetDestDir = path.join(vmDir, 'src', 'extensions', 'scratch3_posenet2scratch');
fs.mkdirSync(posenetDestDir, { recursive: true });
fs.copyFileSync(posenetSrc, path.join(posenetDestDir, 'index.js'));

// faceSensing
const faceSensingSrcDir = path.join(rootDir, 'faceSensing');
const faceSensingDestDir = path.join(vmDir, 'src', 'extensions', 'scratch3_faceSensing');
fs.mkdirSync(faceSensingDestDir, { recursive: true });
fs.copyFileSync(path.join(faceSensingSrcDir, 'index.js'), path.join(faceSensingDestDir, 'index.js'));
fs.copyFileSync(path.join(faceSensingSrcDir, 'utils.js'), path.join(faceSensingDestDir, 'utils.js'));

// multitouch
const multitouchSrc = path.join(rootDir, 'multitouch', 'index.js');
const multitouchDestDir = path.join(vmDir, 'src', 'extensions', 'scratch3_multitouch');
fs.mkdirSync(multitouchDestDir, { recursive: true });
fs.copyFileSync(multitouchSrc, path.join(multitouchDestDir, 'index.js'));

// 3. Patch extension-manager.js
console.log('Patching extension-manager.js...');
const extManagerPath = path.join(vmDir, 'src', 'extension-support', 'extension-manager.js');
let extManagerCode = fs.readFileSync(extManagerPath, 'utf8');

const injectionCode = `
builtinExtensions['ml2scratch'] = () => require('../extensions/scratch3_ml2scratch');
builtinExtensions['posenet2scratch'] = () => require('../extensions/scratch3_posenet2scratch');
builtinExtensions['faceSensing'] = () => require('../extensions/scratch3_faceSensing');
builtinExtensions['multitouch'] = () => require('../extensions/scratch3_multitouch');
`;

if (!extManagerCode.includes("builtinExtensions['ml2scratch']")) {
    extManagerCode = extManagerCode.replace('class ExtensionManager {', injectionCode + '\nclass ExtensionManager {');
    fs.writeFileSync(extManagerPath, extManagerCode, 'utf8');
    console.log('Successfully patched extension-manager.js!');
} else {
    console.log('extension-manager.js is already patched.');
}

console.log('Patch complete!');
