/**
 * Packages the starter projects that two tutorials depend on into .sb3 files.
 *
 * "Code a Cartoon" and "Animate an Adventure Game" declare a `requiredProjectId` in
 * src/lib/libraries/decks/index.jsx. On scratch.mit.edu clicking them opens that project
 * from Scratch's servers; this deployment has no such route, so the starters have to be
 * hosted here instead.
 *
 * Run once, then upload the output to Supabase Storage:
 *   node scripts/fetch-tutorial-starters.js
 *   -> build/tutorial-starters/<projectId>.sb3
 *
 * Upload each file to the "scratch-projects" bucket under "tutorials/<projectId>.sb3".
 *
 * These are Scratch community projects shared under CC BY-SA 2.0. Keep the attribution
 * printed at the end of this script with wherever you surface them.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const JSZip = require('jszip');

const OUT_DIR = path.resolve(__dirname, '..', 'build', 'tutorial-starters');

// Keep in sync with `requiredProjectId` in src/lib/libraries/decks/index.jsx
const PROJECTS = [
    {id: '331474033', deck: 'code-cartoon', name: 'Code a Cartoon'},
    {id: '249143200', deck: 'cartoon-network', name: 'Animate an Adventure Game'}
];

const ASSET_HOST = 'https://assets.scratch.mit.edu/internalapi/asset';

const get = (url, {json = false} = {}) => new Promise((resolve, reject) => {
    https.get(url, {headers: {'User-Agent': 'felice-scratch-lab-tutorial-fetch'}}, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return resolve(get(res.headers.location, {json}));
        }
        if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (!json) return resolve(buffer);
            try {
                resolve(JSON.parse(buffer.toString('utf8')));
            } catch (err) {
                reject(new Error(`Bad JSON from ${url}: ${err.message}`));
            }
        });
    }).on('error', reject);
});

// Every distinct asset referenced by the project, as md5ext filenames.
const collectAssetNames = projectJson => {
    const names = new Set();
    for (const target of projectJson.targets || []) {
        for (const costume of target.costumes || []) {
            if (costume.md5ext) names.add(costume.md5ext);
            else if (costume.assetId && costume.dataFormat) {
                names.add(`${costume.assetId}.${costume.dataFormat}`);
            }
        }
        for (const sound of target.sounds || []) {
            if (sound.md5ext) names.add(sound.md5ext);
            else if (sound.assetId && sound.dataFormat) {
                names.add(`${sound.assetId}.${sound.dataFormat}`);
            }
        }
    }
    return Array.from(names);
};

const packageProject = async project => {
    process.stdout.write(`\n${project.name} (${project.id})\n`);

    const meta = await get(`https://api.scratch.mit.edu/projects/${project.id}`, {json: true});
    if (!meta.project_token) {
        throw new Error(`No project token for ${project.id}; is the project still shared?`);
    }
    const projectJson = await get(
        `https://projects.scratch.mit.edu/${project.id}?token=${meta.project_token}`,
        {json: true}
    );

    const assetNames = collectAssetNames(projectJson);
    process.stdout.write(`  project.json ok, ${assetNames.length} assets\n`);

    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(projectJson));

    let done = 0;
    for (const name of assetNames) {
        const data = await get(`${ASSET_HOST}/${name}/get/`);
        zip.file(name, data);
        done++;
        if (done % 10 === 0 || done === assetNames.length) {
            process.stdout.write(`  assets ${done}/${assetNames.length}\n`);
        }
    }

    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {level: 6}
    });

    fs.mkdirSync(OUT_DIR, {recursive: true});
    const outPath = path.join(OUT_DIR, `${project.id}.sb3`);
    fs.writeFileSync(outPath, buffer);
    process.stdout.write(`  wrote ${outPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`);
    return {project, outPath, size: buffer.length, assets: assetNames.length};
};

const main = async () => {
    const results = [];
    for (const project of PROJECTS) {
        results.push(await packageProject(project));
    }

    process.stdout.write('\nUpload these to the "scratch-projects" bucket:\n');
    for (const result of results) {
        process.stdout.write(`  ${result.outPath}  ->  tutorials/${result.project.id}.sb3\n`);
    }
    process.stdout.write(
        '\nAttribution: both starters are Scratch community projects, shared under\n' +
        'CC BY-SA 2.0. Credit the original authors wherever students can reach them.\n'
    );
};

main().catch(err => {
    process.stderr.write(`\nFailed: ${err.message}\n`);
    process.exit(1);
});
