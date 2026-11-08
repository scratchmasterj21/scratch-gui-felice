import React from 'react';
import PropTypes from 'prop-types';
import omit from 'lodash.omit';
import {connect} from 'react-redux';
import {setFontsLoaded} from '../reducers/fonts-loaded';

// This list is from scratch-render-fonts:
// https://github.com/LLK/scratch-render-fonts/blob/master/src/index.js#L4
const FONTS = [
    'Sans Serif',
    'Serif',
    'Handwriting',
    'Marker',
    'Curly',
    'Pixel',
    'Scratch'
];
/* Higher Order Component to provide behavior for loading fonts.
 * @param {React.Component} WrappedComponent component to receive fontsLoaded prop
 * @returns {React.Component} component with font loading behavior
 */
// The window load event waits for every image/script on the page, so one slow
// remote resource can delay it indefinitely. If it hasn't fired after this
// long, start loading the fonts anyway.
const LOAD_EVENT_FALLBACK_MS = 3000;
// Last resort: never keep the project waiting on fonts longer than this.
const FONTS_LOADED_DEADLINE_MS = 10000;

const FontLoaderHOC = function (WrappedComponent) {
    class FontLoaderComponent extends React.Component {
        componentDidMount () {
            if (this.props.fontsLoaded) return;

            let finished = false;
            const finish = () => {
                if (finished || this.unmounted) return;
                finished = true;
                this.cleanup();
                this.props.onSetFontsLoaded();
            };

            const getFontPromises = () => {
                const fontPromises = [];
                // Browsers that support the font loader interface have an iterable document.fonts.values()
                // Firefox has a mocked out object that doesn't actually implement iterable, which is why
                // the deep safety check is necessary.
                if (document.fonts &&
                    typeof document.fonts.values === 'function' &&
                    typeof document.fonts.values()[Symbol.iterator] === 'function') {
                    for (const fontFace of document.fonts.values()) {
                        // Only load fonts from this list. If we load all fonts on the document, we may block on
                        // loading fonts from things like chrome extensions.
                        if (FONTS.indexOf(fontFace.family) !== -1) {
                            fontPromises.push(fontFace.loaded);
                            fontFace.load();
                        }
                    }
                }
                return fontPromises;
            };
            const loadFonts = () => {
                Promise.all(getFontPromises()).then(finish, finish);
            };
            // Font promises should be gathered after the document is loaded, because on Mac Chrome, the promise
            // objects get replaced and the old ones never resolve. Gathering again on the load event (and the
            // final deadline) covers the case where the early fallback picked up stale promises.
            if (document.readyState === 'complete') {
                loadFonts();
            } else {
                this.handleWindowLoad = loadFonts;
                window.addEventListener('load', this.handleWindowLoad);
                this.fallbackTimeout = setTimeout(loadFonts, LOAD_EVENT_FALLBACK_MS);
                this.deadlineTimeout = setTimeout(finish, FONTS_LOADED_DEADLINE_MS);
            }
        }
        componentWillUnmount () {
            this.unmounted = true;
            this.cleanup();
        }
        cleanup () {
            if (this.handleWindowLoad) {
                window.removeEventListener('load', this.handleWindowLoad);
                this.handleWindowLoad = null;
            }
            clearTimeout(this.fallbackTimeout);
            clearTimeout(this.deadlineTimeout);
        }
        render () {
            const componentProps = omit(this.props, ['onSetFontsLoaded']);
            return (
                <WrappedComponent
                    {...componentProps}
                />
            );
        }
    }


    FontLoaderComponent.propTypes = {
        fontsLoaded: PropTypes.bool.isRequired,
        onSetFontsLoaded: PropTypes.func.isRequired
    };
    const mapStateToProps = state => ({
        fontsLoaded: state.scratchGui.fontsLoaded
    });
    const mapDispatchToProps = dispatch => ({
        onSetFontsLoaded: () => dispatch(setFontsLoaded())
    });
    return connect(
        mapStateToProps,
        mapDispatchToProps
    )(FontLoaderComponent);
};

export {
    FontLoaderHOC as default
};
