import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import styles from './find-bar.css';

const highlightMatch = function (text, query) {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return (
        <span>
            {before}
            <b>{match}</b>
            {after}
        </span>
    );
};

class FindItem extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleMouseDown',
            'handleStopPropagation'
        ]);
    }

    handleMouseDown (e) {
        e.preventDefault();
        this.props.onItemClick(this.props.item, this.props.index);
    }

    handleStopPropagation (e) {
        e.stopPropagation();
    }

    render () {
        const {
            item,
            index,
            isSelected,
            carouselState,
            query,
            onCarouselPrev,
            onCarouselNext
        } = this.props;

        const isCarouselActive = carouselState &&
            carouselState.itemIndex === index &&
            carouselState.total > 1;

        return (
            <li
                className={classNames(styles.findItem, {
                    [styles.selected]: isSelected
                })}
                onMouseDown={this.handleMouseDown}
            >
                <div className={styles.findItemContent}>
                    <span
                        className={classNames(
                            styles.findDot,
                            styles[`dot-${item.cls}`]
                        )}
                    />
                    <span className={styles[`find-label-${item.cls}`]}>
                        {highlightMatch(item.label, query)}
                    </span>
                </div>

                {isCarouselActive && (
                    <div
                        className={styles.findCarousel}
                        onMouseDown={this.handleStopPropagation}
                    >
                        <span
                            className={styles.findCarouselBtn}
                            title="Previous block"
                            onClick={onCarouselPrev}
                        >
                            {'◀'}
                        </span>
                        <span>
                            {carouselState.current + 1}
                            {' / '}
                            {carouselState.total}
                        </span>
                        <span
                            className={styles.findCarouselBtn}
                            title="Next block"
                            onClick={onCarouselNext}
                        >
                            {'▶'}
                        </span>
                    </div>
                )}
            </li>
        );
    }
}

FindItem.propTypes = {
    carouselState: PropTypes.shape({
        current: PropTypes.number,
        itemIndex: PropTypes.number,
        total: PropTypes.number
    }),
    index: PropTypes.number.isRequired,
    isSelected: PropTypes.bool.isRequired,
    item: PropTypes.shape({
        cls: PropTypes.string,
        label: PropTypes.string
    }).isRequired,
    onCarouselNext: PropTypes.func.isRequired,
    onCarouselPrev: PropTypes.func.isRequired,
    onItemClick: PropTypes.func.isRequired,
    query: PropTypes.string.isRequired
};

const FindBarComponent = props => (
    <div className={styles.findBarWrapper}>
        <div className={styles.findInputContainer}>
            <svg
                className={styles.findSearchIcon}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
            >
                <circle
                    cx="11"
                    cy="11"
                    r="8"
                />
                <line
                    x1="21"
                    x2="16.65"
                    y1="21"
                    y2="16.65"
                />
            </svg>
            <input
                autoComplete="off"
                className={styles.findInput}
                placeholder={props.placeholder}
                ref={props.inputRef}
                spellCheck="false"
                type="text"
                value={props.query}
                onChange={props.onInputChange}
                onFocus={props.onInputFocus}
                onKeyDown={props.onInputKeyDown}
            />
            {props.query.length > 0 && (
                <button
                    className={styles.findClearBtn}
                    title="Clear"
                    type="button"
                    onClick={props.onClear}
                >
                    {'✕'}
                </button>
            )}
        </div>

        {props.isOpen && (
            <ul
                className={styles.findDropdown}
                ref={props.dropdownRef}
            >
                {props.items.length === 0 ? (
                    <li className={styles.findNoResults}>
                        {'No matching blocks'}
                    </li>
                ) : (
                    props.items.map((item, idx) => (
                        <FindItem
                            carouselState={props.carouselState}
                            index={idx}
                            isSelected={idx === props.selectedIndex}
                            item={item}
                            key={`${item.cls}-${item.label}-${idx}`}
                            query={props.query}
                            onCarouselNext={props.onCarouselNext}
                            onCarouselPrev={props.onCarouselPrev}
                            onItemClick={props.onItemClick}
                        />
                    ))
                )}
            </ul>
        )}
    </div>
);

FindBarComponent.propTypes = {
    carouselState: PropTypes.shape({
        current: PropTypes.number,
        itemIndex: PropTypes.number,
        total: PropTypes.number
    }),
    dropdownRef: PropTypes.shape({current: PropTypes.any}),
    inputRef: PropTypes.shape({current: PropTypes.any}),
    isOpen: PropTypes.bool,
    items: PropTypes.arrayOf(PropTypes.object),
    onCarouselNext: PropTypes.func,
    onCarouselPrev: PropTypes.func,
    onClear: PropTypes.func,
    onInputChange: PropTypes.func,
    onInputFocus: PropTypes.func,
    onInputKeyDown: PropTypes.func,
    onItemClick: PropTypes.func,
    placeholder: PropTypes.string,
    query: PropTypes.string,
    selectedIndex: PropTypes.number
};

export default FindBarComponent;
