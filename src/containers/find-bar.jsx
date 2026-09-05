import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import ScratchBlocks from 'scratch-blocks';

import FindBarComponent from '../components/find-bar/find-bar.jsx';
import {
    getIndexedItems,
    getVariableUses,
    getProcedureUses,
    getBroadcastUses,
    getCostumes,
    getSounds
} from '../lib/find-bar/block-indexer';
import {scrollBlockIntoView} from '../lib/find-bar/block-scroller';

class FindBar extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleGlobalKeyDown',
            'handleDocumentClick',
            'handleInputChange',
            'handleInputFocus',
            'handleInputKeyDown',
            'handleClear',
            'handleItemClick',
            'handleCarouselPrev',
            'handleCarouselNext',
            'refreshItems',
            'updateFilteredItems'
        ]);

        this.inputRef = React.createRef();
        this.dropdownRef = React.createRef();

        this.state = {
            prevTabIndex: props.activeTabIndex,
            query: '',
            isOpen: false,
            selectedIndex: 0,
            carousel: null,
            items: [],
            filteredItems: []
        };
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        if (nextProps.activeTabIndex !== prevState.prevTabIndex) {
            return {
                prevTabIndex: nextProps.activeTabIndex,
                query: '',
                isOpen: false,
                carousel: null
            };
        }
        return null;
    }

    componentDidMount () {
        window.addEventListener('keydown', this.handleGlobalKeyDown, true);
        document.addEventListener('mousedown', this.handleDocumentClick, false);
    }

    componentWillUnmount () {
        window.removeEventListener('keydown', this.handleGlobalKeyDown, true);
        document.removeEventListener('mousedown', this.handleDocumentClick, false);
    }

    getWorkspace () {
        return ScratchBlocks.getMainWorkspace ? ScratchBlocks.getMainWorkspace() : null;
    }

    handleGlobalKeyDown (e) {
        const isCtrlF = (e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'f' && !e.shiftKey;
        if (!isCtrlF) return;

        const activeEl = document.activeElement;
        const isInsideFindBar = activeEl && activeEl.closest &&
            activeEl.closest(`.${this.inputRef.current?.className}`);
        const isInsideOtherInput = activeEl &&
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
            !isInsideFindBar;

        if (isInsideOtherInput) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (this.inputRef.current) {
            this.inputRef.current.focus();
            this.inputRef.current.select();
        }

        this.refreshItems(() => {
            this.setState({isOpen: true});
        });
    }

    handleDocumentClick (e) {
        if (!this.state.isOpen) return;

        const isClickInsideInput = this.inputRef.current && this.inputRef.current.contains(e.target);
        const isClickInsideDropdown = this.dropdownRef.current && this.dropdownRef.current.contains(e.target);

        if (!isClickInsideInput && !isClickInsideDropdown) {
            this.setState({
                isOpen: false,
                carousel: null
            });
        }
    }

    refreshItems (callback) {
        const {activeTabIndex, vm} = this.props;
        let items = [];

        if (activeTabIndex === 0) {
            const workspace = this.getWorkspace();
            items = getIndexedItems(workspace);
        } else if (activeTabIndex === 1) {
            items = getCostumes(vm);
        } else if (activeTabIndex === 2) {
            items = getSounds(vm);
        }

        this.setState({items}, () => {
            this.updateFilteredItems(this.state.query);
            if (callback) callback();
        });
    }

    updateFilteredItems (query) {
        const trimmed = (query || '').trim().toLowerCase();
        const filtered = trimmed === '' ?
            this.state.items :
            this.state.items.filter(item => item.lower && item.lower.includes(trimmed));

        this.setState({
            filteredItems: filtered,
            selectedIndex: 0
        });
    }

    handleInputChange (e) {
        const query = e.target.value;
        this.setState({
            query,
            isOpen: true,
            carousel: null
        });
        this.updateFilteredItems(query);
    }

    handleInputFocus () {
        this.refreshItems(() => {
            this.setState({isOpen: true});
        });
    }

    handleClear () {
        this.setState({
            query: '',
            carousel: null
        });
        this.updateFilteredItems('');
        if (this.inputRef.current) {
            this.inputRef.current.focus();
        }
    }

    handleInputKeyDown (e) {
        const {isOpen, filteredItems, selectedIndex, carousel} = this.state;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                this.setState({isOpen: true});
                return;
            }
            if (filteredItems.length > 0) {
                const next = (selectedIndex + 1) % filteredItems.length;
                this.setState({selectedIndex: next});
                this.scrollItemIntoView(next);
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                this.setState({isOpen: true});
                return;
            }
            if (filteredItems.length > 0) {
                const prev = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
                this.setState({selectedIndex: prev});
                this.scrollItemIntoView(prev);
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredItems[selectedIndex]) {
                this.handleItemClick(filteredItems[selectedIndex], selectedIndex);
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.state.query.length > 0) {
                this.handleClear();
            } else {
                this.setState({
                    isOpen: false,
                    carousel: null
                });
                if (this.inputRef.current) {
                    this.inputRef.current.blur();
                }
            }
            return;
        }

        if (carousel && carousel.total > 1) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.handleCarouselPrev();
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.handleCarouselNext();
                return;
            }
        }
    }

    scrollItemIntoView (index) {
        if (!this.dropdownRef.current) return;
        const children = this.dropdownRef.current.children;
        if (children && children[index]) {
            children[index].scrollIntoView({block: 'nearest'});
        }
    }

    handleItemClick (item, index) {
        this.setState({selectedIndex: index});
        const {activeTabIndex, vm} = this.props;

        if (activeTabIndex === 0) {
            const workspace = this.getWorkspace();
            if (!workspace) return;

            const cls = item.cls;

            if (cls === 'var' || cls === 'VAR' || cls === 'list' || cls === 'LIST') {
                const uses = getVariableUses(workspace, item.varId || item.id);
                if (uses.length > 0) {
                    this.setState({
                        carousel: {
                            itemIndex: index,
                            blocks: uses,
                            current: 0,
                            total: uses.length
                        }
                    });
                    scrollBlockIntoView(workspace, uses[0], vm);
                } else if (item.id) {
                    this.setState({carousel: null});
                    scrollBlockIntoView(workspace, item.id, vm);
                }
            } else if (cls === 'define') {
                const uses = getProcedureUses(workspace, item.id);
                if (uses.length > 1) {
                    this.setState({
                        carousel: {
                            itemIndex: index,
                            blocks: uses,
                            current: 0,
                            total: uses.length
                        }
                    });
                    scrollBlockIntoView(workspace, uses[0], vm);
                } else {
                    this.setState({carousel: null});
                    scrollBlockIntoView(workspace, item.id, vm);
                }
            } else if (cls === 'receive') {
                const uses = getBroadcastUses(vm, item.eventName);
                if (uses.length > 1) {
                    this.setState({
                        carousel: {
                            itemIndex: index,
                            blocks: uses,
                            current: 0,
                            total: uses.length
                        }
                    });
                    scrollBlockIntoView(workspace, uses[0], vm);
                } else {
                    this.setState({carousel: null});
                    scrollBlockIntoView(workspace, item.id, vm);
                }
            } else if (item.clones && item.clones.length > 1) {
                const uses = item.clones.map(cId => workspace.getBlockById(cId)).filter(Boolean);
                if (uses.length > 1) {
                    this.setState({
                        carousel: {
                            itemIndex: index,
                            blocks: uses,
                            current: 0,
                            total: uses.length
                        }
                    });
                    scrollBlockIntoView(workspace, uses[0], vm);
                } else {
                    this.setState({carousel: null});
                    scrollBlockIntoView(workspace, item.id, vm);
                }
            } else {
                this.setState({carousel: null});
                scrollBlockIntoView(workspace, item.id, vm);
            }
        } else if (activeTabIndex === 1) {
            if (vm && vm.editingTarget && typeof item.index !== 'undefined') {
                vm.editingTarget.setCostume(item.index);
                const assetItems = document.querySelectorAll(
                    '[class*="asset-panel_wrapper_"] [class*="selector_list-item_"]'
                );
                if (assetItems[item.index]) {
                    assetItems[item.index].scrollIntoView({block: 'center', behavior: 'smooth'});
                }
            }
        } else if (activeTabIndex === 2) {
            if (vm && vm.editingTarget && typeof item.index !== 'undefined') {
                const assetItems = document.querySelectorAll(
                    '[class*="asset-panel_wrapper_"] [class*="selector_list-item_"]'
                );
                if (assetItems[item.index]) {
                    assetItems[item.index].scrollIntoView({block: 'center', behavior: 'smooth'});
                    assetItems[item.index].click();
                }
            }
        }
    }

    handleCarouselPrev (e) {
        if (e) e.stopPropagation();
        const {carousel} = this.state;
        if (!carousel || carousel.total <= 1) return;

        const prev = (carousel.current - 1 + carousel.total) % carousel.total;
        const targetBlock = carousel.blocks[prev];
        this.setState({
            carousel: Object.assign({}, carousel, {
                current: prev
            })
        });
        scrollBlockIntoView(this.getWorkspace(), targetBlock, this.props.vm);
    }

    handleCarouselNext (e) {
        if (e) e.stopPropagation();
        const {carousel} = this.state;
        if (!carousel || carousel.total <= 1) return;

        const next = (carousel.current + 1) % carousel.total;
        const targetBlock = carousel.blocks[next];
        this.setState({
            carousel: Object.assign({}, carousel, {
                current: next
            })
        });
        scrollBlockIntoView(this.getWorkspace(), targetBlock, this.props.vm);
    }

    getPlaceholder () {
        const {activeTabIndex} = this.props;
        if (activeTabIndex === 1) return 'Find costume...';
        if (activeTabIndex === 2) return 'Find sound...';
        return 'Find (Ctrl+F)';
    }

    render () {
        const {query, isOpen, filteredItems, selectedIndex, carousel} = this.state;

        return (
            <FindBarComponent
                carouselState={
                    carousel ?
                        {
                            itemIndex: carousel.itemIndex,
                            current: carousel.current,
                            total: carousel.total
                        } :
                        null
                }
                dropdownRef={this.dropdownRef}
                inputRef={this.inputRef}
                isOpen={isOpen}
                items={filteredItems}
                placeholder={this.getPlaceholder()}
                query={query}
                selectedIndex={selectedIndex}
                onCarouselNext={this.handleCarouselNext}
                onCarouselPrev={this.handleCarouselPrev}
                onClear={this.handleClear}
                onInputChange={this.handleInputChange}
                onInputFocus={this.handleInputFocus}
                onInputKeyDown={this.handleInputKeyDown}
                onItemClick={this.handleItemClick}
            />
        );
    }
}

FindBar.propTypes = {
    activeTabIndex: PropTypes.number,
    vm: PropTypes.object
};

const mapStateToProps = state => ({
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex
});

export default connect(mapStateToProps)(FindBar);
