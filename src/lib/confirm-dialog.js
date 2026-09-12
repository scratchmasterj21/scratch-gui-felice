/**
 * The confirmation dialog used before anything destructive.
 *
 * Kept in one place so deleting a sprite, a costume and a restore point all look and
 * behave the same, rather than each call site carrying its own copy of the SweetAlert
 * options and drifting apart.
 */

import Swal from 'sweetalert2';

/**
 * Ask the student to confirm something that cannot be undone easily.
 *
 * `heightAuto: false` is deliberate: without it SweetAlert sets `height: auto` on the
 * document while open, which makes the editor behind it jump.
 * @param {object} options {title, text, confirmButtonText}
 * @returns {Promise<boolean>} resolves true only if they confirmed
 */
const confirmDestructiveAction = ({title, text, confirmButtonText}) => Swal.fire({
    heightAuto: false,
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: confirmButtonText
}).then(result => Boolean(result.isConfirmed));

// What the student picked. Dismissing (Escape, clicking away) is deliberately distinct
// from choosing Cancel: a dialog that was waved away should not be treated as an answer.
const CHOICE_CONFIRM = 'confirm';
const CHOICE_CANCEL = 'cancel';
const CHOICE_DISMISS = 'dismiss';

/**
 * Ask a two way question where neither answer is destructive, so both buttons can say what
 * they actually do instead of relying on the student reading "Cancel" as "keep my work".
 * @param {object} options {title, text, confirmButtonText, cancelButtonText}
 * @returns {Promise<string>} one of CHOICE_CONFIRM, CHOICE_CANCEL, CHOICE_DISMISS
 */
const askChoice = ({title, text, confirmButtonText, cancelButtonText}) => Swal.fire({
    heightAuto: false,
    title: title,
    text: text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#6c757d',
    confirmButtonText: confirmButtonText,
    cancelButtonText: cancelButtonText
}).then(result => {
    if (result.isConfirmed) return CHOICE_CONFIRM;
    if (result.dismiss === Swal.DismissReason.cancel) return CHOICE_CANCEL;
    return CHOICE_DISMISS;
});

export {
    CHOICE_CANCEL,
    CHOICE_CONFIRM,
    CHOICE_DISMISS,
    askChoice,
    confirmDestructiveAction
};
