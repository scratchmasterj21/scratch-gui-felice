import {
    MAX_AUTOMATIC_RESTORE_POINTS,
    TYPE_AUTOMATIC,
    TYPE_MANUAL,
    getRestorePointsForUser,
    selectRestorePointsToDelete,
    selectUnusedAssets
} from '../../../src/lib/restore-points-policy';

const point = (id, overrides) => Object.assign({
    id,
    userId: 'student-1',
    created: id * 1000,
    type: TYPE_AUTOMATIC,
    assets: []
}, overrides);

describe('getRestorePointsForUser', () => {
    // Classroom machines are shared, so one student must never see another's work.
    test('only returns the given student, newest first', () => {
        const all = [
            point(1),
            point(2, {userId: 'student-2'}),
            point(3),
            point(4, {userId: 'student-2'})
        ];
        expect(getRestorePointsForUser(all, 'student-1').map(p => p.id)).toEqual([3, 1]);
        expect(getRestorePointsForUser(all, 'student-2').map(p => p.id)).toEqual([4, 2]);
    });

    test('signed out points are their own bucket', () => {
        const all = [point(1, {userId: null}), point(2)];
        expect(getRestorePointsForUser(all, null).map(p => p.id)).toEqual([1]);
        expect(getRestorePointsForUser(all, undefined).map(p => p.id)).toEqual([1]);
    });

    test('tolerates empty input', () => {
        expect(getRestorePointsForUser(null, 'student-1')).toEqual([]);
    });
});

describe('selectRestorePointsToDelete', () => {
    test('keeps nothing extra when under the limit', () => {
        const all = [point(1), point(2), point(3)];
        expect(selectRestorePointsToDelete(all, 'student-1')).toEqual([]);
    });

    test('deletes the oldest beyond the limit', () => {
        const all = [1, 2, 3, 4, 5, 6, 7].map(id => point(id));
        // Newest five kept: 7,6,5,4,3. Oldest two go.
        expect(selectRestorePointsToDelete(all, 'student-1').sort()).toEqual([1, 2]);
    });

    test('never deletes a manual restore point', () => {
        const all = [
            point(1, {type: TYPE_MANUAL}),
            point(2, {type: TYPE_MANUAL}),
            ...[3, 4, 5, 6, 7, 8].map(id => point(id))
        ];
        const deleted = selectRestorePointsToDelete(all, 'student-1');
        expect(deleted).not.toContain(1);
        expect(deleted).not.toContain(2);
        // Manual points also do not push automatic ones out: six automatic, five kept.
        expect(deleted).toEqual([3]);
    });

    test('never touches another student', () => {
        const all = [
            ...[1, 2, 3, 4, 5, 6, 7].map(id => point(id, {userId: 'student-2'})),
            point(8)
        ];
        expect(selectRestorePointsToDelete(all, 'student-1')).toEqual([]);
    });

    test('respects a custom limit, including zero', () => {
        const all = [1, 2, 3].map(id => point(id));
        expect(selectRestorePointsToDelete(all, 'student-1', 1)).toEqual([2, 1]);
        expect(selectRestorePointsToDelete(all, 'student-1', 0).sort()).toEqual([1, 2, 3]);
        expect(selectRestorePointsToDelete(all, 'student-1', -5).sort()).toEqual([1, 2, 3]);
    });

    test('the default limit is the documented one', () => {
        const all = Array.from({length: 20}, (_, i) => point(i + 1));
        const kept = 20 - selectRestorePointsToDelete(all, 'student-1').length;
        expect(kept).toBe(MAX_AUTOMATIC_RESTORE_POINTS);
    });
});

describe('selectUnusedAssets', () => {
    /*
     * Restore points share asset blobs, so deleting one must not delete costumes another
     * still needs. Getting this wrong corrupts every remaining restore point silently -
     * they would load with missing sprites.
     */
    test('keeps assets that a surviving restore point still references', () => {
        const remaining = [point(2, {assets: ['a.png', 'b.wav']})];
        expect(selectUnusedAssets(remaining, ['a.png', 'b.wav', 'c.svg'])).toEqual(['c.svg']);
    });

    test('keeps an asset shared by several restore points', () => {
        const remaining = [
            point(2, {assets: ['shared.png']}),
            point(3, {assets: ['shared.png', 'only-3.png']})
        ];
        expect(selectUnusedAssets(remaining, ['shared.png', 'only-3.png', 'orphan.png']))
            .toEqual(['orphan.png']);
    });

    test('everything is unused once no restore points remain', () => {
        expect(selectUnusedAssets([], ['a.png', 'b.png'])).toEqual(['a.png', 'b.png']);
    });

    test('tolerates missing fields', () => {
        expect(selectUnusedAssets([point(1)], ['a.png'])).toEqual(['a.png']);
        expect(selectUnusedAssets(null, null)).toEqual([]);
    });
});
