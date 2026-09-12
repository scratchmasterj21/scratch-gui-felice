import {getSupabase} from './supabase';

const BUCKET_NAME = 'scratch-projects';

/**
 * Save a project to Supabase.
 * Uploads the .sb3 blob to Storage and upserts metadata in the projects table.
 * @param {string} userId - The authenticated user's ID
 * @param {string} userEmail - The authenticated user's email
 * @param {string} title - The project title
 * @param {Blob} sb3Blob - The .sb3 file as a Blob
 * @param {string|null} existingProjectId - If updating an existing project, its ID
 * @returns {Promise<object>} The saved project metadata row
 */
export const saveProject = async (userId, userEmail, title, sb3Blob) => {
    const fileName = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.sb3`;
    const filePath = `${userId}/${fileName}`;

    // Check if a project with the same title exists for this user
    let existingId = null;
    const {data: existingList} = await getSupabase()
        .from('projects')
        .select('id, file_path')
        .eq('user_id', userId)
        .eq('title', title);

    if (existingList && existingList.length > 0) {
        existingId = existingList[0].id;
    }

    // Upload .sb3 file to Storage (use upsert: true to overwrite, cacheControl: '0' to avoid stale caching)
    const {error: uploadError} = await getSupabase().storage
        .from(BUCKET_NAME)
        .upload(filePath, sb3Blob, {
            contentType: 'application/octet-stream',
            upsert: true,
            cacheControl: '0'
        });

    if (uploadError) {
        throw new Error(`Failed to upload project file: ${uploadError.message}`);
    }

    // Insert or update metadata in projects table
    const projectData = {
        user_id: userId,
        author_email: userEmail,
        title: title,
        file_path: filePath,
        updated_at: new Date().toISOString()
    };

    let result;
    if (existingId) {
        // Update existing record
        const {data, error} = await getSupabase()
            .from('projects')
            .update(projectData)
            .eq('id', existingId)
            .select()
            .single();
        if (error) throw new Error(`Failed to update project record: ${error.message}`);
        result = data;
    } else {
        // Insert new record
        const {data, error} = await getSupabase()
            .from('projects')
            .insert(projectData)
            .select()
            .single();
        if (error) throw new Error(`Failed to create project record: ${error.message}`);
        result = data;
    }

    return result;
};

/**
 * List all projects for a given user.
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} Array of project metadata objects
 */
export const listProjects = async userId => {
    const {data, error} = await getSupabase()
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', {ascending: false});

    if (error) {
        throw new Error(`Failed to list projects: ${error.message}`);
    }

    return data || [];
};

/**
 * Share or unshare a project as a template.
 * @param {string} projectId - The project's UUID
 * @param {boolean} isTemplate - Whether it should be a template
 */
export const shareProjectTemplate = async (projectId, isTemplate) => {
    const {data, error} = await getSupabase()
        .from('projects')
        .update({is_template: isTemplate})
        .eq('id', projectId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update project template status: ${error.message}`);
    }

    return data;
};

/**
 * List all projects marked as templates.
 * @returns {Promise<Array>} Array of shared template projects
 */
export const listSharedTemplates = async () => {
    const {data, error} = await getSupabase()
        .from('projects')
        .select('*')
        .eq('is_template', true)
        .order('updated_at', {ascending: false});

    if (error) {
        throw new Error(`Failed to list shared templates: ${error.message}`);
    }

    return data || [];
};

/**
 * List all projects created by students (everyone except the teacher).
 * @param {string} teacherUserId - The teacher's user ID
 * @returns {Promise<Array>} Array of student projects
 */
export const listAllStudentProjects = async teacherUserId => {
    const {data, error} = await getSupabase()
        .from('projects')
        .select('*')
        .neq('user_id', teacherUserId)
        .order('updated_at', {ascending: false});

    if (error) {
        throw new Error(`Failed to list student projects: ${error.message}`);
    }

    return data || [];
};

/**
 * Load a project file from Supabase Storage.
 * Uses a signed URL with cache: 'no-store' to ensure the latest version is loaded
 * without hitting Cloudflare CDN or browser HTTP caches.
 * @param {string} filePath - The storage path (e.g. "user-id/filename.sb3")
 * @returns {Promise<ArrayBuffer>} The project file as an ArrayBuffer
 */
export const loadProject = async filePath => {
    // 1. Attempt to load via a fresh signed URL with cache: 'no-store'.
    // Signed URLs contain a unique HMAC token, bypassing Cloudflare's static file cache.
    try {
        const {data: signedData, error: signedError} = await getSupabase().storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 60);

        if (!signedError && signedData && signedData.signedUrl) {
            const response = await fetch(signedData.signedUrl, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (response.ok) {
                return await response.arrayBuffer();
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load project via signed URL, falling back to download:', e);
    }

    // 2. Fallback to direct download with a cacheNonce timestamp
    const {data, error} = await getSupabase().storage
        .from(BUCKET_NAME)
        .download(filePath, {
            cacheNonce: Date.now().toString()
        });

    if (error) {
        throw new Error(`Failed to download project: ${error.message}`);
    }

    return data.arrayBuffer();
};

/**
 * Delete a project (both the Storage file and DB record).
 * @param {string} projectId - The project's UUID in the projects table
 * @param {string} filePath - The storage path to delete
 * @returns {Promise<void>} Resolves when deletion completes
 */
export const deleteProject = async (projectId, filePath) => {
    // Delete file from Storage
    const {error: storageError} = await getSupabase().storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (storageError) {
        console.warn('Failed to delete storage file:', storageError.message);
        // Continue to delete DB record even if file deletion fails
    }

    // Delete record from DB
    const {error: dbError} = await getSupabase()
        .from('projects')
        .delete()
        .eq('id', projectId);

    if (dbError) {
        throw new Error(`Failed to delete project record: ${dbError.message}`);
    }
};
