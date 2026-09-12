const LOGIN_START = 'scratch-gui/auth/LOGIN_START';
const LOGIN_SUCCESS = 'scratch-gui/auth/LOGIN_SUCCESS';
const LOGIN_FAILURE = 'scratch-gui/auth/LOGIN_FAILURE';
const LOGOUT = 'scratch-gui/auth/LOGOUT';
const SET_AVATAR = 'scratch-gui/auth/SET_AVATAR';

const authInitialState = {
    user: null, // { id, username, email, avatar }
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
    case SET_AVATAR:
        return Object.assign({}, state, {
            user: state.user ? Object.assign({}, state.user, {
                avatar: action.avatar
            }) : null
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

const setAvatar = function (avatar) {
    return {
        type: SET_AVATAR,
        avatar: avatar
    };
};

export {
    reducer as default,
    authInitialState,
    loginStart,
    loginSuccess,
    loginFailure,
    logout,
    setAvatar
};
