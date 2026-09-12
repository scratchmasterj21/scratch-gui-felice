import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';

import catProfileIcon from '../menu-bar/icon--profile.png';
import styles from './avatar-picker.css';

class AvatarOption extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, ['handleClick']);
    }

    handleClick () {
        this.props.onSelect(this.props.id);
    }

    render () {
        const {id, isCat, isSelected, label} = this.props;
        return (
            <button
                className={classNames(styles.avatarOptionBtn, {
                    [styles.isSelected]: isSelected
                })}
                title={label}
                type="button"
                onClick={this.handleClick}
            >
                {isCat ? (
                    <img
                        alt={label}
                        className={styles.catOptionIcon}
                        src={catProfileIcon}
                    />
                ) : (
                    <span>{id}</span>
                )}
            </button>
        );
    }
}

AvatarOption.propTypes = {
    id: PropTypes.string.isRequired,
    isCat: PropTypes.bool,
    isSelected: PropTypes.bool.isRequired,
    label: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired
};

export default AvatarOption;
