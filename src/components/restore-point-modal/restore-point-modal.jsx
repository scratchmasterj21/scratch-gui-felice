import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage, injectIntl, intlShape} from 'react-intl';

import Modal from '../../containers/modal.jsx';
import {TYPE_MANUAL} from '../../lib/restore-points-policy';

import styles from './restore-point-modal.css';

// A row per restore point. A component rather than inline handlers so each button does not
// get a freshly allocated callback on every render.
class RestorePointRow extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, ['handleRestore', 'handleDelete']);
    }
    handleRestore () {
        this.props.onRestore(this.props.point.id);
    }
    handleDelete () {
        this.props.onDelete(this.props.point.id);
    }
    render () {
        const {busy, point, title} = this.props;
        return (
            <li className={styles.row}>
                <div className={styles.rowText}>
                    <div className={styles.rowTitle}>{title}</div>
                    <div className={styles.rowMeta}>
                        {new Date(point.created).toLocaleString()}
                        {point.type === TYPE_MANUAL ? (
                            <span className={styles.manualTag}>
                                {' \u00b7 '}
                                <FormattedMessage
                                    defaultMessage="Saved by you"
                                    description="Marks a restore point the student created on purpose"
                                    id="gui.restorePoints.manual"
                                />
                            </span>
                        ) : null}
                    </div>
                </div>
                <button
                    className={styles.button}
                    disabled={busy}
                    onClick={this.handleRestore}
                >
                    <FormattedMessage
                        defaultMessage="Restore"
                        description="Button that loads a restore point"
                        id="gui.restorePoints.restore"
                    />
                </button>
                <button
                    className={classNames(styles.button, styles.dangerButton)}
                    disabled={busy}
                    onClick={this.handleDelete}
                >
                    <FormattedMessage
                        defaultMessage="Delete"
                        description="Button that deletes one restore point"
                        id="gui.restorePoints.delete"
                    />
                </button>
            </li>
        );
    }
}

RestorePointRow.propTypes = {
    busy: PropTypes.bool,
    onDelete: PropTypes.func.isRequired,
    onRestore: PropTypes.func.isRequired,
    point: PropTypes.object.isRequired,
    title: PropTypes.string
};

const RestorePointModal = ({
    intl,
    busy,
    error,
    restorePoints,
    onClose,
    onCreate,
    onDelete,
    onDeleteAll,
    onRestore
}) => (
    <Modal
        className={styles.modalContent}
        contentLabel={intl.formatMessage({
            defaultMessage: 'Restore Points',
            description: 'Title of the window listing automatic project backups',
            id: 'gui.restorePoints.title'
        })}
        id="restorePointModal"
        onRequestClose={onClose}
    >
        <div className={styles.body}>
            <p className={styles.description}>
                <FormattedMessage
                    defaultMessage={'Your project is saved on this computer every few minutes while you work. ' +
                        'If something goes wrong, you can go back to one of these.'}
                    description="Explains what restore points are"
                    id="gui.restorePoints.description"
                />
            </p>

            {error ? <div className={styles.error}>{error}</div> : null}

            {restorePoints.length === 0 ? (
                <div className={styles.empty}>
                    <FormattedMessage
                        defaultMessage={'No restore points yet. One is saved a few minutes ' +
                            'after you start making changes.'}
                        description="Shown when a student has no saved restore points"
                        id="gui.restorePoints.empty"
                    />
                </div>
            ) : (
                <ul className={styles.list}>
                    {restorePoints.map(point => (
                        <RestorePointRow
                            busy={busy}
                            key={point.id}
                            point={point}
                            title={point.title || intl.formatMessage({
                                defaultMessage: 'Untitled project',
                                description: 'Fallback name for a restore point with no project title',
                                id: 'gui.restorePoints.untitled'
                            })}
                            onDelete={onDelete}
                            onRestore={onRestore}
                        />
                    ))}
                </ul>
            )}

            <div className={styles.footer}>
                <button
                    className={styles.button}
                    disabled={busy}
                    onClick={onCreate}
                >
                    <FormattedMessage
                        defaultMessage="Save a restore point now"
                        description="Button that creates a restore point immediately"
                        id="gui.restorePoints.createNow"
                    />
                </button>
                <button
                    className={classNames(styles.button, styles.secondaryButton)}
                    disabled={busy || restorePoints.length === 0}
                    onClick={onDeleteAll}
                >
                    <FormattedMessage
                        defaultMessage="Delete all"
                        description="Button that deletes every restore point"
                        id="gui.restorePoints.deleteAll"
                    />
                </button>
            </div>
        </div>
    </Modal>
);

RestorePointModal.propTypes = {
    busy: PropTypes.bool,
    error: PropTypes.string,
    intl: intlShape.isRequired,
    onClose: PropTypes.func.isRequired,
    onCreate: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDeleteAll: PropTypes.func.isRequired,
    onRestore: PropTypes.func.isRequired,
    restorePoints: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default injectIntl(RestorePointModal);
