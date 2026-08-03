import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import Swal from 'sweetalert2';

import {listProjects, loadProject, deleteProject} from '../../lib/cloud-project-service';

import styles from './my-projects-modal.css';

class MyProjectsModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleOverlayClick',
            'handleLoad',
            'handleDelete',
            'fetchProjects'
        ]);
        this.state = {
            projects: [],
            isLoading: true,
            error: null,
            loadingProjectId: null,
            deletingProjectId: null
        };
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
        listProjects(this.props.userId)
            .then(projects => {
                this.setState({projects: projects, isLoading: false});
            })
            .catch(err => {
                this.setState({error: err.message, isLoading: false});
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
                            this.props.onUpdateProjectTitle(project.title);
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
        }).then((result) => {
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

                    {this.state.error && (
                        <div className={styles.errorBanner}>
                            {this.state.error}
                        </div>
                    )}

                    <div className={styles.projectList}>
                        {this.state.isLoading ? (
                            <div className={styles.loadingSpinner}>
                                {'Loading your projects...'}
                            </div>
                        ) : this.state.projects.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>{'📁'}</div>
                                <div className={styles.emptyText}>
                                    {"You don't have any saved projects yet."}
                                    <br />
                                    {'Use File → Save to Cloud to save your first project!'}
                                </div>
                            </div>
                        ) : (
                            this.state.projects.map(project => (
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
                                    </div>
                                    <div className={styles.projectActions}>
                                        <button
                                            className={styles.loadButton}
                                            disabled={this.state.loadingProjectId === project.id}
                                            onClick={() => this.handleLoad(project)}
                                        >
                                            {this.state.loadingProjectId === project.id ?
                                                'Loading...' : 'Load'}
                                        </button>
                                        <button
                                            className={styles.deleteButton}
                                            disabled={this.state.deletingProjectId === project.id}
                                            onClick={() => this.handleDelete(project)}
                                        >
                                            {this.state.deletingProjectId === project.id ?
                                                'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

MyProjectsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onUpdateProjectTitle: PropTypes.func,
    userId: PropTypes.string,
    vm: PropTypes.object
};

const mapStateToProps = state => ({
    userId: state.scratchGui.auth.user ? state.scratchGui.auth.user.id : null,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = () => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MyProjectsModal);
