import classNames from 'classnames';
import {connect} from 'react-redux';
import {compose} from 'redux';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import bowser from 'bowser';
import React from 'react';
import GoogleDrivePickerButton from './google-drive-btn.jsx'; // Adjust the import path as necessary
import {loadGoogleApis, uploadFileToGoogleDrive} from './drive-utils.jsx';
import VM from 'scratch-vm';

import LoginModal from '../login-modal/login-modal.jsx';
import MyProjectsModal from '../my-projects-modal/my-projects-modal.jsx';
import AvatarPicker from '../avatar-picker/avatar-picker.jsx';
import {saveProject} from '../../lib/cloud-project-service';
import {getSupabase, emailToUsername, getSavedAvatar, updateUserAvatar} from '../../lib/supabase';
import {loginSuccess, logout as logoutAction, setAvatar} from '../../reducers/auth';
import {setProjectTitle} from '../../reducers/project-title';
import {setProjectUnchanged} from '../../reducers/project-changed';
import Swal from 'sweetalert2';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import CommunityButton from './community-button.jsx';
import ShareButton from './share-button.jsx';
import {ComingSoonTooltip} from '../coming-soon/coming-soon.jsx';
import Divider from '../divider/divider.jsx';
import SaveStatus from './save-status.jsx';
import ProjectWatcher from '../../containers/project-watcher.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection} from '../menu/menu.jsx';
import ProjectTitleInput from './project-title-input.jsx';
import AuthorInfo from './author-info.jsx';
import AccountNav from '../../containers/account-nav.jsx';
import LoginDropdown from './login-dropdown.jsx';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import MenuBarHOC from '../../containers/menu-bar-hoc.jsx';
import SettingsMenu from './settings-menu.jsx';
import LanguageSelector from '../../containers/language-selector.jsx';
import languageIcon from '../language-selector/language-icon.svg';
import {projectTitleInitialState} from '../../reducers/project-title';


import {openTipsLibrary, openRestorePoints} from '../../reducers/modals';
import {setPlayer} from '../../reducers/mode';
import {
    isTimeTravel220022BC,
    isTimeTravel1920,
    isTimeTravel1990,
    isTimeTravel2020,
    isTimeTravelNow,
    setTimeTravel
} from '../../reducers/time-travel';
import {
    autoUpdateProject,
    getIsUpdating,
    getIsShowingProject,
    manualUpdateProject,
    requestNewProject,
    remixProject,
    saveProjectAsCopy
} from '../../reducers/project-state';
import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    openFileMenu,
    closeFileMenu,
    fileMenuOpen,
    openEditMenu,
    closeEditMenu,
    editMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen,
    openModeMenu,
    closeModeMenu,
    modeMenuOpen,
    settingsMenuOpen,
    openSettingsMenu,
    closeSettingsMenu
} from '../../reducers/menus';

import collectMetadata from '../../lib/collect-metadata';

import styles from './menu-bar.css';

import helpIcon from '../../lib/assets/icon--tutorials.svg';
import mystuffIcon from './icon--mystuff.png';
import profileIcon from './icon--profile.png';
import remixIcon from './icon--remix.svg';
import dropdownCaret from './dropdown-caret.svg';
import aboutIcon from './icon--about.svg';
import fileIcon from './icon--file.svg';
import editIcon from './icon--edit.svg';

import scratchLogo from './new-felice-scratch-logo.svg';
import ninetiesLogo from './nineties_logo.svg';
import catLogo from './cat_logo.svg';
import prehistoricLogo from './prehistoric-logo.svg';
import oldtimeyLogo from './oldtimey-logo.svg';

import sharedMessages from '../../lib/shared-messages';

const ariaMessages = defineMessages({
    language: {
        id: 'gui.menuBar.LanguageSelector',
        defaultMessage: 'language selector',
        description: 'accessibility text for the language selection menu'
    },
    tutorials: {
        id: 'gui.menuBar.tutorialsLibrary',
        defaultMessage: 'Tutorials',
        description: 'accessibility text for the tutorials button'
    }
});

const MenuBarItemTooltip = ({
    children,
    className,
    enable,
    id,
    place = 'bottom'
}) => {
    if (enable) {
        return (
            <React.Fragment>
                {children}
            </React.Fragment>
        );
    }
    return (
        <ComingSoonTooltip
            className={classNames(styles.comingSoon, className)}
            place={place}
            tooltipClassName={styles.comingSoonTooltip}
            tooltipId={id}
        >
            {children}
        </ComingSoonTooltip>
    );
};


MenuBarItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    enable: PropTypes.bool,
    id: PropTypes.string,
    place: PropTypes.oneOf(['top', 'bottom', 'left', 'right'])
};

