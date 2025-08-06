import React, { createContext, useContext, useReducer, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  loading: true,
  error: null,
  isAuthenticated: false,
  sessionExpiry: null,
  mfaRequired: false,
  mfaSetupRequired: false,
};

// Action types
const ActionTypes = {
  AUTH_START: 'AUTH_START',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER',
  SET_MFA_REQUIRED: 'SET_MFA_REQUIRED',
  SET_MFA_SETUP_REQUIRED: 'SET_MFA_SETUP_REQUIRED',
  TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.AUTH_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case ActionTypes.AUTH_SUCCESS:
      return {
        ...state,
        loading: false,
        error: null,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        sessionExpiry: action.payload.sessionExpiry,
        mfaRequired: false,
        mfaSetupRequired: false,
      };

    case ActionTypes.AUTH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload.error,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        sessionExpiry: null,
      };

    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        loading: false,
      };

    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case ActionTypes.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case ActionTypes.SET_MFA_REQUIRED:
      return {
        ...state,
        mfaRequired: action.payload,
        loading: false,
      };

    case ActionTypes.SET_MFA_SETUP_REQUIRED:
      return {
        ...state,
        mfaSetupRequired: action.payload,
        loading: false,
      };

    case ActionTypes.TOKEN_REFRESH_SUCCESS:
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        sessionExpiry: action.payload.sessionExpiry,
      };

    case ActionTypes.TOKEN_REFRESH_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        sessionExpiry: null,
        loading: false,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up token refresh timer
  useEffect(() => {
    if (state.token && state.sessionExpiry) {
      const refreshTime = new Date(state.sessionExpiry).getTime() - Date.now() - 5 * 60 * 1000; // 5 minutes before expiry
      if (refreshTime > 0) {
        const timer = setTimeout(() => {
          refreshAuthToken();
        }, refreshTime);

        return () => clearTimeout(timer);
      }
    }
  }, [state.token, state.sessionExpiry]);

  // Initialize authentication
  const initializeAuth = async () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!token) {
      dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: null } });
      return;
    }

    try {
      // Validate token by fetching user profile
      const response = await authAPI.getProfile();
      
      dispatch({
        type: ActionTypes.AUTH_SUCCESS,
        payload: {
          user: response.data.user,
          token,
          refreshToken,
          sessionExpiry: getTokenExpiry(token),
        },
      });
    } catch (error) {
      // Try to refresh token if profile fetch fails
      if (refreshToken) {
        try {
          await refreshAuthToken();
        } catch (refreshError) {
          handleAuthError(refreshError);
        }
      } else {
        handleAuthError(error);
      }
    }
  };

  // Login function
  const login = async (credentials) => {
    dispatch({ type: ActionTypes.AUTH_START });

    try {
      const response = await authAPI.login(credentials);
      
      if (response.data.mfaRequired) {
        dispatch({ type: ActionTypes.SET_MFA_REQUIRED, payload: true });
        return { mfaRequired: true };
      }

      const { user, token, refreshToken } = response.data;
      
      // Store tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);

      dispatch({
        type: ActionTypes.AUTH_SUCCESS,
        payload: {
          user,
          token,
          refreshToken,
          sessionExpiry: getTokenExpiry(token),
        },
      });

      toast.success(`Welcome back, ${user.firstName}!`);
      return { success: true };

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: errorMessage } });
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Login with MFA
  const loginWithMFA = async (credentials) => {
    dispatch({ type: ActionTypes.AUTH_START });

    try {
      const response = await authAPI.login(credentials);
      const { user, token, refreshToken } = response.data;
      
      // Store tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);

      dispatch({
        type: ActionTypes.AUTH_SUCCESS,
        payload: {
          user,
          token,
          refreshToken,
          sessionExpiry: getTokenExpiry(token),
        },
      });

      toast.success(`Welcome back, ${user.firstName}!`);
      return { success: true };

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'MFA verification failed';
      dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: errorMessage } });
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: ActionTypes.AUTH_START });

    try {
      const response = await authAPI.register(userData);
      
      toast.success('Registration successful! Please verify your email.');
      
      // Don't auto-login after registration for security
      dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: null } });
      
      return { success: true, user: response.data.user };

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: errorMessage } });
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    
    dispatch({ type: ActionTypes.LOGOUT });
    toast.success('Logged out successfully');
  };

  // Refresh token function
  const refreshAuthToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await authAPI.refreshToken({ refreshToken });
      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      // Update stored tokens
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      dispatch({
        type: ActionTypes.TOKEN_REFRESH_SUCCESS,
        payload: {
          token: newToken,
          refreshToken: newRefreshToken,
          sessionExpiry: getTokenExpiry(newToken),
        },
      });

      return { token: newToken, refreshToken: newRefreshToken };

    } catch (error) {
      dispatch({ type: ActionTypes.TOKEN_REFRESH_FAILURE });
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      throw error;
    }
  };

  // Update user profile
  const updateUser = (userData) => {
    dispatch({ type: ActionTypes.UPDATE_USER, payload: userData });
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      await authAPI.changePassword(passwordData);
      toast.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password change failed';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Setup MFA
  const setupMFA = async () => {
    try {
      const response = await authAPI.setupMFA();
      dispatch({ type: ActionTypes.SET_MFA_SETUP_REQUIRED, payload: true });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'MFA setup failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  // Verify MFA setup
  const verifyMFASetup = async (token) => {
    try {
      const response = await authAPI.verifyMFA({ token });
      
      // Update user to reflect MFA enabled
      dispatch({ 
        type: ActionTypes.UPDATE_USER, 
        payload: { mfaEnabled: true } 
      });
      
      dispatch({ type: ActionTypes.SET_MFA_SETUP_REQUIRED, payload: false });
      
      toast.success('MFA enabled successfully');
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'MFA verification failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  // Disable MFA
  const disableMFA = async (data) => {
    try {
      await authAPI.disableMFA(data);
      
      // Update user to reflect MFA disabled
      dispatch({ 
        type: ActionTypes.UPDATE_USER, 
        payload: { mfaEnabled: false } 
      });
      
      toast.success('MFA disabled successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'MFA disable failed';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: ActionTypes.CLEAR_ERROR });
  };

  // Helper function to get token expiry
  const getTokenExpiry = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch (error) {
      return null;
    }
  };

  // Handle authentication errors
  const handleAuthError = (error) => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    
    const errorMessage = error.response?.data?.error || 'Authentication failed';
    dispatch({ type: ActionTypes.AUTH_FAILURE, payload: { error: errorMessage } });
    
    if (error.response?.status === 401) {
      toast.error('Session expired. Please log in again.');
    }
  };

  // Check if user has specific permission
  const hasPermission = (resource, action) => {
    if (!state.user) return false;
    if (state.user.role === 'super_admin') return true;
    
    return state.user.permissions?.some(p => 
      p.resource === resource && p.actions.includes(action)
    );
  };

  // Check if user has specific role
  const hasRole = (role) => {
    if (!state.user) return false;
    return state.user.role === role || state.user.role === 'super_admin';
  };

  // Context value
  const value = {
    ...state,
    login,
    loginWithMFA,
    register,
    logout,
    refreshAuthToken,
    updateUser,
    changePassword,
    setupMFA,
    verifyMFASetup,
    disableMFA,
    clearError,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;