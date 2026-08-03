const LOGIN_START = 'scratch-gui/auth/LOGIN_START';
const LOGIN_SUCCESS = 'scratch-gui/auth/LOGIN_SUCCESS';
const LOGIN_FAILURE = 'scratch-gui/auth/LOGIN_FAILURE';
const LOGOUT = 'scratch-gui/auth/LOGOUT';

const authInitialState = {
    user: null,         // { id, username, email }
    isLoggingIn: false,
    loginError: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = authInitialState;
    switch (action.type) {
    case LOGIN_START:
        return Object.assign({}, state, {
            isLoggingIn: true,
            loginError: null
        });
    case LOGIN_SUCCESS:
        return Object.assign({}, state, {
            user: action.user,
            isLoggingIn: false,
            loginError: null
        });
    case LOGIN_FAILURE:
        return Object.assign({}, state, {
            user: null,
            isLoggingIn: false,
            loginError: action.error
        });
    case LOGOUT:
        return Object.assign({}, state, {
            user: null,
            isLoggingIn: false,
            loginError: null
        });
    default:
        return state;
    }
};

const loginStart = function () {
    return {type: LOGIN_START};
};

const loginSuccess = function (user) {
    return {
        type: LOGIN_SUCCESS,
        user: user
    };
};

const loginFailure = function (error) {
    return {
        type: LOGIN_FAILURE,
        error: error
    };
};

const logout = function () {
    return {type: LOGOUT};
};

export {
    reducer as default,
    authInitialState,
    loginStart,
    loginSuccess,
    loginFailure,
    logout
};
