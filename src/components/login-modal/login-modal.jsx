import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';

import {getSupabase, usernameToEmail, emailToUsername, getSavedAvatar} from '../../lib/supabase';
import {loginStart, loginSuccess, loginFailure} from '../../reducers/auth';

import styles from './login-modal.css';

class LoginModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleSubmit',
            'handleUsernameChange',
            'handlePasswordChange',
            'handleOverlayClick'
        ]);
        this.state = {
            username: '',
            password: ''
        };
    }
    handleUsernameChange (e) {
        this.setState({username: e.target.value});
    }
    handlePasswordChange (e) {
        this.setState({password: e.target.value});
    }
    handleOverlayClick (e) {
        // Only close if clicking the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            this.props.onClose();
        }
    }
    handleSubmit (e) {
        e.preventDefault();
        const {username, password} = this.state;

        if (!username.trim() || !password) {
            this.props.onLoginFailure('Please enter both username and password.');
            return;
        }

        this.props.onLoginStart();

        const email = usernameToEmail(username);

        getSupabase().auth.signInWithPassword({
            email: email,
            password: password
        })
            .then(({data, error}) => {
                if (error) {
                    this.props.onLoginFailure('Wrong username or password. Please try again.');
                    return;
                }
                const avatar = getSavedAvatar(data.user.id, data.user.user_metadata);
                const user = {
                    id: data.user.id,
                    email: data.user.email,
                    username: emailToUsername(data.user.email),
                    avatar: avatar
                };
                this.props.onLoginSuccess(user);
                this.props.onClose();
            })
            .catch(() => {
                this.props.onLoginFailure('Something went wrong. Please try again.');
            });
    }
    render () {
        if (!this.props.isOpen) return null;

        return (
            <div
                className={styles.loginModalOverlay}
                onClick={this.handleOverlayClick}
            >
                <div className={styles.loginModalContent}>
                    <button
                        className={styles.closeButton}
                        onClick={this.props.onClose}
                    >
                        {'×'}
                    </button>
                    <h2 className={styles.loginTitle}>{'Sign In'}</h2>
                    <form
                        className={styles.loginForm}
                        onSubmit={this.handleSubmit}
                    >
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                {'Username'}
                            </label>
                            <input
                                autoFocus
                                className={styles.inputField}
                                placeholder="Enter your username"
                                type="text"
                                value={this.state.username}
                                onChange={this.handleUsernameChange}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                {'Password'}
                            </label>
                            <input
                                className={styles.inputField}
                                placeholder="Enter your password"
                                type="password"
                                value={this.state.password}
                                onChange={this.handlePasswordChange}
                            />
                        </div>
                        {this.props.loginError && (
                            <div className={styles.errorMessage}>
                                {this.props.loginError}
                            </div>
                        )}
                        <button
                            className={styles.loginButton}
                            disabled={this.props.isLoggingIn}
                            type="submit"
                        >
                            {this.props.isLoggingIn ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

LoginModal.propTypes = {
    isLoggingIn: PropTypes.bool,
    isOpen: PropTypes.bool.isRequired,
    loginError: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onLoginFailure: PropTypes.func.isRequired,
    onLoginStart: PropTypes.func.isRequired,
    onLoginSuccess: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    isLoggingIn: state.scratchGui.auth.isLoggingIn,
    loginError: state.scratchGui.auth.loginError
});

const mapDispatchToProps = dispatch => ({
    onLoginStart: () => dispatch(loginStart()),
    onLoginSuccess: user => dispatch(loginSuccess(user)),
    onLoginFailure: error => dispatch(loginFailure(error))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoginModal);
