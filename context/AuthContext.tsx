
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  cancelVerification: () => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  verificationPendingEmail: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default Admin User Configuration
const ADMIN_USER = {
  id: 'admin_root_001',
  username: 'Admin',
  email: '5ide4ustle5ales@gmail.com',
  password: 'admin',
  isVerified: true,
  verificationCode: null,
  joinedAt: new Date().toISOString(),
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
  bio: 'System Administrator'
};

// Mock database helper
const getStoredUsers = (): any[] => {
    const stored = localStorage.getItem('arcade_users');
    const users = stored ? JSON.parse(stored) : [];
    
    // Ensure Admin user exists
    if (!users.find((u: any) => u.email === ADMIN_USER.email)) {
        users.push(ADMIN_USER);
        localStorage.setItem('arcade_users', JSON.stringify(users));
    }
    
    return users;
};

const saveStoredUsers = (users: any[]) => localStorage.setItem('arcade_users', JSON.stringify(users));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check for active session
    const sessionUser = localStorage.getItem('arcade_session');
    if (sessionUser) {
      setUser(JSON.parse(sessionUser));
    } else {
        // Initialize DB on load to ensure Admin exists even if no session
        getStoredUsers();
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const users = getStoredUsers();
    
    // Check if identifier matches email OR username
    const foundUser = users.find(u => 
        (u.email.toLowerCase() === identifier.toLowerCase() || u.username.toLowerCase() === identifier.toLowerCase()) && 
        u.password === password
    );

    if (!foundUser) {
      setIsLoading(false);
      throw new Error('Invalid username/email or password');
    }

    if (!foundUser.isVerified) {
      setIsLoading(false);
      setVerificationPendingEmail(foundUser.email);
      throw new Error('Account not verified. Please check your email.');
    }

    const { password: _, verificationCode: __, ...safeUser } = foundUser;
    setUser(safeUser);
    localStorage.setItem('arcade_session', JSON.stringify(safeUser));
    setIsLoading(false);
  };

  const loginAsGuest = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    const guestUser: User = {
      id: `guest_${Date.now()}`,
      username: 'Guest Player',
      email: '',
      isVerified: true, // Guests are implicitly verified to play
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      bio: 'Just passing through...',
      joinedAt: new Date().toISOString(),
      isGuest: true
    };

    setUser(guestUser);
    localStorage.setItem('arcade_session', JSON.stringify(guestUser));
    setIsLoading(false);
  };

  const signup = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const users = getStoredUsers();
    
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      setIsLoading(false);
      throw new Error('Email already exists');
    }

    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        setIsLoading(false);
        throw new Error('Username already taken');
    }

    // Generate a mock 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In a real app, this would send an email. Here we log it.
    console.log(`%c[Email Service] Verification code for ${email}: ${verificationCode}`, "color: #4ade80; font-weight: bold; font-size: 14px;");
    
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password,
      isVerified: false,
      verificationCode,
      joinedAt: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: 'Ready to play!'
    };

    users.push(newUser);
    saveStoredUsers(users);
    setVerificationPendingEmail(email);
    setIsLoading(false);
  };

  const verifyEmail = async (email: string, code: string): Promise<boolean> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      setIsLoading(false);
      throw new Error('User not found');
    }

    if (users[userIndex].verificationCode === code) {
      users[userIndex].isVerified = true;
      users[userIndex].verificationCode = null; // Clear code
      saveStoredUsers(users);
      
      // Auto login
      const { password: _, ...safeUser } = users[userIndex];
      setUser(safeUser);
      localStorage.setItem('arcade_session', JSON.stringify(safeUser));
      
      setVerificationPendingEmail(null);
      setIsLoading(false);
      return true;
    }

    setIsLoading(false);
    return false;
  };

  const cancelVerification = () => {
      setVerificationPendingEmail(null);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('arcade_session');
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('arcade_session', JSON.stringify(updatedUser));

    // Update DB only if not guest (guests are not in DB)
    if (!user.isGuest) {
        const users = getStoredUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
        users[idx] = { ...users[idx], ...data };
        saveStoredUsers(users);
        }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      loginAsGuest,
      signup, 
      verifyEmail,
      cancelVerification,
      logout, 
      updateProfile,
      verificationPendingEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
