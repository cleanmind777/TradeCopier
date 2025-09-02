import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { sendEmailOTP, verifyEmailOTP, signUp } from "../api/authApi";
import { UserCreate } from "../types/user";

interface AuthContextType extends AuthState {
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, otp: string) => Promise<boolean>;
  signUp: (userInfo: UserCreate) => Promise<boolean>;
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
    // Check for existing session on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleSendOTP = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await sendEmailOTP(email);
      return success;
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
        // Create user session on successful OTP verification
        const authenticatedUser: User = {
          id: '1', // Replace with actual user ID from API response
          email,
          name: email.split('@')[0], // Default name from email
        };
        setUser(authenticatedUser);
        localStorage.setItem('user', JSON.stringify(authenticatedUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (userInfo: UserCreate): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await signUp(userInfo);
      return success;
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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};