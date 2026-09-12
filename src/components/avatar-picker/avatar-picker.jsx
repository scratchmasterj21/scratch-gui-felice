import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';

import AvatarOption from './avatar-option.jsx';
import catProfileIcon from '../menu-bar/icon--profile.png';
import styles from './avatar-picker.css';

const AVATAR_CATEGORIES = [
    {
        name: 'Classic & Animals',
        items: [
            {id: 'cat', label: 'Scratch Cat', isCat: true},
            {id: '🐱', label: 'Cat'},
            {id: '🐶', label: 'Dog'},
            {id: '🦊', label: 'Fox'},
            {id: '🐻', label: 'Bear'},
            {id: '🐼', label: 'Panda'},
            {id: '🦁', label: 'Lion'},
            {id: '🐯', label: 'Tiger'},
            {id: '🐸', label: 'Frog'},
            {id: '🐵', label: 'Monkey'},
            {id: '🦄', label: 'Unicorn'},
            {id: '🐰', label: 'Bunny'},
            {id: '🐧', label: 'Penguin'},
            {id: '🐨', label: 'Koala'},
            {id: '🐙', label: 'Octopus'},
            {id: '🦖', label: 'Dino'}
        ]
    },
    {
        name: 'Cool & Sci-Fi',
        items: [
            {id: '🚀', label: 'Rocket'},
            {id: '🤖', label: 'Robot'},
            {id: '👾', label: 'Alien'},
            {id: '🎮', label: 'Gamepad'},
            {id: '⚡', label: 'Lightning'},
            {id: '🔥', label: 'Fire'},
            {id: '⭐', label: 'Star'},
            {id: '🌈', label: 'Rainbow'},
            {id: '💎', label: 'Gem'},
            {id: '🔮', label: 'Crystal Ball'}
        ]
    },
    {
        name: 'Creative & Fun',
        items: [
            {id: '🎨', label: 'Art Palette'},
            {id: '🍕', label: 'Pizza'},
            {id: '🍦', label: 'Ice Cream'},
            {id: '🍩', label: 'Donut'},
            {id: '🍪', label: 'Cookie'},
            {id: '🍭', label: 'Lollipop'},
            {id: '⚽', label: 'Soccer'},
            {id: '🛹', label: 'Skateboard'}
        ]
    }
];

class AvatarPicker extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleDocumentClick',
            'handleKeyDown'
        ]);
        this.containerRef = React.createRef();
    }

    componentDidMount () {
        window.addEventListener('pointerdown', this.handleDocumentClick, true);
        window.addEventListener('touchstart', this.handleDocumentClick, true);
        window.addEventListener('mousedown', this.handleDocumentClick, true);
        window.addEventListener('keydown', this.handleKeyDown, true);
    }

    componentWillUnmount () {
        window.removeEventListener('pointerdown', this.handleDocumentClick, true);
        window.removeEventListener('touchstart', this.handleDocumentClick, true);
        window.removeEventListener('mousedown', this.handleDocumentClick, true);
        window.removeEventListener('keydown', this.handleKeyDown, true);
    }

    handleDocumentClick (e) {
        if (!this.props.isOpen) return;

        // If click is inside the container or anchor, don't close here
        if (this.containerRef.current && this.containerRef.current.contains(e.target)) {
            return;
        }
        if (this.props.anchorRef && this.props.anchorRef.current &&
            this.props.anchorRef.current.contains(e.target)) {
            return;
        }

        this.props.onClose();
    }

    handleKeyDown (e) {
        if (!this.props.isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.props.onClose();
        }
    }

    render () {
        if (!this.props.isOpen) return null;

        const current = this.props.currentAvatar || 'cat';
        const isCurrentCat = current === 'cat' || current === '';

        return (
            <div
                className={styles.avatarPickerContainer}
                ref={this.containerRef}
            >
                <div className={styles.avatarPickerHeader}>
                    <h4 className={styles.avatarPickerTitle}>
                        {'Choose Your Avatar'}
                    </h4>
                    <button
                        className={styles.avatarPickerCloseBtn}
                        title="Close"
                        type="button"
                        onClick={this.props.onClose}
                    >
                        {'✕'}
                    </button>
                </div>

                <div className={styles.avatarPickerCurrentPreview}>
                    <div className={styles.currentPreviewBadge}>
                        {isCurrentCat ? (
                            <img
                                alt="Scratch Cat"
                                className={styles.currentPreviewCat}
                                src={catProfileIcon}
                            />
                        ) : (
                            <span>{current}</span>
                        )}
                    </div>
                    <div className={styles.currentPreviewInfo}>
                        <span className={styles.currentPreviewLabel}>
                            {'Current Avatar'}
                        </span>
                        <span className={styles.currentPreviewUsername}>
                            {this.props.username}
                        </span>
                    </div>
                </div>

                <div className={styles.avatarPickerScrollArea}>
                    {AVATAR_CATEGORIES.map(category => (
                        <div key={category.name}>
                            <div className={styles.categoryTitle}>
                                {category.name}
                            </div>
                            <div className={styles.avatarGrid}>
                                {category.items.map(item => {
                                    const isSelected = item.isCat ?
                                        isCurrentCat :
                                        current === item.id;
                                    return (
                                        <AvatarOption
                                            id={item.id}
                                            isCat={item.isCat}
                                            isSelected={isSelected}
                                            key={item.id}
                                            label={item.label}
                                            onSelect={this.props.onSelectAvatar}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

AvatarPicker.propTypes = {
    anchorRef: PropTypes.shape({current: PropTypes.any}),
    currentAvatar: PropTypes.string,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSelectAvatar: PropTypes.func.isRequired,
    username: PropTypes.string
};

export default AvatarPicker;
