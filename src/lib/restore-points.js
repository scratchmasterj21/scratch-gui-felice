/**
 * Restore points: periodic local snapshots of the project being edited, so a crash, a
 * closed tab or a lost network connection does not cost a student their lesson.
 *
 * Snapshots live in IndexedDB on the machine, not in Supabase - they are frequent, and
 * uploading a whole project every few minutes for every student in a class is not a cost
 * worth paying for something usually thrown away.
 *
 * Costume and sound blobs are stored once and shared between restore points. Without that,
 * five snapshots of a project with a few photographs in it would occupy five times the
 * space for no reason.
 *
 * Retention and asset reference counting live in restore-points-policy.js so they can be
 * tested; this file is the storage plumbing around them.
 */

import JSZip from 'jszip';
import log from './log';
import {
    TYPE_AUTOMATIC,
    TYPE_MANUAL,
    getRestorePointsForUser,
    selectRestorePointsToDelete,
    selectUnusedAssets
} from './restore-points-policy';

const DATABASE_NAME = 'FeliceRestorePoints';
const DATABASE_VERSION = 1;
const METADATA_STORE = 'meta';
const PROJECT_STORE = 'projects';
const ASSET_STORE = 'assets';
const ALL_STORES = [METADATA_STORE, PROJECT_STORE, ASSET_STORE];

const isSupported = () => typeof indexedDB !== 'undefined';

