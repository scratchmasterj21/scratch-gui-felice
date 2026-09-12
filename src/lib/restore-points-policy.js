/**
 * Decisions about which restore points to keep and which stored assets are still needed.
 *
 * Pure on purpose: jsdom has no IndexedDB, so the storage layer cannot be unit tested here.
 * Everything that could silently lose a student's work - what gets deleted, and which asset
 * blobs are still referenced - lives in this file instead, where it can be.
 */

// How many automatic restore points to keep per student. Five at a five minute interval is
// roughly the last half hour of work, which is about one lesson.
const MAX_AUTOMATIC_RESTORE_POINTS = 5;

// A restore point the student asked for by hand. Never thrown away automatically.
const TYPE_MANUAL = 'manual';
const TYPE_AUTOMATIC = 'automatic';

const byNewestFirst = (a, b) => b.created - a.created;

/**
 * Restore points belonging to one student, newest first.
 * @param {Array<object>} restorePoints All stored restore point metadata
 * @param {?string} userId The signed in user, or null
 * @returns {Array<object>} that student's restore points
 */
const getRestorePointsForUser = (restorePoints, userId) => (restorePoints || [])
    .filter(point => point.userId === (userId || null))
    .sort(byNewestFirst);

/**
 * Which restore points should be deleted to stay within the limit.
 *
 * Only automatic points are considered. Manual ones are the student saying "keep this",
 * so they are never deleted here and never push an automatic one out.
 * @param {Array<object>} restorePoints All stored restore point metadata
 * @param {?string} userId The signed in user, or null
 * @param {number} [max] How many automatic points to keep
 * @returns {Array<number>} ids to delete
 */
const selectRestorePointsToDelete = (restorePoints, userId, max = MAX_AUTOMATIC_RESTORE_POINTS) => {
    const limit = Math.max(0, max);
    return getRestorePointsForUser(restorePoints, userId)
        .filter(point => point.type !== TYPE_MANUAL)
        .slice(limit)
        .map(point => point.id);
};

/**
 * Which stored assets are no longer referenced by any surviving restore point.
 *
 * Assets are shared between restore points - ten snapshots of one project reference the
 * same costume blobs - so an asset may only be dropped once nothing points at it. Called
 * with the restore points that remain AFTER a deletion.
 * @param {Array<object>} remainingRestorePoints Restore point metadata that still exists
 * @param {Array<string>} storedAssetIds Every asset id currently in storage
 * @returns {Array<string>} asset ids safe to delete
 */
const selectUnusedAssets = (remainingRestorePoints, storedAssetIds) => {
    const stillReferenced = new Set();
    for (const point of remainingRestorePoints || []) {
        for (const assetId of point.assets || []) {
            stillReferenced.add(assetId);
        }
    }
    return (storedAssetIds || []).filter(assetId => !stillReferenced.has(assetId));
};

export {
    MAX_AUTOMATIC_RESTORE_POINTS,
    TYPE_AUTOMATIC,
    TYPE_MANUAL,
    getRestorePointsForUser,
    selectRestorePointsToDelete,
    selectUnusedAssets
};