const MenuItemTooltip = ({id, isRtl, children, className}) => (
    <ComingSoonTooltip
        className={classNames(styles.comingSoon, className)}
        isRtl={isRtl}
        place={isRtl ? 'left' : 'right'}
        tooltipClassName={styles.comingSoonTooltip}
        tooltipId={id}
    >
        {children}
    </ComingSoonTooltip>
);

MenuItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    id: PropTypes.string,
    isRtl: PropTypes.bool
};

const AboutButton = props => (
    <Button
        className={classNames(styles.menuBarItem, styles.hoverable)}
        iconClassName={styles.aboutIcon}
        iconSrc={aboutIcon}
        onClick={props.onClick}
    />
);

AboutButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

class MenuBar extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClickNew',
            'handleClickRemix',
            'handleClickSave',
            'handleClickSaveAsCopy',
            'handleClickSeeCommunity',
            'handleClickShare',
            'handleSetMode',
            'handleKeyPress',
            'handleRestoreOption',
            'getSaveToComputerHandler',
            'handleSaveToGoogleDrive',
            'restoreOptionMessage',
            'handleOpenLoginModal',
            'handleCloseLoginModal',
            'handleOpenMyProjects',
            'handleCloseMyProjects',
            'handleSaveToCloud',
            'handleLogout',
            'handleToggleAutoSave',
            'handleToggleAvatarPicker',
            'handleCloseAvatarPicker',
            'handleSelectAvatar'
        ]);
        this.profileButtonRef = React.createRef();
        this.state = {
            loginModalOpen: false,
            myProjectsModalOpen: false,
            avatarPickerOpen: false,
            cloudSaveStatus: null, // null, 'saving', 'saved', 'error'
            autoSaveEnabled: false,
            autoSaveIntervalId: null,
            lastSavedTime: null
        };
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyPress);
        // Check for existing Supabase session on mount
        getSupabase().auth.getSession().then(({data: {session}}) => {
            if (session && session.user) {
                const avatar = getSavedAvatar(session.user.id, session.user.user_metadata);
                this.props.onSupabaseLoginSuccess({
                    id: session.user.id,
                    email: session.user.email,
                    username: emailToUsername(session.user.email),
                    avatar: avatar
                });
            }
        });
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyPress);
        if (this.state.autoSaveIntervalId) {
            clearInterval(this.state.autoSaveIntervalId);
        }
    }
    handleToggleAvatarPicker () {
        this.setState(prevState => ({
            avatarPickerOpen: !prevState.avatarPickerOpen
        }));
    }
    handleCloseAvatarPicker () {
        this.setState({avatarPickerOpen: false});
    }
    handleSelectAvatar (avatar) {
        const user = this.props.authUser;
        if (user) {
            this.props.onSetAvatar(avatar);
            updateUserAvatar(user.id, avatar);
        }
        this.setState({avatarPickerOpen: false});
    }
    handleOpenLoginModal () {
        this.setState({loginModalOpen: true});
    }
    handleCloseLoginModal () {
        this.setState({loginModalOpen: false});
    }
    handleOpenMyProjects () {
        this.props.onRequestCloseFile();
        this.setState({myProjectsModalOpen: true});
    }
    handleCloseMyProjects () {
        this.setState({myProjectsModalOpen: false});
    }
    handleToggleAutoSave () {
        this.setState(prevState => {
            const nextEnabled = !prevState.autoSaveEnabled;
            let nextIntervalId = prevState.autoSaveIntervalId;
            
            if (nextEnabled) {
                // start auto-save every 1 minute (60000 ms)
                nextIntervalId = setInterval(() => this.handleSaveToCloud(true), 60000);
            } else {
                // stop auto-save
                if (nextIntervalId) clearInterval(nextIntervalId);
                nextIntervalId = null;
            }
            
            return {
                autoSaveEnabled: nextEnabled,
                autoSaveIntervalId: nextIntervalId
            };
        });
    }
    handleSaveToCloud (isAutoSave = false) {
        if (!isAutoSave) {
            this.props.onRequestCloseFile();
        }
        const user = this.props.authUser;
        if (!user) {
            if (!isAutoSave) this.setState({loginModalOpen: true});
            return;
        }
        const title = this.props.projectTitle || 'Untitled';
        this.setState({cloudSaveStatus: 'saving'});
        this.props.vm.saveProjectSb3()
            .then(blob => saveProject(user.id, user.email, title, blob))
            .then(() => {
                this.props.onSetProjectUnchanged(); // Reset projectChanged state to hide button
                const now = new Date();
                this.setState({
                    cloudSaveStatus: 'saved',
                    lastSavedTime: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                });
                if (!isAutoSave) {
                    Swal.fire({
                        heightAuto: false,
                        title: 'Success!',
                        text: `Project "${title}" saved to cloud!`,
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
                setTimeout(() => this.setState({cloudSaveStatus: null}), 3000);
            })
            .catch(err => {
                console.error('Cloud save failed:', err);
                this.setState({cloudSaveStatus: 'error'});
                if (!isAutoSave) {
                    Swal.fire({
                        heightAuto: false,
                        title: 'Error',
                        text: `Failed to save: ${err.message}`,
                        icon: 'error'
                    });
                }
                setTimeout(() => this.setState({cloudSaveStatus: null}), 3000);
            });
    }
    handleLogout () {
        getSupabase().auth.signOut().then(() => {
            this.props.onSupabaseLogout();
        });
    }
    handleClickNew () {
        // if the project is dirty, and user owns the project, we will autosave.
        // but if they are not logged in and can't save, user should consider
        // downloading or logging in first.
        // Note that if user is logged in and editing someone else's project,
        // they'll lose their work.
        const readyToReplaceProject = this.props.confirmReadyToReplaceProject(
            this.props.intl.formatMessage(sharedMessages.replaceProjectWarning)
        );
        this.props.onRequestCloseFile();
        if (readyToReplaceProject) {
            this.props.onClickNew(this.props.canSave && this.props.canCreateNew);
        }
        this.props.onRequestCloseFile();
    }
    handleClickRemix () {
        this.props.onClickRemix();
        this.props.onRequestCloseFile();
    }
    handleClickSave () {
        this.props.onClickSave();
        this.props.onRequestCloseFile();
    }
    handleClickSaveAsCopy () {
        this.props.onClickSaveAsCopy();
        this.props.onRequestCloseFile();
    }
    handleClickSeeCommunity (waitForUpdate) {
        if (this.props.shouldSaveBeforeTransition()) {
            this.props.autoUpdateProject(); // save before transitioning to project page
            waitForUpdate(true); // queue the transition to project page
        } else {
            waitForUpdate(false); // immediately transition to project page
        }
    }
    handleClickShare (waitForUpdate) {
        if (!this.props.isShared) {
            if (this.props.canShare) { // save before transitioning to project page
                this.props.onShare();
            }
            if (this.props.canSave) { // save before transitioning to project page
                this.props.autoUpdateProject();
                waitForUpdate(true); // queue the transition to project page
            } else {
                waitForUpdate(false); // immediately transition to project page
            }
        }
    }
    handleSetMode (mode) {
        return () => {
            // Turn on/off filters for modes.
            if (mode === '1920') {
                document.documentElement.style.filter = 'brightness(.9)contrast(.8)sepia(1.0)';
                document.documentElement.style.height = '100%';
            } else if (mode === '1990') {
                document.documentElement.style.filter = 'hue-rotate(40deg)';
                document.documentElement.style.height = '100%';
            } else {
                document.documentElement.style.filter = '';
                document.documentElement.style.height = '';
            }

            // Change logo for modes
            if (mode === '1990') {
                document.getElementById('logo_img').src = ninetiesLogo;
            } else if (mode === '2020') {
                document.getElementById('logo_img').src = catLogo;
            } else if (mode === '1920') {
                document.getElementById('logo_img').src = oldtimeyLogo;
            } else if (mode === '220022BC') {
                document.getElementById('logo_img').src = prehistoricLogo;
            } else {
                document.getElementById('logo_img').src = this.props.logo;
            }

            this.props.onSetTimeTravelMode(mode);
        };
    }
    handleRestoreOption (restoreFun) {
        return () => {
            restoreFun();
            this.props.onRequestCloseEdit();
        };
    }
    handleKeyPress (event) {
        const modifier = bowser.mac ? event.metaKey : event.ctrlKey;
        if (modifier && event.key === 's') {
            this.props.onClickSave();
            event.preventDefault();
        }
    }
    getSaveToComputerHandler (downloadProjectCallback) {
        return () => {
            this.props.onRequestCloseFile();
            downloadProjectCallback();
            if (this.props.onProjectTelemetryEvent) {
                const metadata = collectMetadata(this.props.vm, this.props.projectTitle, this.props.locale);
                this.props.onProjectTelemetryEvent('projectDidSave', metadata);
            }
        };
    }

    handleSaveToGoogleDrive = () => {
        this.props.onRequestCloseFile();
        this.props.saveProjectSb3().then(blob => {
            const fileName = this.props.projectFilename;
            loadGoogleApis((accessToken) => {
                if (accessToken) {
                    uploadFileToGoogleDrive(blob, fileName, accessToken,
                        (result) => {
                            console.log('Upload successful:', result);
                            if (this.props.onProjectTelemetryEvent) {
                                const metadata = this.collectMetadata();
                                this.props.onProjectTelemetryEvent('projectDidSaveToGoogleDrive', metadata);
                            }
                        },
                        (error) => {
                            console.error('Upload failed:', error);
                        }
                    );
                } else {
                    console.error('No access token available.');
                }
            });
        }).catch(error => {
            console.error('Error fetching the project blob:', error);
        });
    };
    
    
    
    restoreOptionMessage (deletedItem) {
        switch (deletedItem) {
        case 'Sprite':
            return (<FormattedMessage
                defaultMessage="Restore Sprite"
                description="Menu bar item for restoring the last deleted sprite."
                id="gui.menuBar.restoreSprite"
            />);
        case 'Sound':
            return (<FormattedMessage
                defaultMessage="Restore Sound"
                description="Menu bar item for restoring the last deleted sound."
                id="gui.menuBar.restoreSound"
            />);
        case 'Costume':
            return (<FormattedMessage
                defaultMessage="Restore Costume"
                description="Menu bar item for restoring the last deleted costume."
                id="gui.menuBar.restoreCostume"
            />);
        default: {
            return (<FormattedMessage
                defaultMessage="Restore"
                description="Menu bar item for restoring the last deleted item in its disabled state." /* eslint-disable-line max-len */
                id="gui.menuBar.restore"
            />);
        }
        }
    }
    buildAboutMenu (onClickAbout) {
        if (!onClickAbout) {
            // hide the button
            return null;
        }
        if (typeof onClickAbout === 'function') {
            // make a button which calls a function
            return <AboutButton onClick={onClickAbout} />;
        }
        // assume it's an array of objects
        // each item must have a 'title' FormattedMessage and a 'handleClick' function
        // generate a menu with items for each object in the array
        return (
            <div
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.props.aboutMenuOpen
                })}
                onMouseUp={this.props.onRequestOpenAbout}
            >
                <img
                    className={styles.aboutIcon}
                    src={aboutIcon}
                />
                <MenuBarMenu
                    className={classNames(styles.menuBarMenu)}
                    open={this.props.aboutMenuOpen}
                    place={this.props.isRtl ? 'right' : 'left'}
                    onRequestClose={this.props.onRequestCloseAbout}
                >
                    {
                        onClickAbout.map(itemProps => (
                            <MenuItem
                                key={itemProps.title}
                                isRtl={this.props.isRtl}
                                onClick={this.wrapAboutMenuCallback(itemProps.onClick)}
                            >
                                {itemProps.title}
                            </MenuItem>
                        ))
                    }
                </MenuBarMenu>
            </div>
        );
    }
    wrapAboutMenuCallback (callback) {
        return () => {
            callback();
            this.props.onRequestCloseAbout();
        };
    }
    render () {
        const saveNowMessage = (
            <FormattedMessage
                defaultMessage="Save now"
                description="Menu bar item for saving now"
                id="gui.menuBar.saveNow"
            />
        );
        const createCopyMessage = (
            <FormattedMessage
                defaultMessage="Save as a copy"
                description="Menu bar item for saving as a copy"
                id="gui.menuBar.saveAsCopy"
            />
        );
        const remixMessage = (
            <FormattedMessage
                defaultMessage="Remix"
                description="Menu bar item for remixing"
                id="gui.menuBar.remix"
            />
        );
        const newProjectMessage = (
            <FormattedMessage
                defaultMessage="New"
                description="Menu bar item for creating a new project"
                id="gui.menuBar.new"
            />
        );
        const remixButton = (
            <Button
                className={classNames(
                    styles.menuBarButton,
                    styles.remixButton
                )}
                iconClassName={styles.remixButtonIcon}
                iconSrc={remixIcon}
                onClick={this.handleClickRemix}
            >
                {remixMessage}
            </Button>
        );
        // Show the About button only if we have a handler for it (like in the desktop app)
        const aboutButton = this.buildAboutMenu(this.props.onClickAbout);
        return (
            <Box
                className={classNames(
                    this.props.className,
                    styles.menuBar
                )}
            >
                <div className={styles.mainMenu}>
                    <div className={styles.fileGroup}>
                        <div className={classNames(styles.menuBarItem)}>
                            <img
                                id="logo_img"
                                alt="Scratch"
                                className={classNames(styles.scratchLogo, {
                                    [styles.clickable]: typeof this.props.onClickLogo !== 'undefined'
                                })}
                                draggable={false}
                                src={this.props.logo}
                                onClick={this.props.onClickLogo}
                            />
                        </div>
                        {/*{(this.props.canChangeTheme || this.props.canChangeLanguage) && (<SettingsMenu
                            canChangeLanguage={this.props.canChangeLanguage}
                            canChangeTheme={this.props.canChangeTheme}
                            isRtl={this.props.isRtl}
                            onRequestClose={this.props.onRequestCloseSettings}
                            onRequestOpen={this.props.onClickSettings}
                            settingsMenuOpen={this.props.settingsMenuOpen}
                        />)}*/}
                        {(this.props.canChangeLanguage) && (<div
                            className={classNames(styles.menuBarItem, styles.hoverable, styles.languageMenu)}
                        >
                            <div>
                                <img
                                    className={styles.languageIcon}
                                    src={languageIcon}
                                />
                                <img
                                    className={styles.languageCaret}
                                    src={dropdownCaret}
                                />
                            </div>
                            <LanguageSelector label={this.props.intl.formatMessage(ariaMessages.language)} />
                        </div>)}
                        {(this.props.canManageFiles) && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.fileMenuOpen
                                })}
                                onMouseUp={this.props.onClickFile}
                            >
                                {/*<img src={fileIcon} />*/}
                                {/*<span className={styles.collapsibleLabel}>*/}
                                    <FormattedMessage
                                        defaultMessage="File"
                                        description="Text for file dropdown menu"
                                        id="gui.menuBar.file"
                                    />
                                {/*</span>*/}
                                {/*<img src={dropdownCaret} />*/}
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.fileMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseFile}
                                >
                                    <MenuSection>
                                        <MenuItem
                                            isRtl={this.props.isRtl}
                                            onClick={this.handleClickNew}
                                        >
                                            {newProjectMessage}
                                        </MenuItem>
                                    </MenuSection>
                                    {(this.props.canSave || this.props.canCreateCopy || this.props.canRemix) && (
                                        <MenuSection>
                                            {this.props.canSave && (
                                                <MenuItem onClick={this.handleClickSave}>
                                                    {saveNowMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canCreateCopy && (
                                                <MenuItem onClick={this.handleClickSaveAsCopy}>
                                                    {createCopyMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canRemix && (
                                                <MenuItem onClick={this.handleClickRemix}>
                                                    {remixMessage}
                                                </MenuItem>
                                            )}
                                        </MenuSection>
                                    )}
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.props.onStartSelectingFileUpload}
                                        >
                                            {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
                                        </MenuItem>
                                        <SB3Downloader>{(className, downloadProjectCallback) => (
                                            <MenuItem
                                                className={className}
                                                onClick={this.getSaveToComputerHandler(downloadProjectCallback)}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Save to your computer"
                                                    description="Menu bar item for downloading a project to your computer" // eslint-disable-line max-len
                                                    id="gui.menuBar.downloadToComputer"
                                                />
                                            </MenuItem>
                                        )}</SB3Downloader>
                                        <MenuItem onClick={this.props.onOpenRestorePoints}>
                                            <FormattedMessage
                                                defaultMessage="Restore points"
                                                description="Menu bar item opening automatic project backups"
                                                id="gui.menuBar.restorePoints"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                    {/* <MenuSection>

                                    <MenuItem>
                                        <GoogleDrivePickerButton
                                          developerKey="AIzaSyCvjU_vpqkCfb1EB56w4lo3vXNnvGHG4fs"
                                          onProjectLoadFromExternalSource={this.props.onProjectLoadFromExternalSource} // You provide this from SBFileUploaderHOC
                                    />
                                    </MenuItem>
                                    <MenuItem onClick={this.handleSaveToGoogleDrive}
                                    > Save to Google Drive
                                    </MenuItem>
                                    </MenuSection> */}
                                    {/* Cloud items restored to File menu */}
                                    {this.props.authUser && (
                                        <MenuSection>
                                            <MenuItem
                                                onClick={() => this.handleSaveToCloud(false)}
                                            >
                                                {this.state.cloudSaveStatus === 'saving' ?
                                                    'Saving...' : 'Save to Cloud'}
                                            </MenuItem>
                                            <MenuItem
                                                onClick={this.handleOpenMyProjects}
                                            >
                                                {'My Projects'}
                                            </MenuItem>
                                        </MenuSection>
                                    )}
                                </MenuBarMenu>
                            </div>
                        )}
                        <div
                            className={classNames(styles.menuBarItem, styles.hoverable, {
                                [styles.active]: this.props.editMenuOpen
                            })}
                            onMouseUp={this.props.onClickEdit}
                        >
                            {/*<img src={editIcon} />*/}
                            {/*<span className={styles.collapsibleLabel}>*/}
                                <FormattedMessage
                                    defaultMessage="Edit"
                                    description="Text for edit dropdown menu"
                                    id="gui.menuBar.edit"
                                />
                            {/*</span>*/}
                                {/*<img src={dropdownCaret} />*/}
                                <MenuBarMenu
                                className={classNames(styles.menuBarMenu)}
                                open={this.props.editMenuOpen}
                                place={this.props.isRtl ? 'left' : 'right'}
                                onRequestClose={this.props.onRequestCloseEdit}
                            >
                                <DeletionRestorer>{(handleRestore, {restorable, deletedItem}) => (
                                    <MenuItem
                                        className={classNames({[styles.disabled]: !restorable})}
                                        onClick={this.handleRestoreOption(handleRestore)}
                                    >
                                        {this.restoreOptionMessage(deletedItem)}
                                    </MenuItem>
                                )}</DeletionRestorer>
                                <MenuSection>
                                    <TurboMode>{(toggleTurboMode, {turboMode}) => (
                                        <MenuItem onClick={toggleTurboMode}>
                                            {turboMode ? (
                                                <FormattedMessage
                                                    defaultMessage="Turn off Turbo Mode"
                                                    description="Menu bar item for turning off turbo mode"
                                                    id="gui.menuBar.turboModeOff"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Turn on Turbo Mode"
                                                    description="Menu bar item for turning on turbo mode"
                                                    id="gui.menuBar.turboModeOn"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</TurboMode>
                                </MenuSection>
                            </MenuBarMenu>

                        </div>
                        {this.props.isTotallyNormal && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.modeMenuOpen
                                })}
                                onMouseUp={this.props.onClickMode}
                            >
                                <div className={classNames(styles.editMenu)}>
                                    <FormattedMessage
                                        defaultMessage="Mode"
                                        description="Mode menu item in the menu bar"
                                        id="gui.menuBar.modeMenu"
                                    />
                                </div>
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.modeMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseMode}
                                >
                                    <MenuSection>
                                        <MenuItem onClick={this.handleSetMode('NOW')}>
                                            <span className={classNames({[styles.inactive]: !this.props.modeNow})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Normal mode"
                                                description="April fools: resets editor to not have any pranks"
                                                id="gui.menuBar.normalMode"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={this.handleSetMode('2020')}>
                                            <span className={classNames({[styles.inactive]: !this.props.mode2020})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Caturday mode"
                                                description="April fools: Cat blocks mode"
                                                id="gui.menuBar.caturdayMode"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </div>
                        )}
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div className={styles.fileGroup}>
                        <div
                            aria-label={this.props.intl.formatMessage(ariaMessages.tutorials)}
                            className={classNames(styles.menuBarItem, styles.hoverable)}
                            onClick={this.props.onOpenTipLibrary}
                        >
                            <img
                                className={styles.helpIcon}
                                src={helpIcon}
                            />
                            <span className={styles.tutorialsLabel}>
                                <FormattedMessage {...ariaMessages.tutorials} />
                            </span>
                        </div>
                    </div>
                <Divider className={classNames(styles.divider)} />

                    {this.props.canEditTitle ? (
                        <div className={classNames(styles.menuBarItem, styles.growable)}>
                            <MenuBarItemTooltip
                                enable
                                id="title-field"
                            >
                                <ProjectTitleInput
                                    className={classNames(styles.titleFieldGrowable)}
                                />
                            </MenuBarItemTooltip>
                        </div>
                    ) : ((this.props.authorUsername && this.props.authorUsername !== this.props.username) ? (
                        <AuthorInfo
                            className={styles.authorInfo}
                            imageUrl={this.props.authorThumbnailUrl}
                            projectTitle={this.props.projectTitle}
                            userId={this.props.authorId}
                            username={this.props.authorUsername}
                        />
                    ) : null)}
                    
                    {/* Cloud Save Controls in the top bar */}
                    {this.props.authUser && (
                        <div className={classNames(styles.menuBarItem)}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                {this.props.projectChanged && (
                                    <button
                                        onClick={() => this.handleSaveToCloud(false)}
                                        style={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.15)',
                                            border: '1px solid rgba(255, 255, 255, 0.3)',
                                            borderRadius: '4px',
                                            padding: '4px 12px',
                                            color: 'white',
                                            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {this.state.cloudSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                                    </button>
                                )}
                                
                                <label style={{display: 'flex', alignItems: 'center', color: 'white', fontSize: '0.85rem', cursor: 'pointer', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={this.state.autoSaveEnabled} 
                                        onChange={this.handleToggleAutoSave}
                                        style={{marginRight: '6px', cursor: 'pointer'}}
                                    />
                                    Auto-save
                                </label>
                                {this.state.lastSavedTime && (
                                    <span style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontStyle: 'italic'}}>
                                        {`Last saved: ${this.state.lastSavedTime}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className={classNames(styles.menuBarItem)}>
                        {this.props.canShare ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <ShareButton
                                                className={styles.menuBarButton}
                                                isShared={this.props.isShared}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickShare(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (
                            this.props.showComingSoon ? (
                                <MenuBarItemTooltip id="share-button">
                                    <ShareButton className={styles.menuBarButton} />
                                </MenuBarItemTooltip>
                            ) : []
                        )}
                        {this.props.canRemix ? remixButton : []}
                    </div>
                    <div className={classNames(styles.menuBarItem, styles.communityButtonWrapper)}>
                        {this.props.enableCommunity ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <CommunityButton
                                                className={styles.menuBarButton}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickSeeCommunity(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (this.props.showComingSoon ? (
                            <MenuBarItemTooltip id="community-button">
                                <CommunityButton className={styles.menuBarButton} />
                            </MenuBarItemTooltip>
                        ) : [])}
                    </div>
                </div>

                {/* Supabase-based login/logout UI */}
                <div className={styles.accountInfoGroup}>
                    <div className={styles.menuBarItem}>
                        {this.props.canSave && (
                            <SaveStatus />
                        )}
                    </div>
                    {this.props.authUser ? (
                        // ************ user is logged in via Supabase ************
                        <React.Fragment>
                            <div
                                className={classNames(
                                    styles.menuBarItem,
                                    styles.hoverable,
                                    styles.profileButton
                                )}
                                ref={this.profileButtonRef}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'white',
                                    fontWeight: 600
                                }}
                                title="Click to choose an emoji avatar"
                                onClick={this.handleToggleAvatarPicker}
                            >
                                {(!this.props.authUser.avatar || this.props.authUser.avatar === 'cat') ? (
                                    <img
                                        className={styles.profileIcon}
                                        src={profileIcon}
                                    />
                                ) : (
                                    <span className={styles.emojiAvatar}>
                                        {this.props.authUser.avatar}
                                    </span>
                                )}
                                <span>{this.props.authUser.username}</span>
                                <img
                                    className={styles.dropdownCaretIcon}
                                    src={dropdownCaret}
                                />
                                <AvatarPicker
                                    anchorRef={this.profileButtonRef}
                                    currentAvatar={this.props.authUser.avatar || 'cat'}
                                    isOpen={this.state.avatarPickerOpen}
                                    username={this.props.authUser.username}
                                    onClose={this.handleCloseAvatarPicker}
                                    onSelectAvatar={this.handleSelectAvatar}
                                />
                            </div>
                            <div
                                className={classNames(
                                    styles.menuBarItem,
                                    styles.hoverable
                                )}
                                style={{cursor: 'pointer'}}
                                onClick={this.handleLogout}
                            >
                                {'Sign Out'}
                            </div>
                        </React.Fragment>
                    ) : (
                        // ********* user not logged in — show Sign In button *********
                        <div
                            className={classNames(
                                styles.menuBarItem,
                                styles.hoverable
                            )}
                            style={{cursor: 'pointer'}}
                            onClick={this.handleOpenLoginModal}
                        >
                            {'Sign In'}
                        </div>
                    )}
                </div>

                {aboutButton}

                {/* Login and My Projects modals */}
                <LoginModal
                    isOpen={this.state.loginModalOpen}
                    onClose={this.handleCloseLoginModal}
                />
                <MyProjectsModal
                    isOpen={this.state.myProjectsModalOpen}
                    onClose={this.handleCloseMyProjects}
                    onSetProjectUnchanged={this.props.onSetProjectUnchanged}
                    onUpdateProjectTitle={this.props.onUpdateProjectTitle}
                />
            </Box>
        );
    }
}

MenuBar.propTypes = {
    aboutMenuOpen: PropTypes.bool,
    accountMenuOpen: PropTypes.bool,
    authUser: PropTypes.shape({
        id: PropTypes.string,
        email: PropTypes.string,
        username: PropTypes.string,
        avatar: PropTypes.string
    }),
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    autoUpdateProject: PropTypes.func,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    className: PropTypes.string,
    confirmReadyToReplaceProject: PropTypes.func,
    currentLocale: PropTypes.string.isRequired,
    editMenuOpen: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    fileMenuOpen: PropTypes.bool,
    intl: intlShape,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isShowingProject: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    isUpdating: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    loginMenuOpen: PropTypes.bool,
    logo: PropTypes.string,
    mode1920: PropTypes.bool,
    mode1990: PropTypes.bool,
    mode2020: PropTypes.bool,
    mode220022BC: PropTypes.bool,
    modeMenuOpen: PropTypes.bool,
    modeNow: PropTypes.bool,
    onClickAbout: PropTypes.oneOfType([
        PropTypes.func, // button mode: call this callback when the About button is clicked
        PropTypes.arrayOf( // menu mode: list of items in the About menu
            PropTypes.shape({
                title: PropTypes.string, // text for the menu item
                onClick: PropTypes.func // call this callback when the menu item is clicked
            })
        )
    ]),
    onClickAccount: PropTypes.func,
    onClickEdit: PropTypes.func,
    onClickFile: PropTypes.func,
    onClickLogin: PropTypes.func,
    onClickLogo: PropTypes.func,
    onClickMode: PropTypes.func,
    onClickNew: PropTypes.func,
    onClickRemix: PropTypes.func,
    onClickSave: PropTypes.func,
    onClickSaveAsCopy: PropTypes.func,
    onClickSettings: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onOpenTipLibrary: PropTypes.func,
    onOpenRestorePoints: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onRequestCloseAbout: PropTypes.func,
    onRequestCloseAccount: PropTypes.func,
    onRequestCloseEdit: PropTypes.func,
    onRequestCloseFile: PropTypes.func,
    onRequestCloseLogin: PropTypes.func,
    onRequestCloseMode: PropTypes.func,
    onRequestCloseSettings: PropTypes.func,
    onRequestOpenAbout: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onSetAvatar: PropTypes.func,
    onSetProjectUnchanged: PropTypes.func,
    onSetTimeTravelMode: PropTypes.func,
    onShare: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onProjectLoadFromExternalSource: PropTypes.func,
    onSupabaseLoginSuccess: PropTypes.func,
    onSupabaseLogout: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    onUpdateProjectTitle: PropTypes.func,
    projectChanged: PropTypes.bool,
    projectTitle: PropTypes.string,
    renderLogin: PropTypes.func,
    sessionExists: PropTypes.bool,
    settingsMenuOpen: PropTypes.bool,
    shouldSaveBeforeTransition: PropTypes.func,
    showComingSoon: PropTypes.bool,
    username: PropTypes.string,
    userOwnsProject: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

MenuBar.defaultProps = {
    logo: 'https://i.imgur.com/0J5brlL.png',
    onShare: () => {}
};

const mapStateToProps = (state, ownProps) => {
    const loadingState = state.scratchGui.projectState.loadingState;
    
    const user = state.session && state.session.session && state.session.session.user;
    return {
        aboutMenuOpen: aboutMenuOpen(state),
        accountMenuOpen: accountMenuOpen(state),
        authUser: state.scratchGui.auth.user,
        currentLocale: state.locales.locale,
        fileMenuOpen: fileMenuOpen(state),
        editMenuOpen: editMenuOpen(state),
        isRtl: state.locales.isRtl,
        isUpdating: getIsUpdating(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        locale: state.locales.locale,
        loginMenuOpen: loginMenuOpen(state),
        modeMenuOpen: modeMenuOpen(state),
        projectChanged: state.scratchGui.projectChanged,
        projectTitle: state.scratchGui.projectTitle,
        sessionExists: state.session && typeof state.session.session !== 'undefined',
        settingsMenuOpen: settingsMenuOpen(state),
        username: user ? user.username : null,
        userOwnsProject: ownProps.authorUsername && user &&
            (ownProps.authorUsername === user.username),
        vm: state.scratchGui.vm,
        mode220022BC: isTimeTravel220022BC(state),
        mode1920: isTimeTravel1920(state),
        mode1990: isTimeTravel1990(state),
        mode2020: isTimeTravel2020(state),
        modeNow: isTimeTravelNow(state),
        saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
        projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState)
    };
};

const getProjectFilename = (curTitle, defaultTitle) => {
    let filenameTitle = curTitle;
    if (!filenameTitle || filenameTitle.length === 0) {
        filenameTitle = defaultTitle;
    }
    return `${filenameTitle.substring(0, 100)}.sb3`;
};

const mapDispatchToProps = dispatch => ({
    autoUpdateProject: () => dispatch(autoUpdateProject()),
    onOpenTipLibrary: () => dispatch(openTipsLibrary()),
    onOpenRestorePoints: () => dispatch(openRestorePoints()),
    onClickAccount: () => dispatch(openAccountMenu()),
    onRequestCloseAccount: () => dispatch(closeAccountMenu()),
    onClickFile: () => dispatch(openFileMenu()),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onClickEdit: () => dispatch(openEditMenu()),
    onRequestCloseEdit: () => dispatch(closeEditMenu()),
    onClickLogin: () => dispatch(openLoginMenu()),
    onRequestCloseLogin: () => dispatch(closeLoginMenu()),
    onClickMode: () => dispatch(openModeMenu()),
    onRequestCloseMode: () => dispatch(closeModeMenu()),
    onRequestOpenAbout: () => dispatch(openAboutMenu()),
    onRequestCloseAbout: () => dispatch(closeAboutMenu()),
    onClickSettings: () => dispatch(openSettingsMenu()),
    onRequestCloseSettings: () => dispatch(closeSettingsMenu()),
    onClickNew: needSave => dispatch(requestNewProject(needSave)),
    onClickRemix: () => dispatch(remixProject()),
    onClickSave: () => dispatch(manualUpdateProject()),
    onClickSaveAsCopy: () => dispatch(saveProjectAsCopy()),
    onSeeCommunity: () => dispatch(setPlayer(true)),
    onSetAvatar: avatar => dispatch(setAvatar(avatar)),
    onSetTimeTravelMode: mode => dispatch(setTimeTravel(mode)),
    onSupabaseLoginSuccess: user => dispatch(loginSuccess(user)),
    onSupabaseLogout: () => dispatch(logoutAction()),
    onUpdateProjectTitle: title => dispatch(setProjectTitle(title)),
    onSetProjectUnchanged: () => dispatch(setProjectUnchanged())
});

export default compose(
    injectIntl,
    MenuBarHOC,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(MenuBar);