const openDatabase = () => new Promise((resolve, reject) => {
    if (!isSupported()) {
        reject(new Error('This browser has no IndexedDB, so restore points are unavailable.'));
        return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
            db.createObjectStore(METADATA_STORE, {keyPath: 'id', autoIncrement: true});
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
            db.createObjectStore(PROJECT_STORE);
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
            db.createObjectStore(ASSET_STORE);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Could not open restore points: ${request.error}`));
});

const promisifyRequest = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`${request.error}`));
});

const promisifyTransaction = transaction => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`${transaction.error}`));
    transaction.onabort = () => reject(new Error(`${transaction.error}`));
});

const assetIdOf = asset => `${asset.assetId}.${asset.dataFormat}`;

/**
 * Every restore point belonging to a student, newest first.
 * @param {?string} userId The signed in user id, or null
 * @returns {Promise<Array<object>>} restore point metadata
 */
const getRestorePoints = async userId => {
    const db = await openDatabase();
    try {
        const transaction = db.transaction([METADATA_STORE], 'readonly');
        const all = await promisifyRequest(transaction.objectStore(METADATA_STORE).getAll());
        return getRestorePointsForUser(all, userId);
    } finally {
        db.close();
    }
};

/**
 * Snapshot the project currently in the VM.
 * @param {object} vm The VM
 * @param {object} options {userId, title, type}
 * @returns {Promise<number>} the new restore point's id
 */
const createRestorePoint = async (vm, options) => {
    const {userId = null, title = '', type = TYPE_AUTOMATIC} = options || {};
    const projectJson = vm.toJSON();

    // vm.assets lists an entry per costume and sound, so the same blob appears repeatedly.
    const assetsById = new Map();
    for (const asset of vm.assets) {
        if (asset && asset.data) {
            assetsById.set(assetIdOf(asset), asset.data);
        }
    }
    const assetIds = Array.from(assetsById.keys());

    const db = await openDatabase();
    try {
        const transaction = db.transaction(ALL_STORES, 'readwrite');
        const metadataStore = transaction.objectStore(METADATA_STORE);
        const projectStore = transaction.objectStore(PROJECT_STORE);
        const assetStore = transaction.objectStore(ASSET_STORE);

        const id = await promisifyRequest(metadataStore.add({
            userId: userId || null,
            title: title,
            type: type,
            created: Date.now(),
            assets: assetIds,
            size: projectJson.length
        }));
        projectStore.put(projectJson, id);
        for (const [assetId, data] of assetsById) {
            // put() is an upsert, so a blob shared with an earlier restore point is simply
            // rewritten rather than duplicated.
            assetStore.put(data, assetId);
        }

        await promisifyTransaction(transaction);
        return id;
    } finally {
        db.close();
    }
};

const deleteRestorePointsById = async (db, ids) => {
    if (!ids.length) return;
    const transaction = db.transaction(ALL_STORES, 'readwrite');
    const metadataStore = transaction.objectStore(METADATA_STORE);
    const projectStore = transaction.objectStore(PROJECT_STORE);
    for (const id of ids) {
        metadataStore.delete(id);
        projectStore.delete(id);
    }
    await promisifyTransaction(transaction);

    // Drop asset blobs nothing points at any more. Done after the metadata is gone so the
    // survivors are read from committed state.
    const sweep = db.transaction(ALL_STORES, 'readwrite');
    const remaining = await promisifyRequest(sweep.objectStore(METADATA_STORE).getAll());
    const storedAssetIds = await promisifyRequest(sweep.objectStore(ASSET_STORE).getAllKeys());
    const assetStore = sweep.objectStore(ASSET_STORE);
    for (const assetId of selectUnusedAssets(remaining, storedAssetIds)) {
        assetStore.delete(assetId);
    }
    await promisifyTransaction(sweep);
};

/**
 * Delete one restore point, and any asset blobs it was the last user of.
 * @param {number} id The restore point id
 * @returns {Promise<void>} resolves when deleted
 */
const deleteRestorePoint = async id => {
    const db = await openDatabase();
    try {
        await deleteRestorePointsById(db, [id]);
    } finally {
        db.close();
    }
};

/**
 * Delete every restore point belonging to a student.
 * @param {?string} userId The signed in user id, or null
 * @returns {Promise<void>} resolves when deleted
 */
const deleteAllRestorePoints = async userId => {
    const db = await openDatabase();
    try {
        const transaction = db.transaction([METADATA_STORE], 'readonly');
        const all = await promisifyRequest(transaction.objectStore(METADATA_STORE).getAll());
        const ids = getRestorePointsForUser(all, userId).map(point => point.id);
        await deleteRestorePointsById(db, ids);
    } finally {
        db.close();
    }
};

/**
 * Trim a student's automatic restore points back to the limit.
 * @param {?string} userId The signed in user id, or null
 * @returns {Promise<void>} resolves when trimmed
 */
const pruneRestorePoints = async userId => {
    const db = await openDatabase();
    try {
        const transaction = db.transaction([METADATA_STORE], 'readonly');
        const all = await promisifyRequest(transaction.objectStore(METADATA_STORE).getAll());
        await deleteRestorePointsById(db, selectRestorePointsToDelete(all, userId));
    } finally {
        db.close();
    }
};

/**
 * Load a restore point back into the VM, replacing what is open.
 * @param {object} vm The VM
 * @param {number} id The restore point id
 * @returns {Promise<void>} resolves once the project is loaded
 */
const loadRestorePoint = async (vm, id) => {
    const db = await openDatabase();
    let projectJson;
    let metadata;
    let assets;
    try {
        const transaction = db.transaction(ALL_STORES, 'readonly');
        metadata = await promisifyRequest(transaction.objectStore(METADATA_STORE).get(id));
        projectJson = await promisifyRequest(transaction.objectStore(PROJECT_STORE).get(id));
        if (!metadata || typeof projectJson === 'undefined') {
            throw new Error('That restore point is no longer available.');
        }
        const assetStore = transaction.objectStore(ASSET_STORE);
        assets = await Promise.all((metadata.assets || []).map(assetId =>
            promisifyRequest(assetStore.get(assetId)).then(data => ({assetId, data}))
        ));
    } finally {
        db.close();
    }

    // Rebuilt into a real .sb3 so loading uses the same well travelled path as opening a
    // file, rather than a second way into the VM that could rot separately.
    const zip = new JSZip();
    zip.file('project.json', projectJson);
    for (const asset of assets) {
        if (asset.data) {
            zip.file(asset.assetId, asset.data);
        } else {
            log.warn(`Restore point ${id} is missing asset ${asset.assetId}`);
        }
    }
    const sb3 = await zip.generateAsync({type: 'arraybuffer'});
    await vm.loadProject(sb3);
};

export {
    TYPE_AUTOMATIC,
    TYPE_MANUAL,
    createRestorePoint,
    deleteAllRestorePoints,
    deleteRestorePoint,
    getRestorePoints,
    isSupported,
    loadRestorePoint,
    pruneRestorePoints
};
