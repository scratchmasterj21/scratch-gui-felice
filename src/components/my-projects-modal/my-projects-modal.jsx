import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import Swal from 'sweetalert2';

import {
    listProjects,
    loadProject,
    deleteProject,
    shareProjectTemplate,
    listSharedTemplates,
    listAllStudentProjects
} from '../../lib/cloud-project-service';

import styles from './my-projects-modal.css';

class MyProjectsModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleOverlayClick',
            'handleLoad',
            'handleDelete',
            'fetchProjects',
            'handleSearchChange'
        ]);
        this.state = {
            projects: [],
            isLoading: true,
            error: null,
            loadingProjectId: null,
            deletingProjectId: null,
            sharingProjectId: null,
            activeTab: 'student', // default, will be updated in constructor/didMount based on isTeacher
            searchQuery: ''
        };
        const isTeacher = props.userEmail === 'john@felice.local';
        this.state.activeTab = isTeacher ? 'teacher' : 'student';
    }
    componentDidMount () {
        if (this.props.isOpen && this.props.userId) {
            this.fetchProjects();
        }
    }
    componentDidUpdate (prevProps) {
        if (this.props.isOpen && !prevProps.isOpen && this.props.userId) {
            this.fetchProjects();
        }
    }
    fetchProjects () {
        this.setState({isLoading: true, error: null});
        const isTeacher = this.props.userEmail === 'john@felice.local';
        const {activeTab} = this.state;
        
        let fetchPromise;

        if (isTeacher) {
            if (activeTab === 'teacher') {
                fetchPromise = listProjects(this.props.userId);
            } else {
                fetchPromise = listAllStudentProjects(this.props.userId);
            }
        } else {
            // Student view
            if (activeTab === 'student') {
                fetchPromise = listProjects(this.props.userId);
            } else {
                fetchPromise = listSharedTemplates();
            }
        }

        fetchPromise
            .then(projects => {
                this.setState({projects: projects, isLoading: false});
            })
            .catch(err => {
                this.setState({error: err.message, isLoading: false});
            });
    }

    handleTabChange (tab) {
        if (this.state.activeTab !== tab) {
            this.setState({activeTab: tab, searchQuery: ''}, () => {
                this.fetchProjects();
            });
        }
    }

    handleSearchChange (e) {
        this.setState({searchQuery: e.target.value});
    }

    handleShareToggle (project) {
        this.setState({sharingProjectId: project.id});
        const newIsTemplate = !project.is_template;
        shareProjectTemplate(project.id, newIsTemplate)
            .then(() => {
                this.setState(prevState => ({
                    projects: prevState.projects.map(p => {
                        if (p.id === project.id) {
                            return {...p, is_template: newIsTemplate};
                        }
                        return p;
                    }),
                    sharingProjectId: null
                }));
            })
            .catch(err => {
                console.error('Failed to toggle share status:', err);
                this.setState({sharingProjectId: null});
                Swal.fire({
                    heightAuto: false,
                    title: 'Error',
                    text: `Failed to update share status: ${err.message}`,
                    icon: 'error'
                });
            });
    }
    handleOverlayClick (e) {
        if (e.target === e.currentTarget) {
            this.props.onClose();
        }
    }
    handleLoad (project) {
        this.setState({loadingProjectId: project.id});
        loadProject(project.file_path)
            .then(arrayBuffer => {
                // Load the project into the VM
                this.props.vm.loadProject(arrayBuffer)
                    .then(() => {
                        // Update the project title in redux
                        if (this.props.onUpdateProjectTitle) {
                            let newTitle = project.title;
                            const isTeacher = this.props.userEmail === 'john@felice.local';
                            if (isTeacher && this.state.activeTab === 'student') {
                                newTitle += ' (Student Copy)';
                            }
                            this.props.onUpdateProjectTitle(newTitle);
                        }
                        if (this.props.onSetProjectUnchanged) {
                            this.props.onSetProjectUnchanged();
                        }
                        this.setState({loadingProjectId: null});
                        this.props.onClose();
                    })
                    .catch(err => {
                        console.error('Failed to load project into VM:', err);
                        this.setState({
                            error: 'Failed to load project. The file may be corrupted.',
                            loadingProjectId: null
                        });
                    });
            })
            .catch(err => {
                console.error('Failed to download project:', err);
                this.setState({
                    error: `Failed to download project: ${err.message}`,
                    loadingProjectId: null
                });
            });
    }
    handleDelete (project) {
        Swal.fire({
            heightAuto: false,
            title: 'Delete project?',
            text: `Are you sure you want to delete "${project.title}"? This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(result => {
            if (result.isConfirmed) {
                this.setState({deletingProjectId: project.id});
                deleteProject(project.id, project.file_path)
                    .then(() => {
                        this.setState(prevState => ({
                            projects: prevState.projects.filter(p => p.id !== project.id),
                            deletingProjectId: null
                        }));
                        Swal.fire({
                            heightAuto: false,
                            title: 'Deleted!',
                            text: 'Your project has been deleted.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    })
                    .catch(err => {
                        console.error('Failed to delete project:', err);
                        this.setState({
                            error: `Failed to delete project: ${err.message}`,
                            deletingProjectId: null
                        });
                        Swal.fire({
                            heightAuto: false,
                            title: 'Error',
                            text: `Failed to delete project: ${err.message}`,
                            icon: 'error'
                        });
                    });
            }
        });
    }
    formatDate (dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    render () {
        if (!this.props.isOpen) return null;

        return (
            <div
                className={styles.myProjectsOverlay}
                onClick={this.handleOverlayClick}
            >
                <div className={styles.myProjectsContent}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>{'My Projects'}</h2>
                        <button
                            className={styles.closeButton}
                            onClick={this.props.onClose}
                        >
                            {'×'}
                        </button>
                    </div>

                    <div className={styles.tabsContainer}>
                        {this.props.userEmail === 'john@felice.local' ? (
                            <React.Fragment>
                                <button
                                    className={`${styles.tabButton} ${this.state.activeTab === 'teacher' ? styles.active : ''}`}
                                    onClick={() => this.handleTabChange('teacher')}
                                >
                                    Teacher
                                </button>
                                <button
                                    className={`${styles.tabButton} ${this.state.activeTab === 'student' ? styles.active : ''}`}
                                    onClick={() => this.handleTabChange('student')}
                                >
                                    Student
                                </button>
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
                                <button
                                    className={`${styles.tabButton} ${this.state.activeTab === 'student' ? styles.active : ''}`}
                                    onClick={() => this.handleTabChange('student')}
                                >
                                    Student
                                </button>
                                <button
                                    className={`${styles.tabButton} ${this.state.activeTab === 'teacher' ? styles.active : ''}`}
                                    onClick={() => this.handleTabChange('teacher')}
                                >
                                    Teacher
                                </button>
                            </React.Fragment>
                        )}
                        <div className={styles.searchContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search projects..."
                                value={this.state.searchQuery}
                                onChange={this.handleSearchChange}
                            />
                        </div>
                    </div>

                    {this.state.error && (
                        <div className={styles.errorBanner}>
                            {this.state.error}
                        </div>
                    )}

                    <div className={styles.projectList}>
                        {(() => {
                            if (this.state.isLoading) {
                                return (
                                    <div className={styles.loadingSpinner}>
                                        {'Loading your projects...'}
                                    </div>
                                );
                            }

                            const query = this.state.searchQuery.toLowerCase();
                            const filteredProjects = this.state.projects.filter(project => {
                                const titleMatch = project.title && project.title.toLowerCase().includes(query);
                                const emailMatch = project.author_email && project.author_email.toLowerCase().includes(query);
                                return titleMatch || emailMatch;
                            });

                            if (filteredProjects.length === 0) {
                                return (
                                    <div className={styles.emptyState}>
                                        <div className={styles.emptyIcon}>{'📁'}</div>
                                        <div className={styles.emptyText}>
                                            {this.state.searchQuery ?
                                                `No projects found matching "${this.state.searchQuery}"` :
                                                "You don't have any saved projects yet."}
                                            <br />
                                            {!this.state.searchQuery && 'Use File → Save to Cloud to save your first project!'}
                                        </div>
                                    </div>
                                );
                            }

                            return filteredProjects.map(project => (
                                <div
                                    className={styles.projectItem}
                                    key={project.id}
                                >
                                    <div className={styles.projectInfo}>
                                        <div className={styles.projectTitle}>
                                            {project.title}
                                        </div>
                                        <div className={styles.projectDate}>
                                            {`Saved: ${this.formatDate(project.updated_at)}`}
                                        </div>
                                        {project.author_email && (
                                            <div className={styles.projectAuthor}>
                                                {`By: ${project.author_email}`}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.projectActions}>
                                        {this.props.userEmail === 'john@felice.local' && this.state.activeTab === 'teacher' && (
                                            <button
                                                className={`${styles.shareButton} ${project.is_template ? styles.shared : ''}`}
                                                disabled={this.state.sharingProjectId === project.id}
                                                onClick={() => this.handleShareToggle(project)}
                                            >
                                                {this.state.sharingProjectId === project.id ?
                                                    'Updating...' : (project.is_template ? 'Unshare' : 'Share')}
                                            </button>
                                        )}
                                        <button
                                            className={styles.loadButton}
                                            disabled={this.state.loadingProjectId === project.id}
                                            onClick={() => this.handleLoad(project)}
                                        >
                                            {this.state.loadingProjectId === project.id ?
                                                'Loading...' : 'Load'}
                                        </button>
                                        {(this.props.userEmail === 'john@felice.local' && this.state.activeTab === 'student') || (this.props.userEmail !== 'john@felice.local' && this.state.activeTab === 'teacher') ? null : (
                                            <button
                                                className={styles.deleteButton}
                                                disabled={this.state.deletingProjectId === project.id}
                                                onClick={() => this.handleDelete(project)}
                                            >
                                                {this.state.deletingProjectId === project.id ?
                                                    'Deleting...' : 'Delete'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>
        );
    }
}

MyProjectsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSetProjectUnchanged: PropTypes.func,
    onUpdateProjectTitle: PropTypes.func,
    userId: PropTypes.string,
    userEmail: PropTypes.string,
    vm: PropTypes.object
};

const mapStateToProps = state => ({
    userId: state.scratchGui.auth.user ? state.scratchGui.auth.user.id : null,
    userEmail: state.scratchGui.auth.user ? state.scratchGui.auth.user.email : null,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = () => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MyProjectsModal);
