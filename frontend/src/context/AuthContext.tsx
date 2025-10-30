import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState } from '../types';
import { sendEmailOTP, verifyEmailOTP, signUp, loginWithGoogle } from "../api/authApi";
import { UserCreate, User } from "../types/user";
import { Navigate } from 'react-router-dom';

interface AuthContextType extends AuthState {
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, otp: string) => Promise<User | boolean>;
  signUp: (userInfo: UserCreate) => Promise<boolean>;
  loginWithGoogle: (tokenId: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleSendOTP = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      return await sendEmailOTP(email);
    } catch (error) {
      console.error('Error sending OTP:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (email: string, otp: string): Promise<User | boolean> => {
    setIsLoading(true);
    try {
      const response = await verifyEmailOTP(email, otp);

      if (response && typeof response === 'object') {
        const authenticatedUser: User = {
          id: response.id,
          email: response.email,
          name: response.name || email.split('@')[0],
          admin_role: response.admin_role || false,
          is_accepted: response.is_accepted,
          created_at: response.created_at || new Date().toISOString() // Add this line
        };
        setUser(authenticatedUser);
        localStorage.setItem('user', JSON.stringify(authenticatedUser));
        return authenticatedUser;
      }
      return false;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (tokenId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const userData = await loginWithGoogle(tokenId);
      if (userData != null) {
        const authenticatedUser: User = {
          ...userData,
          created_at: userData.created_at || new Date().toISOString() // Ensure created_at exists
        };
        setUser(authenticatedUser);
        localStorage.setItem('user', JSON.stringify(authenticatedUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Google login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (userInfo: UserCreate): Promise<boolean> => {
    setIsLoading(true);
    try {
      return await signUp(userInfo);
    } catch (error) {
      console.error('Error during sign up:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    // Redirect to login page
    window.location.href = '/login';
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.admin_role || false,
    sendEmailOTP: handleSendOTP,
    verifyEmailOTP: handleVerifyOTP,
    signUp: handleSignUp,
    loginWithGoogle: handleGoogleLogin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};