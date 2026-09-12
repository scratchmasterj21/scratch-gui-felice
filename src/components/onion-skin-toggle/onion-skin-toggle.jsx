import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {MAX_ONION_FRAMES} from '../../lib/onion-skin-frames';

import styles from './onion-skin-toggle.css';

const frameCounts = [];
for (let i = 0; i <= MAX_ONION_FRAMES; i++) {
    frameCounts.push(i);
}

const FrameCountSelect = ({value, onChange, children}) => (
    <label className={styles.onionSkinOption}>
        {children}
        <select
            className={styles.onionSkinSelect}
            value={value}
            onChange={onChange}
        >
            {frameCounts.map(count => (
                <option
                    key={count}
                    value={count}
                >
                    {count}
                </option>
            ))}
        </select>
    </label>
);

FrameCountSelect.propTypes = {
    children: PropTypes.node,
    onChange: PropTypes.func.isRequired,
    value: PropTypes.number.isRequired
};

const OnionSkinToggle = ({
    enabled,
    loop,
    next,
    previous,
    tinted,
    onChangeLoop,
    onChangeNext,
    onChangePrevious,
    onChangeTinted,
    onToggle
}) => (
    <div className={styles.onionSkinContainer}>
        <label className={styles.onionSkinLabel}>
            <input
                checked={enabled}
                type="checkbox"
                onChange={onToggle}
            />
            <FormattedMessage
                defaultMessage="Onion Skin"
                description="Label for the paint editor control that shows nearby costumes behind the current one"
                id="gui.paintEditor.onionSkin"
            />
        </label>
        {enabled ? (
            <div className={styles.onionSkinOptions}>
                <FrameCountSelect
                    value={previous}
                    onChange={onChangePrevious}
                >
                    <FormattedMessage
                        defaultMessage="Before"
                        description="Label for how many earlier costumes the onion skin shows"
                        id="gui.paintEditor.onionSkinBefore"
                    />
                </FrameCountSelect>
                <FrameCountSelect
                    value={next}
                    onChange={onChangeNext}
                >
                    <FormattedMessage
                        defaultMessage="After"
                        description="Label for how many later costumes the onion skin shows"
                        id="gui.paintEditor.onionSkinAfter"
                    />
                </FrameCountSelect>
                <label className={styles.onionSkinOption}>
                    <input
                        checked={tinted}
                        type="checkbox"
                        onChange={onChangeTinted}
                    />
                    <FormattedMessage
                        defaultMessage="Tint"
                        description="Label for coloring onion skin frames red for earlier and blue for later"
                        id="gui.paintEditor.onionSkinTint"
                    />
                </label>
                <label className={styles.onionSkinOption}>
                    <input
                        checked={loop}
                        type="checkbox"
                        onChange={onChangeLoop}
                    />
                    <FormattedMessage
                        defaultMessage="Loop"
                        description="Label for wrapping the onion skin around the first and last costume"
                        id="gui.paintEditor.onionSkinLoop"
                    />
                </label>
            </div>
        ) : null}
    </div>
);

OnionSkinToggle.propTypes = {
    enabled: PropTypes.bool,
    loop: PropTypes.bool,
    next: PropTypes.number.isRequired,
    onChangeLoop: PropTypes.func.isRequired,
    onChangeNext: PropTypes.func.isRequired,
    onChangePrevious: PropTypes.func.isRequired,
    onChangeTinted: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
    previous: PropTypes.number.isRequired,
    tinted: PropTypes.bool
};

export default OnionSkinToggle;
