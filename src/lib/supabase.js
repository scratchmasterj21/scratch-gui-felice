import {createClient} from '@supabase/supabase-js';

// ============================================================
// IMPORTANT: Replace these with your actual Supabase credentials
// Get them from: https://supabase.com → Your Project → Settings → API
// ============================================================
const SUPABASE_URL = 'https://gdrkbnuhvhukojgikhcf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkcmtibnVodmh1a29qZ2lraGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NTQwNjQsImV4cCI6MjEwMTIzMDA2NH0.cOak4_jfD-AmdpSLcWOK9ljErDIuUcxLNBm-E1rOdx8'; // eslint-disable-line max-len

// The fake email domain used for username-only login
// e.g. username "john" becomes "john@felice.local"
export const EMAIL_DOMAIN = 'felice.local';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Convert a plain username to a synthetic email.
 * @param {string} username - e.g. "student1"
 * @returns {string} - e.g. "student1@felice.local"
 */
export const usernameToEmail = username => `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;

/**
 * Extract the username portion from a synthetic email.
 * @param {string} email - e.g. "student1@felice.local"
 * @returns {string} - e.g. "student1"
 */
export const emailToUsername = email => {
    if (!email) return '';
    return email.split('@')[0];
};

/**
 * Update the user's avatar in localStorage and Supabase user metadata.
 * @param {string} userId - The user's UUID.
 * @param {string} avatar - The emoji string or 'cat'.
 * @returns {Promise<void>} A promise resolving when update finishes.
 */
export const updateUserAvatar = async function (userId, avatar) {
    if (userId) {
        try {
            window.localStorage.setItem(`felice_avatar_${userId}`, avatar);
        } catch (e) {
            // Ignore localStorage errors
        }
    }
    try {
        await supabase.auth.updateUser({
            data: {avatar: avatar}
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to update user avatar in Supabase:', err);
    }
};

/**
 * Retrieve saved avatar from metadata or local storage.
 * @param {string} userId - The user's UUID.
 * @param {object} userMetadata - User metadata object from Supabase user.
 * @returns {string} The saved avatar emoji or 'cat'.
 */
export const getSavedAvatar = function (userId, userMetadata) {
    if (userMetadata && userMetadata.avatar) {
        return userMetadata.avatar;
    }
    if (userId) {
        try {
            const cached = window.localStorage.getItem(`felice_avatar_${userId}`);
            if (cached) return cached;
        } catch (e) {
            // Ignore localStorage errors
        }
    }
    return 'cat';
};

export default supabase;
