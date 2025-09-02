import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState } from '../types';
import { sendEmailOTP, verifyEmailOTP, signUp, loginWithGoogle } from "../api/authApi";
import { UserCreate, User } from "../types/user";

interface AuthContextType extends AuthState {
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, otp: string) => Promise<boolean>;
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

  const handleVerifyOTP = async (email: string, otp: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await verifyEmailOTP(email, otp);
      if (success) {
        const authenticatedUser: User = {
          id: '1',
          email,
          name: email.split('@')[0],
        };
        setUser(authenticatedUser);
        localStorage.setItem('user', JSON.stringify(authenticatedUser));
      }
      return success;
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
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
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
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    sendEmailOTP: handleSendOTP,
    verifyEmailOTP: handleVerifyOTP,
    signUp: handleSignUp,
    loginWithGoogle: handleGoogleLogin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};